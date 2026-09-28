"use client";

import type { StoredRoomInfo } from "./types";

export const SESSION_TOKEN_KEY = "omniplay_session_token";
export const ACTIVE_ROOM_KEY = "omniplay_active_room";

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or access issues
  }
}

export function getStoredRoomInfo(): StoredRoomInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_ROOM_KEY);
    return raw ? (JSON.parse(raw) as StoredRoomInfo) : null;
  } catch {
    return null;
  }
}

export function setStoredRoomInfo(info: StoredRoomInfo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (info) {
      sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(info));
    } else {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function formatRoomErrorMessage(code: string, rawMessage?: string): string {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "Room not found. Please check the 6-character room code.";
    case "ROOM_FULL":
      return "This room is already full.";
    case "INVALID_ROOM_STATE":
      return "This match is no longer available to join.";
    case "RATE_LIMITED":
      return "Too many requests. Please slow down and try again.";
    case "RECONNECT_EXPIRED":
    case "INVALID_SESSION":
      return "The previous match has ended or expired.";
    case "UNAUTHORIZED":
      return "Multiplayer session expired. Reconnecting...";
    default:
      return rawMessage || "An error occurred. Please try again.";
  }
}

let requestCounter = 0;
export function nextRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  return `req_${Date.now()}_${requestCounter}`;
}
