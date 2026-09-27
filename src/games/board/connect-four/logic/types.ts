/**
 * Pure type definitions for the Connect Four state model.
 * Zero React, DOM, or browser API dependencies.
 */

export type Player = "R" | "Y";

export type CellValue = Player | null;

export const COLUMNS = 7;
export const ROWS = 6;
export const WIN_LENGTH = 4;

/**
 * Flat board representation indexed by row * COLUMNS + column.
 * Row 0 is the TOP row of the grid (visually rendered at the top).
 * A disc lands in the lowest empty row of the chosen column.
 */
export type Board = readonly CellValue[];

export type GameStatus = "in_progress" | "won" | "draw";

export type WinDirection =
  | "horizontal"
  | "vertical"
  | "diagonal-down"
  | "diagonal-up";

export interface WinningLine {
  line: readonly [number, number, number, number];
  direction: WinDirection;
}

export interface ConnectFourState {
  readonly board: Board;
  readonly columnCounts: readonly [number, number, number, number, number, number, number];
  readonly currentPlayer: Player;
  readonly status: GameStatus;
  readonly winner: Player | null;
  readonly winningLine: WinningLine | null;
  readonly moveCount: number;
}

export type ConnectFourAction =
  | { type: "DROP"; column: number }
  | { type: "RESET"; startingPlayer?: Player };