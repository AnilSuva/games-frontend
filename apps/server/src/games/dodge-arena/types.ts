export type DodgeArenaPlayer = "orange" | "blue";

export interface DodgeArenaLives {
  orange: number;
  blue: number;
}

export interface DodgeArenaGameState {
  status: "waiting" | "in_progress" | "won" | "draw" | "abandoned";
  startingPlayer: DodgeArenaPlayer;
  lives: DodgeArenaLives;
  wave: number;
  winner: DodgeArenaPlayer | "draw" | null;
  playerRoles: Record<string, DodgeArenaPlayer>;
  readyPlayers: string[];
  seed: number;
  rematchRequests: string[];
  resultReason?: "win" | "draw" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime: number;
}

export interface DodgeArenaInputAction {
  type: "INPUT";
  input: string;
  data?: unknown;
}

export interface DodgeArenaEventAction {
  type: "EVENT";
  event: string;
  data?: unknown;
}

export interface DodgeArenaRematchAction {
  type: "REMATCH";
}

export type DodgeArenaAction =
  | DodgeArenaInputAction
  | DodgeArenaEventAction
  | DodgeArenaRematchAction;
