export type PlatformPlayer = "orange" | "blue";

export type PingPongStatus = "waiting" | "in_progress" | "won" | "abandoned";

export interface PingPongScore {
  orange: number;
  blue: number;
}

export interface PingPongGameState {
  status: PingPongStatus;
  startingPlayer: PlatformPlayer;
  scores: PingPongScore;
  winner: PlatformPlayer | null;
  playerRoles: Record<string, PlatformPlayer>; // playerId -> "orange" | "blue"
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
}

export type PingPongAction =
  | { type: "INPUT"; input: string; data?: unknown }
  | { type: "EVENT"; event: string; data?: unknown }
  | { type: "REMATCH" };
