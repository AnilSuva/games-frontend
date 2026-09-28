export type PlayerMark = "X" | "O";

export type CellValue = PlayerMark | null;

export type WinDirection = "horizontal" | "vertical" | "diagonal";

export interface WinningLine {
  line: [number, number, number];
  direction: WinDirection;
}

export type TicTacToeStatus = "waiting" | "in_progress" | "won" | "draw";

export type ResultReason = "win" | "draw" | "disconnect_forfeit";

export interface TicTacToeGameState {
  board: CellValue[];
  currentPlayer: PlayerMark;
  startingPlayer: PlayerMark;
  status: TicTacToeStatus;
  winner: PlayerMark | null;
  winningLine: WinningLine | null;
  moveCount: number;
  playerMarks: Record<string, PlayerMark>; // playerId -> "X" | "O"
  rematchRequests: string[]; // playerIds who requested rematch
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type TicTacToeAction =
  | { type: "MOVE"; position: number }
  | { type: "REMATCH" };
