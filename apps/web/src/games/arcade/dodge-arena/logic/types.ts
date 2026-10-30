import type { PlatformPlayer } from "@/games/common/startingPlayer";

export type DodgePlayerColor = PlatformPlayer; // "orange" | "blue"
export type GameMode = "1v1" | "bot" | "online";
export type BotDifficulty = "easy" | "medium" | "hard";

export interface PlayerInput {
  dx: number;
  dy: number;
  seq?: number;
}

export interface PlayerSimState {
  color: DodgePlayerColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number;
  lives: number;
  isAlive: boolean;
  isInvulnerable: boolean;
  invulnerableTimeRemainingMs: number;
}

export type HazardType = "falling-strike" | "sweeping-laser" | "bouncing-hazard";
export type HazardPhase = "warning" | "active" | "expired";

export interface BaseHazard {
  id: string;
  type: HazardType;
  phase: HazardPhase;
  warningDurationMs: number;
  activeDurationMs: number;
  elapsedMs: number;
}

export interface FallingStrikeHazard extends BaseHazard {
  type: "falling-strike";
  x: number;
  y: number;
  radius: number;
}

export interface LaserSafeGap {
  start: number; // coordinate start along beam axis (x if horizontal, y if vertical)
  end: number;   // coordinate end along beam axis
}

export interface SweepingLaserHazard extends BaseHazard {
  type: "sweeping-laser";
  // The line segment sweeps perpendicular to its orientation
  orientation: "horizontal" | "vertical";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  currentCoord: number; // current y if horizontal, current x if vertical
  targetCoord: number;
  sweepSpeed: number; // px/s
  beamWidth: number;
  direction: 1 | -1; // 1 = down / right, -1 = up / left
  safeGaps: LaserSafeGap[];
}

export interface BouncingHazard extends BaseHazard {
  type: "bouncing-hazard";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounceCount: number;
  maxBounces: number;
}

export type Hazard = FallingStrikeHazard | SweepingLaserHazard | BouncingHazard;

export interface ArenaSimState {
  matchTimeMs: number;
  wave: number;
  players: Record<DodgePlayerColor, PlayerSimState>;
  hazards: Hazard[];
  isGameOver: boolean;
  winner: DodgePlayerColor | "draw" | null;
  seed: number;
}

export interface SimulationEvent {
  type: "player_hit" | "player_eliminated" | "hazard_spawned" | "hazard_activated" | "hazard_expired" | "wave_advanced" | "game_over";
  data: Record<string, unknown>;
}
