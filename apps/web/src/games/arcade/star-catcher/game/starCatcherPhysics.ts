/**
 * Star Catcher (Astronavi) Pure Physics Functions
 * Includes toroidal geometry, ship-to-ship rocket collision, and black hole vortex physics.
 */

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  SHIP_RADIUS,
  SHIP_BOUNCE_IMPULSE,
  BLACK_HOLE_PULL_RADIUS,
  BLACK_HOLE_CORE_RADIUS,
  BLACK_HOLE_MAX_FORCE,
  BLACK_HOLE_ORBIT_ESCAPE_ANGLE,
  BLACK_HOLE_SLINGSHOT_SPEED,
} from "../config/constants";
import type { ShipState, BlackHoleState } from "./types";

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

/**
 * Calculates toroidal distance squared between two points.
 */
export function getToroidalDistanceSq(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number = GAME_WIDTH,
  height: number = GAME_HEIGHT
): number {
  const dx = getToroidalDelta(x2, x1, width);
  const dy = getToroidalDelta(y2, y1, height);
  return dx * dx + dy * dy;
}

export interface ShipCollisionResult {
  collided: boolean;
  midX: number;
  midY: number;
  impulse: number;
}

/**
 * Resolves rocket-to-rocket collision between two spaceships.
 * Uses 2-body elastic impulse and position separation with toroidal geometry.
 */
export function resolveShipCollision(
  s1: ShipState,
  s2: ShipState,
  shipRadius: number = SHIP_RADIUS,
  bounceImpulse: number = SHIP_BOUNCE_IMPULSE,
  width: number = GAME_WIDTH,
  height: number = GAME_HEIGHT
): ShipCollisionResult {
  const dx = getToroidalDelta(s1.x, s2.x, width);
  const dy = getToroidalDelta(s1.y, s2.y, height);
  const dist = Math.hypot(dx, dy);
  const minDist = shipRadius * 2;

  if (dist >= minDist || dist < 0.0001) {
    return { collided: false, midX: 0, midY: 0, impulse: 0 };
  }

  // Normal unit vector from s2 (Blue) pointing to s1 (Orange)
  const nx = dx / dist;
  const ny = dy / dist;

  // Position separation (50% each) to prevent penetration
  const overlap = (minDist - dist) * 0.5;
  s1.x += nx * overlap;
  s1.y += ny * overlap;
  s2.x -= nx * overlap;
  s2.y -= ny * overlap;

  // Relative velocity along collision normal
  const rvx = s1.vx - s2.vx;
  const rvy = s1.vy - s2.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  // Elastic rebound impulse
  const impulse = Math.max(bounceImpulse, -velAlongNormal * 1.35);
  const halfImpulse = impulse * 0.5;

  s1.vx += nx * halfImpulse;
  s1.vy += ny * halfImpulse;
  s2.vx -= nx * halfImpulse;
  s2.vy -= ny * halfImpulse;

  // Collision impact point
  const midX = s2.x + nx * (dist * 0.5);
  const midY = s2.y + ny * (dist * 0.5);

  return {
    collided: true,
    midX,
    midY,
    impulse,
  };
}

export interface BlackHolePhysicsResult {
  dvx: number;
  dvy: number;
  coreFactor: number;
  damping: number;
  targetScale: number;
  isStuck: boolean;
  escapeAlignment: number;
  currentAngle: number;
  deltaAngle: number;
  accumAngle: number;
  orbitCompleted: boolean;
  slingshotVx: number;
  slingshotVy: number;
}

/**
 * Calculates authentic black hole vortex physics and orbital escape mechanics.
 * When a rocket enters the singularity/core, outward radial motion is deflected by the vortex
 * into an orbital trajectory around the black hole.
 * Escaping requires performing an orbital revolution around the black hole (like orbital
 * escape from Earth's gravity well), which builds escape velocity and slingshots the rocket free.
 */
