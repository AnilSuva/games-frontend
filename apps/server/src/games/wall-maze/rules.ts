import type { Player, Position, Wall, WallOrientation } from "./types.js";

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

const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const BIT_UP = 1;
const BIT_DOWN = 2;
const BIT_LEFT = 4;
const BIT_RIGHT = 8;

export function getOpponent(player: Player): Player {
  return player === "X" ? "O" : "X";
}

export function isInBounds(row: number, col: number): boolean {
  return (
    typeof row === "number" &&
    typeof col === "number" &&
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
    typeof row === "number" &&
    typeof col === "number" &&
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < WALL_GRID_SIZE &&
    col >= 0 &&
    col < WALL_GRID_SIZE
  );
}

export function isEdgeBlocked(
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[],
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
    const topRow = r1 < r2 ? r1 : r2;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.orientation === "h" && w.row === topRow && (w.col === c1 || w.col === c1 - 1)) {
        return true;
      }
    }
    return false;
  }

  const leftCol = c1 < c2 ? c1 : c2;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.orientation === "v" && w.col === leftCol && (w.row === r1 || w.row === r1 - 1)) {
      return true;
    }
  }
  return false;
}

export function buildBlockedEdgeMask(
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[]
): Uint8Array {
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

export function getShortestPathLength(
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[],
  start: Position,
  goalRow: number
): number | null {
  if (!isInBounds(start.row, start.col)) return null;
  if (start.row === goalRow) return 0;

  const mask = buildBlockedEdgeMask(walls);
  const totalCells = GRID_SIZE * GRID_SIZE;
  const dist = new Int8Array(totalCells);
  dist.fill(-1);

  const queue = new Int8Array(totalCells);
  let head = 0;
  let tail = 0;

  const startIdx = start.row * GRID_SIZE + start.col;
  dist[startIdx] = 0;
  queue[tail++] = startIdx;

  while (head < tail) {
    const idx = queue[head++];
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const nextDist = dist[idx] + 1;
    const cellMask = mask[idx];

    if (r > 0 && (cellMask & BIT_UP) === 0) {
      const nIdx = idx - GRID_SIZE;
      if (dist[nIdx] === -1) {
        if (r - 1 === goalRow) return nextDist;
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
  }

  return null;
}

export function getValidPawnMoves(
  pawns: Record<Player, Position>,
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[],
  player: Player
): Position[] {
  const pos = pawns[player];
  const oppPos = pawns[getOpponent(player)];
  const moves: Position[] = [];

  for (let i = 0; i < ORTHO_DIRS.length; i++) {
    const [dr, dc] = ORTHO_DIRS[i];
    const nr = pos.row + dr;
    const nc = pos.col + dc;

    if (!isInBounds(nr, nc)) continue;
    if (isEdgeBlocked(walls, pos.row, pos.col, nr, nc)) continue;

    if (nr !== oppPos.row || nc !== oppPos.col) {
      moves.push({ row: nr, col: nc });
      continue;
    }

    const or = nr;
    const oc = nc;
    const jr = or + dr;
    const jc = oc + dc;

    if (isInBounds(jr, jc) && !isEdgeBlocked(walls, or, oc, jr, jc)) {
      moves.push({ row: jr, col: jc });
    } else {
      const sideOffsets: ReadonlyArray<readonly [number, number]> = [
        [dc, dr],
        [-dc, -dr],
      ];
      for (let j = 0; j < sideOffsets.length; j++) {
        const sr = or + sideOffsets[j][0];
        const sc = oc + sideOffsets[j][1];
        if (isInBounds(sr, sc) && !isEdgeBlocked(walls, or, oc, sr, sc)) {
          moves.push({ row: sr, col: sc });
        }
      }
    }
  }

  return moves;
}

export function hasWallCollision(
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[],
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

export function validateWallPlacement(
  pawns: Record<Player, Position>,
  walls: readonly Pick<Wall, "row" | "col" | "orientation">[],
  wallsLeft: Record<Player, number>,
  player: Player,
  row: number,
  col: number,
  orientation: WallOrientation
): { valid: boolean; error?: string } {
  if (wallsLeft[player] <= 0) {
    return { valid: false, error: "Invalid wall: no walls remaining" };
  }

  if (orientation !== "h" && orientation !== "v") {
    return { valid: false, error: "Invalid wall: invalid orientation" };
  }

  if (!isWallInBounds(row, col)) {
    return { valid: false, error: "Invalid wall: coordinates out of bounds" };
  }

  const collision = hasWallCollision(walls, row, col, orientation);
  if (collision === "overlap") {
    return { valid: false, error: "Invalid wall: overlaps existing wall" };
  }
  if (collision === "crossing") {
    return { valid: false, error: "Invalid wall: crosses existing wall" };
  }

  const nextWalls = [...walls, { row, col, orientation }];
  if (getShortestPathLength(nextWalls, pawns.X, GOAL_ROW.X) === null) {
    return { valid: false, error: "Invalid wall: blocks all paths for Orange" };
  }
  if (getShortestPathLength(nextWalls, pawns.O, GOAL_ROW.O) === null) {
    return { valid: false, error: "Invalid wall: blocks all paths for Blue" };
  }

  return { valid: true };
}
