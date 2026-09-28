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
    options?: { maxPlayers?: number; displayName?: string }
  ): RoomResult<{ room: Room; reconnectToken: string }> {
    // If player is already in another room, leave it first
    const existingRoomId = this.playerToRoomId.get(hostPlayerId);
    if (existingRoomId) {
      this.leaveRoom(hostPlayerId, existingRoomId);
    }

    const maxPlayers = Math.min(
      Math.max(options?.maxPlayers ?? DEFAULT_MAX_PLAYERS, 2),
      MAX_ALLOWED_PLAYERS
    );

    const roomId = crypto.randomUUID();
    const roomCode = generateRoomCode((code) => this.roomsByCode.has(code));

    const room = new Room({
      id: roomId,
      code: roomCode,
      gameId,
      hostPlayerId,
      maxPlayers,
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

    // If capacity reached, transition to in-progress
    if (room.isFull()) {
      room.status = "in-progress";
      room.touch();
    }

    return {
      success: true,
      data: { room, reconnectToken },
    };
  }

  public leaveRoom(
    playerId: string,
    roomId?: string
  ): { room?: Room; wasHost: boolean; destroyed: boolean } {
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
    room.removePlayer(playerId);
    this.playerToRoomId.delete(playerId);

    if (room.isEmpty()) {
      this.removeRoom(room.id);
      return { room, wasHost, destroyed: true };
    }

    return { room, wasHost, destroyed: false };
  }

  public handleDisconnect(
    playerId: string,
    onGraceExpired?: (room: Room, playerLeftId: string) => void
  ): { room?: Room; scheduled: boolean } {
    const roomId = this.playerToRoomId.get(playerId);
    if (!roomId) {
      return { scheduled: false };
    }

    const room = this.roomsById.get(roomId);
    if (!room || !room.players.has(playerId)) {
      return { scheduled: false };
    }

    room.markPlayerDisconnected(playerId);

    // If an active game is in progress, allow the game adapter to pause and record disconnect grace expiry
    const adapter = this.gameRegistry?.get(room.gameId);
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
    this.reconnectManager.clearAll();
    this.roomsById.clear();
    this.roomsByCode.clear();
    this.playerToRoomId.clear();
  }
}
