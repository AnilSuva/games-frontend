/**
 * Dodge Arena - Configuration and Game Balance Constants
 *
 * Configurable difficulty and physics parameters used across client and server.
 */

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// Arena Playable Field (Inset from canvas border)
export const ARENA_PADDING_X = 24;
export const ARENA_PADDING_Y = 28;
export const ARENA_X = ARENA_PADDING_X;
export const ARENA_Y = ARENA_PADDING_Y;
export const ARENA_WIDTH = GAME_WIDTH - ARENA_PADDING_X * 2; // 432
export const ARENA_HEIGHT = GAME_HEIGHT - ARENA_PADDING_Y * 2; // 584

export const ARENA_LEFT = ARENA_X;
export const ARENA_RIGHT = ARENA_X + ARENA_WIDTH;
export const ARENA_TOP = ARENA_Y;
export const ARENA_BOTTOM = ARENA_Y + ARENA_HEIGHT;

export const ARENA_CENTER_X = GAME_WIDTH / 2; // 240
export const ARENA_CENTER_Y = GAME_HEIGHT / 2; // 320

// Player Mechanics
export const INITIAL_LIVES = 3;
export const PLAYER_RADIUS = 18;
export const PLAYER_MAX_SPEED = 260; // px/s
export const PLAYER_ACCELERATION = 1800; // px/s^2
export const PLAYER_DECELERATION = 1900; // px/s^2
export const INVULNERABILITY_DURATION_MS = 1400; // 1.4s grace period on hit

// Starting Positions
export const ORANGE_SPAWN = { x: ARENA_CENTER_X, y: ARENA_BOTTOM - 90 };
export const BLUE_SPAWN = { x: ARENA_CENTER_X, y: ARENA_TOP + 90 };

// Hazard A: Falling Strike
export const STRIKE_RADIUS_BASE = 52;
export const STRIKE_WARNING_MS_BASE = 1300;
export const STRIKE_ACTIVE_DURATION_MS = 300;

// Hazard B: Sweeping Laser
export const LASER_BEAM_WIDTH = 26;
export const LASER_WARNING_MS_BASE = 1200;
export const LASER_SWEEP_SPEED_BASE = 210; // px/s
export const LASER_SAFE_GAP_SIZE_BASE = 104; // px (more than 2.8x player diameter of 36px)
export const LASER_COOLDOWN_MS = 3000; // minimum cooldown before another laser can spawn

// Hazard C: Bouncing Hazard
export const BOUNCER_RADIUS = 16;
export const BOUNCER_SPEED_BASE = 200; // px/s
export const BOUNCER_MAX_BOUNCES = 6;
export const BOUNCER_LIFETIME_MS = 12000;
export const BOUNCER_WARNING_MS = 800;

// Colors
export const COLOR_ORANGE = 0xf97316;
export const COLOR_ORANGE_HEX = "#f97316";
export const COLOR_BLUE = 0x3b82f6;
export const COLOR_BLUE_HEX = "#3b82f6";
export const COLOR_BG = 0x0f172a; // Slate 900
export const COLOR_ARENA_FLOOR = 0x111827; // Gray 900
export const COLOR_ARENA_BORDER = 0x334155; // Slate 700
export const COLOR_ARENA_GRID = 0x1e293b; // Slate 800
export const COLOR_HAZARD_WARNING = 0xef4444; // Red 500
export const COLOR_HAZARD_AMBER = 0xf59e0b; // Amber 500
export const COLOR_HAZARD_ACTIVE = 0xff2a2a; // Pure Red

// Wave Stages (seconds elapsed in match)
export interface WaveConfig {
  waveNumber: number;
  name: string;
  startSec: number;
  hazardIntervalMs: number;
  maxSimultaneousHazards: number;
  strikeWarningMs: number;
  laserSweepSpeed: number;
  laserWarningMs?: number;
  laserSafeGapSize?: number;
  bouncerSpeed: number;
}

export const WAVE_CONFIGURATIONS: WaveConfig[] = [
  {
    waveNumber: 1,
    name: "Wave 1 - Warmup",
    startSec: 0,
    hazardIntervalMs: 2400,
    maxSimultaneousHazards: 2,
    strikeWarningMs: 1300,
    laserSweepSpeed: 180,
    laserWarningMs: 1400,
    laserSafeGapSize: 110,
    bouncerSpeed: 180,
  },
  {
    waveNumber: 2,
    name: "Wave 2 - Escalation",
    startSec: 15,
    hazardIntervalMs: 1900,
    maxSimultaneousHazards: 3,
    strikeWarningMs: 1150,
    laserSweepSpeed: 210,
    laserWarningMs: 1250,
    laserSafeGapSize: 104,
    bouncerSpeed: 210,
  },
  {
    waveNumber: 3,
    name: "Wave 3 - Blitz",
    startSec: 35,
    hazardIntervalMs: 1500,
    maxSimultaneousHazards: 4,
    strikeWarningMs: 1000,
    laserSweepSpeed: 240,
    laserWarningMs: 1100,
    laserSafeGapSize: 98,
    bouncerSpeed: 240,
  },
  {
    waveNumber: 4,
    name: "Wave 4 - Chaos",
    startSec: 60,
    hazardIntervalMs: 1200,
    maxSimultaneousHazards: 5,
    strikeWarningMs: 900,
    laserSweepSpeed: 270,
    laserWarningMs: 950,
    laserSafeGapSize: 92,
    bouncerSpeed: 270,
  },
  {
    waveNumber: 5,
    name: "Sudden Death",
    startSec: 85,
    hazardIntervalMs: 950,
    maxSimultaneousHazards: 6,
    strikeWarningMs: 800,
    laserSweepSpeed: 300,
    laserWarningMs: 850,
    laserSafeGapSize: 88,
    bouncerSpeed: 300,
  },
];

// Bot presets
export interface BotDifficultyConfig {
  reactionDelayMs: number;
  steeringJitter: number;
  predictionHorizonSec: number;
  cornerAvoidanceWeight: number;
  speedMultiplier: number;
}

export const BOT_DIFFICULTIES: Record<"easy" | "medium" | "hard", BotDifficultyConfig> = {
  easy: {
    reactionDelayMs: 200,
    steeringJitter: 0.22,
    predictionHorizonSec: 0.45,
    cornerAvoidanceWeight: 0.8,
    speedMultiplier: 0.88,
  },
  medium: {
    reactionDelayMs: 90,
    steeringJitter: 0.08,
    predictionHorizonSec: 0.9,
    cornerAvoidanceWeight: 1.2,
    speedMultiplier: 1.0,
  },
  hard: {
    reactionDelayMs: 20,
    steeringJitter: 0.0,
    predictionHorizonSec: 1.4,
    cornerAvoidanceWeight: 1.6,
    speedMultiplier: 1.0,
  },
};
