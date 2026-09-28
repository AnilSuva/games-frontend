/**
 * Multiplayer frontend environment configuration.
 *
 * Centralizes the WebSocket endpoint for local development and production.
 * In production (Vercel), configure NEXT_PUBLIC_MULTIPLAYER_WS_URL to:
 * wss://games-backend-dwqw.onrender.com/ws
 */

const DEFAULT_PROD_WS_URL = "wss://games-backend-dwqw.onrender.com/ws";
const DEFAULT_LOCAL_WS_URL = "ws://localhost:3001/ws";

export function getMultiplayerWsUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }

  // Prevent deployed browser production from accidentally falling back to localhost
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "";
    if (!isLocal) {
      return DEFAULT_PROD_WS_URL;
    }
  }

  return DEFAULT_LOCAL_WS_URL;
}
