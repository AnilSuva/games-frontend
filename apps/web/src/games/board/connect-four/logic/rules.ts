import type {
  Board,
  CellValue,
  Player,
  WinDirection,
  WinningLine,
} from "./types";
import { COLUMNS, ROWS, WIN_LENGTH } from "./types";

/**
 * Pure game rules for Connect Four.
 * Zero React, DOM, or browser API dependencies.
 * Fully deterministic and unit-testable.
 */

const EMPTY_BOARD: Board = Array(ROWS * COLUMNS).fill(null);

/**
 * Creates an empty 7x6 board (42 cells, all null).
 */
export function createEmptyBoard(): Board {
  return [...EMPTY_BOARD];
}

/**
 * Creates the initial column fill counts (all columns empty).
 */
export function createInitialColumnCounts(): [
  number, number, number, number, number, number, number
] {
  return [0, 0, 0, 0, 0, 0, 0];
}

/**
 * Checks whether a column index is within bounds (0..6).
 */
export function isValidColumn(column: number): boolean {
  return Number.isInteger(column) && column >= 0 && column < COLUMNS;
}

/**
 * Checks whether a column is already full (6 discs).
 */
export function isColumnFull(
  columnCounts: readonly [number, number, number, number, number, number, number],
  column: number
): boolean {
  return columnCounts[column] >= ROWS;
}

/**
 * Returns the row index where a disc would land in the given column.
 * Row 0 is the top; the lowest empty row is `ROWS - 1 - columnCounts[column]`.
 * Returns -1 if the column is full.
 */
export function getLandingRow(
  columnCounts: readonly [number, number, number, number, number, number, number],
  column: number
): number {
  if (!isValidColumn(column) || columnCounts[column] >= ROWS) {
    return -1;
  }
  return ROWS - 1 - columnCounts[column];
}

/**
 * Returns a new board with the specified cell updated.
 */
export function placeDisc(
  board: Board,
  row: number,
  column: number,
  player: CellValue
): Board {
  const next = [...board] as CellValue[];
  next[row * COLUMNS + column] = player;
  return next;
}

/**
 * Returns a new column-count array with the given column incremented.
 */
export function incrementColumnCount(
  columnCounts: readonly [number, number, number, number, number, number, number],
  column: number
): [number, number, number, number, number, number, number] {
  const next = [...columnCounts] as [number, number, number, number, number, number, number];
  next[column] += 1;
  return next;
}

function inBounds(row: number, column: number): boolean {
  return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS;
}

/**
 * Counts consecutive discs of `player` starting at (row, col) and
 * moving in direction (dr, dc). The starting cell is included.
 */
function countRun(
  board: Board,
  row: number,
  column: number,
  dr: number,
  dc: number,
  player: Player
): number {
  let r = row;
  let c = column;
  let count = 0;
  while (inBounds(r, c) && board[r * COLUMNS + c] === player) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

interface Direction {
  dr: number;
  dc: number;
  name: WinDirection;
}

const DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1, name: "horizontal" },
  { dr: 1, dc: 0, name: "vertical" },
  { dr: 1, dc: 1, name: "diagonal-down" },
  { dr: 1, dc: -1, name: "diagonal-up" },
];

/**
 * Checks whether placing `player` at (row, col) creates a win,
 * and returns the winning line of 4 cells if so.
 */
export function getWinningLineAt(
  board: Board,
  row: number,
  column: number,
  player: Player
): WinningLine | null {
  for (const dir of DIRECTIONS) {
    const negCount = countRun(board, row - dir.dr, column - dir.dc, -dir.dr, -dir.dc, player);
    const posCount = countRun(board, row, column, dir.dr, dir.dc, player);
    const total = negCount + posCount;
    if (total >= WIN_LENGTH) {
      const startRow = row - dir.dr * negCount;
      const startCol = column - dir.dc * negCount;
      const line: [number, number, number, number] = [
        startRow * COLUMNS + startCol,
        (startRow + dir.dr) * COLUMNS + (startCol + dir.dc),
        (startRow + 2 * dir.dr) * COLUMNS + (startCol + 2 * dir.dc),
        (startRow + 3 * dir.dr) * COLUMNS + (startCol + 3 * dir.dc),
      ];
      return { line, direction: dir.name };
    }
  }
  return null;
}

/**
 * Scans the entire board for any winning line of `player`.
 * Returns the first winning line found, or null.
 */
export function getWinningLineForPlayer(
  board: Board,
  player: Player
): WinningLine | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      if (board[r * COLUMNS + c] === player) {
        const win = getWinningLineAt(board, r, c, player);
        if (win) return win;
      }
    }
  }
  return null;
}

/**
 * Checks whether `player` has a winning line anywhere on the board.
 */
export function hasWon(board: Board, player: Player): boolean {
  return getWinningLineForPlayer(board, player) !== null;
}

/**
 * Returns the list of column indices (0..6) that are not yet full.
 */
export function getAvailableColumns(
  columnCounts: readonly [number, number, number, number, number, number, number]
): number[] {
  const columns: number[] = [];
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] < ROWS) {
      columns.push(c);
    }
  }
  return columns;
}

/**
 * Checks whether the entire board is full (42 discs placed).
 */
export function isBoardFull(
  columnCounts: readonly [number, number, number, number, number, number, number]
): boolean {
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] < ROWS) return false;
  }
  return true;
}