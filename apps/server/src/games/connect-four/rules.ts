import {
  COLUMNS,
  ROWS,
  WIN_LENGTH,
  type CellValue,
  type PlayerDisc,
  type WinDirection,
  type WinningLine,
} from "./types.js";

export function createEmptyBoard(): CellValue[] {
  return Array(ROWS * COLUMNS).fill(null);
}

export function createInitialColumnCounts(): [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] {
  return [0, 0, 0, 0, 0, 0, 0];
}

export function isValidColumn(column: number): boolean {
  return Number.isInteger(column) && column >= 0 && column < COLUMNS;
}

export function isColumnFull(
  columnCounts: readonly [number, number, number, number, number, number, number],
  column: number
): boolean {
  return columnCounts[column] >= ROWS;
}

export function getLandingRow(
  columnCounts: readonly [number, number, number, number, number, number, number],
  column: number
): number {
  if (!isValidColumn(column) || columnCounts[column] >= ROWS) {
    return -1;
  }
  return ROWS - 1 - columnCounts[column];
}

export function placeDisc(
  board: CellValue[],
  row: number,
  column: number,
  disc: PlayerDisc
): CellValue[] {
  const next = [...board];
  next[row * COLUMNS + column] = disc;
  return next;
}

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

function countRun(
  board: CellValue[],
  row: number,
  column: number,
  dr: number,
  dc: number,
  player: PlayerDisc
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

export function getWinningLineAt(
  board: CellValue[],
  row: number,
  column: number,
  player: PlayerDisc
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

export function isBoardFull(
  columnCounts: readonly [number, number, number, number, number, number, number]
): boolean {
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] < ROWS) return false;
  }
  return true;
}
