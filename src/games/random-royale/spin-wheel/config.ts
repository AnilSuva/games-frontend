/**
 * Peak angular velocity scaling factor.
 * Set to 3 to achieve approximately 3× the previous peak rotational speed
 * without altering the 12-second total duration or the smooth acceleration/deceleration motion shape.
 *
 * Previous peak angular velocity: ~347 deg/s (~0.96 rev/s, ~58 RPM) with 5–7 turns.
 * New peak angular velocity:      ~1041 deg/s (~2.89 rev/s, ~174 RPM) with 15–23 turns.
 */
export const PEAK_SPEED_MULTIPLIER = 3;

const BASE_MIN_SPIN_TURNS = 5;
const BASE_EXTRA_SPIN_TURNS = 3;

export const SPIN_WHEEL_CONFIG = {
  maxParticipants: 200,
  spinDurationMs: 12000,
  peakSpeedMultiplier: PEAK_SPEED_MULTIPLIER,
  minSpinTurns: Math.round(BASE_MIN_SPIN_TURNS * PEAK_SPEED_MULTIPLIER),
  extraSpinTurns: Math.round(BASE_EXTRA_SPIN_TURNS * PEAK_SPEED_MULTIPLIER),
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

/**
 * Calculates theoretical peak angular velocity in degrees per second.
 */
export function calculatePeakAngularVelocity(
  fullTurns: number = SPIN_WHEEL_CONFIG.minSpinTurns,
  durationMs: number = SPIN_WHEEL_CONFIG.spinDurationMs
): number {
  const accelerationEnd = Math.min(SPIN_MOTION_CONFIG.accelerationMs, durationMs * 0.3) / durationMs;
  const peakHold = Math.min(SPIN_MOTION_CONFIG.peakHoldMs, (durationMs - accelerationEnd * durationMs) * 0.1) / durationMs;
  const totalArea = accelerationEnd / 2 + peakHold + (1 - (accelerationEnd + peakHold)) / 2;
  return (fullTurns * 360) / ((durationMs / 1000) * totalArea);
}
