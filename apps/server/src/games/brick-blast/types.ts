export type PlatformPlayer = "orange" | "blue";

export type BrickBlastStatus = "waiting" | "in_progress" | "won" | "abandoned";

export interface BrickBlastScore {
  orange: number;
  blue: number;
}

export interface BrickBlastGameState {
  status: BrickBlastStatus;
  currentLevel: number;
  startingPlayer: PlatformPlayer;
  serverPlayer: PlatformPlayer;
  scores: BrickBlastScore;
  winner: PlatformPlayer | null;
  playerRoles: Record<string, PlatformPlayer>; // playerId -> "orange" | "blue"
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
  ballSeed?: number;
}

export type BrickBlastAction =
  | { type: "INPUT"; input: string; data?: unknown }
  | { type: "EVENT"; event: string; data?: unknown }
  | { type: "REMATCH" };
