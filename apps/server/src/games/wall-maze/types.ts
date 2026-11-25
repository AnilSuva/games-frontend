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
  owner: Player;
}

export type WallMazeStatus = "waiting" | "in_progress" | "won" | "abandoned";

export type ResultReason = "win" | "disconnect_forfeit";

export interface WallMazeLastAction {
  type: "MOVE_PAWN" | "PLACE_WALL";
  row: number;
  col: number;
  orientation?: WallOrientation;
  player: Player;
  moveCount: number;
}

export interface WallMazeGameState {
  pawns: Record<Player, Position>;
  walls: Wall[];
  wallsLeft: Record<Player, number>;
  currentPlayer: Player;
  startingPlayer: Player;
  status: WallMazeStatus;
  winner: Player | null;
  moveCount: number;
  lastAction: WallMazeLastAction | null;
  playerRoles: Record<string, Player>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type WallMazeAction =
  | { type: "MOVE_PAWN"; row: number; col: number }
  | { type: "PLACE_WALL"; row: number; col: number; orientation: WallOrientation }
  | { type: "REMATCH" };
