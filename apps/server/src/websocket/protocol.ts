import type { FastifyBaseLogger } from "fastify";
import { PROTOCOL_VERSION } from "../config/constants.js";
import type { InMemorySessionStore } from "../auth/session.js";
import { createDefaultGameRegistry, type GameAdapterRegistry } from "../games/index.js";
import type { Room } from "../rooms/Room.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import type {
  ErrorCode,
  GameStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomUpdatedPayload,
  ServerEnvelope,
  ServerPongPayload,
  SessionReadyPayload,
} from "../types/index.js";
import type { ValidatedClientMessage } from "../validation/messages.js";
import type { ConnectionTracker, PlayerConnection } from "./connection.js";

const defaultGameRegistry = createDefaultGameRegistry();

export interface ProtocolHandlerDependencies {
  sessionStore: InMemorySessionStore;
  roomManager: RoomManager;
  connectionTracker: ConnectionTracker;
  logger: FastifyBaseLogger;
  gameRegistry?: GameAdapterRegistry;
}

export function broadcastToRoom<T>(
  room: Room,
  envelope: ServerEnvelope<T>,
  connectionTracker: ConnectionTracker,
  excludePlayerId?: string
): void {
  for (const player of room.players.values()) {
    if (excludePlayerId && player.playerId === excludePlayerId) {
      continue;
    }
    if (!player.connected) {
      continue;
    }
    const connection = connectionTracker.getByPlayerId(player.playerId);
    if (connection) {
      connection.send(envelope);
    }
  }
}

export function broadcastGameState(
  room: Room,
  connectionTracker: ConnectionTracker,
  gameRegistry: GameAdapterRegistry,
  excludePlayerId?: string
): void {
  if (!room.gameState) return;
  const adapter = gameRegistry.get(room.gameId);

  if (adapter?.projectStateForPlayer) {
    for (const player of room.players.values()) {
      if (excludePlayerId && player.playerId === excludePlayerId) {
        continue;
      }
      if (!player.connected) {
        continue;
      }
      const connection = connectionTracker.getByPlayerId(player.playerId);
      if (connection) {
        connection.send<GameStatePayload>({
          version: PROTOCOL_VERSION,
          type: "game.state",
          payload: {
            roomId: room.id,
            version: room.version,
            gameState: adapter.projectStateForPlayer(room.gameState, player.playerId),
          },
        });
      }
    }
    return;
  }

  broadcastToRoom<GameStatePayload>(
    room,
    {
      version: PROTOCOL_VERSION,
      type: "game.state",
      payload: {
        roomId: room.id,
        version: room.version,
        gameState: room.gameState,
      },
    },
    connectionTracker,
    excludePlayerId
  );
}

export function getSafeRoomDto(room: Room, gameRegistry: GameAdapterRegistry) {
  const adapter = gameRegistry.get(room.gameId);
  if (adapter?.projectStateForPlayer) {
    return room.toDto(undefined);
  }
  return room.toDto();
}

