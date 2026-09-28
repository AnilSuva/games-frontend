/**
 * Brick Blast Game Balance Constants and Configurations.
 * Clean, centralized constants with zero magic numbers scattered in code.
 */

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 580;

export const PADDLE_WIDTH = 72;
export const PADDLE_HEIGHT = 10;
export const PADDLE_RADIUS = 5;
export const PADDLE_KEYBOARD_SPEED = 380; // px/sec

export const TOP_PADDLE_Y = 46;
export const BOTTOM_PADDLE_Y = 534;

export const COLOR_ORANGE = 0xe0530a;
export const COLOR_BLUE = 0x2563eb;
export const COLOR_BG = 0xfaf9f6;
export const COLOR_WALL = 0xe6e3dc;
export const COLOR_SPECIAL = 0xd97706;
export const COLOR_BRICK_NORMAL = 0x64748b;
export const COLOR_BRICK_STRONG = 0x334155;

export const INITIAL_BALL_SPEED = 270; // px/sec
export const LEVEL_SPEED_MULTIPLIER = 1.05;
export const MIN_SPEED_FACTOR = 0.70;
export const MAX_SPEED_FACTOR = 1.65;

export const DEFAULT_BALL_RADIUS = 6;
export const MIN_BALL_RADIUS = 4.5;
export const MAX_BALL_RADIUS = 13;

export const DEFAULT_BALL_POWER = 1;
export const MAX_BALL_POWER = 3;

export const MAX_ACTIVE_BALLS = 4;
export const POWERUP_FALL_SPEED = 120; // px/sec

export const BRICK_COLS = 7;
export const BRICK_ROWS = 8;
export const BRICK_WIDTH = 42;
export const BRICK_HEIGHT = 15;
export const BRICK_GAP_X = 5;
export const BRICK_GAP_Y = 5;
export const BRICK_START_Y = 175;

export const SPECIAL_BRICK_TARGET_RATIO = 0.06; // ~5-6% special bricks

export const POINTS_NORMAL_BRICK = 20;
export const POINTS_STRONG_BRICK = 50;
export const POINTS_SPECIAL_BRICK = 80;
export const POINTS_WIN_LEVEL = 200;
