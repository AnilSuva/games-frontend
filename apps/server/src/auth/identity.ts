import crypto from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../config/constants.js";

/**
 * Generates a cryptographically random, unguessable player ID.
 */
export function generatePlayerId(): string {
  return `ply_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Generates a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generates a cryptographically secure single-use reconnect token.
 */
export function generateReconnectToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generates a human-friendly, uppercase alphanumeric room code.
 * Excludes ambiguous characters (0, O, 1, I).
 */
export function generateRoomCode(isCodeTaken: (code: string) => boolean): string {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const idx = crypto.randomInt(0, ROOM_CODE_ALPHABET.length);
      code += ROOM_CODE_ALPHABET[idx];
    }
    if (!isCodeTaken(code)) {
      return code;
    }
  }

  // Fallback: append random hex if namespace is congested
  return `${ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)]}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}
