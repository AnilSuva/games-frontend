/**
 * Multiplayer frontend environment configuration.
 *
 * Centralizes the WebSocket endpoint for local development and production.
 * In production (Vercel), configure NEXT_PUBLIC_MULTIPLAYER_WS_URL to:
 * wss://games-backend-dwqw.onrender.com/ws
 */

const DEFAULT_LOCAL_WS_URL = "ws://localhost:3001/ws";

export function getMultiplayerWsUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  return DEFAULT_LOCAL_WS_URL;
}
