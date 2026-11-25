import type { Cell, Player } from "./types.js";

export const ROWS = 8;
export const COLS = 6;
export const MAX_WAVES = 200;

export function createEmptyBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ count: 0, owner: null });
    }
    board.push(row);
  }
  return board;
}

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ count: cell.count, owner: cell.owner })));
}

export function getCriticalMass(row: number, col: number): number {
  const isTopOrBottom = row === 0 || row === ROWS - 1;
  const isLeftOrRight = col === 0 || col === COLS - 1;

  if (isTopOrBottom && isLeftOrRight) {
    return 2; // Corner
  }
  if (isTopOrBottom || isLeftOrRight) {
    return 3; // Edge
  }
  return 4; // Interior
}

export function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  const neighbors: Array<{ row: number; col: number }> = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < ROWS - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < COLS - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

export function isValidMove(
  board: Cell[][],
  row: number,
  col: number,
  player: Player
): boolean {
  if (
    typeof row !== "number" ||
    typeof col !== "number" ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  ) {
    return false;
  }
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return false;
  }

  const cell = board[row][col];
  return cell.owner === null || cell.owner === player;
}

export function countOrbs(board: Cell[][]): Record<Player, number> {
  const counts: Record<Player, number> = { X: 0, O: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell.owner) {
        counts[cell.owner] += cell.count;
      }
    }
  }
  return counts;
}

/**
 * Pure state resolution matching client Phase 1 logic identically.
 */
export function resolveServerMove(
  board: Cell[][],
  row: number,
  col: number,
  player: Player,
  movesPlayedAfterThis: number
): { nextBoard: Cell[][]; winner: Player | null; isFinished: boolean } {
  let grid = cloneBoard(board);
  const activePlayer = player;
  const opponent: Player = activePlayer === "X" ? "O" : "X";

  // 1. Initial placement
  grid[row][col].count += 1;
  grid[row][col].owner = activePlayer;

  let waveIndex = 0;
  let winner: Player | null = null;
  let isFinished = false;

  // 2. Cascade waves
  while (waveIndex < MAX_WAVES) {
    const explodingCells: Array<{
      row: number;
      col: number;
      crit: number;
      neighbors: Array<{ row: number; col: number }>;
    }> = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const crit = getCriticalMass(r, c);
        if (grid[r][c].count >= crit) {
          explodingCells.push({
            row: r,
            col: c,
            crit,
            neighbors: getNeighbors(r, c),
          });
        }
      }
    }

    if (explodingCells.length === 0) {
      break;
    }

    const nextGrid = cloneBoard(grid);

    // Deduct from exploding cells
    for (const exp of explodingCells) {
      nextGrid[exp.row][exp.col].count -= exp.crit;
      if (nextGrid[exp.row][exp.col].count === 0) {
        nextGrid[exp.row][exp.col].owner = null;
      } else {
        nextGrid[exp.row][exp.col].owner = activePlayer;
      }
    }

    // Add to neighbors and convert
    for (const exp of explodingCells) {
      for (const target of exp.neighbors) {
        nextGrid[target.row][target.col].count += 1;
        nextGrid[target.row][target.col].owner = activePlayer;
      }
    }

    grid = nextGrid;
    waveIndex++;

    // Anti-Infinite-Loop Win Short-Circuit
    if (movesPlayedAfterThis >= 2) {
      const counts = countOrbs(grid);
      if (counts[opponent] === 0 && counts[activePlayer] > 0) {
        winner = activePlayer;
        isFinished = true;
        break;
      }
    }
  }

  // Safety settlement check
  if (!isFinished && movesPlayedAfterThis >= 2) {
    const counts = countOrbs(grid);
    if (counts[opponent] === 0 && counts[activePlayer] > 0) {
      winner = activePlayer;
      isFinished = true;
    }
  }

  return { nextBoard: grid, winner, isFinished };
}
