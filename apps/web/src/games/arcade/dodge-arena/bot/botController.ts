import {
  ARENA_BOTTOM,
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_LEFT,
  ARENA_RIGHT,
  ARENA_TOP,
  BOT_DIFFICULTIES,
  PLAYER_RADIUS,
} from "../config/balance";
import { distToSegment, getLaserSegments } from "../logic/hazards";
import type {
  ArenaSimState,
  BotDifficulty,
  DodgePlayerColor,
  Hazard,
  PlayerInput,
} from "../logic/types";

interface Candidate {
  dx: number;
  dy: number;
}

// 8 radial directions + stationary
const CANDIDATE_DIRECTIONS: readonly Candidate[] = [
  { dx: 0, dy: 0 },
  { dx: 0, dy: -1 }, // Up
  { dx: 0, dy: 1 }, // Down
  { dx: -1, dy: 0 }, // Left
  { dx: 1, dy: 0 }, // Right
  { dx: 0.7071, dy: -0.7071 }, // Up-Right
  { dx: -0.7071, dy: -0.7071 }, // Up-Left
  { dx: 0.7071, dy: 0.7071 }, // Down-Right
  { dx: -0.7071, dy: 0.7071 }, // Down-Left
];

export class DodgeArenaBotController {
  private botColor: DodgePlayerColor;
  private difficulty: BotDifficulty;
  private timeSinceLastDecisionMs = 9999;
  private cachedInput: PlayerInput = { dx: 0, dy: 0 };

  constructor(botColor: DodgePlayerColor = "blue", difficulty: BotDifficulty = "medium") {
    this.botColor = botColor;
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: BotDifficulty): void {
    this.difficulty = diff;
  }

  public reset(): void {
    this.timeSinceLastDecisionMs = 9999;
    this.cachedInput = { dx: 0, dy: 0 };
  }

  /**
   * Evaluates the current arena state and returns a normalized movement input.
   */
  public update(simState: ArenaSimState, dt: number): PlayerInput {
    const config = BOT_DIFFICULTIES[this.difficulty];
    const dtMs = dt * 1000;
    this.timeSinceLastDecisionMs += dtMs;

    // Only re-evaluate movement vector when reaction delay interval has elapsed
    if (this.timeSinceLastDecisionMs < config.reactionDelayMs) {
      return this.cachedInput;
    }

    this.timeSinceLastDecisionMs = 0;

    const bot = simState.players[this.botColor];
    if (!bot || !bot.isAlive) {
      this.cachedInput = { dx: 0, dy: 0 };
      return this.cachedInput;
    }

    const testStepDist = 70; // Projection distance
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCandidate: Candidate = CANDIDATE_DIRECTIONS[0];

    for (const cand of CANDIDATE_DIRECTIONS) {
      const candidateX = Math.max(
        ARENA_LEFT + PLAYER_RADIUS + 4,
        Math.min(ARENA_RIGHT - PLAYER_RADIUS - 4, bot.x + cand.dx * testStepDist)
      );
      const candidateY = Math.max(
        ARENA_TOP + PLAYER_RADIUS + 4,
        Math.min(ARENA_BOTTOM - PLAYER_RADIUS - 4, bot.y + cand.dy * testStepDist)
      );

      const score = this.evaluatePositionSafety(
        candidateX,
        candidateY,
        cand,
        simState.hazards,
        config.predictionHorizonSec,
        config.cornerAvoidanceWeight
      );

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }

    // Add difficulty-based steering jitter if configured
    let finalDx = bestCandidate.dx;
    let finalDy = bestCandidate.dy;

    if (config.steeringJitter > 0 && (finalDx !== 0 || finalDy !== 0)) {
      const jitterAngle = (Math.random() - 0.5) * config.steeringJitter * Math.PI;
      const cos = Math.cos(jitterAngle);
      const sin = Math.sin(jitterAngle);
      const rx = finalDx * cos - finalDy * sin;
      const ry = finalDx * sin + finalDy * cos;
      finalDx = rx;
      finalDy = ry;
    }

    // Apply speed multiplier
    finalDx *= config.speedMultiplier;
    finalDy *= config.speedMultiplier;

    this.cachedInput = { dx: finalDx, dy: finalDy };
    return this.cachedInput;
  }

