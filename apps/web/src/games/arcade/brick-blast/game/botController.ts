import type { Ball } from "./types";
import type { PlatformPlayer } from "@/games/common/startingPlayer";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotControllerOptions {
  difficulty: BotDifficulty;
  controlledPaddle?: PlatformPlayer;
}

type BotTuning = {
  decisionInterval: number;
  speed: number;
  acceleration: number;
  reactionDelay: number;
  predictionError: number;
};

const TUNING: Record<BotDifficulty, BotTuning> = {
  easy: { decisionInterval: 0.1, speed: 190, acceleration: 520, reactionDelay: 0.28, predictionError: 22 },
  medium: { decisionInterval: 0.075, speed: 260, acceleration: 900, reactionDelay: 0.08, predictionError: 8 },
  hard: { decisionInterval: 0.055, speed: 330, acceleration: 1350, reactionDelay: 0.025, predictionError: 3 },
};

export function clampBotTarget(x: number, paddleWidth: number, gameWidth: number): number {
  const halfWidth = paddleWidth / 2;
  return Math.max(halfWidth, Math.min(gameWidth - halfWidth, x));
}

export function predictWallReflectedX(
  x: number,
  vx: number,
  time: number,
  radius: number,
  gameWidth: number
): number {
  const left = radius;
  const span = gameWidth - radius * 2;
  if (span <= 0) return gameWidth / 2;
  const period = span * 2;
  let unfolded = (x - left + vx * time) % period;
  if (unfolded < 0) unfolded += period;
  return left + (unfolded <= span ? unfolded : period - unfolded);
}

export function getBallTimeToPaddle(
  ball: Ball,
  paddleY: number,
  paddleSide: PlatformPlayer = "blue"
): number {
  if (!ball.active) return Number.POSITIVE_INFINITY;
  if (paddleSide === "orange") {
    // Bottom paddle (Host side): Ball must be moving downward (vy > 0)
    if (ball.vy <= 0) return Number.POSITIVE_INFINITY;
    const contactY = paddleY - 5 - ball.radius;
    const time = (contactY - ball.y) / ball.vy;
    return time >= 0 ? time : Number.POSITIVE_INFINITY;
  } else {
    // Top paddle (Guest side): Ball must be moving upward (vy < 0)
    if (ball.vy >= 0) return Number.POSITIVE_INFINITY;
    const contactY = paddleY + 5 + ball.radius;
    const time = (ball.y - contactY) / -ball.vy;
    return time >= 0 ? time : Number.POSITIVE_INFINITY;
  }
}

export function selectThreateningBall(
  balls: Ball[],
  paddleY: number,
  paddleSide: PlatformPlayer = "blue"
): Ball | null {
  let target: Ball | null = null;
  let shortestTime = Number.POSITIVE_INFINITY;
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    if (!ball) continue;
    const time = getBallTimeToPaddle(ball, paddleY, paddleSide);
    if (time < shortestTime) {
      shortestTime = time;
      target = ball;
    }
  }
  return target;
}

/** Stateful, allocation-free per-frame paddle driver. Targeting runs at 10–18 Hz. */
export class BrickBlastBotController {
  private readonly tuning: BotTuning;
  private readonly difficulty: BotDifficulty;
  private readonly controlledPaddle: PlatformPlayer;
  private decisionTimer = 0;
  private reactionTimer = 0;
  private targetId = -1;
  private targetX = 180;
  private paddleVelocity = 0;
  private decisionCount = 0;

  constructor(difficultyOrOptions: BotDifficulty | BotControllerOptions) {
    if (typeof difficultyOrOptions === "string") {
      this.difficulty = difficultyOrOptions;
      this.controlledPaddle = "blue";
    } else {
      this.difficulty = difficultyOrOptions.difficulty;
      this.controlledPaddle = difficultyOrOptions.controlledPaddle ?? "blue";
    }
    this.tuning = TUNING[this.difficulty];
  }

  public get controlledPaddleId(): PlatformPlayer {
    return this.controlledPaddle;
  }

  reset(paddleX = 180): void {
    this.decisionTimer = 0;
    this.reactionTimer = 0;
    this.targetId = -1;
    this.targetX = paddleX;
    this.paddleVelocity = 0;
    this.decisionCount = 0;
  }

  update(
    balls: Ball[],
    paddleX: number,
    paddleWidth: number,
    paddleY: number,
    gameWidth: number,
    dt: number
  ): number {
    this.decisionTimer += dt;
    this.reactionTimer = Math.max(0, this.reactionTimer - dt);
    if (this.decisionTimer >= this.tuning.decisionInterval) {
      this.decisionTimer %= this.tuning.decisionInterval;
      this.chooseTarget(balls, paddleWidth, paddleY, gameWidth);
    }

    const dx = this.targetX - paddleX;
    if (Math.abs(dx) < 1.5) {
      this.paddleVelocity = 0;
      return this.targetX;
    }
    const desiredVelocity = Math.sign(dx) * this.tuning.speed;
    const velocityDelta = this.tuning.acceleration * dt;
    this.paddleVelocity += Math.max(-velocityDelta, Math.min(velocityDelta, desiredVelocity - this.paddleVelocity));
    const step = this.paddleVelocity * dt;
    if (Math.abs(step) >= Math.abs(dx)) {
      this.paddleVelocity = 0;
      return this.targetX;
    }
    return clampBotTarget(paddleX + step, paddleWidth, gameWidth);
  }

  private chooseTarget(balls: Ball[], paddleWidth: number, paddleY: number, gameWidth: number): void {
    const target = selectThreateningBall(balls, paddleY, this.controlledPaddle);
    if (!target) {
      this.targetId = -1;
      this.targetX = clampBotTarget(gameWidth / 2, paddleWidth, gameWidth);
      return;
    }
    if (target.id !== this.targetId) {
      this.targetId = target.id;
      this.reactionTimer = this.tuning.reactionDelay;
    }
    if (this.reactionTimer > 0) return;

    const time = getBallTimeToPaddle(target, paddleY, this.controlledPaddle);
    let predictedX = predictWallReflectedX(target.x, target.vx, time, target.radius, gameWidth);
    this.decisionCount++;
    // Repeatable, bounded error keeps all levels imperfect without frame-to-frame noise.
    const phase = (target.id * 17 + this.decisionCount * 7) % 11 - 5;
    predictedX += (phase * this.tuning.predictionError) / 5;
    // Easy occasionally favors the next incoming ball for a short decision interval.
    if (this.difficulty === "easy" && balls.length > 1 && this.decisionCount % 7 === 0) {
      let next: Ball | null = null;
      let nextTime = Number.POSITIVE_INFINITY;
      for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (!ball || ball.id === target.id) continue;
        const eta = getBallTimeToPaddle(ball, paddleY, this.controlledPaddle);
        if (eta < nextTime) {
          next = ball;
          nextTime = eta;
        }
      }
      if (next) predictedX = predictWallReflectedX(next.x, next.vx, nextTime, next.radius, gameWidth);
    }
    // Paddle width is reflected in the valid center range; the collision system
    // itself supplies the full-width interception window.
    this.targetX = clampBotTarget(predictedX, paddleWidth, gameWidth);
  }
}
