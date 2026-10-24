/**
 * Dots and Boxes Board Geometry & Connection Helpers
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES)
 */

import type {
  BoxCoord,
  DotsBoxesConfig,
  Edge,
  EdgeId,
  PlatformPlayer,
} from "./types";

export const DEFAULT_CONFIG: DotsBoxesConfig = {
  rows: 5,
  cols: 5,
};

export function edgeToId(edge: Edge): EdgeId {
  return `${edge.type}:${edge.row}:${edge.col}`;
}

export function idToEdge(id: EdgeId): Edge {
  const [type, rowStr, colStr] = id.split(":");
  return {
    type: type as "h" | "v",
    row: Number.parseInt(rowStr, 10),
    col: Number.parseInt(colStr, 10),
  };
}

export function createEmptyHorizontalEdges(
  config: DotsBoxesConfig
): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows + 1 }, () =>
    Array(config.cols).fill(null)
  );
}

export function createEmptyVerticalEdges(
  config: DotsBoxesConfig
): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows }, () =>
    Array(config.cols + 1).fill(null)
  );
}

export function createEmptyBoxes(
  config: DotsBoxesConfig
): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows }, () =>
    Array(config.cols).fill(null)
  );
}

/**
 * Returns all boundary edges of a given box.
 * Box (r, c) is bounded by:
 * - Top: h(r, c)
 * - Bottom: h(r + 1, c)
 * - Left: v(r, c)
 * - Right: v(r, c + 1)
 */
export function getBoxEdges(box: BoxCoord): Edge[] {
  const { row: r, col: c } = box;
  return [
    { type: "h", row: r, col: c },
    { type: "h", row: r + 1, col: c },
    { type: "v", row: r, col: c },
    { type: "v", row: r, col: c + 1 },
  ];
}

/**
 * Returns the boxes adjacent to a given edge (1 or 2 boxes).
 */
export function getAdjacentBoxesForEdge(
  edge: Edge,
  config: DotsBoxesConfig
): BoxCoord[] {
  const boxes: BoxCoord[] = [];
  const { type, row, col } = edge;

  if (type === "h") {
    // Horizontal edge:
    // Box above (row - 1, col) if row > 0
    if (row > 0 && col < config.cols) {
      boxes.push({ row: row - 1, col });
    }
    // Box below (row, col) if row < config.rows
    if (row < config.rows && col < config.cols) {
      boxes.push({ row, col });
    }
  } else {
    // Vertical edge:
    // Box to the left (row, col - 1) if col > 0
    if (col > 0 && row < config.rows) {
      boxes.push({ row, col: col - 1 });
    }
    // Box to the right (row, col) if col < config.cols
    if (col < config.cols && row < config.rows) {
      boxes.push({ row, col });
    }
  }

  return boxes;
}

/**
 * Checks whether an edge is within the valid board dimensions.
 */
export function isEdgeInBounds(edge: Edge, config: DotsBoxesConfig): boolean {
  const { type, row, col } = edge;
  if (row < 0 || col < 0) return false;
  if (type === "h") {
    return row <= config.rows && col < config.cols;
  }
  if (type === "v") {
    return row < config.rows && col <= config.cols;
  }
  return false;
}

/**
 * Retrieves the current owner of an edge, or null if unclaimed.
 */
export function getEdgeOwner(
  edge: Edge,
  hEdges: (PlatformPlayer | null)[][],
  vEdges: (PlatformPlayer | null)[][]
): PlatformPlayer | null {
  if (edge.type === "h") {
    return hEdges[edge.row]?.[edge.col] ?? null;
  }
  return vEdges[edge.row]?.[edge.col] ?? null;
}

/**
 * Counts how many of the 4 edges of a box have already been drawn (0 to 4).
 */
export function countBoxCompletedEdges(
  box: BoxCoord,
  hEdges: (PlatformPlayer | null)[][],
  vEdges: (PlatformPlayer | null)[][]
): number {
  const edges = getBoxEdges(box);
  let count = 0;
  for (const edge of edges) {
    if (getEdgeOwner(edge, hEdges, vEdges) !== null) {
      count++;
    }
  }
  return count;
}

/**
 * Checks if a box has all 4 edges completed.
 */
export function isBoxComplete(
  box: BoxCoord,
  hEdges: (PlatformPlayer | null)[][],
  vEdges: (PlatformPlayer | null)[][]
): boolean {
  return countBoxCompletedEdges(box, hEdges, vEdges) === 4;
}

/**
 * Returns a list of all possible edges for the given board configuration.
 */
export function getAllBoardEdges(config: DotsBoxesConfig): Edge[] {
  const edges: Edge[] = [];
  // Horizontal edges: (rows + 1) rows x cols cols
  for (let r = 0; r <= config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      edges.push({ type: "h", row: r, col: c });
    }
  }
  // Vertical edges: rows rows x (cols + 1) cols
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c <= config.cols; c++) {
      edges.push({ type: "v", row: r, col: c });
    }
  }
  return edges;
}
