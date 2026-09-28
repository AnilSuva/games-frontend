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

      const result = roomManager.createRoom(
        connection.playerId,
        message.payload.gameId,
        {
          maxPlayers: message.payload.maxPlayers,
          displayName: message.payload.displayName,
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

      const result = roomManager.joinRoom(
        message.payload.roomCode,
        connection.playerId,
        message.payload.displayName
      );

      if (!result.success) {
        connection.sendError(result.code, result.message, message.requestId);
        return;
      }

      const { room, reconnectToken } = result.data;
      logger.info({ roomId: room.id, roomCode: room.code, playerId: connection.playerId }, "Player joined room");

      // If room became full and game state not yet initialized, initialize authoritative game state
      if (room.isFull() && !room.gameState) {
        const host = Array.from(room.players.values()).find((p) => p.seat === 0);
        const guest = Array.from(room.players.values()).find((p) => p.seat === 1);
        const adapter = gameRegistry.get(room.gameId);
        if (adapter && host && guest) {
          room.gameState = adapter.createInitialState({
            hostPlayerId: host.playerId,
            guestPlayerId: guest.playerId,
            startingPlayer: "X",
          });
        }
      }

      // Send join response to current player
      connection.send<RoomJoinedPayload>({
        version: PROTOCOL_VERSION,
        type: "room.joined",
        requestId: message.requestId,
        payload: {
          room: room.toDto(),
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
            room: room.toDto(),
            reason: "player_joined",
          },
        },
        connectionTracker,
        connection.playerId
      );

      // If game state is active, broadcast game.state to all players
      if (room.gameState) {
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

      const { room, destroyed } = leaveResult;
      connection.send<RoomLeftPayload>({
        version: PROTOCOL_VERSION,
        type: "room.left",
        requestId: message.requestId,
        payload: {
          roomId: room.id,
        },
      });

      if (!destroyed) {
        broadcastToRoom<RoomUpdatedPayload>(
          room,
          {
            version: PROTOCOL_VERSION,
            type: "room.updated",
            payload: {
              room: room.toDto(),
              reason: "player_left",
            },
          },
          connectionTracker
        );
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
        connection.send<GameStatePayload>({
          version: PROTOCOL_VERSION,
          type: "game.state",
          payload: {
            roomId: room.id,
            version: room.version,
            gameState: room.gameState,
          },
        });
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

      const validation = adapter.validateAction(
        room.gameState,
        { type: "MOVE", position: message.payload.position },
        connection.playerId
      );

      if (!validation.valid) {
        const errorCode: ErrorCode =
          validation.error === "It is not your turn"
            ? "NOT_YOUR_TURN"
            : validation.error === "Invalid move position"
            ? "INVALID_MOVE"
            : validation.error === "Game is not in progress"
            ? "GAME_NOT_IN_PROGRESS"
            : "INVALID_MESSAGE";
        connection.sendError(errorCode, validation.error ?? "Invalid move", message.requestId);
        return;
      }

      const actionResult = adapter.applyAction(
        room.gameState,
        { type: "MOVE", position: message.payload.position },
        connection.playerId
      );

      room.gameState = actionResult.nextState;
      const nextState = actionResult.nextState as { status?: string };
      if (nextState.status === "won" || nextState.status === "draw") {
        room.status = "completed";
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
  }
}
