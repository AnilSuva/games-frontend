export type PlatformPlayer = "orange" | "blue";

export type StarCatcherStatus = "waiting" | "in_progress" | "won" | "abandoned";

export interface StarCatcherScore {
  orange: number;
  blue: number;
}

export interface StarCatcherGameState {
  status: StarCatcherStatus;
  startingPlayer: PlatformPlayer;
  scores: StarCatcherScore;
  winner: PlatformPlayer | null;
  playerRoles: Record<string, PlatformPlayer>; // playerId -> "orange" | "blue"
  readyPlayers?: string[];
  initialStar?: { x: number; y: number } | null;
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
}

export type StarCatcherAction =
  | { type: "INPUT"; input: string; data?: unknown }
  | { type: "EVENT"; event: string; data?: unknown }
  | { type: "REMATCH" };
