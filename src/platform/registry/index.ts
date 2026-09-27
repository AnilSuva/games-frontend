import { GAME_MANIFESTS } from "./games";
import type { GameCategory, GameManifest, GameMetadata } from "./types";

/**
 * Strips non-serializable fields (like functions) to safely pass to React Server Components.
 */
function toMetadata(manifest: GameManifest): GameMetadata {
  const { loader: _unusedLoader, ...metadata } = manifest;
  void _unusedLoader;
  return metadata;
}

/**
 * Retrieves all registered game metadata.
 */
export function getAllGames(): GameMetadata[] {
  return GAME_MANIFESTS.map(toMetadata);
}

/**
 * Retrieves game metadata by unique ID.
 */
export function getGameMetadata(id: string): GameMetadata | undefined {
  const found = GAME_MANIFESTS.find((g) => g.id === id);
  return found ? toMetadata(found) : undefined;
}

/**
 * Retrieves the full game manifest (including dynamic loader).
 */
export function getGameManifest(id: string): GameManifest | undefined {
  return GAME_MANIFESTS.find((g) => g.id === id);
}

/**
 * Filter game metadata by category ('board' | 'arcade').
 */
export function getGamesByCategory(category: GameCategory): GameMetadata[] {
  return GAME_MANIFESTS.filter((g) => g.category === category).map(toMetadata);
}

/**
 * Returns all game IDs that are currently playable.
 * Useful for Next.js `generateStaticParams()`.
 */
export function getAllAvailableGameIds(): string[] {
  return GAME_MANIFESTS.filter((g) => g.status === "available").map((g) => g.id);
}

export * from "./types";
