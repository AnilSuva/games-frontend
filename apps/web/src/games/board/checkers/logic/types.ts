/**
 * Pure type definitions for Checkers (Draughts) state model.
 * Zero React, DOM, or browser API dependencies.
 */

export type PlatformPlayer = "orange" | "blue";

export const BOARD_SIZE = 8;
export const TOTAL_SQUARES = 64;

export const EMPTY = 0 as const;
export const ORANGE_MAN = 1 as const;
export const ORANGE_KING = 2 as const;
export const BLUE_MAN = 3 as const;
export const BLUE_KING = 4 as const;

export type Piece =
  | typeof EMPTY
  | typeof ORANGE_MAN
  | typeof ORANGE_KING
  | typeof BLUE_MAN
  | typeof BLUE_KING;

export type Board = readonly Piece[];

export type GameStatus = "in_progress" | "won" | "draw";

export interface CheckersMove {
  from: number;
  to: number;
  isJump: boolean;
  jumpedIndex?: number;
}

export interface CheckersState {
  readonly board: Board;
  readonly currentPlayer: PlatformPlayer;
  readonly status: GameStatus;
  readonly winner: PlatformPlayer | null;
  readonly activePiece: number | null;
  readonly orangeCaptures: number;
  readonly blueCaptures: number;
  readonly moveCount: number;
  readonly lastMove: CheckersMove | null;
}

export type CheckersAction =
  | { type: "MOVE"; from: number; to: number }
  | { type: "RESET"; startingPlayer?: PlatformPlayer };
