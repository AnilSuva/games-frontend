import { z } from "zod";
import { MAX_PAYLOAD_BYTES, PROTOCOL_VERSION } from "../config/constants.js";
import type {
  ClientEnvelope,
  ClientPingPayload,
  ErrorCode,
  GameMovePayload,
  GameRematchPayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomLeavePayload,
  RoomReconnectPayload,
  SessionIdentifyPayload,
} from "../types/index.js";
import { isPayloadWithinLimit } from "./limits.js";

// Specific payload schemas
export const sessionIdentifySchema = z.object({
  sessionToken: z.string().min(1).max(128).optional(),
  displayName: z.string().trim().min(1).max(32).optional(),
});

export const roomCreateSchema = z.object({
  gameId: z.string().trim().min(1).max(64),
  maxPlayers: z.number().int().min(2).max(8).optional(),
  displayName: z.string().trim().min(1).max(32).optional(),
});

export const roomJoinSchema = z.object({
  roomCode: z.string().trim().min(1).max(16),
  displayName: z.string().trim().min(1).max(32).optional(),
});

export const roomLeaveSchema = z.object({
  roomId: z.string().uuid().optional(),
});

export const roomReconnectSchema = z.object({
  roomCode: z.string().trim().min(1).max(16),
  reconnectToken: z.string().min(1).max(128),
});

export const clientPingSchema = z.object({
  clientTime: z.number().optional(),
});

export const gameMoveSchema = z.object({
  roomId: z.string().min(1).max(64),
  position: z.number().int().min(0).max(8),
});

export const gameRematchSchema = z.object({
  roomId: z.string().min(1).max(64),
});

const baseEnvelopeSchema = z.object({
  version: z.number().int(),
  type: z.enum([
    "session.identify",
    "room.create",
    "room.join",
    "room.leave",
    "room.reconnect",
    "ping",
    "game.move",
    "game.rematch",
  ]),
  requestId: z.string().min(1).max(64),
  payload: z.unknown().default({}),
});

export type ValidatedClientMessage =
  | (ClientEnvelope<SessionIdentifyPayload> & { type: "session.identify" })
  | (ClientEnvelope<RoomCreatePayload> & { type: "room.create" })
  | (ClientEnvelope<RoomJoinPayload> & { type: "room.join" })
  | (ClientEnvelope<RoomLeavePayload> & { type: "room.leave" })
  | (ClientEnvelope<RoomReconnectPayload> & { type: "room.reconnect" })
  | (ClientEnvelope<ClientPingPayload> & { type: "ping" })
  | (ClientEnvelope<GameMovePayload> & { type: "game.move" })
  | (ClientEnvelope<GameRematchPayload> & { type: "game.rematch" });

export type ParseResult =
  | { success: true; message: ValidatedClientMessage }
  | { success: false; code: ErrorCode; error: string; requestId?: string };

export function parseClientMessage(
  raw: string | Buffer | ArrayBuffer | Buffer[]
): ParseResult {
  if (!isPayloadWithinLimit(raw, MAX_PAYLOAD_BYTES)) {
    return {
      success: false,
      code: "MESSAGE_TOO_LARGE",
      error: `Message exceeds maximum allowed size of ${MAX_PAYLOAD_BYTES} bytes`,
    };
  }

  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString("utf8");
  } else if (Array.isArray(raw)) {
    text = Buffer.concat(raw).toString("utf8");
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(raw).toString("utf8");
  } else {
    return {
      success: false,
      code: "MALFORMED_JSON",
      error: "Unsupported raw payload data format",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      success: false,
      code: "MALFORMED_JSON",
      error: "Malformed JSON payload",
    };
  }

  if (typeof parsedJson !== "object" || parsedJson === null) {
    return {
      success: false,
      code: "INVALID_MESSAGE",
      error: "Message must be an object",
    };
  }

  const rawObj = parsedJson as Record<string, unknown>;
  const requestId = typeof rawObj.requestId === "string" ? rawObj.requestId : undefined;

  const envelopeResult = baseEnvelopeSchema.safeParse(parsedJson);
  if (!envelopeResult.success) {
    if (rawObj.version !== undefined && rawObj.version !== PROTOCOL_VERSION) {
      return {
        success: false,
        code: "INVALID_VERSION",
        error: `Unsupported protocol version ${rawObj.version}. Supported version: ${PROTOCOL_VERSION}`,
        requestId,
      };
    }
    return {
      success: false,
      code: "INVALID_MESSAGE",
      error: envelopeResult.error.issues[0]?.message ?? "Invalid message envelope",
      requestId,
    };
  }

  const envelope = envelopeResult.data;
  if (envelope.version !== PROTOCOL_VERSION) {
    return {
      success: false,
      code: "INVALID_VERSION",
      error: `Unsupported protocol version ${envelope.version}. Expected ${PROTOCOL_VERSION}`,
      requestId: envelope.requestId,
    };
  }

  const payload = envelope.payload ?? {};

  switch (envelope.type) {
    case "session.identify": {
      const res = sessionIdentifySchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid identify payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "session.identify",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "room.create": {
      const res = roomCreateSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid room.create payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "room.create",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "room.join": {
      const res = roomJoinSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid room.join payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "room.join",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "room.leave": {
      const res = roomLeaveSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid room.leave payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "room.leave",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "room.reconnect": {
      const res = roomReconnectSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid room.reconnect payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "room.reconnect",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "ping": {
      const res = clientPingSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid ping payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "ping",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "game.move": {
      const res = gameMoveSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid game.move payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "game.move",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }

    case "game.rematch": {
      const res = gameRematchSchema.safeParse(payload);
      if (!res.success) {
        return {
          success: false,
          code: "INVALID_MESSAGE",
          error: res.error.issues[0]?.message ?? "Invalid game.rematch payload",
          requestId: envelope.requestId,
        };
      }
      return {
        success: true,
        message: {
          version: PROTOCOL_VERSION,
          type: "game.rematch",
          requestId: envelope.requestId,
          payload: res.data,
        },
      };
    }
  }
}
