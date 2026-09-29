export type PlayerDisc = "R" | "Y";

export type CellValue = PlayerDisc | null;

export const COLUMNS = 7;
export const ROWS = 6;
export const WIN_LENGTH = 4;

export type WinDirection =
  | "horizontal"
  | "vertical"
  | "diagonal-down"
  | "diagonal-up";

export interface WinningLine {
  line: [number, number, number, number];
  direction: WinDirection;
}

export type ConnectFourStatus = "waiting" | "in_progress" | "won" | "draw";

export type ResultReason = "win" | "draw" | "disconnect_forfeit";

export interface ConnectFourLastMove {
  column: number;
  row: number;
  player: PlayerDisc;
}

export interface ConnectFourGameState {
  board: CellValue[];
  columnCounts: [number, number, number, number, number, number, number];
  currentPlayer: PlayerDisc;
  startingPlayer: PlayerDisc;
  status: ConnectFourStatus;
  winner: PlayerDisc | null;
  winningLine: WinningLine | null;
  lastMove?: ConnectFourLastMove | null;
  moveCount: number;
  playerDiscs: Record<string, PlayerDisc>; // playerId -> "R" | "Y"
  rematchRequests: string[]; // playerIds who requested rematch
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type ConnectFourAction =
  | { type: "MOVE"; column: number }
  | { type: "REMATCH" };
