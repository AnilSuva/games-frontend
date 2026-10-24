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
export const STAR_RESPAWN_DELAY_MS = 2400; // Authentic pause between star collection and respawn
export const STAR_SPAWN_PADDING_X = 45;
export const STAR_SPAWN_PADDING_Y = 70;

// Black Hole (Buco Nero) Hazard
export const BLACK_HOLE_RADIUS = 28;
export const BLACK_HOLE_PULL_RADIUS = 170;
export const BLACK_HOLE_CORE_RADIUS = 38;
export const BLACK_HOLE_MAX_FORCE = 300; // Radial acceleration
export const BLACK_HOLE_ORBIT_ESCAPE_ANGLE = Math.PI * 1.9; // ~342 deg (~full rotation orbit around singularity)
export const BLACK_HOLE_SLINGSHOT_SPEED = 340; // Escape velocity impulse on completing orbit (px/s)
export const BLACK_HOLE_ESCAPE_GRACE_SEC = 0.85; // Grace duration after slingshot to clear pull radius
export const BLACK_HOLE_FIRST_SPAWN_DELAY_MS = 8000;
export const BLACK_HOLE_INTERVAL_MS = 15000; // (sogliaBucoNero in base.apk = 15s)
export const BLACK_HOLE_DURATION_MS = 10000; // (tempoRimaneBucoNero in base.apk = 10s)

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
