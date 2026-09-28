import type { ComponentType } from "react";
import type { GameHostProps, GameMode } from "@/games/common/types";

export type GameCategory = "board" | "arcade" | "random-royale";
export type GameEngine = "react-dom" | "phaser";
export type GameStatus = "available" | "coming-soon";
export type GameOrientation = "portrait" | "landscape" | "any";

/**
 * Pure serializable metadata for a game.
 * Safe to pass between Server Components and Client Components.
 */
export interface GameMetadata {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  category: GameCategory;
  engine: GameEngine;
  status: GameStatus;
  supportedModes: GameMode[];
  defaultOrientation: GameOrientation;
  aspectRatio: "1/1" | "4/3" | "16/9" | "responsive";
  iconName: string;
  badgeText?: string;
  tags: string[];
  /** Whether the game is visible in the public catalog / landing page */
  isVisible?: boolean;
}

/**
 * Full game manifest including code-splitting dynamic loader.
 */
export interface GameManifest extends GameMetadata {
  loader?: () => Promise<{ default: ComponentType<GameHostProps> }>;
}