  /**
   * Scores the threat level of candidate position (x, y). Lower is safer.
   */
  private evaluatePositionSafety(
    x: number,
    y: number,
    cand: Candidate,
    hazards: Hazard[],
    predictionHorizonSec: number,
    cornerAvoidanceWeight: number
  ): number {
    let threat = 0;

    // 1. Boundary & Corner Avoidance
    const distToLeft = x - ARENA_LEFT;
    const distToRight = ARENA_RIGHT - x;
    const distToTop = y - ARENA_TOP;
    const distToBottom = ARENA_BOTTOM - y;
    const minWallDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minWallDist < 60) {
      threat += ((60 - minWallDist) / 60) * 120 * cornerAvoidanceWeight;
    }

    // Slight bias toward arena center to avoid being pushed into edges
    const distToCenter = Math.hypot(x - ARENA_CENTER_X, y - ARENA_CENTER_Y);
    threat += (distToCenter / 300) * 8;

    // Small momentum bonus for staying in current direction to avoid rapid jitter
    if (cand.dx === 0 && cand.dy === 0) {
      threat += 4;
    }

    // 2. Evaluate Hazards
    for (const h of hazards) {
      if (h.phase === "expired") continue;

      if (h.type === "falling-strike") {
        const dist = Math.hypot(x - h.x, y - h.y);
        const dangerZone = h.radius + PLAYER_RADIUS + 24;

        if (dist < dangerZone) {
          // Lethal threat: strongly penalize being inside the strike circle
          const penetration = dangerZone - dist;
          const urgency =
            h.phase === "active"
              ? 5000
              : 1000 + (1 - h.elapsedMs / h.warningDurationMs) * 1500;
          threat += penetration * urgency;
        }
      } else if (h.type === "sweeping-laser") {
        const segments = getLaserSegments(h);
        const laserDanger = h.beamWidth / 2 + PLAYER_RADIUS + 25;
        let minSolidDist = Number.POSITIVE_INFINITY;

        for (const seg of segments) {
          const dist = distToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
          if (dist < minSolidDist) {
            minSolidDist = dist;
          }
        }

        if (minSolidDist < laserDanger) {
          threat += (laserDanger - minSolidDist) * 3500;
        }

        // Forward prediction: if laser is moving toward (x, y) along solid segment
        if (h.phase === "active") {
          const isMovingToward =
            h.orientation === "horizontal"
              ? (y - h.currentCoord) * h.direction > 0
              : (x - h.currentCoord) * h.direction > 0;

          if (isMovingToward && minSolidDist < 130) {
            threat += (130 - minSolidDist) * 90;
          }
        }
      } else if (h.type === "bouncing-hazard") {
        const curDist = Math.hypot(x - h.x, y - h.y);
        const bouncerDanger = h.radius + PLAYER_RADIUS + 25;

        if (curDist < bouncerDanger) {
          threat += (bouncerDanger - curDist) * 3000;
        }

        // Project bouncer forward along its trajectory
        if (h.phase === "active") {
          const checkSteps = 4;
          const dtStep = predictionHorizonSec / checkSteps;
          let projX = h.x;
          let projY = h.y;
          let projVx = h.vx;
          let projVy = h.vy;

          for (let step = 1; step <= checkSteps; step++) {
            projX += projVx * dtStep;
            projY += projVy * dtStep;

            // Reflect off walls in projection
            const r = h.radius;
            if (projX - r <= ARENA_LEFT || projX + r >= ARENA_RIGHT) {
              projVx = -projVx;
            }
            if (projY - r <= ARENA_TOP || projY + r >= ARENA_BOTTOM) {
              projVy = -projVy;
            }

            const pDist = Math.hypot(x - projX, y - projY);
            if (pDist < bouncerDanger + 15) {
              threat += ((bouncerDanger + 15 - pDist) / step) * 200;
            }
          }
        }
      }
    }

    return threat;
  }
}
