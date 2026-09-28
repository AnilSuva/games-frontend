import { generatePlayerId, generateSessionToken } from "./identity.js";

export interface PlayerSession {
  playerId: string;
  sessionToken: string;
  displayName?: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface ISessionStore {
  createSession(displayName?: string): PlayerSession;
  getSession(sessionToken: string): PlayerSession | undefined;
  touchSession(sessionToken: string): void;
  removeSession(sessionToken: string): void;
}

export class InMemorySessionStore implements ISessionStore {
  private sessionsByToken = new Map<string, PlayerSession>();
  private sessionsByPlayerId = new Map<string, PlayerSession>();

  public createSession(displayName?: string): PlayerSession {
    const session: PlayerSession = {
      playerId: generatePlayerId(),
      sessionToken: generateSessionToken(),
      displayName,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.sessionsByToken.set(session.sessionToken, session);
    this.sessionsByPlayerId.set(session.playerId, session);
    return session;
  }

  public getSession(sessionToken: string): PlayerSession | undefined {
    return this.sessionsByToken.get(sessionToken);
  }

  public getSessionByPlayerId(playerId: string): PlayerSession | undefined {
    return this.sessionsByPlayerId.get(playerId);
  }

  public touchSession(sessionToken: string): void {
    const session = this.sessionsByToken.get(sessionToken);
    if (session) {
      session.lastSeenAt = Date.now();
    }
  }

  public removeSession(sessionToken: string): void {
    const session = this.sessionsByToken.get(sessionToken);
    if (session) {
      this.sessionsByToken.delete(sessionToken);
      this.sessionsByPlayerId.delete(session.playerId);
    }
  }
}
