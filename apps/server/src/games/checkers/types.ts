export const EMPTY = 0;
export const ORANGE_MAN = 1;
export const ORANGE_KING = 2;
export const BLUE_MAN = 3;
export const BLUE_KING = 4;

export type Piece =
  | typeof EMPTY
  | typeof ORANGE_MAN
  | typeof ORANGE_KING
  | typeof BLUE_MAN
  | typeof BLUE_KING;

export type CheckersPlayer = "orange" | "blue";

export type CheckersStatus = "waiting" | "in_progress" | "won" | "draw";

export type ResultReason = "win" | "draw" | "disconnect_forfeit" | "timeout";

export const TURN_DURATION_MS = 60_000; // 1-minute move limit in online mode

export interface CheckersMove {
  from: number;
  to: number;
  isJump: boolean;
  jumpedIndex?: number;
}

export interface CheckersLastMove {
  from: number;
  to: number;
  isJump: boolean;
  jumpedIndex?: number;
}

export interface CheckersGameState {
  board: number[];
  currentPlayer: CheckersPlayer;
  startingPlayer: CheckersPlayer;
  status: CheckersStatus;
  winner: CheckersPlayer | null;
  activePiece: number | null;
  orangeCaptures: number;
  blueCaptures: number;
  moveCount: number;
  lastMove?: CheckersLastMove | null;
  playerRoles: Record<string, CheckersPlayer>; // playerId -> "orange" | "blue"
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  turnExpiresAt?: number | null;
}

export type CheckersAction =
  | { type: "MOVE"; from: number; to: number }
  | { type: "REMATCH" }
  | { type: "EVENT"; event: string; data?: unknown }
  | { type: "TIMEOUT" };
