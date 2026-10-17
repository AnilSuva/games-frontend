/**
 * Two-Player Knife Thrower game configuration and geometry constants.
 * Adheres strictly to OmniPlay 360x580 mobile viewport standard.
 * Inspired by the 2-Player head-to-head duel in Two Player Games Challenge (base.apk).
 */

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 580;

// Central Rotating Trunk geometry
export const TRUNK_CENTER_X = 180;
export const TRUNK_CENTER_Y = 290; // Mid-screen height
export const TRUNK_RADIUS = 60;
export const TRUNK_STROKE_WIDTH = 5;

// Player 1 (Orange / Bottom) geometry
export const RED_KNIFE_SPAWN_X = 180;
export const RED_KNIFE_SPAWN_Y = 515;
export const RED_KNIFE_DESTINY_Y = TRUNK_CENTER_Y + TRUNK_RADIUS - 6; // 344

// Player 2 (Blue / Top) geometry
export const BLUE_KNIFE_SPAWN_X = 180;
export const BLUE_KNIFE_SPAWN_Y = 65;
export const BLUE_KNIFE_DESTINY_Y = TRUNK_CENTER_Y - TRUNK_RADIUS + 6; // 236

// Knife dimensions & physics
export const KNIFE_WIDTH = 12;
export const KNIFE_LENGTH = 50;
export const KNIFE_BLADE_LENGTH = 34;
export const KNIFE_HANDLE_LENGTH = 16;
export const KNIFE_GUARD_WIDTH = 18;
export const KNIFE_SPEED = 1450; // px/sec

// Collision threshold
// For radius 60px and knife width 12px + clearance, ~0.26 radians (~14.9 deg)
export const KNIFE_CLASH_ANGLE_THRESHOLD = 0.26; // radians

// 8 Default Obstacle Knives around the trunk (45° / PI/4 intervals)
// Matching Unity Sword Default 1..8 in base.apk:
// [0] Sword Default 1: rot_z = -90° (West / 180° in canvas)
// [1] Sword Default 2: rot_z = 90° (East / 0° in canvas)
// [2] Sword Default 3: rot_z = -135° (North-West / 225° in canvas)
// [3] Sword Default 4: rot_z = 45° (South-East / 45° in canvas)
// [4] Sword Default 5: rot_z = 180° (North / 270° in canvas)
// [5] Sword Default 6: rot_z = 0° (South / 90° in canvas)
// [6] Sword Default 7: rot_z = 135° (North-East / 315° in canvas)
// [7] Sword Default 8: rot_z = -45° (South-West / 135° in canvas)
export const DEFAULT_KNIFE_ANGLES: readonly number[] = [
  Math.PI,           // 0: West (180°)
  0,                 // 1: East (0°)
  (5 * Math.PI) / 4, // 2: North-West (225°)
  Math.PI / 4,       // 3: South-East (45°)
  (3 * Math.PI) / 2, // 4: North (270°)
  Math.PI / 2,       // 5: South (90°)
  (7 * Math.PI) / 4, // 6: North-East (315°)
  (3 * Math.PI) / 4, // 7: South-West (135°)
];

export interface TargetSetConfig {
  defaultKnifeIndices: number[];
  playerKnives: number;
  rotationProfile: "easy" | "medium" | "hard";
}

/**
 * Authentic 2-Player (1v1) progression extracted from knivesPVP in base.apk:
 * firstRound: '' (clean log)
 * rounds: ['01', '23', '67', '0145', '234567', '0123', '']
 */
export const PVP_TARGET_SETS: readonly TargetSetConfig[] = [
  // Set 0: 0 obstacle knives, 7 knives each, easy rotation (120 deg/s)
  { defaultKnifeIndices: [], playerKnives: 7, rotationProfile: "easy" },
  // Set 1: '01' -> 2 default knives (West, East), 6 knives each, medium rotation (150 deg/s)
  { defaultKnifeIndices: [0, 1], playerKnives: 6, rotationProfile: "medium" },
  // Set 2: '23' -> 2 default knives (NW, SE), 6 knives each, medium rotation (150 deg/s)
  { defaultKnifeIndices: [2, 3], playerKnives: 6, rotationProfile: "medium" },
  // Set 3: '67' -> 2 default knives (NE, SW), 6 knives each, medium rotation (150 deg/s)
  { defaultKnifeIndices: [6, 7], playerKnives: 6, rotationProfile: "medium" },
  // Set 4: '0145' -> 4 default knives (W, E, N, S), 5 knives each, hard dynamic rotation
  { defaultKnifeIndices: [0, 1, 4, 5], playerKnives: 5, rotationProfile: "hard" },
  // Set 5: '234567' -> 6 default knives, 4 knives each, hard dynamic rotation
  { defaultKnifeIndices: [2, 3, 4, 5, 6, 7], playerKnives: 4, rotationProfile: "hard" },
  // Set 6: '0123' -> 4 default knives (W, E, NW, SE), 5 knives each, hard dynamic rotation
  { defaultKnifeIndices: [0, 1, 2, 3], playerKnives: 5, rotationProfile: "hard" },
];

