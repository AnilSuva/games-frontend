import type {
  Player,
  Position,
  Wall,
  WallMazeAction,
  WallMazeState,
  WallOrientation,
  WallPlacement,
  WallValidationResult,
} from "./types";

export const GRID_SIZE = 9;
export const WALL_GRID_SIZE = 8;
export const INITIAL_WALLS = 10;

export const GOAL_ROW: Record<Player, number> = {
  X: 0,
  O: 8,
};

export const START_POSITIONS: Record<Player, Position> = {
  X: { row: 8, col: 4 },
  O: { row: 0, col: 4 },
};

// Orthogonal directions: Up, Down, Left, Right
const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// Bit flags for blocked directions in the 9x9 edge mask
const BIT_UP = 1;
const BIT_DOWN = 2;
const BIT_LEFT = 4;
const BIT_RIGHT = 8;

export function getOpponent(player: Player): Player {
  return player === "X" ? "O" : "X";
}

export function isInBounds(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < GRID_SIZE &&
    col >= 0 &&
    col < GRID_SIZE
  );
}

export function isWallInBounds(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < WALL_GRID_SIZE &&
    col >= 0 &&
    col < WALL_GRID_SIZE
  );
}

/**
 * Creates a clean initial JSON-serializable state for Wall Maze (Quoridor).
 */
export function createInitialState(startingPlayer: Player = "X"): WallMazeState {
  return {
    pawns: {
      X: { ...START_POSITIONS.X },
      O: { ...START_POSITIONS.O },
    },
    walls: [],
    wallsLeft: {
      X: INITIAL_WALLS,
      O: INITIAL_WALLS,
    },
    currentPlayer: startingPlayer,
    startingPlayer,
    status: "playing",
    winner: null,
    moveCount: 0,
    lastAction: null,
  };
}

/**
 * Checks if the edge between two orthogonally adjacent cells is blocked by a wall
 * (or if either cell is out of bounds / non-adjacent).
 */
export function isEdgeBlocked(
  walls: readonly Wall[],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  if (!isInBounds(r1, c1) || !isInBounds(r2, c2)) {
    return true;
  }

  const dr = r2 - r1;
  const dc = c2 - c1;
  if (Math.abs(dr) + Math.abs(dc) !== 1) {
    return true;
  }

  if (dc === 0) {
    // Vertical step between topRow and topRow + 1 at column c1
    const topRow = r1 < r2 ? r1 : r2;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.orientation === "h" && w.row === topRow && (w.col === c1 || w.col === c1 - 1)) {
        return true;
      }
    }
    return false;
  }

  // Horizontal step between leftCol and leftCol + 1 at row r1
  const leftCol = c1 < c2 ? c1 : c2;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.orientation === "v" && w.col === leftCol && (w.row === r1 || w.row === r1 - 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds an 81-cell directional blocked-edge bitmask for fast BFS evaluation.
 */
export function buildBlockedEdgeMask(walls: readonly Wall[]): Uint8Array {
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE);

  for (let i = 0; i < walls.length; i++) {
    const { row, col, orientation } = walls[i];
    if (orientation === "h") {
      if (row >= 0 && row < WALL_GRID_SIZE) {
        if (col >= 0 && col < GRID_SIZE) {
          mask[row * GRID_SIZE + col] |= BIT_DOWN;
          mask[(row + 1) * GRID_SIZE + col] |= BIT_UP;
        }
        if (col + 1 >= 0 && col + 1 < GRID_SIZE) {
          mask[row * GRID_SIZE + (col + 1)] |= BIT_DOWN;
          mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_UP;
        }
      }
    } else {
      if (col >= 0 && col < WALL_GRID_SIZE) {
        if (row >= 0 && row < GRID_SIZE) {
          mask[row * GRID_SIZE + col] |= BIT_RIGHT;
          mask[row * GRID_SIZE + (col + 1)] |= BIT_LEFT;
        }
        if (row + 1 >= 0 && row + 1 < GRID_SIZE) {
          mask[(row + 1) * GRID_SIZE + col] |= BIT_RIGHT;
          mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_LEFT;
        }
      }
    }
  }

  return mask;
}

