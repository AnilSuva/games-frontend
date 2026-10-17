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

export const TOP_PADDLE_Y = 75; // Blue (Guest) paddle baseline
export const BOTTOM_PADDLE_Y = 505; // Orange (Host) paddle baseline

// Top-Down bold circular racket dimensions (Scale Overhaul: radius >= 35px)
export const PADDLE_FACE_RADIUS = 36;
export const PADDLE_WIDTH = PADDLE_FACE_RADIUS * 2; // 72
export const HANDLE_WIDTH = 16;
export const HANDLE_HEIGHT = 28;
export const PADDLE_STROKE_WIDTH = 6;
export const PADDLE_KEYBOARD_SPEED = 420;

// Ball & physics constants (Scale Overhaul: radius >= 12px)
export const BALL_RADIUS = 13;
export const BALL_STROKE_WIDTH = 6;
export const INITIAL_BALL_SPEED = 380;
export const MIN_BALL_SPEED = 300;
export const MAX_BALL_SPEED = 860;
export const WINNING_SCORE = 5;

// Dynamic physics parameters & Feel
export const PADDLE_VELOCITY_INFLUENCE = 0.35;
export const SMASH_FORWARD_THRESHOLD = 140; // Forward swipe velocity threshold
export const HARD_SMASH_FORWARD_THRESHOLD = 210; // Overpowered forward smash threshold that can fly out
export const HARD_HIT_SPEED_THRESHOLD = 580; // Speed threshold where a direct smash can fly out of bounds
export const BALL_DRAG_DECAY = 0.9975; // Linear damping/friction so massive smashes gradually slow down
export const MAGNUS_FORCE = 0.00075;
export const SPIN_DECAY = 0.985;
export const MAX_SPIN = 30;

// Visual & simulated Z-axis parameters
export const TRAIL_MAX_LENGTH = 70;
export const Z_PEAK_HEIGHT = 1.0;
export const AIRTIME_EXPONENT = 0.65;

// Bold minimalist palette matching reference styling
export const COLOR_BG = 0xf4d07b; // Soft yellow/tan outer floor
export const COLOR_TABLE = 0x7ac84c; // Solid vibrant green table
export const COLOR_STROKE = 0x000000; // Bold black outlines
export const COLOR_NET = 0xffffff; // Crisp white net
export const COLOR_ORANGE = 0xe0530a; // OmniPlay Orange racket face
export const COLOR_BLUE = 0x2563eb; // OmniPlay Blue racket face
export const COLOR_HANDLE = 0x1f2937; // Dark charcoal handle
export const COLOR_BALL = 0xffffff; // White ball with black stroke
