import { RECONNECT_TOKEN_TTL_MS } from "../config/constants.js";

export interface ReconnectRecord {
  roomId: string;
  playerId: string;
  expiresAt: number;
}

export class ReconnectManager {
  private recordsByToken = new Map<string, ReconnectRecord>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  public registerToken(token: string, roomId: string, playerId: string, ttlMs: number = RECONNECT_TOKEN_TTL_MS): void {
    this.recordsByToken.set(token, {
      roomId,
      playerId,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public validateAndConsumeToken(token: string, roomId: string): { valid: boolean; playerId?: string } {
    const record = this.recordsByToken.get(token);
    if (!record) {
      return { valid: false };
    }

    if (Date.now() > record.expiresAt) {
      this.recordsByToken.delete(token);
      return { valid: false };
    }

    if (record.roomId !== roomId) {
      return { valid: false };
    }

    // Single-use token
    this.recordsByToken.delete(token);
    return { valid: true, playerId: record.playerId };
  }

  public scheduleDisconnectCleanup(
    playerId: string,
    gracePeriodMs: number,
    onExpired: () => void
  ): void {
    this.cancelDisconnectCleanup(playerId);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId);
      onExpired();
    }, gracePeriodMs);

    // Don't hold process open in tests
    if (timer.unref) {
      timer.unref();
    }

    this.disconnectTimers.set(playerId, timer);
  }

  public cancelDisconnectCleanup(playerId: string): boolean {
    const existing = this.disconnectTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.disconnectTimers.delete(playerId);
      return true;
    }
    return false;
  }

  public clearAll(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.recordsByToken.clear();
  }
}
