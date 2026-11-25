import type {
  Cell,
  ChainReactionState,
  ChainReactionStatus,
  CascadeWave,
  Explosion,
  ExplosionTarget,
  MoveLocation,
  Player,
} from "./types";

export const ROWS = 8;
export const COLS = 6;
export const TOTAL_CELLS = ROWS * COLS; // 48
export const MAX_WAVES = 200;

/**
 * Creates an empty 6x8 board where every cell has 0 orbs and no owner.
 */
export function createEmptyGrid(): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ count: 0, owner: null });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Deep clones the 2D grid.
 */
export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => ({ count: cell.count, owner: cell.owner })));
}

/**
 * Returns the critical mass for a cell at (row, col):
 * - Corners (2 neighbors): 2
 * - Edges (3 neighbors): 3
 * - Interior (4 neighbors): 4
 */
export function getCriticalMass(row: number, col: number): number {
  const isTopOrBottom = row === 0 || row === ROWS - 1;
  const isLeftOrRight = col === 0 || col === COLS - 1;

  if (isTopOrBottom && isLeftOrRight) {
    return 2; // Corner
  }
  if (isTopOrBottom || isLeftOrRight) {
    return 3; // Edge
  }
  return 4; // Center
}

/**
 * Returns orthogonal neighbors within grid boundaries.
 */
export function getNeighbors(row: number, col: number): ExplosionTarget[] {
  const neighbors: ExplosionTarget[] = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < ROWS - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < COLS - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

/**
 * Verifies if a move is legal.
 * Legal if cell is within bounds, game is playing, and cell is empty OR owned by currentPlayer.
 */
export function isValidMove(state: ChainReactionState, row: number, col: number): boolean {
  if (state.status !== "playing") return false;
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;

  const cell = state.grid[row][col];
  return cell.owner === null || cell.owner === state.currentPlayer;
}

/**
 * Returns all currently legal move locations for the active player.
 */
export function getLegalMoves(state: ChainReactionState): MoveLocation[] {
  if (state.status !== "playing") return [];

  const moves: MoveLocation[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (cell.owner === null || cell.owner === state.currentPlayer) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

/**
 * Counts total orbs on the board per player.
 */
export function countOrbs(grid: Cell[][]): Record<Player, number> {
  const counts: Record<Player, number> = { X: 0, O: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.owner) {
        counts[cell.owner] += cell.count;
      }
    }
  }
  return counts;
}

/**
 * Counts number of controlled cells per player.
 */
export function countCells(grid: Cell[][]): Record<Player, number> {
  const counts: Record<Player, number> = { X: 0, O: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.owner) {
        counts[cell.owner] += 1;
      }
    }
  }
  return counts;
}

/**
 * Resolves a move step-by-step with simultaneous wave-based cascade resolution.
 *
 * Anti-Infinite-Loop Win Short-Circuit:
 * If both players have taken at least one turn (playerMoves.X >= 1 && playerMoves.O >= 1),
 * after EVERY wave, if opponent has 0 orbs left, the cascade loop immediately stops
 * and activePlayer wins.
 */
export function resolveMove(
  state: ChainReactionState,
  row: number,
  col: number
): { finalState: ChainReactionState; waves: CascadeWave[] } {
  if (!isValidMove(state, row, col)) {
    return { finalState: state, waves: [] };
  }

  const activePlayer = state.currentPlayer;
  const opponent: Player = activePlayer === "X" ? "O" : "X";
  let grid = cloneGrid(state.grid);

  // 1. Place initial orb
  grid[row][col].count += 1;
  grid[row][col].owner = activePlayer;

  const newPlayerMoves: Record<Player, number> = {
    ...state.playerMoves,
    [activePlayer]: state.playerMoves[activePlayer] + 1,
  };
  const newMovesPlayed = state.movesPlayed + 1;

  const waves: CascadeWave[] = [];
  let waveIndex = 0;
  let winner: Player | null = null;
  let status: ChainReactionStatus = "playing";

  // 2. Cascade Loop
  while (waveIndex < MAX_WAVES) {
    // Find all cells at or exceeding critical mass
    const explodingCells: Array<{
      row: number;
      col: number;
      crit: number;
      neighbors: ExplosionTarget[];
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

    // No cells need to explode; cascade is settled
    if (explodingCells.length === 0) {
      break;
    }

    // Execute simultaneous wave
    const nextGrid = cloneGrid(grid);
    const explosions: Explosion[] = [];

    // Step A: Deduct critical mass from all exploding cells
    for (const exp of explodingCells) {
      nextGrid[exp.row][exp.col].count -= exp.crit;
      if (nextGrid[exp.row][exp.col].count === 0) {
        nextGrid[exp.row][exp.col].owner = null;
      } else {
        nextGrid[exp.row][exp.col].owner = activePlayer;
      }

      explosions.push({
        fromRow: exp.row,
        fromCol: exp.col,
        targets: exp.neighbors,
      });
    }

    // Step B: Send +1 orb to all neighbors and convert ownership
    for (const exp of explodingCells) {
      for (const target of exp.neighbors) {
        nextGrid[target.row][target.col].count += 1;
        nextGrid[target.row][target.col].owner = activePlayer;
      }
    }

    grid = nextGrid;

    // Record snapshot of this wave
    waves.push({
      waveIndex,
      explosions,
      board: cloneGrid(grid),
      player: activePlayer,
    });
    waveIndex++;

    // Step C: Anti-Infinite-Loop Win Short-Circuit
    // Only check if both players have played at least once
    if (newPlayerMoves.X >= 1 && newPlayerMoves.O >= 1) {
      const counts = countOrbs(grid);
      if (counts[opponent] === 0 && counts[activePlayer] > 0) {
        winner = activePlayer;
        status = "finished";
        break; // Stop immediately!
      }
    }
  }

  // Safety check if settled without explosion or max waves reached
  if (status !== "finished" && newPlayerMoves.X >= 1 && newPlayerMoves.O >= 1) {
    const counts = countOrbs(grid);
    if (counts[opponent] === 0 && counts[activePlayer] > 0) {
      winner = activePlayer;
      status = "finished";
    }
  }

  const nextPlayer: Player = status === "finished" ? activePlayer : opponent;

  const finalState: ChainReactionState = {
    grid,
    currentPlayer: nextPlayer,
    startingPlayer: state.startingPlayer,
    status,
    winner,
    movesPlayed: newMovesPlayed,
    playerMoves: newPlayerMoves,
    lastMove: { row, col },
  };

  return { finalState, waves };
}

/**
 * Creates a clean initial state for a new game.
 */
export function createInitialState(startingPlayer: Player = "X"): ChainReactionState {
  return {
    grid: createEmptyGrid(),
    currentPlayer: startingPlayer,
    startingPlayer,
    status: "playing",
    winner: null,
    movesPlayed: 0,
    playerMoves: { X: 0, O: 0 },
    lastMove: null,
  };
}
