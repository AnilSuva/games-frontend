import type { PowerUpType } from "../config/powerUps";
import type { BrickDefinition } from "../levels/generator";
import type { PlatformPlayer } from "@/games/common/startingPlayer";

export interface BrickBlastCallbacks {
  onScoreUpdate?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (result: {
    winner: PlatformPlayer;
    score: number;
    details?: Record<string, unknown>;
  }) => void;
  onLifecycleChange?: (status: "playing" | "paused" | "finished") => void;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  power: number;
  speedMultiplier: number;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

export interface Paddle {
  player: PlatformPlayer;
  x: number;
  y: number;
  width: number;
  height: number;
  graphics: Phaser.GameObjects.Graphics;
}

export interface Brick {
  def: BrickDefinition;
  hp: number;
  alive: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

export interface DroppedPowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  vy: number;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
}
