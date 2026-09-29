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
      hostname === "" ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    if (isLocal) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = hostname || "localhost";
      return `${protocol}//${host}:3001/ws`;
    }

    return DEFAULT_PROD_WS_URL;
  }

  return DEFAULT_LOCAL_WS_URL;
}
