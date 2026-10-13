import { GAME_WIDTH, TABLE_MARGIN_X, TABLE_WIDTH, TOP_PADDLE_Y } from "../config/constants";
import type { Ball } from "./types";

export interface BotControllerOptions {
  difficulty?: "easy" | "medium" | "hard";
}

export class PingPongBotController {
  private difficulty: "easy" | "medium" | "hard";
  private currentX: number = GAME_WIDTH / 2;
  private targetOffset: number = 0;
  private lastDecisionTime: number = 0;

  constructor(options: BotControllerOptions = {}) {
    this.difficulty = options.difficulty || "medium";
    this.reset(GAME_WIDTH / 2);
  }

  public reset(initialX = GAME_WIDTH / 2) {
    this.currentX = initialX;
    this.targetOffset = 0;
    this.lastDecisionTime = 0;
  }

  public update(dt: number, ball: Ball | null, paddleWidth: number): number {
    const minX = TABLE_MARGIN_X + paddleWidth / 2;
    const maxX = TABLE_MARGIN_X + TABLE_WIDTH - paddleWidth / 2;

    if (!ball || !ball.active) {
      // Idle return to center
      const centerDist = GAME_WIDTH / 2 - this.currentX;
      this.currentX += Math.sign(centerDist) * Math.min(Math.abs(centerDist), 160 * dt);
      return Math.max(minX, Math.min(maxX, this.currentX));
    }

    // Reaction parameters based on difficulty
    let maxSpeed = 360;
    let errorRange = 14;
    let predictCurve = false;

    if (this.difficulty === "easy") {
      maxSpeed = 240;
      errorRange = 36;
      predictCurve = false;
    } else if (this.difficulty === "hard") {
      maxSpeed = 520;
      errorRange = 4;
      predictCurve = true;
    }

    const now = performance.now();
    if (now - this.lastDecisionTime > 350) {
      this.lastDecisionTime = now;
      this.targetOffset = (Math.random() - 0.5) * 2 * errorRange;
    }

    let targetX = GAME_WIDTH / 2;

    if (ball.vy < 0) {
      // Ball is traveling towards the bot paddle (upward)
      const distY = Math.max(1, Math.abs(ball.y - TOP_PADDLE_Y));
      const timeToArrive = distY / Math.max(100, Math.abs(ball.vy));

      let predictedX = ball.x + ball.vx * timeToArrive;

      // In hard mode, factor in Magnus spin curve
      if (predictCurve && Math.abs(ball.spin) > 0.5) {
        predictedX += Math.sign(ball.spin) * 28;
      }

      // Handle table wall rebounds
      while (predictedX < minX || predictedX > maxX) {
        if (predictedX < minX) {
          predictedX = minX + (minX - predictedX);
        } else if (predictedX > maxX) {
          predictedX = maxX - (predictedX - maxX);
        }
      }

      targetX = predictedX + this.targetOffset;

      // In hard mode, strategically aim toward corners
      if (this.difficulty === "hard") {
        const cornerAimOffset = ball.x > GAME_WIDTH / 2 ? -18 : 18;
        targetX += cornerAimOffset;
      }
    } else {
      // Ball is moving away towards Orange: drift toward center-table
      targetX = GAME_WIDTH / 2 + this.targetOffset * 0.5;
    }

    targetX = Math.max(minX, Math.min(maxX, targetX));

    // Smooth movement toward targetX
    const deltaX = targetX - this.currentX;
    const step = Math.sign(deltaX) * Math.min(Math.abs(deltaX), maxSpeed * dt);
    this.currentX += step;

    return Math.max(minX, Math.min(maxX, this.currentX));
  }
}
