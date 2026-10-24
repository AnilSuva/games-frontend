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
import {
  getToroidalDelta,
  getToroidalDistanceSq,
} from "./starCatcherPhysics";

export { getToroidalDelta, getToroidalDistanceSq };

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
    asteroids: AsteroidState[] = [],
    opponentShip: ShipState | null = null
  ): JoystickInput {
    // Decision latency based on difficulty:
    // Easy bot is very casual/forgiving with 650ms reaction delay,
    // Medium has human-friendly 250ms delay, and Hard has 85ms skilled reaction.
    const latencyMs =
      this.difficulty === "easy" ? 650 : this.difficulty === "medium" ? 250 : 85;

    if (currentTime - this.lastDecisionTime < latencyMs && this.currentInput.active) {
      return this.currentInput;
    }

    this.lastDecisionTime = currentTime;

    if (!star || !star.active) {
      this.currentInput = { active: false, angle: ship.rotation, intensity: 0 };
      return this.currentInput;
    }

    // 1. Vector to Star:
    // Easy bot NEVER uses toroidal wrapping across borders (acts like a beginner looking at screen).
    // Medium bot occasionally wraps (50%). Hard bot always uses smart toroidal wrapping.
    const useToroidal =
      this.difficulty === "hard"
        ? true
        : this.difficulty === "medium"
        ? Math.random() < 0.50
        : false;

    const dxStar = useToroidal
      ? getToroidalDelta(star.x, ship.x, GAME_WIDTH)
      : star.x - ship.x;
    const dyStar = useToroidal
      ? getToroidalDelta(star.y, ship.y, GAME_HEIGHT)
      : star.y - ship.y;

    const distStar = Math.hypot(dxStar, dyStar);
    let targetX = distStar > 0.001 ? (dxStar / distStar) * 1.0 : 0;
    let targetY = distStar > 0.001 ? (dyStar / distStar) * 1.0 : 0;

    // 2. Obstacle Avoidance: Black Hole & Orbital Vortex
    let isInsideBH = false;
    if (blackHole && blackHole.active && blackHole.scale > 0.2) {
      const dxBH = useToroidal
        ? getToroidalDelta(blackHole.x, ship.x, GAME_WIDTH)
        : blackHole.x - ship.x;
      const dyBH = useToroidal
        ? getToroidalDelta(blackHole.y, ship.y, GAME_HEIGHT)
        : blackHole.y - ship.y;
      const distBH = Math.hypot(dxBH, dyBH);

      if (distBH < 55) {
        isInsideBH = true;
        // In the core vortex, the bot steers along the prograde orbital tangent
        // to complete an orbital rotation and slingshot out!
        // Clockwise tangent: tanX = dyBH / distBH, tanY = -dxBH / distBH
        const tanX = dyBH / distBH;
        const tanY = -dxBH / distBH;

        if (this.difficulty === "hard") {
          targetX = tanX * 2.2;
          targetY = tanY * 2.2;
        } else if (this.difficulty === "medium") {
          targetX = tanX * 1.6 + (-dxBH / distBH) * 0.4;
          targetY = tanY * 1.6 + (-dyBH / distBH) * 0.4;
        } else {
          // Easy bot wobbles around the orbit
          targetX = tanX * 1.0 + (Math.random() - 0.5) * 1.0;
          targetY = tanY * 1.0 + (Math.random() - 0.5) * 1.0;
        }
      } else {
        const avoidRadius =
          this.difficulty === "hard"
            ? BLACK_HOLE_PULL_RADIUS * 1.05
            : this.difficulty === "medium"
            ? BLACK_HOLE_PULL_RADIUS * 0.75
            : BLACK_HOLE_PULL_RADIUS * 0.35;

        if (distBH < avoidRadius && distBH > 0.1) {
          const repulsionStrength =
            this.difficulty === "hard"
              ? 2.0 * (1 - distBH / avoidRadius)
              : this.difficulty === "medium"
              ? 1.2 * (1 - distBH / avoidRadius)
              : 0.5 * (1 - distBH / avoidRadius);

          // Repel away from black hole
          targetX -= (dxBH / distBH) * repulsionStrength;
          targetY -= (dyBH / distBH) * repulsionStrength;
        }
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
        const alertRadius =
          this.difficulty === "hard" ? asteroid.radius + 35 : asteroid.radius + 20;

        if (distAst < alertRadius && distAst > 0.1) {
          const rep =
            (1 - distAst / alertRadius) * (this.difficulty === "hard" ? 1.2 : 0.6);
          targetX -= (dxAst / distAst) * rep;
          targetY -= (dyAst / distAst) * rep;
        }
      }
    }

    // 4. Opponent Ship Awareness
    if (opponentShip && this.difficulty !== "easy") {
      const dxOpp = useToroidal
        ? getToroidalDelta(opponentShip.x, ship.x, GAME_WIDTH)
        : opponentShip.x - ship.x;
      const dyOpp = useToroidal
        ? getToroidalDelta(opponentShip.y, ship.y, GAME_HEIGHT)
        : opponentShip.y - ship.y;
      const distOpp = Math.hypot(dxOpp, dyOpp);
      const alertDist = this.difficulty === "hard" ? 42 : 32;

      if (distOpp < alertDist && distOpp > 0.1) {
        const oppRep =
          (1 - distOpp / alertDist) * (this.difficulty === "hard" ? 0.6 : 0.35);
        targetX -= (dxOpp / distOpp) * oppRep;
        targetY -= (dyOpp / distOpp) * oppRep;
      }
    }

    // 5. Calculate desired angle
    let desiredAngle = Math.atan2(targetY, targetX);

    // 6. Add difficulty-based steering noise and human imperfection
    if (this.difficulty === "easy") {
      desiredAngle += (Math.random() - 0.5) * 1.1; // ~ +/- 31 degrees wobble
      // Occasional overshoot or hesitation near star
      if (distStar < 55 && Math.random() < 0.30) {
        desiredAngle += (Math.random() - 0.5) * 0.8;
      }
    } else if (this.difficulty === "medium") {
      desiredAngle += (Math.random() - 0.5) * 0.38; // ~ +/- 11 degrees
    } else {
      desiredAngle += (Math.random() - 0.5) * 0.08; // Small human imperfection
    }

    this.targetHeading = desiredAngle;

    // 7. Determine throttle intensity:
    // Easy bot is capped at 0.48 so human players can easily outpace it;
    // Medium is comfortable at 0.72; Hard is competitive at 0.92.
    let intensity: number;
    if (isInsideBH) {
      intensity =
        this.difficulty === "hard" ? 1.0 : this.difficulty === "medium" ? 0.85 : 0.58;
    } else {
      intensity =
        this.difficulty === "hard" ? 0.92 : this.difficulty === "medium" ? 0.72 : 0.48;
    }

    this.currentInput = {
      active: true,
      angle: this.targetHeading,
      intensity,
    };

    return this.currentInput;
  }
}
