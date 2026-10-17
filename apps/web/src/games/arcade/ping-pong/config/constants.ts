export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 580;

export const TABLE_MARGIN_X = 22;
export const TABLE_MARGIN_Y = 26;
export const TABLE_WIDTH = GAME_WIDTH - TABLE_MARGIN_X * 2; // 316
export const TABLE_HEIGHT = GAME_HEIGHT - TABLE_MARGIN_Y * 2; // 528

export const NET_Y = GAME_HEIGHT / 2; // 290
export const NET_HEIGHT = 8;
export const NET_STROKE_WIDTH = 4;
export const TABLE_STROKE_WIDTH = 7;

export const TOP_PADDLE_Y = 75; // Blue (Guest/Bot) paddle baseline
export const BOTTOM_PADDLE_Y = 505; // Orange (Host) paddle baseline

// Top-Down circular racket dimensions
export const PADDLE_FACE_RADIUS = 36;
export const PADDLE_WIDTH = PADDLE_FACE_RADIUS * 2; // 72
export const HANDLE_WIDTH = 16;
export const HANDLE_HEIGHT = 28;
export const PADDLE_STROKE_WIDTH = 6;
export const PADDLE_KEYBOARD_SPEED = 500;

// Authentic Table Tennis physics constants from base.apk
export const BALL_RADIUS = 13;
export const BALL_STROKE_WIDTH = 6;
export const INITIAL_BALL_SPEED = 520; // px/sec - crisp, snappy pace
export const MIN_BALL_SPEED = 460;
export const MAX_BALL_SPEED = 880;
export const SPEED_INCREMENT = 1.03; // +3% speed each rally hit
export const WINNING_SCORE = 5;

// Swipe & contact dynamics
export const SWIPE_SAMPLING_TIME = 0.20; // 200ms sampling window (secondiSuCuiFareIlSampling from base.apk)
export const MAX_DEFLECTION_ANGLE = 0.75; // ~43 degrees max angle on edge hit
export const SWIPE_VELOCITY_INFLUENCE = 0.25; // How much paddle swipe shifts ball exit angle
export const SMASH_FORWARD_THRESHOLD = 90; // Forward swipe velocity threshold for power hit
export const SMASH_BOOST = 160; // Max speed bonus on fast forward swipe

// Parabolic Z-axis arc parameters
export const Z_ARC_HEIGHT = 0.45; // Height factor for clean parabolic arc
export const TRAIL_MAX_LENGTH = 50;

// Bold minimalist palette matching reference styling
export const COLOR_BG = 0xf4d07b; // Soft yellow/tan outer floor
export const COLOR_TABLE = 0x7ac84c; // Solid vibrant green table
export const COLOR_STROKE = 0x000000; // Bold black outlines
export const COLOR_NET = 0xffffff; // Crisp white net
export const COLOR_ORANGE = 0xe0530a; // OmniPlay Orange racket face
export const COLOR_BLUE = 0x2563eb; // OmniPlay Blue racket face
export const COLOR_HANDLE = 0x1f2937; // Dark charcoal handle
export const COLOR_BALL = 0xffffff; // White ball with black stroke