export function scheduleRoomTurnTimer(
  room: Room,
  roomManager: RoomManager,
  connectionTracker: ConnectionTracker,
  gameRegistry: GameAdapterRegistry
): void {
  roomManager.scheduleTurnTimer(room.id, (timedOutRoom, kickedPlayerId) => {
    const adapter = gameRegistry.get(timedOutRoom.gameId);
    if (!adapter?.handleImmediateRemove || !timedOutRoom.gameState) {
      return;
    }

    const removeRes = adapter.handleImmediateRemove(
      timedOutRoom.gameState,
      kickedPlayerId,
      "afk_timeout"
    );
    timedOutRoom.gameState = removeRes.nextState;
    if (removeRes.isCompleted) {
      timedOutRoom.status = "completed";
    }
    timedOutRoom.touch();

    const kickedEvent = {
      type: "player_kicked_afk",
      reason: "afk_timeout",
      playerId: kickedPlayerId,
    };

    const kickedConn = connectionTracker.getByPlayerId(kickedPlayerId);
    if (kickedConn) {
      kickedConn.send({
        version: PROTOCOL_VERSION,
        type: "game.event",
        payload: kickedEvent,
      });
      kickedConn.send<RoomLeftPayload>({
        version: PROTOCOL_VERSION,
        type: "room.left",
        payload: {
          roomId: timedOutRoom.id,
          reason: "afk_timeout",
        },
      });
    }

    const kickResult = roomManager.kickPlayerFromRoom(kickedPlayerId, timedOutRoom.id);
    if (kickResult.destroyed) {
      return;
    }

    const eventsToBroadcast =
      removeRes.events && removeRes.events.length > 0 ? removeRes.events : [kickedEvent];
    for (const ev of eventsToBroadcast) {
      broadcastToRoom(
        timedOutRoom,
        {
          version: PROTOCOL_VERSION,
          type: "game.event",
          payload: ev,
        },
        connectionTracker
      );
    }

    broadcastToRoom<RoomUpdatedPayload>(
      timedOutRoom,
      {
        version: PROTOCOL_VERSION,
        type: "room.updated",
        payload: {
          room: getSafeRoomDto(timedOutRoom, gameRegistry),
          reason: "player_kicked_afk",
        },
      },
      connectionTracker
    );

    if (timedOutRoom.gameState) {
      broadcastGameState(timedOutRoom, connectionTracker, gameRegistry);
    }

    if (timedOutRoom.status === "in-progress") {
      scheduleRoomTurnTimer(timedOutRoom, roomManager, connectionTracker, gameRegistry);
    }
  });
}

