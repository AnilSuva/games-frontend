import type { PlayerRole } from "./types";

/**
 * Normalizes an angle into [0, 2*PI).
 */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const mod = angle % twoPi;
  return mod < 0 ? mod + twoPi : mod;
}

/**
 * Calculates the shortest angular distance between two angles on a circle.
 * Result is in range [0, PI].
 */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI * 2 - diff);
}

/**
 * Calculates the local contact angle on the rotating trunk when a knife
 * hits from either player's side:
 * - Orange (Bottom): world contact point is at bottom (angle PI/2).
 *   localAngle = PI/2 - trunkRotation.
 * - Blue (Top): world contact point is at top (angle 3*PI/2).
 *   localAngle = 3*PI/2 - trunkRotation.
 */
export function calculateHitAngle(
  trunkRotation: number,
  player: PlayerRole
): number {
  const worldAngle = player === "orange" ? Math.PI / 2 : (Math.PI * 3) / 2;
  return normalizeAngle(worldAngle - trunkRotation);
}

/**
 * Determines whether a candidate contact angle clashes with any existing embedded knife angles.
 */
export function isAngleClashing(
  contactAngle: number,
  existingAngles: number[],
  threshold: number
): boolean {
  for (const existing of existingAngles) {
    if (angularDistance(contactAngle, existing) < threshold) {
      return true;
    }
  }
  return false;
}

export interface TrunkGap {
  startAngle: number;
  endAngle: number;
  size: number;
  centerAngle: number;
}

/**
 * Calculates all open angular gaps between embedded knives on the rotating trunk.
 */
export function findTrunkGaps(embeddedAngles: number[]): TrunkGap[] {
  if (embeddedAngles.length === 0) {
    return [
      {
        startAngle: 0,
        endAngle: Math.PI * 2,
        size: Math.PI * 2,
        centerAngle: Math.PI,
      },
    ];
  }

  if (embeddedAngles.length === 1) {
    const single = normalizeAngle(embeddedAngles[0]);
    return [
      {
        startAngle: single,
        endAngle: single,
        size: Math.PI * 2,
        centerAngle: normalizeAngle(single + Math.PI),
      },
    ];
  }

  const normalized = embeddedAngles
    .map((a) => normalizeAngle(a))
    .sort((a, b) => a - b);

  const gaps: TrunkGap[] = [];
  const twoPi = Math.PI * 2;

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];
    const next = i === normalized.length - 1 ? normalized[0] : normalized[i + 1];
    const size =
      i === normalized.length - 1 ? twoPi - current + next : next - current;

    const centerAngle = normalizeAngle(current + size / 2);
    gaps.push({
      startAngle: current,
      endAngle: next,
      size,
      centerAngle,
    });
  }

  return gaps;
}


export interface RotatorStep {
  speed: number; // in rad/sec
  duration: number; // in seconds
}

export interface RotatorProfileConfig {
  steps: RotatorStep[];
  transitionDuration: number; // in seconds
}

const DEG2RAD = Math.PI / 180;

/**
 * Authentic rotation profiles extracted from KnifeHitController raw MonoBehaviour in base.apk:
 * - easyRotation: [120 deg/s for 4.0s, -120 deg/s for 4.0s], transition: 1.5s
 * - mediumRotation: [150 deg/s for 4.0s, -150 deg/s for 4.0s], transition: 0.5s
 * - hardRotation: 8 steps with pauses and sudden directional cuts, transition: 0.5s
 */
export const ROTATION_PROFILES: Record<"easy" | "medium" | "hard", RotatorProfileConfig> = {
  easy: {
    steps: [
      { speed: 120 * DEG2RAD, duration: 4.0 },
      { speed: -120 * DEG2RAD, duration: 4.0 },
    ],
    transitionDuration: 1.5,
  },
  medium: {
    steps: [
      { speed: 150 * DEG2RAD, duration: 4.0 },
      { speed: -150 * DEG2RAD, duration: 4.0 },
    ],
    transitionDuration: 0.5,
  },
  hard: {
    steps: [
      { speed: 150 * DEG2RAD, duration: 1.0 },
      { speed: 100 * DEG2RAD, duration: 0.5 },
      { speed: 150 * DEG2RAD, duration: 4.0 },
      { speed: 0, duration: 0.25 },
      { speed: 100 * DEG2RAD, duration: 1.0 },
      { speed: 0, duration: 0.25 },
      { speed: -150 * DEG2RAD, duration: 0.6 },
      { speed: 0, duration: 0.25 },
    ],
    transitionDuration: 0.5,
  },
};

/**
 * Controller for the central rotating trunk.
 * Reproduces the authentic rotation profiles and step routines from base.apk Rotator.
 */
export class TrunkRotator {
  private profileName: "easy" | "medium" | "hard" = "easy";
  private profile: RotatorProfileConfig = ROTATION_PROFILES.easy;
  private currentStepIndex = 0;
  private stepTimer = 0;
  private currentSpeed = 0;

  constructor(profile: "easy" | "medium" | "hard" = "easy") {
    this.reset(profile);
  }

  public reset(profile: "easy" | "medium" | "hard" = this.profileName): void {
    this.profileName = profile;
    this.profile = ROTATION_PROFILES[profile] ?? ROTATION_PROFILES.easy;
    this.currentStepIndex = 0;
    this.stepTimer = 0;
    this.currentSpeed = this.profile.steps[0]?.speed ?? 2.0;
  }

  public setProfile(profile: "easy" | "medium" | "hard"): void {
    if (this.profileName === profile) return;
    this.profileName = profile;
    this.profile = ROTATION_PROFILES[profile] ?? ROTATION_PROFILES.easy;
    this.currentStepIndex = 0;
    this.stepTimer = 0;
  }

  public getProfileName(): "easy" | "medium" | "hard" {
    return this.profileName;
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public update(deltaSec: number): number {
    const steps = this.profile.steps;
    if (steps.length === 0) return 0;

    const currentStep = steps[this.currentStepIndex % steps.length];
    this.stepTimer += deltaSec;

    // Smooth transition toward target step speed
    const targetSpeed = currentStep.speed;
    const transitionRate =
      this.profile.transitionDuration > 0
        ? deltaSec / this.profile.transitionDuration
        : 1;

    // Smooth exponential decay lerp
    this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1, transitionRate * 3.5);

    // Advance to next step in rotation routine
    if (this.stepTimer >= currentStep.duration) {
      this.stepTimer = 0;
      this.currentStepIndex = (this.currentStepIndex + 1) % steps.length;
    }

    return this.currentSpeed * deltaSec;
  }
}
