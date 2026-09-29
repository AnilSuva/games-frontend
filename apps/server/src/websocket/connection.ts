import crypto from "node:crypto";
import type { WebSocket as WsWebSocket } from "ws";
import { PROTOCOL_VERSION } from "../config/constants.js";
import { TokenBucketRateLimiter } from "../security/rateLimit.js";
import type { ErrorCode, ServerEnvelope } from "../types/index.js";

export class PlayerConnection {
  public readonly connectionId: string;
  public playerId?: string;
  public sessionToken?: string;
  public isAlive: boolean = true;
  public readonly rateLimiter: TokenBucketRateLimiter;
  public readonly connectedAt: number;
  public lastMessageAt: number;

  constructor(
    public readonly socket: WsWebSocket,
    rateLimitCapacity: number = 30,
    rateLimitRefillRate: number = 20
  ) {
    this.connectionId = crypto.randomUUID();
    this.rateLimiter = new TokenBucketRateLimiter(rateLimitCapacity, rateLimitRefillRate);
    this.connectedAt = Date.now();
    this.lastMessageAt = this.connectedAt;
  }

  public send<T>(envelope: ServerEnvelope<T>): boolean {
    if (this.socket.readyState !== 1 /* WebSocket.OPEN */) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }

  public sendError(code: ErrorCode, message: string, requestId?: string): boolean {
    return this.send({
      version: PROTOCOL_VERSION,
      type: "room.error",
      requestId,
      payload: { code, message },
    });
  }

  public close(code: number = 1000, reason?: string): void {
    if (this.socket.readyState === 1 || this.socket.readyState === 0) {
      try {
        this.socket.close(code, reason);
      } catch {
        this.socket.terminate();
      }
    }
  }

  public terminate(): void {
    try {
      this.socket.terminate();
    } catch {
      // Ignore termination errors
    }
  }
}

export class ConnectionTracker {
  private connectionsById = new Map<string, PlayerConnection>();
  private connectionIdByPlayerId = new Map<string, string>();

  public add(connection: PlayerConnection): void {
    this.connectionsById.set(connection.connectionId, connection);
    if (connection.playerId) {
      this.connectionIdByPlayerId.set(connection.playerId, connection.connectionId);
    }
  }

  public bindPlayerId(connectionId: string, playerId: string): void {
    const existingConnectionId = this.connectionIdByPlayerId.get(playerId);
    if (existingConnectionId && existingConnectionId !== connectionId) {
      const existingConn = this.connectionsById.get(existingConnectionId);
      if (existingConn) {
        // Disassociate playerId from stale connection so its close handler won't trigger disconnect
        existingConn.playerId = undefined;
        try {
          existingConn.close(1000, "Replaced by new connection");
        } catch {
          existingConn.terminate();
        }
        this.connectionsById.delete(existingConnectionId);
      }
    }

    const connection = this.connectionsById.get(connectionId);
    if (connection) {
      connection.playerId = playerId;
      this.connectionIdByPlayerId.set(playerId, connectionId);
    }
  }

  public remove(connectionId: string): PlayerConnection | undefined {
    const conn = this.connectionsById.get(connectionId);
    if (conn) {
      this.connectionsById.delete(connectionId);
      // Only delete playerId mapping if it is still pointing to this exact connection
      if (conn.playerId && this.connectionIdByPlayerId.get(conn.playerId) === connectionId) {
        this.connectionIdByPlayerId.delete(conn.playerId);
      }
    }
    return conn;
  }

  public getById(connectionId: string): PlayerConnection | undefined {
    return this.connectionsById.get(connectionId);
  }

  public getByPlayerId(playerId: string): PlayerConnection | undefined {
    const connectionId = this.connectionIdByPlayerId.get(playerId);
    return connectionId ? this.connectionsById.get(connectionId) : undefined;
  }

  public getAll(): PlayerConnection[] {
    return Array.from(this.connectionsById.values());
  }

  public size(): number {
    return this.connectionsById.size;
  }

  public clear(): void {
    for (const conn of this.connectionsById.values()) {
      conn.close(1001, "Server shutting down");
    }
    this.connectionsById.clear();
    this.connectionIdByPlayerId.clear();
  }
}
