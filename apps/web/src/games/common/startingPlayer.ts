/**
 * Shared starting player / first serve management system.
 * Ensures alternating first moves across matches and levels per game session.
 *
 * Persisted in sessionStorage (per browser session) with in-memory fallback.
 */

export type PlatformPlayer = "orange" | "blue";

const inMemoryStore: Record<string, PlatformPlayer> = {};

function getStorageKey(gameId: string): string {
  return `omniplay_starter_${gameId}`;
}

/**
 * Returns the current starting player for a game without advancing it.
 * Defaults to "orange" for the first match of a session.
 */
export function peekStartingPlayer(gameId: string): PlatformPlayer {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(getStorageKey(gameId));
      if (stored === "orange" || stored === "blue") {
        return stored;
      }
    } catch {
      // sessionStorage restricted / unavailable
    }
  }

  return inMemoryStore[gameId] ?? "orange";
}

/**
 * Returns the starting player for the current match and advances the rotation
 * so the next match starts with the opponent.
 */
export function consumeStartingPlayer(gameId: string): PlatformPlayer {
  const current = peekStartingPlayer(gameId);
  const next: PlatformPlayer = current === "orange" ? "blue" : "orange";

  inMemoryStore[gameId] = next;

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(getStorageKey(gameId), next);
    } catch {
      // sessionStorage restricted / unavailable
    }
  }

  return current;
}

/**
 * Explicitly advances the starting player for a game and returns the new starter.
 */
export function advanceStartingPlayer(gameId: string): PlatformPlayer {
  const current = peekStartingPlayer(gameId);
  const next: PlatformPlayer = current === "orange" ? "blue" : "orange";

  inMemoryStore[gameId] = next;

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(getStorageKey(gameId), next);
    } catch {
      // sessionStorage restricted / unavailable
    }
  }

  return next;
}

/**
 * Resets the starting player sequence for a game back to "orange".
 */
export function resetStartingPlayer(gameId: string): void {
  inMemoryStore[gameId] = "orange";

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(getStorageKey(gameId));
    } catch {
      // sessionStorage restricted / unavailable
    }
  }
}
