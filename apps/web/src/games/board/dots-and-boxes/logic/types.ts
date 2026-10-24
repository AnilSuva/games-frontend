/**
 * Dots and Boxes (JungleFrog.NPlayers.DotsBoxes) Core Types
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES)
 */

export type PlatformPlayer = "orange" | "blue";

export type EdgeType = "h" | "v";

export interface Edge {
  type: EdgeType;
  row: number;
  col: number;
}

export type EdgeId = `${EdgeType}:${number}:${number}`;

export interface BoxCoord {
  row: number;
  col: number;
}

export interface DotsBoxesConfig {
  /** Number of box rows (default 5, resulting in 6 dot rows) */
  rows: number;
  /** Number of box columns (default 5, resulting in 6 dot columns) */
  cols: number;
}

export type GameStatus = "waiting" | "in_progress" | "completed";

export interface LastMoveInfo {
  edge: Edge;
  edgeId: EdgeId;
  player: PlatformPlayer;
  completedBoxes: BoxCoord[];
}

export interface DotsBoxesState {
  config: DotsBoxesConfig;
  /**
   * Horizontal edges grid: (rows + 1) rows x cols columns.
   * horizontalEdges[r][c] is the edge connecting dot (r, c) and dot (r, c + 1).
   */
  horizontalEdges: (PlatformPlayer | null)[][];
  /**
   * Vertical edges grid: rows rows x (cols + 1) columns.
   * verticalEdges[r][c] is the edge connecting dot (r, c) and dot (r + 1, c).
   */
  verticalEdges: (PlatformPlayer | null)[][];
  /**
   * Boxes grid: rows rows x cols columns.
   * boxes[r][c] indicates which player completed and owns box (r, c).
   */
  boxes: (PlatformPlayer | null)[][];
  /** Scores count claimed boxes per player */
  scores: Record<PlatformPlayer, number>;
  /** The player whose turn it currently is */
  currentPlayer: PlatformPlayer;
  /** Overall game progress */
  status: GameStatus;
  /** Winner determination: player, "draw", or null if in progress */
  winner: PlatformPlayer | "draw" | null;
  /** Details of the most recent edge drawn and any resulting box captures */
  lastMove: LastMoveInfo | null;
  /** Total number of edges drawn so far */
  moveCount: number;
  /** Consecutive boxes scored in the current turn */
  consecutiveBoxesThisTurn: number;
}
