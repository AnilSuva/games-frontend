/**
 * Star Catcher (Astronavi) Configuration Constants
 * Reverse-engineered from Two Player Games Challenge (19_ASTRONAVI)
 */

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 600;

export const WINNING_SCORE = 5;

// Ship Physics
export const SHIP_RADIUS = 16;
export const SHIP_MASS = 1.0;
export const SHIP_THRUST = 440; // px/s^2 (potenzaMotori)
export const SHIP_MAX_SPEED = 320; // px/s
export const SHIP_DRAG = 0.985; // Linear dampening per 60fps tick
export const SHIP_ROTATION_LERP = 0.16; // (velocitaLerpRotazione)
export const SHIP_BOUNCE_IMPULSE = 280; // (potenzaRimbalzo)

// Screen edge wrapping margins (Teletrasporto)
export const WRAP_MARGIN = 20;

// Star mechanics
export const STAR_RADIUS = 18;
export const STAR_COLLECT_RADIUS = 28;
export const STAR_RESPAWN_DELAY_MS = 1200;
export const STAR_SPAWN_PADDING_X = 45;
export const STAR_SPAWN_PADDING_Y = 70;

// Black Hole (Buco Nero) Hazard
export const BLACK_HOLE_RADIUS = 28;
export const BLACK_HOLE_PULL_RADIUS = 170;
export const BLACK_HOLE_MAX_FORCE = 240; // Max gravitational acceleration at center
export const BLACK_HOLE_FIRST_SPAWN_DELAY_MS = 8000;
export const BLACK_HOLE_INTERVAL_MS = 16000;
export const BLACK_HOLE_DURATION_MS = 7500; // (tempoRimaneBucoNero)

// Asteroid Hazards
export const NUM_ASTEROIDS = 2;
export const ASTEROID_RADIUS = 22;
export const ASTEROID_MIN_SPEED = 30;
export const ASTEROID_MAX_SPEED = 60;

// Colors
export const COLOR_BG = 0x090d16;
export const COLOR_BG_HEX = "#090d16";
export const COLOR_ORANGE = 0xe0530a;
export const COLOR_ORANGE_HEX = "#e0530a";
export const COLOR_ORANGE_LIGHT = 0xf97316;
export const COLOR_BLUE = 0x2563eb;
export const COLOR_BLUE_HEX = "#2563eb";
export const COLOR_BLUE_LIGHT = 0x3b82f6;
export const COLOR_STAR = 0xfbbf24;
export const COLOR_STAR_CORE = 0xfffbeb;
export const COLOR_BLACK_HOLE = 0x1e1035;
export const COLOR_ACCRETION = 0x8b5cf6;
export const COLOR_ASTEROID = 0x64748b;
export const COLOR_ASTEROID_DARK = 0x334155;

// Spawning initial positions
export const BLUE_START_X = GAME_WIDTH / 2;
export const BLUE_START_Y = 130;
export const BLUE_START_ANGLE = Math.PI / 2; // Facing down

export const ORANGE_START_X = GAME_WIDTH / 2;
export const ORANGE_START_Y = GAME_HEIGHT - 130;
export const ORANGE_START_ANGLE = -Math.PI / 2; // Facing up
