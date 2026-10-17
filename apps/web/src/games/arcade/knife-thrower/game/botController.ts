import {
  BLUE_KNIFE_DESTINY_Y,
  BLUE_KNIFE_SPAWN_Y,
  KNIFE_CLASH_ANGLE_THRESHOLD,
  KNIFE_SPEED,
} from "../config/constants";
import { calculateHitAngle, isAngleClashing } from "./rotationProfiles";

export interface BotControllerConfig {
  difficulty: "easy" | "medium" | "hard";
}

/**
 * AI Bot Controller for Player Blue (Top).
 * Reproduces the observed decision-making from KnifeHitBot in Two Player Games Challenge:
 * evaluates candidate trunk contact angles, calculates arrival timing, and applies human-like
 * reaction latency and difficulty-scaled mistake probabilities.
 */
export class KnifeThrowerBot {
  private difficulty: "easy" | "medium" | "hard";
  private decisionTimer = 0;
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
      return false;
    }

    this.decisionTimer += deltaSec;

    // Projected arrival angle on the trunk when Blue knife lands
    const projectedTrunkRotation = trunkRotation + trunkSpeed * this.flightTime;
    const projectedHitAngle = calculateHitAngle(projectedTrunkRotation, "blue");

    // Safety margin around clash threshold based on difficulty
    const safetyMargin =
      this.difficulty === "easy" ? 0.03 : this.difficulty === "medium" ? 0.08 : 0.14;
    const threshold = KNIFE_CLASH_ANGLE_THRESHOLD + safetyMargin;

    const isSafe = !isAngleClashing(
      projectedHitAngle,
      embeddedAngles,
      threshold
    );

    // On easy/medium, occasionally simulate a human mistake or impulsive tap into a tight gap
    const mistakeChance =
      this.difficulty === "easy" ? 0.008 : this.difficulty === "medium" ? 0.002 : 0;
    const triggerMistake = Math.random() < mistakeChance;

    if ((isSafe || triggerMistake) && this.decisionTimer >= this.requiredWait) {
      this.resetTimer();
      return true;
    }

    // If gap is unsafe and bot was ready to throw, reset timer and wait for trunk to rotate
    if (!isSafe && this.decisionTimer >= this.requiredWait) {
      this.decisionTimer = this.requiredWait * 0.7; // Recheck in a few frames
    }

    return false;
  }
}
