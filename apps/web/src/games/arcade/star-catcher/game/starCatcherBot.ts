/**
 * Star Catcher AI Bot Controller
 * Replicates the CPU logic from Two Player Games Challenge (19_ASTRONAVI)
 */

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  BLACK_HOLE_PULL_RADIUS,
} from "../config/constants";
import type {
  BotDifficulty,
  JoystickInput,
  ShipState,
  StarState,
  BlackHoleState,
  AsteroidState,
} from "./types";

/**
 * Calculates the shortest displacement considering screen-edge wrapping (toroidal geometry).
 */
export function getToroidalDelta(target: number, current: number, dimension: number): number {
  let delta = target - current;
  if (delta > dimension / 2) {
    delta -= dimension;
  } else if (delta < -dimension / 2) {
    delta += dimension;
  }
  return delta;
}

export function getToroidalDistanceSq(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
): number {
  const dx = getToroidalDelta(x2, x1, width);
  const dy = getToroidalDelta(y2, y1, height);
  return dx * dx + dy * dy;
}

export class StarCatcherBot {
  private difficulty: BotDifficulty;
  private lastDecisionTime = 0;
  private currentInput: JoystickInput = { active: false, angle: 0, intensity: 0 };
  private targetHeading = 0;

  constructor(difficulty: BotDifficulty = "medium") {
    this.difficulty = difficulty;
  }

  public setDifficulty(difficulty: BotDifficulty): void {
    this.difficulty = difficulty;
  }

  public update(
    currentTime: number,
    ship: ShipState,
    star: StarState | null,
    blackHole: BlackHoleState | null,
    asteroids: AsteroidState[] = []
  ): JoystickInput {
    // Decision latency based on difficulty
    const latencyMs =
      this.difficulty === "easy" ? 280 : this.difficulty === "medium" ? 130 : 35;

    if (currentTime - this.lastDecisionTime < latencyMs && this.currentInput.active) {
      return this.currentInput;
    }

    this.lastDecisionTime = currentTime;

    if (!star || !star.active) {
      this.currentInput = { active: false, angle: ship.rotation, intensity: 0 };
      return this.currentInput;
    }

    // 1. Vector to Star (with toroidal wrap)
    const useToroidal = this.difficulty !== "easy" || Math.random() > 0.3;
    const dxStar = useToroidal
      ? getToroidalDelta(star.x, ship.x, GAME_WIDTH)
      : star.x - ship.x;
    const dyStar = useToroidal
      ? getToroidalDelta(star.y, ship.y, GAME_HEIGHT)
      : star.y - ship.y;

    const distStar = Math.hypot(dxStar, dyStar);
    let targetX = distStar > 0.001 ? (dxStar / distStar) * 1.0 : 0;
    let targetY = distStar > 0.001 ? (dyStar / distStar) * 1.0 : 0;

    // 2. Obstacle Avoidance: Black Hole
    if (blackHole && blackHole.active && blackHole.scale > 0.2) {
      const dxBH = useToroidal
        ? getToroidalDelta(blackHole.x, ship.x, GAME_WIDTH)
        : blackHole.x - ship.x;
      const dyBH = useToroidal
        ? getToroidalDelta(blackHole.y, ship.y, GAME_HEIGHT)
        : blackHole.y - ship.y;
      const distBH = Math.hypot(dxBH, dyBH);

      const avoidRadius =
        this.difficulty === "hard"
          ? BLACK_HOLE_PULL_RADIUS * 1.2
          : this.difficulty === "medium"
          ? BLACK_HOLE_PULL_RADIUS * 0.95
          : BLACK_HOLE_PULL_RADIUS * 0.6;

      if (distBH < avoidRadius && distBH > 0.1) {
        const repulsionStrength =
          this.difficulty === "hard"
            ? 2.5 * (1 - distBH / avoidRadius)
            : this.difficulty === "medium"
            ? 1.8 * (1 - distBH / avoidRadius)
            : 0.9 * (1 - distBH / avoidRadius);

        // Repel away from black hole
        targetX -= (dxBH / distBH) * repulsionStrength;
        targetY -= (dyBH / distBH) * repulsionStrength;
      }
    }

    // 3. Obstacle Avoidance: Asteroids
    if (this.difficulty !== "easy") {
      for (const asteroid of asteroids) {
        const dxAst = useToroidal
          ? getToroidalDelta(asteroid.x, ship.x, GAME_WIDTH)
          : asteroid.x - ship.x;
        const dyAst = useToroidal
          ? getToroidalDelta(asteroid.y, ship.y, GAME_HEIGHT)
          : asteroid.y - ship.y;
        const distAst = Math.hypot(dxAst, dyAst);
        const alertRadius = asteroid.radius + 40;

        if (distAst < alertRadius && distAst > 0.1) {
          const rep = (1 - distAst / alertRadius) * (this.difficulty === "hard" ? 1.5 : 1.0);
          targetX -= (dxAst / distAst) * rep;
          targetY -= (dyAst / distAst) * rep;
        }
      }
    }

    // 4. Calculate desired angle
    let desiredAngle = Math.atan2(targetY, targetX);

    // 5. Add difficulty-based steering noise
    if (this.difficulty === "easy") {
      desiredAngle += (Math.random() - 0.5) * 0.5;
    } else if (this.difficulty === "medium") {
      desiredAngle += (Math.random() - 0.5) * 0.15;
    }

    this.targetHeading = desiredAngle;

    // Determine intensity
    const intensity =
      this.difficulty === "hard" ? 1.0 : this.difficulty === "medium" ? 0.9 : 0.75;

    this.currentInput = {
      active: true,
      angle: this.targetHeading,
      intensity,
    };

    return this.currentInput;
  }
}
