export type Player = "X" | "O";

export interface Cell {
  count: number;
  owner: Player | null;
}

export type ChainReactionStatus = "playing" | "finished";

export interface ExplosionTarget {
  row: number;
  col: number;
}

export interface Explosion {
  fromRow: number;
  fromCol: number;
  targets: ExplosionTarget[];
}

export interface CascadeWave {
  waveIndex: number;
  explosions: Explosion[];
  board: Cell[][];
  player: Player;
}

export interface MoveLocation {
  row: number;
  col: number;
}

export interface ChainReactionState {
  grid: Cell[][];
  currentPlayer: Player;
  startingPlayer: Player;
  status: ChainReactionStatus;
  winner: Player | null;
  movesPlayed: number;
  playerMoves: Record<Player, number>;
  lastMove: MoveLocation | null;
}

export type ChainReactionAction =
  | { type: "PLACE_ORB"; row: number; col: number }
  | { type: "RESET"; startingPlayer?: Player };
