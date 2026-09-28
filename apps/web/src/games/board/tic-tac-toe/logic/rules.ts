import type { Board, CellValue, WinningLine } from "./types";

/**
 * All 8 winning combinations in Tic-Tac-Toe:
 * - 3 Horizontal rows
 * - 3 Vertical columns
 * - 2 Diagonals
 */
export const WINNING_COMBINATIONS: readonly WinningLine[] = [
  // Horizontal rows
  { line: [0, 1, 2], direction: "horizontal" },
  { line: [3, 4, 5], direction: "horizontal" },
  { line: [6, 7, 8], direction: "horizontal" },

  // Vertical columns
  { line: [0, 3, 6], direction: "vertical" },
  { line: [1, 4, 7], direction: "vertical" },
  { line: [2, 5, 8], direction: "vertical" },

  // Diagonals
  { line: [0, 4, 8], direction: "diagonal" },
  { line: [2, 4, 6], direction: "diagonal" },
];

/**
 * Creates an empty 3x3 board.
 */
export function createEmptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * Checks if any winning combination is completed on the board.
 * Returns the winning line info or null if no winner.
 */
export function checkWinningLine(board: Board): WinningLine | null {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo.line;
    const mark = board[a];
    if (mark !== null && mark === board[b] && mark === board[c]) {
      return combo;
    }
  }
  return null;
}

/**
 * Returns an array of valid cell indices (0..8) that are currently empty.
 */
export function getAvailableMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      moves.push(i);
    }
  }
  return moves;
}

/**
 * Checks whether all 9 cells are occupied.
 */
export function isBoardFull(board: Board): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) return false;
  }
  return true;
}

/**
 * Validates whether a move index is in bounds and the cell is empty.
 */
export function isValidMove(board: Board, cellIndex: number): boolean {
  return cellIndex >= 0 && cellIndex < 9 && board[cellIndex] === null;
}

/**
 * Returns a new board with the specified cell updated.
 */
export function placeMark(board: Board, cellIndex: number, mark: CellValue): Board {
  const next = [...board] as unknown as [
    CellValue, CellValue, CellValue,
    CellValue, CellValue, CellValue,
    CellValue, CellValue, CellValue
  ];
  next[cellIndex] = mark;
  return next;
}