export async function handleClientMessage(
  connection: PlayerConnection,
  message: ValidatedClientMessage,
  deps: ProtocolHandlerDependencies
): Promise<void> {
  const { sessionStore, roomManager, connectionTracker, logger } = deps;
  const gameRegistry = deps.gameRegistry ?? defaultGameRegistry;

  switch (message.type) {
    case "session.identify": {
      let session = message.payload.sessionToken
        ? sessionStore.getSession(message.payload.sessionToken)
        : undefined;

      if (!session) {
        session = sessionStore.createSession(message.payload.displayName);
      } else {
        sessionStore.touchSession(session.sessionToken);
        if (message.payload.displayName) {
          session.displayName = message.payload.displayName;
        }
      }

      connection.playerId = session.playerId;
      connection.sessionToken = session.sessionToken;
      connectionTracker.bindPlayerId(connection.connectionId, session.playerId);

      logger.info({ playerId: session.playerId, connectionId: connection.connectionId }, "Session identified and ready");

      connection.send<SessionReadyPayload>({
        version: PROTOCOL_VERSION,
        type: "session.ready",
        requestId: message.requestId,
        payload: {
          playerId: session.playerId,
          sessionToken: session.sessionToken,
          displayName: session.displayName,
        },
      });
      break;
    }

    case "room.create": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before creating a room", message.requestId);
        return;
      }

      const sessionDisplayName = connection.sessionToken
        ? sessionStore.getSession(connection.sessionToken)?.displayName
        : undefined;

      const result = roomManager.createRoom(
        connection.playerId,
        message.payload.gameId,
        {
          maxPlayers: message.payload.maxPlayers,
          displayName: message.payload.displayName ?? sessionDisplayName,
          settings: message.payload.settings,
        }
      );

      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room, reconnectToken } = result.data;
      logger.info({ roomId: room.id, roomCode: room.code, gameId: room.gameId }, "Room created");

      connection.send<RoomCreatedPayload>({
        version: PROTOCOL_VERSION,
        type: "room.created",
        requestId: message.requestId,
        payload: {
          room: room.toDto(),
          reconnectToken,
        },
      });
      break;
    }

    case "room.join": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before joining a room", message.requestId);
        return;
      }

      const sessionDisplayName = connection.sessionToken
        ? sessionStore.getSession(connection.sessionToken)?.displayName
        : undefined;

      const result = roomManager.joinRoom(
        message.payload.roomCode,
        connection.playerId,
        message.payload.displayName ?? sessionDisplayName
      );

      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room, reconnectToken } = result.data;
      logger.info({ roomId: room.id, roomCode: room.code, playerId: connection.playerId }, "Player joined room");

      // If room became full (and auto-start is enabled) and game state not yet initialized, initialize authoritative game state
      if (!room.manualStart && room.isFull() && !room.gameState) {
        const host = Array.from(room.players.values()).find((p) => p.seat === 0);
        const guest = Array.from(room.players.values()).find((p) => p.seat === 1);
        const adapter = gameRegistry.get(room.gameId);
        if (adapter && host && guest) {
          room.gameState = adapter.createInitialState({
            hostPlayerId: host.playerId,
            guestPlayerId: guest.playerId,
          });
        }
      }

      // Send join response to current player
      connection.send<RoomJoinedPayload>({
        version: PROTOCOL_VERSION,
        type: "room.joined",
        requestId: message.requestId,
        payload: {
          room: getSafeRoomDto(room, gameRegistry),
          reconnectToken,
        },
      });

      // Broadcast room.updated to other players in room
      broadcastToRoom<RoomUpdatedPayload>(
        room,
        {
          version: PROTOCOL_VERSION,
          type: "room.updated",
          payload: {
            room: getSafeRoomDto(room, gameRegistry),
            reason: "player_joined",
          },
        },
        connectionTracker,
        connection.playerId
      );

      // If game state is active, broadcast game.state to all players
      if (room.gameState) {
        logger.info({ roomId: room.id, roomCode: room.code }, "Broadcasting authoritative game.state to room players");
        broadcastGameState(room, connectionTracker, gameRegistry);
      }
      break;
    }

    case "room.update_settings":
    case "update_room_settings": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before updating settings", message.requestId);
        return;
      }

      const targetRoomId =
        message.payload.roomId ?? roomManager.getPlayerRoom(connection.playerId)?.id;
      if (!targetRoomId) {
        connection.sendError("NOT_IN_ROOM", "Player is not in any room", message.requestId);
        return;
      }

      const result = roomManager.updateRoomSettings(
        targetRoomId,
        connection.playerId,
        message.payload.settings
      );

      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room } = result.data;
      broadcastToRoom<RoomUpdatedPayload>(
        room,
        {
          version: PROTOCOL_VERSION,
          type: "room.updated",
          requestId: message.requestId,
          payload: {
            room: getSafeRoomDto(room, gameRegistry),
            reason: "settings_updated",
          },
        },
        connectionTracker
      );
      break;
    }

    case "room.start":
    case "start_game": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before starting game", message.requestId);
        return;
      }

      const targetRoomId =
        message.payload.roomId ?? roomManager.getPlayerRoom(connection.playerId)?.id;
      if (!targetRoomId) {
        connection.sendError("NOT_IN_ROOM", "Player is not in any room", message.requestId);
        return;
      }

      const result = roomManager.startGame(targetRoomId, connection.playerId);
      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room } = result.data;
      broadcastToRoom<RoomUpdatedPayload>(
        room,
        {
          version: PROTOCOL_VERSION,
          type: "room.updated",
          requestId: message.requestId,
          payload: {
            room: getSafeRoomDto(room, gameRegistry),
            reason: "game_started",
          },
        },
        connectionTracker
      );

      if (room.gameState) {
        broadcastGameState(room, connectionTracker, gameRegistry);
      }

      scheduleRoomTurnTimer(room, roomManager, connectionTracker, gameRegistry);
      break;
    }

    case "room.leave": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before leaving a room", message.requestId);
        return;
      }

      const leaveResult = roomManager.leaveRoom(connection.playerId, message.payload.roomId);
      if (!leaveResult.room) {
        connection.sendError("NOT_IN_ROOM", "Player is not currently in any room", message.requestId);
        return;
      }

      const { room, destroyed, events } = leaveResult;
      connection.send<RoomLeftPayload>({
        version: PROTOCOL_VERSION,
        type: "room.left",
        requestId: message.requestId,
        payload: {
          roomId: room.id,
        },
      });

      if (!destroyed) {
        if (events && events.length > 0) {
          for (const ev of events) {
            broadcastToRoom(
              room,
              {
                version: PROTOCOL_VERSION,
                type: "game.event",
                payload: ev,
              },
              connectionTracker
            );
          }
        }

        broadcastToRoom<RoomUpdatedPayload>(
          room,
          {
            version: PROTOCOL_VERSION,
            type: "room.updated",
            payload: {
              room: getSafeRoomDto(room, gameRegistry),
              reason: "player_left",
            },
          },
          connectionTracker
        );

        if (room.gameState && gameRegistry.get(room.gameId)?.disconnectPolicy === "remove_immediately") {
          broadcastGameState(room, connectionTracker, gameRegistry);
          if (room.status === "in-progress") {
            scheduleRoomTurnTimer(room, roomManager, connectionTracker, gameRegistry);
          }
        }
      }
      break;
    }

    case "room.reconnect": {
      const result = roomManager.reconnectPlayer(
        message.payload.roomCode,
        message.payload.reconnectToken
      );

      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room, playerId, reconnectToken } = result.data;
      connection.playerId = playerId;
      connectionTracker.bindPlayerId(connection.connectionId, playerId);

      connection.send<RoomJoinedPayload>({
        version: PROTOCOL_VERSION,
        type: "room.joined",
        requestId: message.requestId,
        payload: {
          room: room.toDto(),
          reconnectToken,
        },
      });

      broadcastToRoom<RoomUpdatedPayload>(
        room,
        {
          version: PROTOCOL_VERSION,
          type: "room.updated",
          payload: {
            room: room.toDto(),
            reason: "player_reconnected",
          },
        },
        connectionTracker,
        playerId
      );

      if (room.gameState) {
        broadcastGameState(room, connectionTracker, gameRegistry);
      }
      break;
    }

    case "ping": {
      connection.send<ServerPongPayload>({
        version: PROTOCOL_VERSION,
        type: "server.pong",
        requestId: message.requestId,
        payload: {
          serverTime: Date.now(),
          clientTime: message.payload.clientTime,
        },
      });
      break;
    }

    case "game.move": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before making a move", message.requestId);
        return;
      }

      const room = roomManager.getRoomById(message.payload.roomId);
      if (!room || !room.players.has(connection.playerId)) {
        connection.sendError("NOT_IN_ROOM", "Player is not in the specified room", message.requestId);
        return;
      }

      if (room.status !== "in-progress" || !room.gameState) {
        connection.sendError("GAME_NOT_IN_PROGRESS", "Game is not currently active", message.requestId);
        return;
      }

      const adapter = gameRegistry.get(room.gameId);
      if (!adapter) {
        connection.sendError("INTERNAL_ERROR", `No game adapter registered for ${room.gameId}`, message.requestId);
        return;
      }

      const moveAction =
        message.payload.action !== undefined
          ? message.payload.action
          : room.gameId === "wall-maze" &&
            message.payload.row !== undefined &&
            message.payload.col !== undefined &&
            message.payload.orientation !== undefined
          ? {
              type: "PLACE_WALL" as const,
              row: message.payload.row,
              col: message.payload.col,
              orientation: message.payload.orientation,
            }
          : room.gameId === "wall-maze" &&
            message.payload.row !== undefined &&
            message.payload.col !== undefined
          ? {
              type: "MOVE_PAWN" as const,
              row: message.payload.row,
              col: message.payload.col,
            }
          : message.payload.from !== undefined && message.payload.to !== undefined
          ? { type: "MOVE", from: message.payload.from, to: message.payload.to }
          : message.payload.column !== undefined
          ? { type: "MOVE", column: message.payload.column }
          : message.payload.edge !== undefined
          ? { type: "CLAIM_EDGE", edge: message.payload.edge }
          : message.payload.shot !== undefined
          ? { type: "MOVE", shot: message.payload.shot }
          : message.payload.row !== undefined && message.payload.col !== undefined
          ? { type: "PLACE_ORB", row: message.payload.row, col: message.payload.col }
          : { type: "MOVE", position: message.payload.position };

      const validation = adapter.validateAction(
        room.gameState,
        moveAction,
        connection.playerId
      );

      if (!validation.valid) {
        const errorCode: ErrorCode =
          validation.error === "It is not your turn"
            ? "NOT_YOUR_TURN"
            : validation.error === "Invalid move position" ||
              validation.error === "Invalid column" ||
              validation.error === "Column is full" ||
              validation.error?.startsWith("Invalid move:") ||
              validation.error?.startsWith("Invalid wall:") ||
              validation.error?.includes("paused")
            ? "INVALID_MOVE"
            : validation.error === "Game is not in progress"
            ? "GAME_NOT_IN_PROGRESS"
            : "INVALID_MESSAGE";
        connection.sendError(errorCode, validation.error ?? "Invalid move", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        moveAction,
        connection.playerId
      );

      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (
        nextState.status === "won" ||
        nextState.status === "draw" ||
        nextState.status === "finished"
      ) {
        room.status = "completed";
        roomManager.clearTurnTimer(room.id);
      } else {
        scheduleRoomTurnTimer(room, roomManager, connectionTracker, gameRegistry);
      }

      room.incrementVersion();

      if (actionResult.events && actionResult.events.length > 0) {
        for (const ev of actionResult.events) {
          broadcastToRoom(
            room,
            {
              version: PROTOCOL_VERSION,
              type: "game.event",
              payload: ev,
            },
            connectionTracker
          );
        }
      }

      broadcastGameState(room, connectionTracker, gameRegistry);
      break;
    }

    case "game.rematch": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before requesting rematch", message.requestId);
        return;
      }

      const room = roomManager.getRoomById(message.payload.roomId);
      if (!room || !room.players.has(connection.playerId)) {
        connection.sendError("NOT_IN_ROOM", "Player is not in the specified room", message.requestId);
        return;
      }

      if (!room.gameState) {
        connection.sendError("GAME_NOT_IN_PROGRESS", "No active game in room", message.requestId);
        return;
      }

      const adapter = gameRegistry.get(room.gameId);
      if (!adapter) {
        connection.sendError("INTERNAL_ERROR", `No game adapter registered for ${room.gameId}`, message.requestId);
        return;
      }

      const validation = adapter.validateAction(
        room.gameState,
        { type: "REMATCH" },
        connection.playerId
      );

      if (!validation.valid) {
        const errorCode: ErrorCode =
          validation.error === "Game is still in progress"
            ? "GAME_NOT_OVER"
            : "INVALID_MESSAGE";
        connection.sendError(errorCode, validation.error ?? "Invalid rematch request", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        { type: "REMATCH" },
        connection.playerId
      );

      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (nextState.status === "in_progress") {
        room.status = "in-progress";
      }

      room.incrementVersion();

      broadcastToRoom<GameStatePayload>(
        room,
        {
          version: PROTOCOL_VERSION,
          type: "game.state",
          payload: {
            roomId: room.id,
            version: room.version,
            gameState: room.gameState,
          },
        },
        connectionTracker
      );
      break;
    }

    case "game.input": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before sending input", message.requestId);
        return;
      }

      const room = roomManager.getRoomById(message.payload.roomId);
      if (!room || !room.players.has(connection.playerId)) {
        connection.sendError("NOT_IN_ROOM", "Player is not in the specified room", message.requestId);
        return;
      }

      if (room.status !== "in-progress" || !room.gameState) {
        connection.sendError("GAME_NOT_IN_PROGRESS", "Game is not currently active", message.requestId);
        return;
      }

      const adapter = gameRegistry.get(room.gameId);
      if (!adapter) {
        connection.sendError("INTERNAL_ERROR", `No game adapter registered for ${room.gameId}`, message.requestId);
        return;
      }

      const action = {
        type: "INPUT",
        input: message.payload.input,
        data: message.payload.data,
      };

      const validation = adapter.validateAction(
        room.gameState,
        action,
        connection.playerId
      );

      if (!validation.valid) {
        connection.sendError("INVALID_MOVE", validation.error ?? "Invalid input", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        action,
        connection.playerId
      );

      const stateChanged = actionResult.nextState !== room.gameState;
      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (nextState.status === "won" || nextState.status === "draw") {
        room.status = "completed";
      }

      room.incrementVersion();

      if (actionResult.events && actionResult.events.length > 0) {
        for (const ev of actionResult.events) {
          broadcastToRoom(
            room,
            {
              version: PROTOCOL_VERSION,
              type: "game.event",
              payload: ev,
            },
            connectionTracker
          );
        }
      } else {
        // Forward player input to opponent(s)
        broadcastToRoom(
          room,
          {
            version: PROTOCOL_VERSION,
            type: "game.event",
            payload: {
              type: "player_input",
              playerId: connection.playerId,
              input: message.payload.input,
              data: message.payload.data,
            },
          },
          connectionTracker,
          connection.playerId
        );
      }

      if (stateChanged) {
        broadcastToRoom<GameStatePayload>(
          room,
          {
            version: PROTOCOL_VERSION,
            type: "game.state",
            payload: {
              roomId: room.id,
              version: room.version,
              gameState: room.gameState,
            },
          },
          connectionTracker
        );
      }
      break;
    }

    case "game.event": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before sending event", message.requestId);
        return;
      }

      const room = roomManager.getRoomById(message.payload.roomId);
      if (!room || !room.players.has(connection.playerId)) {
        connection.sendError("NOT_IN_ROOM", "Player is not in the specified room", message.requestId);
        return;
      }

      if (room.status !== "in-progress" || !room.gameState) {
        connection.sendError("GAME_NOT_IN_PROGRESS", "Game is not currently active", message.requestId);
        return;
      }

      const adapter = gameRegistry.get(room.gameId);
      if (!adapter) {
        connection.sendError("INTERNAL_ERROR", `No game adapter registered for ${room.gameId}`, message.requestId);
        return;
      }

      const action = {
        type: "EVENT",
        event: message.payload.event,
        data: message.payload.data,
      };

      const validation = adapter.validateAction(
        room.gameState,
        action,
        connection.playerId
      );

      if (!validation.valid) {
        connection.sendError("INVALID_MOVE", validation.error ?? "Invalid event", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        action,
        connection.playerId
      );

      const stateChanged = actionResult.nextState !== room.gameState;
      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (nextState.status === "won" || nextState.status === "draw") {
        room.status = "completed";
      }

      if (actionResult.events && actionResult.events.length > 0) {
        for (const ev of actionResult.events) {
          broadcastToRoom(
            room,
            {
              version: PROTOCOL_VERSION,
              type: "game.event",
              payload: ev,
            },
            connectionTracker,
            connection.playerId
          );
        }
      }

      if (stateChanged) {
        room.incrementVersion();
        broadcastToRoom<GameStatePayload>(
          room,
          {
            version: PROTOCOL_VERSION,
            type: "game.state",
            payload: {
              roomId: room.id,
              version: room.version,
              gameState: room.gameState,
            },
          },
          connectionTracker
        );
      }
      break;
    }

    case "game.shot": {
      if (!connection.playerId) {
        connection.sendError("UNAUTHORIZED", "Must identify session before taking a shot", message.requestId);
        return;
      }

      const room = roomManager.getRoomById(message.payload.roomId);
      if (!room || !room.players.has(connection.playerId)) {
        connection.sendError("NOT_IN_ROOM", "Player is not in the specified room", message.requestId);
        return;
      }

      if (room.status !== "in-progress" || !room.gameState) {
        connection.sendError("GAME_NOT_IN_PROGRESS", "Game is not currently active", message.requestId);
        return;
      }

      const adapter = gameRegistry.get(room.gameId);
      if (!adapter) {
        connection.sendError("INTERNAL_ERROR", `No game adapter registered for ${room.gameId}`, message.requestId);
        return;
      }

      const shotAction = {
        type: "SHOT" as const,
        aim: message.payload.aim,
        power: message.payload.power,
        seq: message.payload.seq,
      };

      const validation = adapter.validateAction(
        room.gameState,
        shotAction,
        connection.playerId
      );

      if (!validation.valid) {
        const errorCode: ErrorCode =
          validation.error === "It is not your turn"
            ? "NOT_YOUR_TURN"
            : validation.error === "Game is not in progress"
            ? "GAME_NOT_IN_PROGRESS"
            : "INVALID_MOVE";
        connection.sendError(errorCode, validation.error ?? "Invalid shot", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        shotAction,
        connection.playerId
      );

      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (
        nextState.status === "won" ||
        nextState.status === "draw" ||
        nextState.status === "finished"
      ) {
        room.status = "completed";
        roomManager.clearTurnTimer(room.id);
      } else {
        scheduleRoomTurnTimer(room, roomManager, connectionTracker, gameRegistry);
      }

      room.incrementVersion();

      if (actionResult.events && actionResult.events.length > 0) {
        for (const ev of actionResult.events) {
          broadcastToRoom(
            room,
            {
              version: PROTOCOL_VERSION,
              type: "game.event",
              payload: ev,
            },
            connectionTracker
          );
        }
      }

      broadcastGameState(room, connectionTracker, gameRegistry);
      break;
    }
  }
}
