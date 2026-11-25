export type Player = "X" | "O";

export type WallOrientation = "h" | "v";

export interface Position {
  row: number;
  col: number;
}

export interface Wall {
  row: number;
  col: number;
  orientation: WallOrientation;
  owner?: Player;
}

export type WallMazeAction =
  | { type: "MOVE_PAWN"; row: number; col: number }
  | { type: "PLACE_WALL"; row: number; col: number; orientation: WallOrientation };

export type WallMazeStatus = "playing" | "finished";

export interface WallMazeState {
  pawns: Record<Player, Position>;
  walls: Wall[];
  wallsLeft: Record<Player, number>;
  currentPlayer: Player;
  startingPlayer: Player;
  status: WallMazeStatus;
  winner: Player | null;
  moveCount: number;
  lastAction: WallMazeAction | null;
}

export type WallValidationReason =
  | "game_over"
  | "no_walls_left"
  | "out_of_bounds"
  | "overlap"
  | "crossing"
  | "blocks_path";

export interface WallValidationResult {
  valid: boolean;
  reason?: WallValidationReason;
}

export interface WallPlacement {
  row: number;
  col: number;
  orientation: WallOrientation;
}
