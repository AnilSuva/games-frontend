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
  isHost?: boolean;
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
  minPlayers?: number;
  manualStart?: boolean;
  settings?: Record<string, unknown>;
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

export type DodgeArenaOnlinePlayer = "orange" | "blue";

export interface DodgeArenaLives {
  orange: number;
  blue: number;
}

export interface OnlineDodgeArenaState {
  status: "waiting" | "in_progress" | "won" | "draw" | "abandoned";
  startingPlayer: DodgeArenaOnlinePlayer;
  lives: DodgeArenaLives;
  wave: number;
  winner: DodgeArenaOnlinePlayer | "draw" | null;
  playerRoles: Record<string, DodgeArenaOnlinePlayer>;
  readyPlayers?: string[];
  seed: number;
  rematchRequests: string[];
  resultReason?: "win" | "draw" | "disconnect_forfeit";
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime?: number;
}

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

export type ChainReactionOnlinePlayer = "X" | "O";

export interface ChainReactionOnlineCell {
  count: number;
  owner: ChainReactionOnlinePlayer | null;
}

export interface ChainReactionOnlineLastMove {
  row: number;
  col: number;
  player: ChainReactionOnlinePlayer;
  moveNumber: number;
}

export interface OnlineChainReactionState {
  board: ChainReactionOnlineCell[][];
  currentPlayer: ChainReactionOnlinePlayer;
  startingPlayer: ChainReactionOnlinePlayer;
  status: "waiting" | "in_progress" | "won" | "abandoned";
  winner: ChainReactionOnlinePlayer | null;
  movesPlayed: number;
  moveNumber: number;
  lastMove: ChainReactionOnlineLastMove | null;
  orbCounts: Record<ChainReactionOnlinePlayer, number>;
  playerRoles: Record<string, ChainReactionOnlinePlayer>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type WallMazeOnlinePlayer = "X" | "O";

export type WallMazeOnlineOrientation = "h" | "v";

export interface WallMazeOnlinePosition {
  row: number;
  col: number;
}

export interface WallMazeOnlineWall {
  row: number;
  col: number;
  orientation: WallMazeOnlineOrientation;
  owner: WallMazeOnlinePlayer;
}

export interface WallMazeOnlineLastAction {
  type: "MOVE_PAWN" | "PLACE_WALL";
  row: number;
  col: number;
  orientation?: WallMazeOnlineOrientation;
  player: WallMazeOnlinePlayer;
  moveCount: number;
}

export interface OnlineWallMazeState {
  pawns: Record<WallMazeOnlinePlayer, WallMazeOnlinePosition>;
  walls: WallMazeOnlineWall[];
  wallsLeft: Record<WallMazeOnlinePlayer, number>;
  currentPlayer: WallMazeOnlinePlayer;
  startingPlayer: WallMazeOnlinePlayer;
  status: "waiting" | "in_progress" | "won" | "abandoned";
  winner: WallMazeOnlinePlayer | null;
  moveCount: number;
  lastAction: WallMazeOnlineLastAction | null;
  playerRoles: Record<string, WallMazeOnlinePlayer>;
  rematchRequests: string[];
  resultReason?: ResultReason;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export type WallMazeOnlineMoveAction =
  | { type: "MOVE_PAWN"; row: number; col: number }
  | { type: "PLACE_WALL"; row: number; col: number; orientation: WallMazeOnlineOrientation };

// ==========================================
// UNO Show 'Em No Mercy Types
// ==========================================

export type UnoCardColor = "red" | "yellow" | "green" | "blue";
export type UnoColor = UnoCardColor | "wild";

export type UnoCardKind =
  | "number"
  | "draw2"
  | "draw4"
  | "skip"
  | "skip_everyone"
  | "reverse"
  | "discard_all"
  | "wild_reverse_draw4"
  | "wild_color_roulette"
  | "wild_draw6"
  | "wild_draw10";

export interface UnoCard {
  id: string;
  color: UnoColor;
  kind: UnoCardKind;
  number?: number;
}

export interface UnoSettings {
  startingHandSize: number;
  mercyLimit: number;
  maxPlayers: number;
  turnTimeoutMs: number;
  drawUntilPlayable: boolean;
  endOnFirstMercyLoss: boolean;
}

export type UnoPlayerStatus =
  | "active"
  | "eliminated_mercy"
  | "disconnected"
  | "kicked_afk";

export interface UnoPublicPlayerInfo {
  playerId: string;
  displayName?: string;
  seat: number;
  status: UnoPlayerStatus;
  cardCount: number;
  unoCalled: boolean;
  vulnerableToUnoCatch: boolean;
}

export type UnoPhase =
  | "playing"
  | "choosing_wild_color"
  | "choosing_swap_target"
  | "choosing_roulette_color"
  | "finished";

export type UnoResultReason =
  | "emptied_hand"
  | "mercy_elimination"
  | "single_loser_mercy"
  | "last_player_standing";

export interface UnoFinalStanding {
  playerId: string;
  displayName: string;
  seat: number;
  status: UnoPlayerStatus;
  cardCount: number;
  isLoser: boolean;
  isWinner: boolean;
}

export interface OnlineUnoNoMercyState {
  gameId: "uno-no-mercy";
  status: "in_progress" | "won" | "finished";
  phase: UnoPhase;
  settings: UnoSettings;
  players: UnoPublicPlayerInfo[];
  myPlayerId: string;
  myHand: UnoCard[];
  activeActorId: string | null;
  direction: 1 | -1;
  activeColor: UnoCardColor;
  topDiscard: UnoCard;
  discardCount: number;
  drawPileCount: number;
  eliminatedReserveCount: number;
  pendingDrawCount: number;
  pendingDrawMinValue: 0 | 2 | 4 | 6 | 10;
  pendingWildCardKind: "wild_reverse_draw4" | "wild_draw6" | "wild_draw10" | null;
  hasDrawnThisTurn: boolean;
  lastRouletteReveal: UnoCard[];
  turnDeadlineAt: number | null;
  winnerId: string | null;
  loserId: string | null;
  loserName: string | null;
  loserCardCount: number | null;
  resultReason: UnoResultReason | null;
  finalStandings?: UnoFinalStanding[];
  moveCount: number;
}

export type UnoAction =
  | { type: "PLAY_CARD"; cardId: string; chosenColor?: UnoCardColor }
  | { type: "DRAW_CARD" }
  | { type: "PASS_TURN" }
  | { type: "ACCEPT_DRAW_PENALTY" }
  | { type: "CHOOSE_WILD_COLOR"; color: UnoCardColor }
  | { type: "CHOOSE_SWAP_TARGET"; targetPlayerId: string }
  | { type: "CHOOSE_ROULETTE_COLOR"; color: UnoCardColor }
  | { type: "CALL_UNO" }
  | { type: "CATCH_UNO"; targetPlayerId: string };

export interface UnoGameEventPayload {
  type: string;
  playerId?: string;
  playerName?: string;
  targetPlayerId?: string;
  catcherId?: string;
  reason?: string;
  card?: UnoCard;
  color?: UnoCardColor;
  chosenColor?: UnoCardColor;
  kind?: string;
  count?: number;
  drawnCount?: number;
  cardsDrawn?: number;
  cardCount?: number;
  mercyLimit?: number;
  direction?: 1 | -1;
  winnerId?: string;
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