/**
 * Authentic Bot mode progressions extracted from knivesEasy, knivesMedium, knivesHard in base.apk
 */
export const BOT_TARGET_SETS: Record<"easy" | "medium" | "hard", readonly TargetSetConfig[]> = {
  // knivesEasy: firstRound: '', rounds: ['01', '']
  easy: [
    { defaultKnifeIndices: [], playerKnives: 5, rotationProfile: "easy" },
    { defaultKnifeIndices: [0, 1], playerKnives: 5, rotationProfile: "easy" },
  ],
  // knivesMedium: firstRound: '01', rounds: ['0123', '45', '23']
  medium: [
    { defaultKnifeIndices: [0, 1], playerKnives: 6, rotationProfile: "medium" },
    { defaultKnifeIndices: [0, 1, 2, 3], playerKnives: 5, rotationProfile: "medium" },
    { defaultKnifeIndices: [4, 5], playerKnives: 6, rotationProfile: "medium" },
    { defaultKnifeIndices: [2, 3], playerKnives: 6, rotationProfile: "medium" },
  ],
  // knivesHard: firstRound: '45', rounds: ['0145', '012345', '01', '', '45', '4567']
  hard: [
    { defaultKnifeIndices: [4, 5], playerKnives: 6, rotationProfile: "hard" },
    { defaultKnifeIndices: [0, 1, 4, 5], playerKnives: 5, rotationProfile: "hard" },
    { defaultKnifeIndices: [0, 1, 2, 3, 4, 5], playerKnives: 4, rotationProfile: "hard" },
    { defaultKnifeIndices: [0, 1], playerKnives: 6, rotationProfile: "hard" },
    { defaultKnifeIndices: [], playerKnives: 7, rotationProfile: "hard" },
    { defaultKnifeIndices: [4, 5], playerKnives: 6, rotationProfile: "hard" },
    { defaultKnifeIndices: [4, 5, 6, 7], playerKnives: 5, rotationProfile: "hard" },
  ],
};

// Knives inventory defaults
export const KNIVES_PVP = 7;
export const KNIVES_EASY = 5;
export const KNIVES_MEDIUM = 6;
export const KNIVES_HARD = 7;

// Match win condition
export const WINNING_SCORE = 5;

// Delays & Pacing (matching 0.05s respawn and 0.50s reset from base.apk)
export const RESPAWN_COOLDOWN_MS = 60;
export const ROUND_RESET_DELAY_MS = 750;
export const GAME_OVER_MODAL_DELAY_MS = 750;

// Visual Colors (OmniPlay tactile palette)
export const COLOR_BG = 0xfaf9f6; // Warm light background
export const COLOR_ORANGE = 0xe0530a; // Player 1 (Bottom)
export const COLOR_BLUE = 0x2563eb; // Player 2 (Top)
export const COLOR_TRUNK_WOOD = 0xdca56d; // Oak face
export const COLOR_TRUNK_BARK = 0x8c5627; // Tree bark rim
export const COLOR_TRUNK_RING = 0xbf854e; // Growth ring
export const COLOR_TRUNK_CORE = 0x9c612f; // Heartwood core
export const COLOR_TRUNK_STROKE = 0x1c1917; // Bold charcoal perimeter
export const COLOR_BLADE = 0xf1f5f9; // Polished steel
export const COLOR_BLADE_BEVEL = 0x94a3b8; // Bevel shadow
export const COLOR_HANDLE = 0x334155; // Slate handle grip
export const COLOR_SPARK = 0xffdf59; // Clash spark
export const COLOR_WOOD_CHIP = 0xc89050; // Wood chip
export const COLOR_DIVIDER = 0xeeece6; // Center court divider
