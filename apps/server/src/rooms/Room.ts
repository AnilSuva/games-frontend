import type { RoomDto, RoomPlayerDto, RoomStatus } from "../types/index.js";

export interface RoomPlayer {
  playerId: string;
  seat: number;
  displayName?: string;
  connected: boolean;
  reconnectToken: string;
  joinedAt: number;
  disconnectedAt?: number;
}

export interface RoomOptions {
  id: string;
  code: string;
  gameId: string;
  hostPlayerId: string;
  maxPlayers: number;
}

export class Room {
  public readonly id: string;
  public readonly code: string;
  public readonly gameId: string;
  public readonly maxPlayers: number;
  public hostPlayerId: string;
  public status: RoomStatus;
  public readonly players = new Map<string, RoomPlayer>();
  public version: number;
  public readonly createdAt: number;
  public lastActivityAt: number;
  public gameState?: unknown;

  constructor(options: RoomOptions) {
    this.id = options.id;
    this.code = options.code.toUpperCase();
    this.gameId = options.gameId;
    this.hostPlayerId = options.hostPlayerId;
    this.maxPlayers = options.maxPlayers;
    this.status = "waiting";
    this.version = 1;
    this.createdAt = Date.now();
    this.lastActivityAt = this.createdAt;
  }

  public addPlayer(
    playerId: string,
    reconnectToken: string,
    displayName?: string
  ): RoomPlayer {
    if (this.players.has(playerId)) {
      const existing = this.players.get(playerId)!;
      existing.connected = true;
      existing.disconnectedAt = undefined;
      existing.reconnectToken = reconnectToken;
      if (displayName) existing.displayName = displayName;
      this.touch();
      return existing;
    }

    const assignedSeats = new Set(Array.from(this.players.values()).map((p) => p.seat));
    let nextSeat = 0;
    while (assignedSeats.has(nextSeat)) {
      nextSeat++;
    }

    const player: RoomPlayer = {
      playerId,
      seat: nextSeat,
      displayName,
      connected: true,
      reconnectToken,
      joinedAt: Date.now(),
    };

    this.players.set(playerId, player);
    this.touch();
    return player;
  }

  public removePlayer(playerId: string): boolean {
    const deleted = this.players.delete(playerId);
    if (deleted) {
      this.touch();

      // If host left, elect new host if any connected players remain
      if (this.hostPlayerId === playerId && this.players.size > 0) {
        const nextHost = Array.from(this.players.values()).find((p) => p.connected) ??
          Array.from(this.players.values())[0];
        if (nextHost) {
          this.hostPlayerId = nextHost.playerId;
        }
      }
    }
    return deleted;
  }

  public markPlayerDisconnected(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
      this.touch();
    }
  }

  public reconnectPlayer(playerId: string, newReconnectToken: string): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }
    player.connected = true;
    player.disconnectedAt = undefined;
    player.reconnectToken = newReconnectToken;
    this.touch();
    return true;
  }

  public isFull(): boolean {
    return this.players.size >= this.maxPlayers;
  }

  public isEmpty(): boolean {
    return this.players.size === 0;
  }

  public hasConnectedPlayers(): boolean {
    for (const player of this.players.values()) {
      if (player.connected) return true;
    }
    return false;
  }

  public incrementVersion(): number {
    this.version++;
    this.lastActivityAt = Date.now();
    return this.version;
  }

  public touch(): void {
    this.lastActivityAt = Date.now();
    this.version++;
  }

  public toDto(): RoomDto {
    const playersDto: RoomPlayerDto[] = Array.from(this.players.values())
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        playerId: p.playerId,
        seat: p.seat,
        displayName: p.displayName,
        connected: p.connected,
        joinedAt: p.joinedAt,
      }));

    return {
      roomId: this.id,
      roomCode: this.code,
      gameId: this.gameId,
      status: this.status,
      hostPlayerId: this.hostPlayerId,
      players: playersDto,
      maxPlayers: this.maxPlayers,
      version: this.version,
      createdAt: this.createdAt,
      gameState: this.gameState,
    };
  }
}
