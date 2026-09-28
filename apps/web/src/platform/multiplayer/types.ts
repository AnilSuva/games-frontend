export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "identifying"
  | "connected"
  | "creating_room"
  | "waiting_for_opponent"
  | "joining_room"
  | "in_game"
  | "reconnecting"
  | "game_over"
  | "connection_failed";

export type PlayerMark = "X" | "O";

export interface RoomPlayerDto {
  playerId: string;
  seat: number;
  displayName?: string;
  connected: boolean;
  joinedAt: number;
}

export type RoomStatus = "waiting" | "in-progress" | "completed" | "abandoned";

export interface RoomDto {
  roomId: string;
  roomCode: string;
  gameId: string;
  status: RoomStatus;
  hostPlayerId: string;
  players: RoomPlayerDto[];
  maxPlayers: number;
  version: number;
  createdAt: number;
  gameState?: unknown;
}

export interface WinningLine {
  line: [number, number, number];
  direction: "horizontal" | "vertical" | "diagonal";
}

export type ResultReason = "win" | "draw" | "disconnect_forfeit";

export interface OnlineTicTacToeState {
  board: (PlayerMark | null)[];
  currentPlayer: PlayerMark;
  startingPlayer: PlayerMark;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: PlayerMark | null;
  winningLine: WinningLine | null;
  moveCount: number;
  playerMarks: Record<string, PlayerMark>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export interface ServerEnvelope<T = unknown> {
  version: 1;
  type: string;
  requestId?: string;
  payload: T;
}

export interface ClientEnvelope<T = unknown> {
  version: 1;
  type: string;
  requestId: string;
  payload: T;
}
