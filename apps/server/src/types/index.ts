export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ALREADY_IN_ROOM"
  | "NOT_IN_ROOM"
  | "INVALID_MESSAGE"
  | "MALFORMED_JSON"
  | "MESSAGE_TOO_LARGE"
  | "INVALID_VERSION"
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "INVALID_ROOM_STATE"
  | "RECONNECT_EXPIRED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "FORBIDDEN"
  | "NOT_YOUR_TURN"
  | "INVALID_MOVE"
  | "GAME_NOT_IN_PROGRESS"
  | "GAME_NOT_OVER";

export type RoomStatus = "waiting" | "in-progress" | "completed" | "abandoned";

export interface RoomPlayerDto {
  playerId: string;
  seat: number;
  displayName?: string;
  connected: boolean;
  joinedAt: number;
  isHost?: boolean;
}

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

export type ClientMessageType =
  | "session.identify"
  | "room.create"
  | "room.join"
  | "room.leave"
  | "room.reconnect"
  | "room.update_settings"
  | "update_room_settings"
  | "room.start"
  | "start_game"
  | "ping"
  | "game.move"
  | "game.rematch"
  | "game.input"
  | "game.event"
  | "game.shot";

export type ServerMessageType =
  | "session.ready"
  | "room.created"
  | "room.joined"
  | "room.updated"
  | "room.left"
  | "room.error"
  | "server.pong"
  | "game.state"
  | "game.event";

export interface ClientEnvelope<T = unknown> {
  version: 1;
  type: ClientMessageType;
  requestId: string;
  payload: T;
}

export interface ServerEnvelope<T = unknown> {
  version: 1;
  type: ServerMessageType;
  requestId?: string;
  payload: T;
}

// Client payloads
export interface SessionIdentifyPayload {
  sessionToken?: string;
  displayName?: string;
}

export interface RoomCreatePayload {
  gameId: string;
  maxPlayers?: number;
  displayName?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateRoomSettingsPayload {
  roomId?: string;
  settings: Record<string, unknown>;
}

export interface StartGamePayload {
  roomId?: string;
}

export interface RoomJoinPayload {
  roomCode: string;
  displayName?: string;
}

export interface RoomLeavePayload {
  roomId?: string;
}

export interface RoomReconnectPayload {
  roomCode: string;
  reconnectToken: string;
}

export interface ClientPingPayload {
  clientTime?: number;
}

export interface GameMovePayload {
  roomId: string;
  position?: number;
  column?: number;
  from?: number;
  to?: number;
  edge?: {
    type: "h" | "v";
    row: number;
    col: number;
  };
  shot?: {
    dx: number;
    dy: number;
    power: number;
  };
  row?: number;
  col?: number;
  orientation?: "h" | "v";
  action?:
    | { type: "MOVE_PAWN"; row: number; col: number }
    | { type: "PLACE_WALL"; row: number; col: number; orientation: "h" | "v" }
    | { type: "PLAY_CARD"; cardId: string; chosenColor?: "red" | "yellow" | "green" | "blue" }
    | { type: "DRAW_CARD" }
    | { type: "PASS_TURN" }
    | { type: "ACCEPT_DRAW_PENALTY" }
    | { type: "CHOOSE_WILD_COLOR"; color: "red" | "yellow" | "green" | "blue" }
    | { type: "CHOOSE_SWAP_TARGET"; targetPlayerId: string }
    | { type: "CHOOSE_ROULETTE_COLOR"; color: "red" | "yellow" | "green" | "blue" }
    | { type: "CALL_UNO" }
    | { type: "CATCH_UNO"; targetPlayerId: string };
}

export interface GameRematchPayload {
  roomId: string;
}

export interface GameInputPayload {
  roomId: string;
  input: string;
  data?: unknown;
}

export interface GameEventPayload {
  roomId: string;
  event: string;
  data?: unknown;
}

export interface GameShotPayload {
  roomId: string;
  aim: {
    x: number;
    y: number;
  };
  power: number;
  seq?: number;
}

// Server payloads
export interface SessionReadyPayload {
  playerId: string;
  sessionToken: string;
  displayName?: string;
}

export interface RoomCreatedPayload {
  room: RoomDto;
  reconnectToken: string;
}

export interface RoomJoinedPayload {
  room: RoomDto;
  reconnectToken: string;
}

export interface RoomUpdatedPayload {
  room: RoomDto;
  reason?:
    | "player_joined"
    | "player_left"
    | "player_disconnected"
    | "player_reconnected"
    | "player_removed"
    | "player_kicked_afk"
    | "settings_updated"
    | "game_started"
    | "status_changed";
}

export interface RoomLeftPayload {
  roomId: string;
  reason?: string;
}

export interface RoomErrorPayload {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ServerPongPayload {
  serverTime: number;
  clientTime?: number;
}

export interface GameStatePayload {
  roomId: string;
  version: number;
  gameState: unknown;
}
