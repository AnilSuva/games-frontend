import type {
  CourseDef,
  PhysicsEvent,
  SimulationResult,
  TrajectoryPoint,
  Vector2,
} from "./types";
import { BALL_RADIUS } from "../config/constants";

// Physics constants
export const DT = 1 / 120; // 120Hz fixed physics step
export const MAX_STEPS = 720; // 6 seconds max simulation time
export const TRAJECTORY_SAMPLE_INTERVAL = 3; // Record every 3 steps (40Hz trajectory)
export const STOP_SPEED_THRESHOLD = 2.0; // Clean settling threshold
export const MAX_BALL_SPEED = 540;
export const MIN_LAUNCH_SPEED = 25; // Enables delicate short putts
export const MAX_LAUNCH_SPEED = 520;

// Rolling friction coefficients (px/s^2 constant deceleration)
export const DECEL_GREEN = 135;
export const DECEL_FAIRWAY = 150;
export const DECEL_ROUGH = 270;
export const DECEL_SAND = 520;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function vecLength(v: Vector2): number {
  return Math.hypot(v.x, v.y);
}

export function vecDistance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function vecNormalize(v: Vector2): Vector2 {
  const len = vecLength(v);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vecDot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Returns closest point on line segment p1->p2 to point c
 */
export function closestPointOnSegment(p1: Vector2, p2: Vector2, c: Vector2): Vector2 {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return { x: p1.x, y: p1.y };

  const t = clamp(((c.x - p1.x) * dx + (c.y - p1.y) * dy) / lenSq, 0, 1);
  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
}

/**
 * Point in axis-aligned rectangle check
 */
export function isPointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Circle in axis-aligned rectangle check (with radius margin)
 */
export function isCircleInRect(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY < radius * radius;
}

/**
 * Deterministic physics simulation of a golf shot on a given course.
 */
export function simulateShot(
  course: CourseDef,
  startPos: Vector2,
  aim: Vector2,
  power: number,
  initialTimeMs = 0
): SimulationResult {
  const clampedPower = clamp(power, 0, 1);
  const normalizedAim = vecNormalize(aim);

  // Progressive power curve: power^1.3 allows fine touch on small putts
  const effectivePower = Math.pow(clampedPower, 1.3);
  const initialSpeed = MIN_LAUNCH_SPEED + effectivePower * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
  let vx = normalizedAim.x * initialSpeed;
  let vy = normalizedAim.y * initialSpeed;

  let x = startPos.x;
  let y = startPos.y;

  const trajectory: TrajectoryPoint[] = [
    {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      vx: Math.round(vx * 10) / 10,
      vy: Math.round(vy * 10) / 10,
      t: 0,
    },
  ];

  const events: PhysicsEvent[] = [];
  let lipOutTriggered = false;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const elapsedSec = step * DT;
    const currentSimTimeMs = initialTimeMs + elapsedSec * 1000;

    // 1. Moving obstacles collision (sweeper barriers)
    for (const obs of course.movingObstacles) {
      const phase = ((currentSimTimeMs % obs.periodMs) / obs.periodMs) * 2 * Math.PI;
      const alpha = 0.5 + 0.5 * Math.sin(phase);
      const obsX = obs.startX + alpha * (obs.endX - obs.startX);
      const obsY = obs.startY + alpha * (obs.endY - obs.startY);

      // Sweeper barrier velocity
      const dAlpha = (Math.PI / obs.periodMs) * 1000 * Math.cos(phase);
      const obsVx = dAlpha * (obs.endX - obs.startX);
      const obsVy = dAlpha * (obs.endY - obs.startY);

      const minX = obsX - obs.width / 2;
      const maxX = obsX + obs.width / 2;
      const minY = obsY - obs.height / 2;
      const maxY = obsY + obs.height / 2;

      if (isCircleInRect(x, y, BALL_RADIUS, minX, minY, obs.width, obs.height)) {
        // Robust rectangle collision normal
        let nx = 0;
        let ny = -1;

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          // Inside the box: find shortest distance to an edge
          const distL = Math.abs(x - minX);
          const distR = Math.abs(maxX - x);
          const distT = Math.abs(y - minY);
          const distB = Math.abs(maxY - y);
          const minDist = Math.min(distL, distR, distT, distB);

          if (minDist === distL) {
            nx = -1;
            ny = 0;
            x = minX - BALL_RADIUS - 0.2;
          } else if (minDist === distR) {
            nx = 1;
            ny = 0;
            x = maxX + BALL_RADIUS + 0.2;
          } else if (minDist === distT) {
            nx = 0;
            ny = -1;
            y = minY - BALL_RADIUS - 0.2;
          } else {
            nx = 0;
            ny = 1;
            y = maxY + BALL_RADIUS + 0.2;
          }
        } else {
          // Outside: clamp to closest edge
          const closestX = clamp(x, minX, maxX);
          const closestY = clamp(y, minY, maxY);
          const dx = x - closestX;
          const dy = y - closestY;
          const dist = Math.hypot(dx, dy);
          if (dist > 1e-4) {
            nx = dx / dist;
            ny = dy / dist;
          }
          x = closestX + nx * (BALL_RADIUS + 0.2);
          y = closestY + ny * (BALL_RADIUS + 0.2);
        }

        // Relative velocity including moving obstacle speed
        const relVx = vx - obsVx;
        const relVy = vy - obsVy;
        const dot = relVx * nx + relVy * ny;

        if (dot < 0) {
          const e = 0.80;
          vx = obsVx + (relVx - (1 + e) * dot * nx) * 0.96;
          vy = obsVy + (relVy - (1 + e) * dot * ny) * 0.96;

          events.push({
            type: "wall_bounce",
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            step,
            extra: { obstacleId: obs.id, speed: Math.hypot(vx, vy) },
          });
        }
      }
    }

    // 2. Surface physical properties & Water hazard check
    let decelRate = DECEL_GREEN;
    let inSand = false;

    for (const surface of course.surfaces) {
      if (isPointInRect(x, y, surface.x, surface.y, surface.width, surface.height)) {
        if (surface.type === "water") {
          events.push({
            type: "water_hazard",
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            step,
          });
          trajectory.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            vx: 0,
            vy: 0,
            t: Math.round(elapsedSec * 1000) / 1000,
          });
          return {
            trajectory,
            finalPosition: { ...startPos }, // penalty resets to pre-shot position
            sunk: false,
            waterHazard: true,
            events,
            settled: true,
            totalSteps: step,
          };
        } else if (surface.type === "sand") {
          inSand = true;
          decelRate = DECEL_SAND;
        } else if (surface.type === "rough") {
          decelRate = DECEL_ROUGH;
        }
      }
    }

    // 3. Hole capture and Lip-out mechanics
    const distToHole = Math.hypot(x - course.hole.x, y - course.hole.y);
    const speed = Math.hypot(vx, vy);

    if (distToHole <= course.hole.captureRadius) {
      if (speed <= course.hole.maxCaptureSpeed) {
        // Successful cup capture!
        events.push({
          type: "hole_sink",
          x: course.hole.x,
          y: course.hole.y,
          step,
        });
        // Snap to hole center
        x = course.hole.x;
        y = course.hole.y;
        vx = 0;
        vy = 0;
        trajectory.push({
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          vx: 0,
          vy: 0,
          t: Math.round(elapsedSec * 1000) / 1000,
        });
        return {
          trajectory,
          finalPosition: { x: course.hole.x, y: course.hole.y },
          sunk: true,
          waterHazard: false,
          events,
          settled: true,
          totalSteps: step,
        };
      } else if (speed <= course.hole.lipOutSpeed) {
        // Lip-out rim deflection
        if (!lipOutTriggered) {
          lipOutTriggered = true;
          events.push({
            type: "lip_out",
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            step,
            extra: { speed },
          });
        }
        // Centripetal rim pull & friction
        const dirX = (course.hole.x - x) / (distToHole || 1);
        const dirY = (course.hole.y - y) / (distToHole || 1);
        vx += dirX * 180 * DT;
        vy += dirY * 180 * DT;
        vx *= 0.96;
        vy *= 0.96;

        // If deflection slows it enough inside the cup
        if (Math.hypot(vx, vy) <= course.hole.maxCaptureSpeed && distToHole <= 8) {
          events.push({
            type: "hole_sink",
            x: course.hole.x,
            y: course.hole.y,
            step,
          });
          trajectory.push({
            x: course.hole.x,
            y: course.hole.y,
            vx: 0,
            vy: 0,
            t: Math.round(elapsedSec * 1000) / 1000,
          });
          return {
            trajectory,
            finalPosition: { x: course.hole.x, y: course.hole.y },
            sunk: true,
            waterHazard: false,
            events,
            settled: true,
            totalSteps: step,
          };
        }
      }
    }

    // 4. Integrate position
    x += vx * DT;
    y += vy * DT;

    // 5. Wall collisions
    let bouncedThisStep = false;
    for (const wall of course.walls) {
      const q = closestPointOnSegment(wall.p1, wall.p2, { x, y });
      const dx = x - q.x;
      const dy = y - q.y;
      const dist = Math.hypot(dx, dy);

      if (dist < BALL_RADIUS) {
        let nx = 0;
        let ny = -1;
        if (dist > 1e-4) {
          nx = dx / dist;
          ny = dy / dist;
        } else {
          const wdx = wall.p2.x - wall.p1.x;
          const wdy = wall.p2.y - wall.p1.y;
          const wlen = Math.hypot(wdx, wdy);
          if (wlen > 1e-4) {
            nx = -wdy / wlen;
            ny = wdx / wlen;
          }
        }

        // Push out of wall
        x = q.x + nx * (BALL_RADIUS + 0.1);
        y = q.y + ny * (BALL_RADIUS + 0.1);

        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          const restitution = wall.restitution ?? 0.70;
          const vnx = dot * nx;
          const vny = dot * ny;
          const vtx = vx - vnx;
          const vty = vy - vny;

          // Tangential friction damping & normal reflection
          vx = vtx * 0.95 - vnx * restitution;
          vy = vty * 0.95 - vny * restitution;

          bouncedThisStep = true;
          events.push({
            type: "wall_bounce",
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            step,
            extra: { speed: Math.hypot(vx, vy) },
          });
        }
      }
    }

    // 6. Bumper collisions
    for (const bumper of course.bumpers) {
      const distToBumper = Math.hypot(x - bumper.x, y - bumper.y);
      const minDistance = BALL_RADIUS + bumper.radius;

      if (distToBumper < minDistance) {
        let nx = 0;
        let ny = -1;
        if (distToBumper > 1e-4) {
          nx = (x - bumper.x) / distToBumper;
          ny = (y - bumper.y) / distToBumper;
        }

        // Separate
        x = bumper.x + nx * (minDistance + 0.3);
        y = bumper.y + ny * (minDistance + 0.3);

        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          const e = bumper.restitution ?? 1.30;
          const vnx = dot * nx;
          const vny = dot * ny;
          const vtx = vx - vnx;
          const vty = vy - vny;

          // Springy rebound with extra impulse
          vx = vtx * 0.98 - vnx * e + nx * 25;
          vy = vty * 0.98 - vny * e + ny * 25;

          const curSpeed = Math.hypot(vx, vy);
          if (curSpeed > MAX_BALL_SPEED) {
            vx = (vx / curSpeed) * MAX_BALL_SPEED;
            vy = (vy / curSpeed) * MAX_BALL_SPEED;
          }

          bouncedThisStep = true;
          events.push({
            type: "bumper_hit",
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            step,
            extra: { bumperId: bumper.id, speed: curSpeed },
          });
        }
      }
    }

    // 7. Physical Rolling Deceleration & Drag
    const curSpeed = Math.hypot(vx, vy);
    if (curSpeed > 0) {
      // Coulomb rolling resistance: constant deceleration
      let nextSpeed = Math.max(0, curSpeed - decelRate * DT);

      // Light quadratic air drag at higher speeds
      if (curSpeed > 150) {
        nextSpeed *= 1 - 0.00012 * curSpeed * DT;
      }

      // Sand high-friction damping
      if (inSand) {
        nextSpeed *= 0.96;
      }

      if (nextSpeed < STOP_SPEED_THRESHOLD) {
        vx = 0;
        vy = 0;
      } else {
        vx = (vx / curSpeed) * nextSpeed;
        vy = (vy / curSpeed) * nextSpeed;
      }
    }

    // 8. Record trajectory point
    if (step % TRAJECTORY_SAMPLE_INTERVAL === 0 || bouncedThisStep || (vx === 0 && vy === 0)) {
      trajectory.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        vx: Math.round(vx * 10) / 10,
        vy: Math.round(vy * 10) / 10,
        t: Math.round(elapsedSec * 1000) / 1000,
      });
    }

    if (vx === 0 && vy === 0) {
      // Ball settled completely
      return {
        trajectory,
        finalPosition: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
        sunk: false,
        waterHazard: false,
        events,
        settled: true,
        totalSteps: step,
      };
    }
  }

  // Reached max simulation steps: settle cleanly
  return {
    trajectory,
    finalPosition: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
    sunk: false,
    waterHazard: false,
    events,
    settled: true,
    totalSteps: MAX_STEPS,
  };
}
