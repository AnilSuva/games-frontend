export type Player = "X" | "O";

export interface Cell {
  count: number;
  owner: Player | null;
}

export type ChainReactionStatus = "waiting" | "in_progress" | "won" | "abandoned";

export type ResultReason = "win" | "disconnect_forfeit";

export interface LastMove {
  row: number;
  col: number;
  player: Player;
  moveNumber: number;
}

export interface ChainReactionGameState {
  board: Cell[][];
  currentPlayer: Player;
  startingPlayer: Player;
  status: ChainReactionStatus;
  winner: Player | null;
  movesPlayed: number;
  moveNumber: number;
  lastMove: LastMove | null;
  orbCounts: Record<Player, number>;
  playerRoles: Record<string, Player>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type ChainReactionAction =
  | { type: "PLACE_ORB"; row: number; col: number }
  | { type: "MOVE"; row?: number; col?: number; position?: number }
  | { type: "REMATCH" };
