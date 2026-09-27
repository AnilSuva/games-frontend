export const SPIN_WHEEL_CONFIG = {
  maxParticipants: 200,
  spinDurationMs: 12000,
  minSpinTurns: 5,
  extraSpinTurns: 3,
  wheelRadius: 240,
  centerCoord: 250,
  maxVisibleLabels: 16,
  maxLabelLength: 14,
  colors: [
    "#F3B768",
    "#99C7C4",
    "#E78C72",
    "#A8B7D8",
    "#E6C777",
    "#9CBF91",
    "#D7A3B6",
    "#B5A7D5",
  ],
} as const;

/** Velocity-curve timing; remaining spin time is reserved for gradual deceleration. */
export const SPIN_MOTION_CONFIG = {
  accelerationMs: 1500,
  peakHoldMs: 450,
  durationVariationMs: 1400,
  reducedMotionDurationMs: 1200,
} as const;

export const MAX_PARTICIPANTS = SPIN_WHEEL_CONFIG.maxParticipants;
export const SPIN_DURATION_MS = SPIN_WHEEL_CONFIG.spinDurationMs;
export const MIN_SPIN_TURNS = SPIN_WHEEL_CONFIG.minSpinTurns;
export const EXTRA_SPIN_TURNS = SPIN_WHEEL_CONFIG.extraSpinTurns;
export const WHEEL_COLORS = SPIN_WHEEL_CONFIG.colors;