export function calculateBlackHoleEffect(
  ship: ShipState,
  blackHole: BlackHoleState | null,
  dt: number,
  width: number = GAME_WIDTH,
  height: number = GAME_HEIGHT,
  orbitAccum: number = 0,
  prevAngle: number | null = null,
  escapeGrace: number = 0
): BlackHolePhysicsResult {
  if (!blackHole || !blackHole.active || blackHole.scale < 0.1 || escapeGrace > 0) {
    return {
      dvx: 0,
      dvy: 0,
      coreFactor: 0,
      damping: 1.0,
      targetScale: 1.0,
      isStuck: false,
      escapeAlignment: 0,
      currentAngle: 0,
      deltaAngle: 0,
      accumAngle: 0,
      orbitCompleted: false,
      slingshotVx: 0,
      slingshotVy: 0,
    };
  }

  // Vector pointing from ship toward black hole center
  const toBhX = getToroidalDelta(blackHole.x, ship.x, width);
  const toBhY = getToroidalDelta(blackHole.y, ship.y, height);
  const dist = Math.hypot(toBhX, toBhY);

  // Vector pointing outward from black hole center to ship
  const fromBhX = -toBhX;
  const fromBhY = -toBhY;
  const currentAngle = Math.atan2(fromBhY, fromBhX);

  let deltaAngle = 0;
  if (prevAngle !== null) {
    let diff = currentAngle - prevAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    deltaAngle = diff;
  }

  if (dist >= BLACK_HOLE_PULL_RADIUS) {
    return {
      dvx: 0,
      dvy: 0,
      coreFactor: 0,
      damping: 1.0,
      targetScale: 1.0,
      isStuck: false,
      escapeAlignment: 0,
      currentAngle,
      deltaAngle: 0,
      accumAngle: 0,
      orbitCompleted: false,
      slingshotVx: 0,
      slingshotVy: 0,
    };
  }

  // Linear pull factor matching Unity EffectorForceMode2D.InverseLinear
  const pullFactor = 1.0 - dist / BLACK_HOLE_PULL_RADIUS;
  const safeDist = Math.max(dist, 1.5);

  // Inward unit vector towards black hole center
  const inX = toBhX / safeDist;
  const inY = toBhY / safeDist;

  // Outward unit vector from black hole center to ship
  const outX = fromBhX / safeDist;
  const outY = fromBhY / safeDist;

  // Clockwise tangential unit vector (orbital vortex motion)
  const tanX = -outY;
  const tanY = outX;

  // Capture core zone (dist < BLACK_HOLE_CORE_RADIUS)
  const isStuck = dist < BLACK_HOLE_CORE_RADIUS;
  const coreFactor = isStuck ? 1.0 - dist / BLACK_HOLE_CORE_RADIUS : 0;

  // Calculate thrust alignment with outward escape vector
  let escapeAlignment = 0;
  if (ship.thrusting) {
    const thrustX = Math.cos(ship.rotation);
    const thrustY = Math.sin(ship.rotation);
    escapeAlignment = thrustX * outX + thrustY * outY;
  }

  // Radial gravitational pull inward
  const radialForce = BLACK_HOLE_MAX_FORCE * pullFactor;

  // Tangential vortex swirl force that drives the ship into orbit
  const swirlForce = BLACK_HOLE_MAX_FORCE * pullFactor * (isStuck ? 0.95 : 0.45);

  let dvx = (inX * radialForce + tanX * swirlForce) * dt;
  let dvy = (inY * radialForce + tanY * swirlForce) * dt;

  // Orbital mechanics & Coriolis deflection:
  // Inside the core, outward radial velocity is deflected into tangential orbital velocity,
  // naturally curving any escape attempt into an orbit around the black hole.
  if (isStuck) {
    const vr = ship.vx * outX + ship.vy * outY;
    if (vr > 0) {
      const deflect = vr * 0.85;
      dvx -= outX * deflect;
      dvy -= outY * deflect;
      dvx += tanX * deflect;
      dvy += tanY * deflect;
    }
  }

  // Accumulate orbital rotation around the black hole
  const sweptAngle = Math.abs(deltaAngle);
  const accumAngle = isStuck ? orbitAccum + sweptAngle : Math.max(0, orbitAccum - dt * 2.0);

  // Orbital Escape (Slingshot):
  // When the rocket completes an orbital revolution (~2*PI radians) with active thrust,
  // it achieves orbital escape velocity and slingshots outward away from the event horizon!
  const orbitCompleted = isStuck && accumAngle >= BLACK_HOLE_ORBIT_ESCAPE_ANGLE && ship.thrusting;

  let slingshotVx = 0;
  let slingshotVy = 0;
  if (orbitCompleted) {
    const escapeDirX = outX * 0.7 + tanX * 0.7;
    const escapeDirY = outY * 0.7 + tanY * 0.7;
    const escapeLen = Math.hypot(escapeDirX, escapeDirY) || 1.0;
    slingshotVx = (escapeDirX / escapeLen) * BLACK_HOLE_SLINGSHOT_SPEED;
    slingshotVy = (escapeDirY / escapeLen) * BLACK_HOLE_SLINGSHOT_SPEED;
  }

  // Preserves zero drag damping
  const damping = 1.0;

  // Visual funnel sinking scale (shrinks ship towards 0.65 in singularity for depth illusion)
  const targetScale = isStuck ? 1.0 - 0.35 * coreFactor : 1.0;

  return {
    dvx,
    dvy,
    coreFactor,
    damping,
    targetScale,
    isStuck,
    escapeAlignment,
    currentAngle,
    deltaAngle,
    accumAngle,
    orbitCompleted,
    slingshotVx,
    slingshotVy,
  };
}
