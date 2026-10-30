import {
  ARENA_BOTTOM,
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_LEFT,
  ARENA_RIGHT,
  ARENA_TOP,
  BOUNCER_LIFETIME_MS,
  BOUNCER_MAX_BOUNCES,
  BOUNCER_RADIUS,
  BOUNCER_WARNING_MS,
  LASER_BEAM_WIDTH,
  PLAYER_RADIUS,
  STRIKE_ACTIVE_DURATION_MS,
  STRIKE_RADIUS_BASE,
  WAVE_CONFIGURATIONS,
  type WaveConfig,
} from "../config/balance";
import { SeededPRNG } from "./prng";
import type {
  BouncingHazard,
  FallingStrikeHazard,
  Hazard,
  LaserSafeGap,
  PlayerSimState,
  SweepingLaserHazard,
} from "./types";

/**
 * Calculates current active WaveConfig based on match elapsed time.
 */
export function getCurrentWaveConfig(matchTimeMs: number): WaveConfig {
  const elapsedSec = matchTimeMs / 1000;
  for (let i = WAVE_CONFIGURATIONS.length - 1; i >= 0; i--) {
    if (elapsedSec >= WAVE_CONFIGURATIONS[i].startSec) {
      return WAVE_CONFIGURATIONS[i];
    }
  }
  return WAVE_CONFIGURATIONS[0];
}

/**
 * Distance between point (px, py) and line segment (x1, y1) -> (x2, y2).
 */
export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return Math.hypot(px - projX, py - projY);
}

export interface LaserSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Returns solid laser beam segments outside of safe gaps.
 */
export function getLaserSegments(
  hazard: SweepingLaserHazard,
  coordOverride?: number
): LaserSegment[] {
  const coord = coordOverride ?? hazard.currentCoord;
  const segments: LaserSegment[] = [];
  const gaps = (hazard.safeGaps ?? []).slice().sort((a, b) => a.start - b.start);

  if (gaps.length === 0) {
    if (hazard.orientation === "horizontal") {
      segments.push({ x1: ARENA_LEFT, y1: coord, x2: ARENA_RIGHT, y2: coord });
    } else {
      segments.push({ x1: coord, y1: ARENA_TOP, x2: coord, y2: ARENA_BOTTOM });
    }
    return segments;
  }

  if (hazard.orientation === "horizontal") {
    let curX = ARENA_LEFT;
    for (const gap of gaps) {
      if (gap.start > curX) {
        segments.push({
          x1: curX,
          y1: coord,
          x2: gap.start,
          y2: coord,
        });
      }
      curX = Math.max(curX, gap.end);
    }
    if (curX < ARENA_RIGHT) {
      segments.push({
        x1: curX,
        y1: coord,
        x2: ARENA_RIGHT,
        y2: coord,
      });
    }
  } else {
    let curY = ARENA_TOP;
    for (const gap of gaps) {
      if (gap.start > curY) {
        segments.push({
          x1: coord,
          y1: curY,
          x2: coord,
          y2: gap.start,
        });
      }
      curY = Math.max(curY, gap.end);
    }
    if (curY < ARENA_BOTTOM) {
      segments.push({
        x1: coord,
        y1: curY,
        x2: coord,
        y2: ARENA_BOTTOM,
      });
    }
  }

  return segments;
}

/**
 * Checks whether an active hazard collides with a player.
 */
