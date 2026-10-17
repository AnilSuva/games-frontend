import { GAME_WIDTH, TABLE_MARGIN_X, TABLE_WIDTH, TOP_PADDLE_Y } from "../config/constants";
import type { Ball } from "./types";

export interface BotControllerOptions {
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * AI Bot Controller for Blue Paddle (Top).
 * Reproduces the observed behavior from Racchetta.CPUCaso in Two Player Games Challenge (base.apk):
 * tracks the ball's incoming trajectory, calculates arrival intercept,
 * and scales movement speed and targeting error based on difficulty.
 */
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
      // Idle drift back toward table center
      const centerDist = GAME_WIDTH / 2 - this.currentX;
      this.currentX += Math.sign(centerDist) * Math.min(Math.abs(centerDist), 180 * dt);
      return Math.max(minX, Math.min(maxX, this.currentX));
    }

    // Reaction parameters based on difficulty matching reference intervalloVelocitaCPU
    let maxSpeed = 480;
    let errorRange = 12;

    if (this.difficulty === "easy") {
      maxSpeed = 300;
      errorRange = 32;
    } else if (this.difficulty === "hard") {
      maxSpeed = 640;
      errorRange = 4;
    }

    const now = performance.now();
    if (now - this.lastDecisionTime > 300) {
      this.lastDecisionTime = now;
      this.targetOffset = (Math.random() - 0.5) * 2 * errorRange;
    }

    let targetX = GAME_WIDTH / 2;

    if (ball.vy < 0) {
      // Ball is traveling towards the bot paddle (upward)
      const distY = Math.max(1, Math.abs(ball.y - TOP_PADDLE_Y));
      const timeToArrive = distY / Math.max(100, Math.abs(ball.vy));

      let predictedX = ball.x + ball.vx * timeToArrive;

      // Clamp target within paddle reachable court bounds
      predictedX = Math.max(minX, Math.min(maxX, predictedX));

      targetX = predictedX + this.targetOffset;

      // In hard mode, strategically aim toward corners by offsetting racket impact point
      if (this.difficulty === "hard") {
        const cornerAimOffset = ball.x > GAME_WIDTH / 2 ? -16 : 16;
        targetX += cornerAimOffset;
      }
    } else {
      // Ball is moving away towards Orange: drift toward center-table
      targetX = GAME_WIDTH / 2 + this.targetOffset * 0.4;
    }

    targetX = Math.max(minX, Math.min(maxX, targetX));

    // Smooth movement toward targetX (lerpVelocitaRacchetta)
    const deltaX = targetX - this.currentX;
    const step = Math.sign(deltaX) * Math.min(Math.abs(deltaX), maxSpeed * dt);
    this.currentX += step;

    return Math.max(minX, Math.min(maxX, this.currentX));
  }
}
