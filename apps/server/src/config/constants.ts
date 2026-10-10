export const PROTOCOL_VERSION = 1 as const;

export const MAX_PAYLOAD_BYTES = 32 * 1024; // 32 KB

export const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const HEARTBEAT_TIMEOUT_MS = 10_000; // 10 seconds

export const DISCONNECT_GRACE_PERIOD_MS = 30_000; // 30 seconds
export const RECONNECT_TOKEN_TTL_MS = 60_000; // 60 seconds

export const ROOM_CLEANUP_INTERVAL_MS = 60_000; // 1 minute
export const ROOM_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

export const RATE_LIMIT_CAPACITY = 60; // Max burst
export const RATE_LIMIT_REFILL_PER_SEC = 35; // Refill tokens per second

export const ROOM_CODE_LENGTH = 6;
// Unambiguous uppercase alphanumeric alphabet (excluding 0, O, 1, I)
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const DEFAULT_MAX_PLAYERS = 2;
export const MAX_ALLOWED_PLAYERS = 8;
