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

export type PingPongPlayer = "orange" | "blue";

export interface PingPongScore {
  orange: number;
  blue: number;
}

export interface OnlinePingPongState {
  status: "waiting" | "in_progress" | "won" | "abandoned";
  startingPlayer: PingPongPlayer;
  scores: PingPongScore;
  winner: PingPongPlayer | null;
  playerRoles: Record<string, PingPongPlayer>;
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
}

export type StarCatcherOnlinePlayer = "orange" | "blue";

export interface StarCatcherOnlineScore {
  orange: number;
  blue: number;
}

export interface OnlineStarCatcherState {
  status: "waiting" | "in_progress" | "won" | "abandoned";
  startingPlayer: StarCatcherOnlinePlayer;
  scores: StarCatcherOnlineScore;
  winner: StarCatcherOnlinePlayer | null;
  playerRoles: Record<string, StarCatcherOnlinePlayer>;
  readyPlayers?: string[];
  initialStar?: { x: number; y: number } | null;
  rematchRequests: string[];
  resultReason?: "win" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
}

export type DotsBoxesOnlinePlayer = "orange" | "blue";

export type TypingRaceOnlinePlayer = "orange" | "blue";

export interface TypingRacePlayerStats {
  correctChars: number;
  totalTypedChars: number;
  totalKeystrokes: number;
  errorCount: number;
  wpm: number;
  accuracy: number;
  progress: number;
  isFinished: boolean;
  finishTimeMs?: number;
}

export type PlayerRaceStats = TypingRacePlayerStats;

export interface OnlineTypingRaceState {
  status: "waiting" | "in_progress" | "won" | "abandoned";
  passageId: string;
  passageText: string;
  wordCount: number;
  countdownStartAt?: number | null;
  raceStartAt?: number | null;
  players: Record<TypingRaceOnlinePlayer, TypingRacePlayerStats>;
  playerRoles: Record<string, TypingRaceOnlinePlayer>;
  readyPlayers: string[];
  winner: TypingRaceOnlinePlayer | null;
  resultReason?: "win" | "disconnect_forfeit";
  rematchRequests: string[];
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime: number;
}

export interface OnlineDotsBoxesState {
  config: { rows: number; cols: number };
  horizontalEdges: (DotsBoxesOnlinePlayer | null)[][];
  verticalEdges: (DotsBoxesOnlinePlayer | null)[][];
  boxes: (DotsBoxesOnlinePlayer | null)[][];
  scores: Record<DotsBoxesOnlinePlayer, number>;
  currentPlayer: DotsBoxesOnlinePlayer;
  startingPlayer: DotsBoxesOnlinePlayer;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: DotsBoxesOnlinePlayer | "draw" | null;
  lastMove: {
    edge: { type: "h" | "v"; row: number; col: number };
    player: DotsBoxesOnlinePlayer;
    completedBoxes: { row: number; col: number }[];
  } | null;
  moveCount: number;
  consecutiveBoxesThisTurn: number;
  playerColors: Record<string, DotsBoxesOnlinePlayer>;
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
