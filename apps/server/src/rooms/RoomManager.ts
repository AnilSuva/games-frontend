import crypto from "node:crypto";
import { DEFAULT_MAX_PLAYERS, MAX_ALLOWED_PLAYERS } from "../config/constants.js";
import { generateReconnectToken, generateRoomCode } from "../auth/identity.js";
import type { ErrorCode } from "../types/index.js";
import type { GameAdapterRegistry } from "../games/GameAdapter.js";
import { Room } from "./Room.js";
import { ReconnectManager } from "./reconnect.js";

export type RoomResult<T> =
  | { success: true; data: T }
  | { success: false; code: ErrorCode; message: string };

export class RoomManager {
  private roomsById = new Map<string, Room>();
  private roomsByCode = new Map<string, Room>();
  private playerToRoomId = new Map<string, string>();
  private reconnectManager = new ReconnectManager();
  private turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly disconnectGracePeriodMs: number = 30_000,
    private readonly gameRegistry?: GameAdapterRegistry
  ) {}

  public getRoomById(roomId: string): Room | undefined {
    return this.roomsById.get(roomId);
  }

  public getRoomByCode(code: string): Room | undefined {
    return this.roomsByCode.get(code.trim().toUpperCase());
  }

  public getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerToRoomId.get(playerId);
    return roomId ? this.roomsById.get(roomId) : undefined;
  }

  public createRoom(
    hostPlayerId: string,
    gameId: string,
    options?: { maxPlayers?: number; displayName?: string; settings?: Record<string, unknown> }
  ): RoomResult<{ room: Room; reconnectToken: string }> {
    // If player is already in another room, leave it first
    const existingRoomId = this.playerToRoomId.get(hostPlayerId);
    if (existingRoomId) {
      this.leaveRoom(hostPlayerId, existingRoomId);
    }

    const adapter = this.gameRegistry?.get(gameId);
    const minPlayers = adapter?.minPlayers ?? 2;
    const adapterMaxPlayers = adapter?.maxPlayers ?? MAX_ALLOWED_PLAYERS;
    const manualStart = adapter?.manualStart ?? false;

    let settings: Record<string, unknown> = adapter?.defaultSettings
      ? { ...adapter.defaultSettings }
      : {};

    if (options?.settings) {
      const merged = { ...settings, ...options.settings };
      if (adapter?.validateSettings) {
        const res = adapter.validateSettings(merged);
        if (!res.valid) {
          return {
            success: false,
            code: "INVALID_MESSAGE",
            message: res.error ?? "Invalid room settings",
          };
        }
        settings = res.normalized ?? merged;
      } else {
        settings = merged;
      }
    }

    const requestedMax =
      typeof settings.maxPlayers === "number"
        ? settings.maxPlayers
        : options?.maxPlayers ?? adapter?.maxPlayers ?? DEFAULT_MAX_PLAYERS;

    const maxPlayers = Math.min(Math.max(requestedMax, minPlayers), adapterMaxPlayers);
    if (typeof settings.maxPlayers === "number") {
      settings.maxPlayers = maxPlayers;
    }

    const roomId = crypto.randomUUID();
    const roomCode = generateRoomCode((code) => this.roomsByCode.has(code));

    const room = new Room({
      id: roomId,
      code: roomCode,
      gameId,
      hostPlayerId,
      maxPlayers,
      minPlayers,
      manualStart,
      settings,
    });

    const reconnectToken = generateReconnectToken();
    room.addPlayer(hostPlayerId, reconnectToken, options?.displayName);

    this.roomsById.set(room.id, room);
    this.roomsByCode.set(room.code, room);
    this.playerToRoomId.set(hostPlayerId, room.id);
    this.reconnectManager.registerToken(reconnectToken, room.id, hostPlayerId);

    return {
      success: true,
      data: { room, reconnectToken },
    };
  }

  public joinRoom(
    roomCode: string,
    playerId: string,
    displayName?: string
  ): RoomResult<{ room: Room; reconnectToken: string }> {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.roomsByCode.get(normalizedCode);

    if (!room) {
      return {
        success: false,
        code: "ROOM_NOT_FOUND",
        message: `Room with code ${normalizedCode} does not exist`,
      };
    }

    // Check if player is already in this room
    if (room.players.has(playerId)) {
      const existingPlayer = room.players.get(playerId)!;
      return {
        success: true,
        data: { room, reconnectToken: existingPlayer.reconnectToken },
      };
    }

    if (room.isFull()) {
      return {
        success: false,
        code: "ROOM_FULL",
        message: "Room is already full",
      };
    }

    if (room.status !== "waiting") {
      return {
        success: false,
        code: "INVALID_ROOM_STATE",
        message: `Cannot join room in status '${room.status}'`,
      };
    }

    // If player is in another room, leave it
    const currentRoomId = this.playerToRoomId.get(playerId);
    if (currentRoomId && currentRoomId !== room.id) {
      this.leaveRoom(playerId, currentRoomId);
    }

    const reconnectToken = generateReconnectToken();
    room.addPlayer(playerId, reconnectToken, displayName);

    this.playerToRoomId.set(playerId, room.id);
    this.reconnectManager.registerToken(reconnectToken, room.id, playerId);

    // If capacity reached and auto-start enabled, transition to in-progress
    if (!room.manualStart && room.isFull()) {
      room.status = "in-progress";
      room.touch();
    }

    return {
      success: true,
      data: { room, reconnectToken },
    };
  }

  public kickPlayerFromRoom(playerId: string, roomId: string): { room?: Room; destroyed: boolean } {
    const room = this.roomsById.get(roomId);
    if (!room) {
      this.playerToRoomId.delete(playerId);
      return { destroyed: false };
    }
    this.reconnectManager.cancelDisconnectCleanup(playerId);
    room.removePlayer(playerId);
    this.playerToRoomId.delete(playerId);

    if (room.isEmpty()) {
      this.removeRoom(room.id);
      return { room, destroyed: true };
    }
    return { room, destroyed: false };
  }

  public leaveRoom(
    playerId: string,
    roomId?: string
  ): { room?: Room; wasHost: boolean; destroyed: boolean; events?: unknown[] } {
    const targetRoomId = roomId ?? this.playerToRoomId.get(playerId);
    if (!targetRoomId) {
      return { wasHost: false, destroyed: false };
    }

    const room = this.roomsById.get(targetRoomId);
    if (!room) {
      this.playerToRoomId.delete(playerId);
      return { wasHost: false, destroyed: false };
    }

    this.reconnectManager.cancelDisconnectCleanup(playerId);
    const wasHost = room.hostPlayerId === playerId;
    const adapter = this.gameRegistry?.get(room.gameId);
    let events: unknown[] | undefined;

    if (
      adapter?.disconnectPolicy === "remove_immediately" &&
      room.status === "in-progress" &&
      adapter.handleImmediateRemove &&
      room.gameState
    ) {
      this.clearTurnTimer(room.id);
      const removeRes = adapter.handleImmediateRemove(room.gameState, playerId, "disconnected");
      room.gameState = removeRes.nextState;
      events = removeRes.events;
      if (removeRes.isCompleted) {
        room.status = "completed";
      }
    }

    room.removePlayer(playerId);
    this.playerToRoomId.delete(playerId);

    if (room.isEmpty()) {
      this.removeRoom(room.id);
      return { room, wasHost, destroyed: true, events };
    }

    return { room, wasHost, destroyed: false, events };
  }

  public updateRoomSettings(
    roomId: string,
    playerId: string,
    newSettings: Record<string, unknown>
  ): RoomResult<{ room: Room }> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.players.has(playerId)) {
      return {
        success: false,
        code: "NOT_IN_ROOM",
        message: "Player is not in the specified room",
      };
    }

    if (room.hostPlayerId !== playerId) {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Only the room host can update room settings",
      };
    }

    if (room.status !== "waiting") {
      return {
        success: false,
        code: "INVALID_ROOM_STATE",
        message: `Cannot update settings while room is '${room.status}'`,
      };
    }

    const adapter = this.gameRegistry?.get(room.gameId);
    const merged = { ...room.settings, ...newSettings };
    let normalized = merged;

    if (adapter?.validateSettings) {
      const validation = adapter.validateSettings(merged);
      if (!validation.valid) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          message: validation.error ?? "Invalid room settings",
        };
      }
      normalized = validation.normalized ?? merged;
    }

    if (typeof normalized.maxPlayers === "number") {
      if (normalized.maxPlayers < room.players.size) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          message: `Cannot set maxPlayers (${normalized.maxPlayers}) below current player count (${room.players.size})`,
        };
      }
      room.maxPlayers = normalized.maxPlayers;
    }

    room.settings = normalized;
    room.touch();
    return { success: true, data: { room } };
  }

  public startGame(roomId: string, playerId: string): RoomResult<{ room: Room }> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.players.has(playerId)) {
      return {
        success: false,
        code: "NOT_IN_ROOM",
        message: "Player is not in the specified room",
      };
    }

    if (room.hostPlayerId !== playerId) {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Only the room host can start the game",
      };
    }

    if (room.status !== "waiting") {
      return {
        success: false,
        code: "INVALID_ROOM_STATE",
        message: `Cannot start game while room is '${room.status}'`,
      };
    }

    if (room.players.size < room.minPlayers) {
      return {
        success: false,
        code: "INVALID_ROOM_STATE",
        message: `Need at least ${room.minPlayers} players to start`,
      };
    }

    const adapter = this.gameRegistry?.get(room.gameId);
    if (!adapter) {
      return {
        success: false,
        code: "INTERNAL_ERROR",
        message: `No game adapter registered for ${room.gameId}`,
      };
    }

    const orderedPlayers = Array.from(room.players.values()).sort((a, b) => a.seat - b.seat);
    room.gameState = adapter.createInitialState({
      hostPlayerId: room.hostPlayerId,
      guestPlayerId: orderedPlayers[1]?.playerId,
      players: orderedPlayers.map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        seat: p.seat,
      })),
      settings: room.settings,
    });
    room.status = "in-progress";
    room.touch();

    return { success: true, data: { room } };
  }

  public scheduleTurnTimer(
    roomId: string,
    onTimeout: (room: Room, activeActorId: string) => void
  ): void {
    this.clearTurnTimer(roomId);

    const room = this.roomsById.get(roomId);
    if (!room || room.status !== "in-progress" || !room.gameState) {
      return;
    }

    const adapter = this.gameRegistry?.get(room.gameId);
    if (!adapter?.getTurnDeadline) {
      return;
    }

    const deadlineInfo = adapter.getTurnDeadline(room.gameState);
    if (!deadlineInfo || !deadlineInfo.activeActorId || deadlineInfo.deadlineAt === null) {
      return;
    }

    const actorId = deadlineInfo.activeActorId;
    const delayMs = Math.max(0, deadlineInfo.deadlineAt - Date.now());

    const timer = setTimeout(() => {
      this.turnTimers.delete(roomId);
      const currentRoom = this.roomsById.get(roomId);
      if (!currentRoom || currentRoom.status !== "in-progress" || !currentRoom.gameState) {
        return;
      }
      const currentAdapter = this.gameRegistry?.get(currentRoom.gameId);
      const currentDeadline = currentAdapter?.getTurnDeadline?.(currentRoom.gameState);
      if (!currentDeadline || currentDeadline.activeActorId !== actorId) {
        return;
      }
      onTimeout(currentRoom, actorId);
    }, delayMs);

    if (timer.unref) {
      timer.unref();
    }

    this.turnTimers.set(roomId, timer);
  }

  public clearTurnTimer(roomId: string): void {
    const existing = this.turnTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(roomId);
    }
  }

  public handleDisconnect(
    playerId: string,
    onGraceExpired?: (room: Room, playerLeftId: string) => void
  ): {
    room?: Room;
    scheduled: boolean;
    removedImmediately?: boolean;
    destroyed?: boolean;
    events?: unknown[];
  } {
    const roomId = this.playerToRoomId.get(playerId);
    if (!roomId) {
      return { scheduled: false };
    }

    const room = this.roomsById.get(roomId);
    if (!room || !room.players.has(playerId)) {
      return { scheduled: false };
    }

    const adapter = this.gameRegistry?.get(room.gameId);

    if (adapter?.disconnectPolicy === "remove_immediately") {
      if (room.status === "waiting" || room.status === "completed" || room.status === "abandoned") {
        const leaveRes = this.leaveRoom(playerId, room.id);
        return {
          room: leaveRes.room,
          scheduled: false,
          removedImmediately: true,
          destroyed: leaveRes.destroyed,
        };
      }

      // Active match ("in-progress"): immediately remove player and update game state
      this.clearTurnTimer(room.id);
      let events: unknown[] | undefined;

      if (adapter.handleImmediateRemove && room.gameState) {
        const removeRes = adapter.handleImmediateRemove(room.gameState, playerId, "disconnected");
        room.gameState = removeRes.nextState;
        events = removeRes.events;
        if (removeRes.isCompleted) {
          room.status = "completed";
        }
      }

      room.removePlayer(playerId);
      this.playerToRoomId.delete(playerId);

      if (room.isEmpty()) {
        this.removeRoom(room.id);
        return {
          room,
          scheduled: false,
          removedImmediately: true,
          destroyed: true,
          events,
        };
      }

      room.touch();
      return {
        room,
        scheduled: false,
        removedImmediately: true,
        destroyed: false,
        events,
      };
    }

    room.markPlayerDisconnected(playerId);

    // If an active game is in progress, allow the game adapter to pause and record disconnect grace expiry
    if (adapter?.handlePlayerDisconnect && room.gameState) {
      room.gameState = adapter.handlePlayerDisconnect(
        room.gameState,
        playerId,
        Date.now() + this.disconnectGracePeriodMs
      );
      room.touch();
    } else {
      const activeGameState = room.gameState as Record<string, unknown> | undefined;
      if (activeGameState && activeGameState.status === "in_progress") {
        activeGameState.disconnectGraceExpiresAt = Date.now() + this.disconnectGracePeriodMs;
        activeGameState.disconnectedPlayerId = playerId;
        room.touch();
      }
    }

    this.reconnectManager.scheduleDisconnectCleanup(
      playerId,
      this.disconnectGracePeriodMs,
      () => {
        const currentRoom = this.roomsById.get(roomId);
        if (!currentRoom) return;

        const player = currentRoom.players.get(playerId);
        // Only trigger forfeit and remove if still disconnected
        if (player && !player.connected) {
          const currentAdapter = this.gameRegistry?.get(currentRoom.gameId);
          if (currentRoom.gameState) {
            const remainingPlayerIds = Array.from(currentRoom.players.values())
              .filter((p) => p.playerId !== playerId && p.connected)
              .map((p) => p.playerId);

            if (currentAdapter?.handleForfeit) {
              const forfeitOutcome = currentAdapter.handleForfeit(
                currentRoom.gameState,
                playerId,
                remainingPlayerIds
              );
              currentRoom.gameState = forfeitOutcome.nextState;
              if (forfeitOutcome.isCompleted) {
                currentRoom.status = "completed";
                currentRoom.touch();
              }
            }
          }

          currentRoom.removePlayer(playerId);
          this.playerToRoomId.delete(playerId);

          if (currentRoom.isEmpty()) {
            this.removeRoom(currentRoom.id);
          } else if (currentRoom.status !== "completed") {
            currentRoom.status = "abandoned";
            currentRoom.touch();
          }

          if (onGraceExpired) {
            onGraceExpired(currentRoom, playerId);
          }
        }
      }
    );

    return { room, scheduled: true };
  }

  public reconnectPlayer(
    roomCode: string,
    reconnectToken: string
  ): RoomResult<{ room: Room; playerId: string; reconnectToken: string }> {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.roomsByCode.get(normalizedCode);

    if (!room) {
      return {
        success: false,
        code: "ROOM_NOT_FOUND",
        message: `Room with code ${normalizedCode} does not exist`,
      };
    }

    const validation = this.reconnectManager.validateAndConsumeToken(reconnectToken, room.id);
    if (!validation.valid || !validation.playerId) {
      return {
        success: false,
        code: "RECONNECT_EXPIRED",
        message: "Reconnect token is invalid or has expired",
      };
    }

    const playerId = validation.playerId;
    this.reconnectManager.cancelDisconnectCleanup(playerId);

    const freshReconnectToken = generateReconnectToken();
    const reconnected = room.reconnectPlayer(playerId, freshReconnectToken);

    if (!reconnected) {
      return {
        success: false,
        code: "INVALID_SESSION",
        message: "Player was not found in room during reconnect",
      };
    }

    // Clear disconnect grace period on successful match reconnect via adapter or fallback
    const adapter = this.gameRegistry?.get(room.gameId);
    if (adapter?.handlePlayerReconnect && room.gameState) {
      room.gameState = adapter.handlePlayerReconnect(room.gameState, playerId);
      room.touch();
    } else {
      const activeGameState = room.gameState as Record<string, unknown> | undefined;
      if (activeGameState) {
        activeGameState.disconnectGraceExpiresAt = null;
        activeGameState.disconnectedPlayerId = null;
        room.touch();
      }
    }

    this.reconnectManager.registerToken(freshReconnectToken, room.id, playerId);
    this.playerToRoomId.set(playerId, room.id);

    return {
      success: true,
      data: {
        room,
        playerId,
        reconnectToken: freshReconnectToken,
      },
    };
  }

  public removeRoom(roomId: string): void {
    this.clearTurnTimer(roomId);
    const room = this.roomsById.get(roomId);
    if (room) {
      for (const playerId of room.players.keys()) {
        this.reconnectManager.cancelDisconnectCleanup(playerId);
        this.playerToRoomId.delete(playerId);
      }
      this.roomsByCode.delete(room.code);
      this.roomsById.delete(room.id);
    }
  }

  public cleanupStaleRooms(maxIdleMs: number): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [roomId, room] of this.roomsById.entries()) {
      if (now - room.lastActivityAt > maxIdleMs) {
        this.removeRoom(roomId);
        cleaned++;
      }
    }
    return cleaned;
  }

  public destroy(): void {
    for (const timer of this.turnTimers.values()) {
      clearTimeout(timer);
    }
    this.turnTimers.clear();
    this.reconnectManager.clearAll();
    this.roomsById.clear();
    this.roomsByCode.clear();
    this.playerToRoomId.clear();
  }
}
