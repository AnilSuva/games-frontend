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
}

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

export type ClientMessageType =
  | "session.identify"
  | "room.create"
  | "room.join"
  | "room.leave"
  | "room.reconnect"
  | "ping"
  | "game.move"
  | "game.rematch"
  | "game.input"
  | "game.event";

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
  reason?: "player_joined" | "player_left" | "player_disconnected" | "player_reconnected" | "status_changed";
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
