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

export interface StoredRoomInfo {
  roomId: string;
  roomCode: string;
  reconnectToken: string;
}

export interface WinningLine {
  line: [number, number, number];
  direction: "horizontal" | "vertical" | "diagonal";
}

export type ResultReason = "win" | "draw" | "disconnect_forfeit" | "timeout";

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

export type PlayerDisc = "R" | "Y";

export interface ConnectFourWinningLine {
  line: [number, number, number, number];
  direction: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
}

export interface ConnectFourLastMove {
  column: number;
  row: number;
  player: PlayerDisc;
}

export interface OnlineConnectFourState {
  board: (PlayerDisc | null)[];
  columnCounts: [number, number, number, number, number, number, number];
  currentPlayer: PlayerDisc;
  startingPlayer: PlayerDisc;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: PlayerDisc | null;
  winningLine: ConnectFourWinningLine | null;
  lastMove?: ConnectFourLastMove | null;
  moveCount: number;
  playerDiscs: Record<string, PlayerDisc>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type BrickBlastPlayer = "orange" | "blue";

export interface BrickBlastScore {
  orange: number;
  blue: number;
}

export interface OnlineBrickBlastState {
  status: "waiting" | "in_progress" | "won" | "abandoned";
  currentLevel: number;
  startingPlayer: BrickBlastPlayer;
  serverPlayer: BrickBlastPlayer;
  scores: BrickBlastScore;
  winner: BrickBlastPlayer | null;
  playerRoles: Record<string, BrickBlastPlayer>;
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
  ballSeed?: number;
}

export type CheckersPlayer = "orange" | "blue";

export interface CheckersLastMove {
  from: number;
  to: number;
  isJump: boolean;
  jumpedIndex?: number;
}

export interface OnlineCheckersState {
  board: number[];
  currentPlayer: CheckersPlayer;
  startingPlayer: CheckersPlayer;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: CheckersPlayer | null;
  activePiece: number | null;
  orangeCaptures: number;
  blueCaptures: number;
  moveCount: number;
  lastMove?: CheckersLastMove | null;
  playerRoles: Record<string, CheckersPlayer>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  turnExpiresAt?: number | null;
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
