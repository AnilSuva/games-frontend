/**
 * Lightweight, deterministic physics simulation for Connect Four disc drop animation.
 *
 * Implements:
 * - Natural gravitational acceleration down the column.
 * - Accurate target row detection and clamping.
 * - Subtle, controlled settling bounce upon reaching destination.
 * - Clean termination without overshoot.
 */

export interface DropPhysicsState {
  /** Current vertical position in pixels */
  y: number;
  /** Current vertical velocity in px/s */
  velocity: number;
  /** Whether the disc has hit the target row once and begun its settling bounce */
  hasBounced: boolean;
  /** Whether the animation has completely settled and finished */
  isFinished: boolean;
}

export const DROP_PHYSICS_CONFIG = {
  /** Gravitational acceleration in px/s^2 (tuned for satisfying 60 FPS weight) */
  gravity: 4200,
  /** Coefficient of restitution for the subtle settling bounce (0.0 - 1.0) */
  restitution: 0.18,
  /** Initial downward impulse velocity (px/s) */
  initialVelocity: 80,
  /** Multiplier for how far above the top row the disc spawns */
  spawnAboveRatio: 1.15,
} as const;

/**
 * Computes geometry helpers from the column DOM measurements.
 */
export function calculateRowGeometry(
  columnHeight: number,
  cellDiameter: number
): {
  rowStep: number;
  startY: number;
  getTargetY: (row: number) => number;
} {
  // 6 rows (indices 0..5), 5 gaps between them
  const rowStep = Math.max(1, (columnHeight - cellDiameter) / 5);
  const startY = -DROP_PHYSICS_CONFIG.spawnAboveRatio * cellDiameter;

  return {
    rowStep,
    startY,
    getTargetY: (row: number) => Math.max(0, row) * rowStep,
  };
}

/**
 * Creates the initial physics state for a falling disc.
 */
export function createInitialDropPhysics(startY: number): DropPhysicsState {
  return {
    y: startY,
    velocity: DROP_PHYSICS_CONFIG.initialVelocity,
    hasBounced: false,
    isFinished: false,
  };
}

/**
 * Advances the physics simulation by delta time (dt in seconds).
 * Returns the next state immutably.
 */
export function stepDropPhysics(
  current: DropPhysicsState,
  targetY: number,
  dt: number,
  gravity: number = DROP_PHYSICS_CONFIG.gravity,
  restitution: number = DROP_PHYSICS_CONFIG.restitution
): DropPhysicsState {
  if (current.isFinished) {
    return { ...current, y: targetY, velocity: 0 };
  }

  // Safety clamp on delta time to avoid large physics steps when tab is backgrounded
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);

  const newVelocity = current.velocity + gravity * clampedDt;
  const newY = current.y + newVelocity * clampedDt;

  // Impact detection with target landing row
  if (newY >= targetY) {
    if (!current.hasBounced) {
      // First impact: reverse velocity with restitution for a subtle settle bounce
      return {
        y: targetY,
        velocity: -Math.abs(newVelocity) * restitution,
        hasBounced: true,
        isFinished: false,
      };
    } else {
      // Second impact after bounce: clamp exactly to target and finish
      return {
        y: targetY,
        velocity: 0,
        hasBounced: true,
        isFinished: true,
      };
    }
  }

  return {
    y: newY,
    velocity: newVelocity,
    hasBounced: current.hasBounced,
    isFinished: false,
  };
}

/**
 * Deterministically simulates an entire drop from start to finish.
 * Useful for automated tests and duration estimation.
 */
export function simulateDropAnimation(
  targetRow: number,
  columnHeight = 320,
  cellDiameter = 44,
  dt = 1 / 60
): {
  frames: DropPhysicsState[];
  totalTimeMs: number;
  finalY: number;
} {
  const { startY, getTargetY } = calculateRowGeometry(columnHeight, cellDiameter);
  const targetY = getTargetY(targetRow);

  let state = createInitialDropPhysics(startY);
  const frames: DropPhysicsState[] = [{ ...state }];
  let totalTime = 0;
  const maxIterations = 300; // 5 seconds max guard

  let iter = 0;
  while (!state.isFinished && iter < maxIterations) {
    iter++;
    totalTime += dt;
    state = stepDropPhysics(state, targetY, dt);
    frames.push({ ...state });
  }

  return {
    frames,
    totalTimeMs: Math.round(totalTime * 1000),
    finalY: state.y,
  };
}
