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
 * Retrieves all registered game metadata for visible, playable games in the public catalog.
 * Excludes unfinished, placeholder, or coming-soon games.
 */
export function getAllGames(): GameMetadata[] {
  return GAME_MANIFESTS.filter(
    (g) => g.status === "available" && g.isVisible !== false
  ).map(toMetadata);
}

/**
 * Explicit helper to retrieve visible catalog games.
 */
export function getVisibleGames(): GameMetadata[] {
  return getAllGames();
}

/**
 * Retrieves all registered game metadata regardless of release status (for internal tooling/dev).
 */
export function getAllRegisteredGames(): GameMetadata[] {
  return GAME_MANIFESTS.map(toMetadata);
}

/**
 * Retrieves game metadata by unique ID. Only returns playable/visible games.
 */
export function getGameMetadata(id: string): GameMetadata | undefined {
  const found = GAME_MANIFESTS.find(
    (g) => g.id === id && g.status === "available" && g.isVisible !== false
  );
  return found ? toMetadata(found) : undefined;
}

/**
 * Retrieves raw registered game metadata by unique ID including unreleased games.
 */
export function getRegisteredGameMetadata(id: string): GameMetadata | undefined {
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
 * Filter visible game metadata by category ('board' | 'arcade').
 */
export function getGamesByCategory(category: GameCategory): GameMetadata[] {
  return getAllGames().filter((g) => g.category === category);
}

/**
 * Returns all game IDs that are currently playable.
 * Useful for Next.js `generateStaticParams()`.
 */
export function getAllAvailableGameIds(): string[] {
  return GAME_MANIFESTS.filter(
    (g) => g.status === "available" && g.isVisible !== false
  ).map((g) => g.id);
}

export * from "./types";