export function checkHazardCollision(hazard: Hazard, player: PlayerSimState): boolean {
  if (hazard.phase !== "active" || !player.isAlive || player.isInvulnerable) {
    return false;
  }

  if (hazard.type === "falling-strike") {
    const dist = Math.hypot(player.x - hazard.x, player.y - hazard.y);
    return dist <= hazard.radius + PLAYER_RADIUS;
  }

  if (hazard.type === "sweeping-laser") {
    const segments = getLaserSegments(hazard);
    const dangerRadius = hazard.beamWidth / 2 + PLAYER_RADIUS;

    for (const seg of segments) {
      const dist = distToSegment(player.x, player.y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (dist <= dangerRadius) {
        return true;
      }
    }

    return false;
  }

  if (hazard.type === "bouncing-hazard") {
    const dist = Math.hypot(player.x - hazard.x, player.y - hazard.y);
    return dist <= hazard.radius + PLAYER_RADIUS;
  }

  return false;
}

/**
 * Updates a single hazard's lifecycle, position, and bounce physics for delta time dt (in seconds).
 */
export function updateHazard(hazard: Hazard, dt: number): void {
  const dtMs = dt * 1000;
  hazard.elapsedMs += dtMs;

  if (hazard.phase === "warning") {
    if (hazard.elapsedMs >= hazard.warningDurationMs) {
      hazard.phase = "active";
      hazard.elapsedMs = 0;
    }
    return;
  }

  if (hazard.phase === "active") {
    if (hazard.type === "falling-strike") {
      if (hazard.elapsedMs >= hazard.activeDurationMs) {
        hazard.phase = "expired";
      }
    } else if (hazard.type === "sweeping-laser") {
      // Advance coordinate
      const delta = hazard.sweepSpeed * dt * hazard.direction;
      hazard.currentCoord += delta;

      const hasReachedTarget =
        hazard.direction === 1
          ? hazard.currentCoord >= hazard.targetCoord
          : hazard.currentCoord <= hazard.targetCoord;

      if (hasReachedTarget || hazard.elapsedMs >= hazard.activeDurationMs) {
        hazard.phase = "expired";
      }
    } else if (hazard.type === "bouncing-hazard") {
      // Move bouncer
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;

      // Bounce off walls
      const r = hazard.radius;
      if (hazard.x - r <= ARENA_LEFT && hazard.vx < 0) {
        hazard.x = ARENA_LEFT + r;
        hazard.vx = -hazard.vx;
        hazard.bounceCount++;
      } else if (hazard.x + r >= ARENA_RIGHT && hazard.vx > 0) {
        hazard.x = ARENA_RIGHT - r;
        hazard.vx = -hazard.vx;
        hazard.bounceCount++;
      }

      if (hazard.y - r <= ARENA_TOP && hazard.vy < 0) {
        hazard.y = ARENA_TOP + r;
        hazard.vy = -hazard.vy;
        hazard.bounceCount++;
      } else if (hazard.y + r >= ARENA_BOTTOM && hazard.vy > 0) {
        hazard.y = ARENA_BOTTOM - r;
        hazard.vy = -hazard.vy;
        hazard.bounceCount++;
      }

      if (hazard.bounceCount >= hazard.maxBounces || hazard.elapsedMs >= hazard.activeDurationMs) {
        hazard.phase = "expired";
      }
    }
  }
}

/**
 * Creates a telegraphed Falling Strike hazard.
 * Fairness rule: ensures center is not spawned directly on top of either alive player,
 * and does not trap players inside the safe gap of an active laser.
 */
export function createFallingStrike(
  id: string,
  prng: SeededPRNG,
  warningDurationMs: number,
  players: PlayerSimState[],
  existingHazards: Hazard[] = []
): FallingStrikeHazard {
  const margin = STRIKE_RADIUS_BASE + 20;
  let targetX = prng.nextFloat(ARENA_LEFT + margin, ARENA_RIGHT - margin);
  let targetY = prng.nextFloat(ARENA_TOP + margin, ARENA_BOTTOM - margin);

  // Fairness check 1: if spawned too close to any player, shift it away
  for (const p of players) {
    if (!p.isAlive) continue;
    const dist = Math.hypot(targetX - p.x, targetY - p.y);
    if (dist < STRIKE_RADIUS_BASE + PLAYER_RADIUS + 20) {
      // Offset by 80px in a safe direction
      const angle = Math.atan2(targetY - p.y, targetX - p.x);
      targetX = Math.max(
        ARENA_LEFT + margin,
        Math.min(ARENA_RIGHT - margin, targetX + Math.cos(angle) * 80)
      );
      targetY = Math.max(
        ARENA_TOP + margin,
        Math.min(ARENA_BOTTOM - margin, targetY + Math.sin(angle) * 80)
      );
    }
  }

  // Fairness check 2: do not spawn inside the safe gaps of an active/warning laser
  const activeLaser = existingHazards.find(
    (h) => h.type === "sweeping-laser" && h.phase !== "expired"
  ) as SweepingLaserHazard | undefined;

  if (activeLaser && activeLaser.safeGaps) {
    if (activeLaser.orientation === "horizontal") {
      for (const gap of activeLaser.safeGaps) {
        if (targetX >= gap.start - 25 && targetX <= gap.end + 25) {
          targetX =
            gap.start - 30 > ARENA_LEFT + margin
              ? gap.start - 45
              : Math.min(ARENA_RIGHT - margin, gap.end + 45);
        }
      }
    } else {
      for (const gap of activeLaser.safeGaps) {
        if (targetY >= gap.start - 25 && targetY <= gap.end + 25) {
          targetY =
            gap.start - 30 > ARENA_TOP + margin
              ? gap.start - 45
              : Math.min(ARENA_BOTTOM - margin, gap.end + 45);
        }
      }
    }
  }

  return {
    id,
    type: "falling-strike",
    phase: "warning",
    warningDurationMs,
    activeDurationMs: STRIKE_ACTIVE_DURATION_MS,
    elapsedMs: 0,
    x: targetX,
    y: targetY,
    radius: STRIKE_RADIUS_BASE,
  };
}

/**
 * Creates a telegraphed Sweeping Laser hazard with accessible safe gaps.
 * Early waves provide wide escape passages and lower sweep speeds.
 */
export function createSweepingLaser(
  id: string,
  prng: SeededPRNG,
  warningDurationMs: number,
  sweepSpeed: number,
  gapSize: number = 104,
  alivePlayers: PlayerSimState[] = []
): SweepingLaserHazard {
  const isHorizontal = prng.next() > 0.45; // 55% horizontal, 45% vertical

  if (isHorizontal) {
    const sweepDown = prng.next() > 0.5;
    const startCoord = sweepDown ? ARENA_TOP + 40 : ARENA_BOTTOM - 40;
    const targetCoord = sweepDown ? ARENA_BOTTOM - 40 : ARENA_TOP + 40;
    const sweepDist = Math.abs(targetCoord - startCoord);
    const activeDurationMs = (sweepDist / sweepSpeed) * 1000 + 400;

    // Dual safe gaps along X: one on left half, one on right half
    // Gives players on either side of the arena an immediate accessible escape gap
    let leftCenter = prng.nextFloat(ARENA_LEFT + 75, ARENA_CENTER_X - 55);
    let rightCenter = prng.nextFloat(ARENA_CENTER_X + 55, ARENA_RIGHT - 75);

    for (const p of alivePlayers) {
      if (!p.isAlive) continue;
      if (p.x < ARENA_CENTER_X) {
        leftCenter = Math.max(
          ARENA_LEFT + gapSize / 2 + 10,
          Math.min(ARENA_CENTER_X - gapSize / 2 - 10, p.x + prng.nextFloat(-20, 20))
        );
      } else {
        rightCenter = Math.max(
          ARENA_CENTER_X + gapSize / 2 + 10,
          Math.min(ARENA_RIGHT - gapSize / 2 - 10, p.x + prng.nextFloat(-20, 20))
        );
      }
    }

    const safeGaps: LaserSafeGap[] = [
      {
        start: Math.round(leftCenter - gapSize / 2),
        end: Math.round(leftCenter + gapSize / 2),
      },
      {
        start: Math.round(rightCenter - gapSize / 2),
        end: Math.round(rightCenter + gapSize / 2),
      },
    ];

    return {
      id,
      type: "sweeping-laser",
      phase: "warning",
      warningDurationMs,
      activeDurationMs,
      elapsedMs: 0,
      orientation: "horizontal",
      startX: ARENA_LEFT,
      startY: startCoord,
      endX: ARENA_RIGHT,
      endY: startCoord,
      currentCoord: startCoord,
      targetCoord,
      sweepSpeed,
      beamWidth: LASER_BEAM_WIDTH,
      direction: sweepDown ? 1 : -1,
      safeGaps,
    };
  } else {
    const sweepRight = prng.next() > 0.5;
    const startCoord = sweepRight ? ARENA_LEFT + 40 : ARENA_RIGHT - 40;
    const targetCoord = sweepRight ? ARENA_RIGHT - 40 : ARENA_LEFT + 40;
    const sweepDist = Math.abs(targetCoord - startCoord);
    const activeDurationMs = (sweepDist / sweepSpeed) * 1000 + 400;

    // Dual safe gaps along Y:
    // Top half gap for Blue / Top player (y ~ 90..230)
    // Bottom half gap for Orange / Bottom player (y ~ 390..530)
    // Ensures both players can escape completely independently without invading each other's half!
    let topCenter = prng.nextFloat(ARENA_TOP + 85, ARENA_CENTER_Y - 55);
    let bottomCenter = prng.nextFloat(ARENA_CENTER_Y + 55, ARENA_BOTTOM - 85);

    for (const p of alivePlayers) {
      if (!p.isAlive) continue;
      if (p.y < ARENA_CENTER_Y) {
        topCenter = Math.max(
          ARENA_TOP + gapSize / 2 + 10,
          Math.min(ARENA_CENTER_Y - gapSize / 2 - 10, p.y + prng.nextFloat(-20, 20))
        );
      } else {
        bottomCenter = Math.max(
          ARENA_CENTER_Y + gapSize / 2 + 10,
          Math.min(ARENA_BOTTOM - gapSize / 2 - 10, p.y + prng.nextFloat(-20, 20))
        );
      }
    }

    const safeGaps: LaserSafeGap[] = [
      {
        start: Math.round(topCenter - gapSize / 2),
        end: Math.round(topCenter + gapSize / 2),
      },
      {
        start: Math.round(bottomCenter - gapSize / 2),
        end: Math.round(bottomCenter + gapSize / 2),
      },
    ];

    return {
      id,
      type: "sweeping-laser",
      phase: "warning",
      warningDurationMs,
      activeDurationMs,
      elapsedMs: 0,
      orientation: "vertical",
      startX: startCoord,
      startY: ARENA_TOP,
      endX: startCoord,
      endY: ARENA_BOTTOM,
      currentCoord: startCoord,
      targetCoord,
      sweepSpeed,
      beamWidth: LASER_BEAM_WIDTH,
      direction: sweepRight ? 1 : -1,
      safeGaps,
    };
  }
}

/**
 * Creates a telegraphed Bouncing Hazard entering from an arena edge.
 */
export function createBouncingHazard(
  id: string,
  prng: SeededPRNG,
  speed: number
): BouncingHazard {
  // Pick spawn edge (0: top, 1: bottom, 2: left, 3: right)
  const edge = prng.nextInt(0, 3);
  let spawnX = 0;
  let spawnY = 0;
  let angle = 0;

  const r = BOUNCER_RADIUS;
  if (edge === 0) {
    // Top wall
    spawnX = prng.nextFloat(ARENA_LEFT + 60, ARENA_RIGHT - 60);
    spawnY = ARENA_TOP + r + 2;
    angle = prng.nextFloat(Math.PI * 0.2, Math.PI * 0.8); // pointing downward
  } else if (edge === 1) {
    // Bottom wall
    spawnX = prng.nextFloat(ARENA_LEFT + 60, ARENA_RIGHT - 60);
    spawnY = ARENA_BOTTOM - r - 2;
    angle = prng.nextFloat(-Math.PI * 0.8, -Math.PI * 0.2); // pointing upward
  } else if (edge === 2) {
    // Left wall
    spawnX = ARENA_LEFT + r + 2;
    spawnY = prng.nextFloat(ARENA_TOP + 60, ARENA_BOTTOM - 60);
    angle = prng.nextFloat(-Math.PI * 0.3, Math.PI * 0.3); // pointing right
  } else {
    // Right wall
    spawnX = ARENA_RIGHT - r - 2;
    spawnY = prng.nextFloat(ARENA_TOP + 60, ARENA_BOTTOM - 60);
    angle = prng.nextFloat(Math.PI * 0.7, Math.PI * 1.3); // pointing left
  }

  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  return {
    id,
    type: "bouncing-hazard",
    phase: "warning",
    warningDurationMs: BOUNCER_WARNING_MS,
    activeDurationMs: BOUNCER_LIFETIME_MS,
    elapsedMs: 0,
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    radius: r,
    bounceCount: 0,
    maxBounces: BOUNCER_MAX_BOUNCES,
  };
}
