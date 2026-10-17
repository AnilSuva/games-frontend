import {
  BLUE_KNIFE_DESTINY_Y,
  BLUE_KNIFE_SPAWN_Y,
  KNIFE_CLASH_ANGLE_THRESHOLD,
  KNIFE_SPEED,
} from "../config/constants";
import {
  angularDistance,
  calculateHitAngle,
  findTrunkGaps,
  isAngleClashing,
} from "./rotationProfiles";

export interface BotControllerConfig {
  difficulty: "easy" | "medium" | "hard";
}

/**
 * AI Bot Controller for Player Blue (Top).
 * Evaluates candidate trunk contact angles, calculates arrival timing,
 * targets open gaps, handles crowded/full logs naturally without hanging,
 * and applies human-like reaction latency and difficulty-scaled mistake probabilities.
 */
export class KnifeThrowerBot {
  private difficulty: "easy" | "medium" | "hard";
  private decisionTimer = 0;
  private patienceTimer = 0;
  private requiredWait = 0.5;
  private flightTime: number;

  constructor(config: BotControllerConfig) {
    this.difficulty = config.difficulty;
    const distance = Math.abs(BLUE_KNIFE_DESTINY_Y - BLUE_KNIFE_SPAWN_Y);
    this.flightTime = distance / KNIFE_SPEED;
    this.resetTimer();
  }

  public reset(difficulty = this.difficulty): void {
    this.difficulty = difficulty;
    this.resetTimer();
  }

  private resetTimer(): void {
    this.decisionTimer = 0;
    this.patienceTimer = 0;
    if (this.difficulty === "easy") {
      this.requiredWait = 0.65 + Math.random() * 0.55; // 0.65 - 1.20s
    } else if (this.difficulty === "medium") {
      this.requiredWait = 0.35 + Math.random() * 0.30; // 0.35 - 0.65s
    } else {
      this.requiredWait = 0.18 + Math.random() * 0.16; // 0.18 - 0.34s
    }
  }

  /**
   * Updates bot decision state.
   * Returns true when the bot decides to execute a throw.
   */
  public update(
    deltaSec: number,
    trunkRotation: number,
    trunkSpeed: number,
    embeddedAngles: number[],
    canThrow: boolean
  ): boolean {
    if (!canThrow) {
      this.decisionTimer = 0;
      this.patienceTimer = 0;
      return false;
    }

    this.decisionTimer += deltaSec;
    this.patienceTimer += deltaSec;

    // Projected arrival angle on the trunk when Blue knife lands
    const projectedTrunkRotation = trunkRotation + trunkSpeed * this.flightTime;
    const projectedHitAngle = calculateHitAngle(projectedTrunkRotation, "blue");

    // Base safety margin around clash threshold based on difficulty
    const baseSafetyMargin =
      this.difficulty === "easy" ? 0.03 : this.difficulty === "medium" ? 0.08 : 0.14;

    // Analyze gaps currently open on the rotating trunk
    const gaps = findTrunkGaps(embeddedAngles);
    let largestGap = gaps[0];
    for (let i = 1; i < gaps.length; i++) {
      if (gaps[i].size > largestGap.size) {
        largestGap = gaps[i];
      }
    }
    const maxGapSize = largestGap.size;

    // Minimum gap size needed to physically embed a knife without clashing with neighbors
    const minPhysicalSafeGap = KNIFE_CLASH_ANGLE_THRESHOLD * 2; // ~0.52 rad (~30 deg)
    const hasSpaceInLog = maxGapSize >= minPhysicalSafeGap;

    // Case 1: NO SPACE IN LOG (every gap is smaller than the clash threshold)
    // The bot must NOT freeze or refuse to throw! When there is no space, a human player
    // hesitates briefly, aims towards the best available opening, and throws anyway.
    if (!hasSpaceInLog) {
      if (this.decisionTimer >= this.requiredWait) {
        // Aim for the center of the largest available gap
        const distToGapCenter = angularDistance(projectedHitAngle, largestGap.centerAngle);
        const gapArrivalWindow = Math.max(0.25, largestGap.size / 2);
        const maxNoSpaceWait =
          this.requiredWait +
          (this.difficulty === "easy" ? 0.7 : this.difficulty === "medium" ? 0.45 : 0.25);

        if (distToGapCenter <= gapArrivalWindow || this.decisionTimer >= maxNoSpaceWait) {
          this.resetTimer();
          return true;
        }
      }
      return false;
    }

    // Case 2: SPACE EXISTS IN LOG
    // As patience increases, gradually relax safety margin towards bare physical threshold
    // so the bot can squeeze into tighter openings rather than stalling if all gaps are small.
    const patienceDecay = Math.min(
      1,
      Math.max(0, (this.patienceTimer - this.requiredWait) / 0.8)
    );
    const effectiveMargin = baseSafetyMargin * (1 - patienceDecay);
    const threshold = KNIFE_CLASH_ANGLE_THRESHOLD + effectiveMargin;

    const isSafe = !isAngleClashing(projectedHitAngle, embeddedAngles, threshold);

    // On easy/medium, occasionally simulate a human impulsive tap into a tight gap
    const mistakeChance =
      this.difficulty === "easy" ? 0.008 : this.difficulty === "medium" ? 0.002 : 0;
    const triggerMistake = Math.random() < mistakeChance;

    if ((isSafe || triggerMistake) && this.decisionTimer >= this.requiredWait) {
      this.resetTimer();
      return true;
    }

    // If gap is unsafe and bot was ready to throw, wait for trunk to rotate
    if (!isSafe && this.decisionTimer >= this.requiredWait) {
      // Aim check: if aligned with the center of the largest gap and gap can fit a knife
      const distToBestCenter = angularDistance(projectedHitAngle, largestGap.centerAngle);
      if (distToBestCenter < Math.max(0.08, (maxGapSize - minPhysicalSafeGap) / 2)) {
        this.resetTimer();
        return true;
      }

      // Hard max wait limit so bot never hangs indefinitely
      const maxGlobalWait =
        this.difficulty === "easy" ? 3.0 : this.difficulty === "medium" ? 2.2 : 1.8;
      if (this.patienceTimer >= maxGlobalWait) {
        this.resetTimer();
        return true;
      }

      this.decisionTimer = this.requiredWait * 0.85; // Recheck in next frames
    }

    return false;
  }
}
