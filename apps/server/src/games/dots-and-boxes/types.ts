export type PlatformPlayer = "orange" | "blue";

export type EdgeType = "h" | "v";

export interface Edge {
  type: EdgeType;
  row: number;
  col: number;
}

export interface BoxCoord {
  row: number;
  col: number;
}

export interface DotsBoxesConfig {
  rows: number;
  cols: number;
}

export interface LastMoveInfo {
  edge: Edge;
  player: PlatformPlayer;
  completedBoxes: BoxCoord[];
}

export type ResultReason = "win" | "draw" | "disconnect_forfeit" | "timeout";

export interface DotsBoxesGameState {
  config: DotsBoxesConfig;
  horizontalEdges: (PlatformPlayer | null)[][];
  verticalEdges: (PlatformPlayer | null)[][];
  boxes: (PlatformPlayer | null)[][];
  scores: Record<PlatformPlayer, number>;
  currentPlayer: PlatformPlayer;
  startingPlayer: PlatformPlayer;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: PlatformPlayer | "draw" | null;
  lastMove: LastMoveInfo | null;
  moveCount: number;
  consecutiveBoxesThisTurn: number;
  playerColors: Record<string, PlatformPlayer>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type DotsBoxesAction =
  | { type: "CLAIM_EDGE"; edge: Edge }
  | { type: "REMATCH" };
