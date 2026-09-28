import { SPIN_MOTION_CONFIG } from "../config";

interface SpinMotion {
  positionAt: (progress: number) => number;
  normalizedVelocityAt: (progress: number) => number;
}

/** Precomputes a normalized velocity curve and its integral for one spin. */
export function createSpinMotion(durationMs: number): SpinMotion {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("Spin duration must be a positive finite number.");
  }

  const accelerationMs = Math.min(
    SPIN_MOTION_CONFIG.accelerationMs,
    durationMs * 0.3
  );
  const peakHoldMs = Math.min(
    SPIN_MOTION_CONFIG.peakHoldMs,
    (durationMs - accelerationMs) * 0.1
  );
  const accelerationEnd = accelerationMs / durationMs;
  const peakEnd = (accelerationMs + peakHoldMs) / durationMs;
  const decelerationLength = 1 - peakEnd;
  const totalArea = accelerationEnd / 2 + peakHoldMs / durationMs + decelerationLength / 2;
  const peakArea = accelerationEnd / 2 + peakHoldMs / durationMs;

  const normalizedVelocityAt = (progress: number): number => {
    const t = Math.min(1, Math.max(0, progress));
    if (t === 0 || t === 1) return 0;

    if (t < accelerationEnd) {
      const u = t / accelerationEnd;
      return 3 * u ** 2 - 2 * u ** 3;
    }
    if (t < peakEnd) return 1;

    const u = (t - peakEnd) / decelerationLength;
    const cosine = Math.cos((Math.PI * u) / 2);
    return cosine * cosine;
  };

  const positionAt = (progress: number): number => {
    const t = Math.min(1, Math.max(0, progress));
    if (t === 0) return 0;
    if (t === 1) return 1;

    if (t < accelerationEnd) {
      const u = t / accelerationEnd;
      return (accelerationEnd * (u ** 3 - 0.5 * u ** 4)) / totalArea;
    }
    if (t < peakEnd) {
      return (accelerationEnd / 2 + t - accelerationEnd) / totalArea;
    }

    const u = (t - peakEnd) / decelerationLength;
    const decelerationArea =
      (decelerationLength / 2) * (u + Math.sin(Math.PI * u) / Math.PI);
    return (peakArea + decelerationArea) / totalArea;
  };

  return { positionAt, normalizedVelocityAt };
}