function bfsShortestDistanceWithMask(
  mask: Uint8Array,
  start: Position,
  goalRow: number
): number | null {
  if (!isInBounds(start.row, start.col)) return null;
  if (start.row === goalRow) return 0;

  const totalCells = GRID_SIZE * GRID_SIZE;
  const dist = new Int8Array(totalCells);
  dist.fill(-1);

  const queue = new Int8Array(totalCells);
  let head = 0;
  let tail = 0;

  const startIdx = start.row * GRID_SIZE + start.col;
  dist[startIdx] = 0;
  queue[tail++] = startIdx;

  // Bias exploration order slightly toward goalRow for clean deterministic paths
  const preferDown = goalRow > start.row;

  while (head < tail) {
    const idx = queue[head++];
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const nextDist = dist[idx] + 1;
    const cellMask = mask[idx];

    if (preferDown) {
      if (r < GRID_SIZE - 1 && (cellMask & BIT_DOWN) === 0) {
        const nIdx = idx + GRID_SIZE;
        if (dist[nIdx] === -1) {
          if (r + 1 === goalRow) return nextDist;
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (c > 0 && (cellMask & BIT_LEFT) === 0) {
        const nIdx = idx - 1;
        if (dist[nIdx] === -1) {
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (c < GRID_SIZE - 1 && (cellMask & BIT_RIGHT) === 0) {
        const nIdx = idx + 1;
        if (dist[nIdx] === -1) {
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (r > 0 && (cellMask & BIT_UP) === 0) {
        const nIdx = idx - GRID_SIZE;
        if (dist[nIdx] === -1) {
          if (r - 1 === goalRow) return nextDist;
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
    } else {
      if (r > 0 && (cellMask & BIT_UP) === 0) {
        const nIdx = idx - GRID_SIZE;
        if (dist[nIdx] === -1) {
          if (r - 1 === goalRow) return nextDist;
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (c > 0 && (cellMask & BIT_LEFT) === 0) {
        const nIdx = idx - 1;
        if (dist[nIdx] === -1) {
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (c < GRID_SIZE - 1 && (cellMask & BIT_RIGHT) === 0) {
        const nIdx = idx + 1;
        if (dist[nIdx] === -1) {
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
      if (r < GRID_SIZE - 1 && (cellMask & BIT_DOWN) === 0) {
        const nIdx = idx + GRID_SIZE;
        if (dist[nIdx] === -1) {
          if (r + 1 === goalRow) return nextDist;
          dist[nIdx] = nextDist;
          queue[tail++] = nIdx;
        }
      }
    }
  }

  return null;
}

/**
 * Computes the shortest number of orthogonal steps from `start` to `goalRow`
 * respecting placed `walls`, or `null` if completely sealed off.
 */
export function getShortestPathLength(
  walls: readonly Wall[],
  start: Position,
  goalRow: number
): number | null {
  const mask = buildBlockedEdgeMask(walls);
  return bfsShortestDistanceWithMask(mask, start, goalRow);
}

/**
 * Computes a deterministic shortest path from `start` to `goalRow` (inclusive of
 * `start` and the reached goal cell), or `null` if unreachable.
 */
export function getShortestPath(
  walls: readonly Wall[],
  start: Position,
  goalRow: number
): Position[] | null {
  if (!isInBounds(start.row, start.col)) return null;
  if (start.row === goalRow) return [{ row: start.row, col: start.col }];

  const mask = buildBlockedEdgeMask(walls);
  const totalCells = GRID_SIZE * GRID_SIZE;
  const parent = new Int8Array(totalCells);
  parent.fill(-1);

  const visited = new Uint8Array(totalCells);
  const queue = new Int8Array(totalCells);
  let head = 0;
  let tail = 0;

  const startIdx = start.row * GRID_SIZE + start.col;
  visited[startIdx] = 1;
  queue[tail++] = startIdx;

  const preferDown = goalRow > start.row;
  let goalIdx = -1;

  while (head < tail && goalIdx === -1) {
    const idx = queue[head++];
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const cellMask = mask[idx];

    const neighbors: number[] = [];
    if (preferDown) {
      if (r < GRID_SIZE - 1 && (cellMask & BIT_DOWN) === 0) neighbors.push(idx + GRID_SIZE);
      if (c > 0 && (cellMask & BIT_LEFT) === 0) neighbors.push(idx - 1);
      if (c < GRID_SIZE - 1 && (cellMask & BIT_RIGHT) === 0) neighbors.push(idx + 1);
      if (r > 0 && (cellMask & BIT_UP) === 0) neighbors.push(idx - GRID_SIZE);
    } else {
      if (r > 0 && (cellMask & BIT_UP) === 0) neighbors.push(idx - GRID_SIZE);
      if (c > 0 && (cellMask & BIT_LEFT) === 0) neighbors.push(idx - 1);
      if (c < GRID_SIZE - 1 && (cellMask & BIT_RIGHT) === 0) neighbors.push(idx + 1);
      if (r < GRID_SIZE - 1 && (cellMask & BIT_DOWN) === 0) neighbors.push(idx + GRID_SIZE);
    }

    for (let i = 0; i < neighbors.length; i++) {
      const nIdx = neighbors[i];
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      parent[nIdx] = idx;
      const nRow = Math.floor(nIdx / GRID_SIZE);
      if (nRow === goalRow) {
        goalIdx = nIdx;
        break;
      }
      queue[tail++] = nIdx;
    }
  }

  if (goalIdx === -1) return null;

  const reversed: Position[] = [];
  let cur = goalIdx;
  while (cur !== -1) {
    reversed.push({
      row: Math.floor(cur / GRID_SIZE),
      col: cur % GRID_SIZE,
    });
    if (cur === startIdx) break;
    cur = parent[cur];
  }

  reversed.reverse();
  return reversed;
}

/**
 * Checks whether a candidate wall blocks at least one edge along a given path.
 * Used as a mathematically sound fast-path for BFS seal-off checks.
 */
function doesWallIntersectPath(wall: Wall, path: readonly Position[] | null): boolean {
  if (!path || path.length < 2) return true;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (a.col === b.col) {
      if (wall.orientation === "h") {
        const topRow = a.row < b.row ? a.row : b.row;
        if (wall.row === topRow && (wall.col === a.col || wall.col === a.col - 1)) {
          return true;
        }
      }
    } else if (a.row === b.row) {
      if (wall.orientation === "v") {
        const leftCol = a.col < b.col ? a.col : b.col;
        if (wall.col === leftCol && (wall.row === a.row || wall.row === a.row - 1)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Fast overlap & intersection crossing check (without BFS).
 */
export function hasWallCollision(
  walls: readonly Wall[],
  row: number,
  col: number,
  orientation: WallOrientation
): "overlap" | "crossing" | null {
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (orientation === "h") {
      if (w.orientation === "h" && w.row === row && Math.abs(w.col - col) <= 1) {
        return "overlap";
      }
      if (w.orientation === "v" && w.row === row && w.col === col) {
        return "crossing";
      }
    } else {
      if (w.orientation === "v" && w.col === col && Math.abs(w.row - row) <= 1) {
        return "overlap";
      }
      if (w.orientation === "h" && w.row === row && w.col === col) {
        return "crossing";
      }
    }
  }
  return null;
}

/**
 * Validates whether the active player can place a wall at `(row, col, orientation)`,
 * returning a structured reason if illegal.
 */
export function validateWallPlacement(
  state: WallMazeState,
  row: number,
  col: number,
  orientation: WallOrientation
): WallValidationResult {
  if (state.status !== "playing") {
    return { valid: false, reason: "game_over" };
  }

  if (state.wallsLeft[state.currentPlayer] <= 0) {
    return { valid: false, reason: "no_walls_left" };
  }

  if (!isWallInBounds(row, col)) {
    return { valid: false, reason: "out_of_bounds" };
  }

  const collision = hasWallCollision(state.walls, row, col, orientation);
  if (collision) {
    return { valid: false, reason: collision };
  }

  const candidateWall: Wall = { row, col, orientation };
  const nextWalls = [...state.walls, candidateWall];
  const mask = buildBlockedEdgeMask(nextWalls);

  const xDist = bfsShortestDistanceWithMask(mask, state.pawns.X, GOAL_ROW.X);
  if (xDist === null) {
    return { valid: false, reason: "blocks_path" };
  }

  const oDist = bfsShortestDistanceWithMask(mask, state.pawns.O, GOAL_ROW.O);
  if (oDist === null) {
    return { valid: false, reason: "blocks_path" };
  }

  return { valid: true };
}

/**
 * Returns true if placing `(row, col, orientation)` is legal for the active player.
 */
export function canPlaceWall(
  state: WallMazeState,
  row: number,
  col: number,
  orientation: WallOrientation
): boolean {
  return validateWallPlacement(state, row, col, orientation).valid;
}

/**
 * Returns all valid wall placements for the active player.
 * Uses precomputed shortest paths to skip BFS on walls that do not touch either path.
 */
export function getValidWallPlacements(state: WallMazeState): WallPlacement[] {
  if (state.status !== "playing" || state.wallsLeft[state.currentPlayer] <= 0) {
    return [];
  }

  const pathX = getShortestPath(state.walls, state.pawns.X, GOAL_ROW.X);
  const pathO = getShortestPath(state.walls, state.pawns.O, GOAL_ROW.O);
  const baseMask = buildBlockedEdgeMask(state.walls);
  const placements: WallPlacement[] = [];

  for (let r = 0; r < WALL_GRID_SIZE; r++) {
    for (let c = 0; c < WALL_GRID_SIZE; c++) {
      for (const orientation of ["h", "v"] as const) {
        if (hasWallCollision(state.walls, r, c, orientation) !== null) {
          continue;
        }

        const candidate: Wall = { row: r, col: c, orientation };
        const touchesX = doesWallIntersectPath(candidate, pathX);
        const touchesO = doesWallIntersectPath(candidate, pathO);

        if (!touchesX && !touchesO) {
          placements.push({ row: r, col: c, orientation });
          continue;
        }

        const nextMask = applyWallToMaskCopy(baseMask, candidate);
        if (touchesX && bfsShortestDistanceWithMask(nextMask, state.pawns.X, GOAL_ROW.X) === null) {
          continue;
        }
        if (touchesO && bfsShortestDistanceWithMask(nextMask, state.pawns.O, GOAL_ROW.O) === null) {
          continue;
        }

        placements.push({ row: r, col: c, orientation });
      }
    }
  }

  return placements;
}

function applyWallToMaskCopy(baseMask: Uint8Array, wall: Wall): Uint8Array {
  const mask = new Uint8Array(baseMask);
  const { row, col, orientation } = wall;
  if (orientation === "h") {
    mask[row * GRID_SIZE + col] |= BIT_DOWN;
    mask[(row + 1) * GRID_SIZE + col] |= BIT_UP;
    mask[row * GRID_SIZE + (col + 1)] |= BIT_DOWN;
    mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_UP;
  } else {
    mask[row * GRID_SIZE + col] |= BIT_RIGHT;
    mask[row * GRID_SIZE + (col + 1)] |= BIT_LEFT;
    mask[(row + 1) * GRID_SIZE + col] |= BIT_RIGHT;
    mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_LEFT;
  }
  return mask;
}

/**
 * Computes all valid pawn destinations for `player` following exact Quoridor
 * orthogonal step, straight jump, and wall/edge-blocked diagonal side-step rules.
 */
export function getValidPawnMoves(
  state: WallMazeState,
  player: Player = state.currentPlayer
): Position[] {
  if (state.status !== "playing") {
    return [];
  }

  const pos = state.pawns[player];
  const opp = getOpponent(player);
  const oppPos = state.pawns[opp];
  const moves: Position[] = [];

  for (let i = 0; i < ORTHO_DIRS.length; i++) {
    const [dr, dc] = ORTHO_DIRS[i];
    const nr = pos.row + dr;
    const nc = pos.col + dc;

    if (!isInBounds(nr, nc)) continue;
    if (isEdgeBlocked(state.walls, pos.row, pos.col, nr, nc)) continue;

    if (nr !== oppPos.row || nc !== oppPos.col) {
      moves.push({ row: nr, col: nc });
      continue;
    }

    // Adjacent cell contains opponent pawn at (or, oc) = (nr, nc)
    const or = nr;
    const oc = nc;
    const jr = or + dr;
    const jc = oc + dc;

    // 1. Straight jump when open (in bounds and not blocked by wall)
    if (isInBounds(jr, jc) && !isEdgeBlocked(state.walls, or, oc, jr, jc)) {
      moves.push({ row: jr, col: jc });
    } else {
      // 2. Diagonal side-step ONLY when straight jump is blocked by wall or board edge
      const sideOffsets: ReadonlyArray<readonly [number, number]> = [
        [dc, dr],
        [-dc, -dr],
      ];
      for (let j = 0; j < sideOffsets.length; j++) {
        const sr = or + sideOffsets[j][0];
        const sc = oc + sideOffsets[j][1];
        if (isInBounds(sr, sc) && !isEdgeBlocked(state.walls, or, oc, sr, sc)) {
          moves.push({ row: sr, col: sc });
        }
      }
    }
  }

  return moves;
}

/**
 * Pure immutable state transition for MOVE_PAWN and PLACE_WALL actions.
 * Rejects illegal moves by returning the original state unchanged.
 */
export function applyAction(
  state: WallMazeState,
  action: WallMazeAction
): WallMazeState {
  if (state.status !== "playing") {
    return state;
  }

  const activePlayer = state.currentPlayer;

  if (action.type === "MOVE_PAWN") {
    const validMoves = getValidPawnMoves(state, activePlayer);
    const isLegal = validMoves.some(
      (m) => m.row === action.row && m.col === action.col
    );
    if (!isLegal) {
      return state;
    }

    const nextPawns: Record<Player, Position> = {
      X: activePlayer === "X" ? { row: action.row, col: action.col } : { ...state.pawns.X },
      O: activePlayer === "O" ? { row: action.row, col: action.col } : { ...state.pawns.O },
    };

    const didWin = action.row === GOAL_ROW[activePlayer];

    return {
      pawns: nextPawns,
      walls: state.walls.map((w) => ({ ...w })),
      wallsLeft: { ...state.wallsLeft },
      currentPlayer: didWin ? activePlayer : getOpponent(activePlayer),
      startingPlayer: state.startingPlayer,
      status: didWin ? "finished" : "playing",
      winner: didWin ? activePlayer : null,
      moveCount: state.moveCount + 1,
      lastAction: { type: "MOVE_PAWN", row: action.row, col: action.col },
    };
  }

  if (action.type === "PLACE_WALL") {
    if (!canPlaceWall(state, action.row, action.col, action.orientation)) {
      return state;
    }

    const nextWalls: Wall[] = [
      ...state.walls.map((w) => ({ ...w })),
      {
        row: action.row,
        col: action.col,
        orientation: action.orientation,
        owner: activePlayer,
      },
    ];

    return {
      pawns: {
        X: { ...state.pawns.X },
        O: { ...state.pawns.O },
      },
      walls: nextWalls,
      wallsLeft: {
        ...state.wallsLeft,
        [activePlayer]: state.wallsLeft[activePlayer] - 1,
      },
      currentPlayer: getOpponent(activePlayer),
      startingPlayer: state.startingPlayer,
      status: "playing",
      winner: null,
      moveCount: state.moveCount + 1,
      lastAction: {
        type: "PLACE_WALL",
        row: action.row,
        col: action.col,
        orientation: action.orientation,
      },
    };
  }

  return state;
}
