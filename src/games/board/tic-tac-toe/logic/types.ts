/**
 * Pure type definitions for the Tic-Tac-Toe state model.
 * Zero React, DOM, or browser API dependencies.
 */

export type Player = "X" | "O";

export type CellValue = Player | null;

export type Board = readonly [
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue
];

export type GameStatus = "in_progress" | "won" | "draw";

export type WinDirection = "horizontal" | "vertical" | "diagonal";

export interface WinningLine {
  line: readonly [number, number, number];
  direction: WinDirection;
}

export interface TicTacToeState {
  readonly board: Board;
  readonly currentPlayer: Player;
  readonly status: GameStatus;
  readonly winner: Player | null;
  readonly winningLine: WinningLine | null;
  readonly moveCount: number;
}

export type TicTacToeAction =
  | { type: "MAKE_MOVE"; cellIndex: number }
  | { type: "RESET"; startingPlayer?: Player };
