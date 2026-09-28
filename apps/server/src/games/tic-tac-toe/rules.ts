import type { CellValue, PlayerMark, WinningLine } from "./types.js";

export const WINNING_COMBINATIONS: readonly WinningLine[] = [
  // Rows
  { line: [0, 1, 2], direction: "horizontal" },
  { line: [3, 4, 5], direction: "horizontal" },
  { line: [6, 7, 8], direction: "horizontal" },

  // Columns
  { line: [0, 3, 6], direction: "vertical" },
  { line: [1, 4, 7], direction: "vertical" },
  { line: [2, 5, 8], direction: "vertical" },

  // Diagonals
  { line: [0, 4, 8], direction: "diagonal" },
  { line: [2, 4, 6], direction: "diagonal" },
];

export function createEmptyBoard(): CellValue[] {
  return [null, null, null, null, null, null, null, null, null];
}

export function checkWinningLine(board: CellValue[]): WinningLine | null {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo.line;
    const mark = board[a];
    if (mark !== null && mark === board[b] && mark === board[c]) {
      return combo;
    }
  }
  return null;
}

export function isBoardFull(board: CellValue[]): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) return false;
  }
  return true;
}

export function isValidMove(board: CellValue[], position: number): boolean {
  return position >= 0 && position < 9 && board[position] === null;
}

export function placeMark(board: CellValue[], position: number, mark: PlayerMark): CellValue[] {
  const next = [...board];
  next[position] = mark;
  return next;
}
