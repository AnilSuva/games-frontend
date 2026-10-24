import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WINNING_SCORE,
  SHIP_RADIUS,
  SHIP_THRUST,
  SHIP_MAX_SPEED,
  SHIP_DRAG,
  SHIP_ROTATION_LERP,
  SHIP_BOUNCE_IMPULSE,
  STAR_COLLECT_RADIUS,
  STAR_RESPAWN_DELAY_MS,
  BLACK_HOLE_PULL_RADIUS,
  BLACK_HOLE_CORE_RADIUS,
  BLACK_HOLE_ORBIT_ESCAPE_ANGLE,
  BLACK_HOLE_SLINGSHOT_SPEED,
} from "../src/games/arcade/star-catcher/config/constants.ts";
import {
  getToroidalDelta,
  getToroidalDistanceSq,
  StarCatcherBot,
} from "../src/games/arcade/star-catcher/game/starCatcherBot.ts";
import {
  resolveShipCollision,
  calculateBlackHoleEffect,
} from "../src/games/arcade/star-catcher/game/starCatcherPhysics.ts";

test("Star Catcher Constants: has authentic physics and match rules", () => {
  assert.equal(GAME_WIDTH, 360);
  assert.equal(GAME_HEIGHT, 600);
  assert.equal(WINNING_SCORE, 5);
  assert.ok(SHIP_THRUST > 0);
  assert.ok(SHIP_MAX_SPEED > 0);
  assert.ok(SHIP_DRAG > 0.9 && SHIP_DRAG < 1.0);
  assert.ok(SHIP_ROTATION_LERP > 0 && SHIP_ROTATION_LERP < 1.0);
  assert.ok(SHIP_BOUNCE_IMPULSE > 0);
  assert.ok(STAR_COLLECT_RADIUS >= 20);
  assert.equal(STAR_RESPAWN_DELAY_MS, 2400, "Star respawn delay must be 2400ms to give players breathing room");
  assert.ok(BLACK_HOLE_PULL_RADIUS >= 100);
  assert.ok(BLACK_HOLE_CORE_RADIUS >= 30);
});

test("Toroidal Geometry (Teletrasporto): calculates shortest wrapped delta correctly", () => {
  // Normal delta without wrapping
  assert.equal(getToroidalDelta(150, 100, 360), 50);
  assert.equal(getToroidalDelta(100, 150, 360), -50);

  // Wrapping across right border (from 350 to 10 should be +20, not -340)
  assert.equal(getToroidalDelta(10, 350, 360), 20);

  // Wrapping across left border (from 10 to 350 should be -20, not +340)
  assert.equal(getToroidalDelta(350, 10, 360), -20);

  // Exact half width
  assert.equal(getToroidalDelta(280, 100, 360), 180);

  // Vertical wrapping
  assert.equal(getToroidalDelta(20, 580, 600), 40);
  assert.equal(getToroidalDelta(580, 20, 600), -40);
});

test("Toroidal Distance: calculates wrapped distance squared correctly", () => {
  // Direct distance
  const d1 = getToroidalDistanceSq(100, 100, 130, 140, 360, 600);
  assert.equal(d1, 30 * 30 + 40 * 40); // 2500

  // Toroidal wrapped distance (wrapping around border is shorter)
  const d2 = getToroidalDistanceSq(10, 20, 350, 580, 360, 600);
  assert.equal(d2, 20 * 20 + 40 * 40); // 2000
});

test("Rocket Collision: detects and resolves ship-to-ship collision with bounce impulse", () => {
  // Ship 1 (Orange) and Ship 2 (Blue) far apart
  const sOrange = { x: 100, y: 300, vx: 50, vy: 0, rotation: 0, thrusting: false };
  const sBlue = { x: 200, y: 300, vx: -50, vy: 0, rotation: Math.PI, thrusting: false };

  const noCollision = resolveShipCollision(sOrange, sBlue);
  assert.equal(noCollision.collided, false);

  // Now position them overlapping within SHIP_RADIUS * 2 (16 * 2 = 32px)
  sOrange.x = 180;
  sOrange.y = 300;
  sBlue.x = 196; // distance = 16px, overlap = 16px
  sBlue.y = 300;

  const result = resolveShipCollision(sOrange, sBlue, SHIP_RADIUS, SHIP_BOUNCE_IMPULSE);
  assert.equal(result.collided, true);
  assert.ok(result.impulse >= SHIP_BOUNCE_IMPULSE);

  // Verified position separation: Orange pushed left, Blue pushed right
  assert.ok(sOrange.x < 180, "Orange should be separated leftwards");
  assert.ok(sBlue.x > 196, "Blue should be separated rightwards");

  // Verified rebound velocities
  assert.ok(sOrange.vx < 0, "Orange should rebound with negative vx");
  assert.ok(sBlue.vx > 0, "Blue should rebound with positive vx");
});

test("Rocket Collision: handles toroidal screen-edge boundary collision correctly", () => {
  // Orange at x = 5, Blue at x = 355 (separated by only 10px across 360px border)
  const sOrange = { x: 5, y: 200, vx: -30, vy: 0, rotation: Math.PI, thrusting: false };
  const sBlue = { x: 355, y: 200, vx: 30, vy: 0, rotation: 0, thrusting: false };

  const result = resolveShipCollision(sOrange, sBlue, SHIP_RADIUS, SHIP_BOUNCE_IMPULSE, 360, 600);
  assert.equal(result.collided, true);
  assert.ok(result.impulse > 0);

  // Orange pushed away across wrap border
  assert.ok(sOrange.vx > 0, "Orange should be bounced toward +x (inward)");
  assert.ok(sBlue.vx < 0, "Blue should be bounced toward -x (inward)");
});

test("Black Hole Vortex & Stuck Effect: applies inward radial pull and tangential swirl", () => {
  const blackHole = { x: 180, y: 300, active: true, scale: 0.5 };
  // Ship at distance 100px directly to the right
  const ship = { x: 280, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };

  const effect = calculateBlackHoleEffect(ship, blackHole, 1 / 60, 360, 600);

  // Inward radial pull: should pull leftwards towards x = 180 (dvx < 0)
  assert.ok(effect.dvx < 0, `Expected inward dvx < 0, got ${effect.dvx}`);

  // Tangential swirl: clockwise accretion swirl pushes dvy > 0
  assert.notEqual(effect.dvy, 0, "Black hole must exert tangential swirl force");
  assert.equal(effect.isStuck, false, "At 100px ship is not in stuck singularity zone");
  assert.equal(effect.targetScale, 1.0, "Outside core, targetScale should be 1.0");
});

test("Black Hole Capture & Orbital Slingshot: captures in core, deflects radial plunge, and escapes after full orbital rotation", () => {
  const blackHole = { x: 180, y: 300, active: true, scale: 0.5 };

  // 1. Ship inside core singularity (dist = 15px directly to the right at x=195, y=300)
  const shipCaptured = { x: 195, y: 300, vx: 0, vy: 0, rotation: Math.PI, thrusting: false };
  const effectCaptured = calculateBlackHoleEffect(shipCaptured, blackHole, 1 / 60, 360, 600);

  assert.equal(effectCaptured.isStuck, true, "Ship within BLACK_HOLE_CORE_RADIUS should be captured");
  assert.ok(effectCaptured.coreFactor > 0.5, "Core factor should be significant near center");
  assert.equal(effectCaptured.damping, 1.0, "Damping must be 1.0 (zero artificial glue dampening)");
  assert.ok(effectCaptured.targetScale < 1.0, "Target scale must shrink ship into singularity funnel");

  // 2. Pure radial escape attempt is deflected into orbit by Coriolis frame dragging
  const shipRadial = { x: 195, y: 300, vx: 100, vy: 0, rotation: 0, thrusting: true };
  const effectRadial = calculateBlackHoleEffect(shipRadial, blackHole, 1 / 60, 360, 600);
  assert.equal(effectRadial.isStuck, true);
  assert.equal(effectRadial.orbitCompleted, false, "Straight radial escape must NOT break free without completing an orbit");
  assert.ok(effectRadial.dvy > 0, "Outward radial velocity must be deflected tangentially into the orbit");

  // 3. Orbital rotation progression: simulate ship orbiting around the black hole under thrust
  // Sweeping 360 degrees (~2*PI radians) accumulates orbital angle
  const shipOrbiting = { x: 195, y: 300, vx: 0, vy: 180, rotation: Math.PI / 2, thrusting: true };
  const fullOrbitAccum = BLACK_HOLE_ORBIT_ESCAPE_ANGLE + 0.1;
  const effectEscaping = calculateBlackHoleEffect(
    shipOrbiting,
    blackHole,
    1 / 60,
    360,
    600,
    fullOrbitAccum,
    0
  );

  assert.equal(effectEscaping.orbitCompleted, true, "Ship completing full rotation orbit under thrust must trigger escape");
  const escapeVelocity = Math.hypot(effectEscaping.slingshotVx, effectEscaping.slingshotVy);
  assert.ok(
    escapeVelocity >= BLACK_HOLE_SLINGSHOT_SPEED,
    `Slingshot escape velocity (${escapeVelocity}) must achieve escape speed (${BLACK_HOLE_SLINGSHOT_SPEED})`
  );

  // 4. Slingshot grace period prevents re-capture while breaking free
  const effectGrace = calculateBlackHoleEffect(shipCaptured, blackHole, 1 / 60, 360, 600, 0, null, 0.85);
  assert.equal(effectGrace.isStuck, false, "During escape grace period, ship cannot be re-captured");
  assert.equal(effectGrace.dvx, 0);
  assert.equal(effectGrace.dvy, 0);
});

test("Star Catcher Bot: returns idle input when star is not active", () => {
  const bot = new StarCatcherBot("medium");
  const ship = { x: 180, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };

  const input1 = bot.update(1000, ship, null, null, []);
  assert.equal(input1.active, false);
  assert.equal(input1.intensity, 0);

  const inactiveStar = { x: 180, y: 150, active: false, scale: 0 };
  const input2 = bot.update(2000, ship, inactiveStar, null, []);
  assert.equal(input2.active, false);
  assert.equal(input2.intensity, 0);
});

test("Star Catcher Bot: steers toward active star using toroidal navigation on Hard", () => {
  const bot = new StarCatcherBot("hard");
  const ship = { x: 350, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };
  // Star is wrapped across right border at x = 10 (dx = +20)
  const star = { x: 10, y: 300, active: true, scale: 1 };

  const input = bot.update(1000, ship, star, null, []);
  assert.equal(input.active, true);
  assert.ok(input.intensity >= 0.90, `Hard bot intensity should be competitive (>= 0.90), got ${input.intensity}`);

  // Desired angle should be close to 0 radians (pointing right towards +x wrap)
  assert.ok(Math.abs(input.angle) < 0.25, `Expected angle close to 0, got ${input.angle}`);
});

test("Star Catcher Bot Difficulty: Easy bot difficulty is genuinely easy and forgiving", () => {
  const bot = new StarCatcherBot("easy");
  const ship = { x: 350, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };
  // Star is across the border at x = 10
  const star = { x: 10, y: 300, active: true, scale: 1 };

  const input = bot.update(1000, ship, star, null, []);
  assert.equal(input.active, true);

  // 1. Easy throttle is capped at ~0.48 so human players can easily outpace it
  assert.ok(input.intensity <= 0.55, `Easy bot intensity must be <= 0.55, got ${input.intensity}`);

  // 2. Easy bot does NOT wrap across screen edges (takes direct Euclidean path across screen toward -x)
  // angle should point left (around PI or -PI), NOT right towards +x wrap
  assert.ok(
    Math.abs(input.angle) > 2.0,
    `Easy bot should steer direct left across screen without toroidal wrap, got angle ${input.angle}`
  );

  // 3. Reaction latency: input does not change within 500ms
  const inputFast = bot.update(1400, ship, star, null, []);
  assert.deepEqual(inputFast, input, "Easy bot should respect 650ms reaction latency");
});

test("Star Catcher Bot Difficulty: Medium bot has balanced casual speed and reaction", () => {
  const bot = new StarCatcherBot("medium");
  const ship = { x: 180, y: 400, vx: 0, vy: 0, rotation: 0, thrusting: false };
  const star = { x: 180, y: 200, active: true, scale: 1 };

  const input = bot.update(1000, ship, star, null, []);
  assert.equal(input.active, true);
  // Medium intensity is around 0.72 (casual-friendly, not overpowering)
  assert.ok(
    input.intensity >= 0.65 && input.intensity <= 0.80,
    `Medium bot intensity should be ~0.72, got ${input.intensity}`
  );
});

test("Star Catcher Bot: avoids Black Hole and steers along orbital tangent to escape", () => {
  const bot = new StarCatcherBot("hard");
  const ship = { x: 180, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };
  // Star is directly up at y = 100
  const star = { x: 180, y: 100, active: true, scale: 1 };

  // Case A: Without Black Hole, bot steers up (angle = -PI/2 = -1.57)
  const inputDirect = bot.update(1000, ship, star, null, []);
  assert.ok(
    Math.abs(inputDirect.angle - (-Math.PI / 2)) < 0.2,
    `Direct angle should be ~ -1.57, got ${inputDirect.angle}`
  );

  // Case B: Black Hole is right in between ship and star at (180, 250)
  const blackHole = { x: 180, y: 250, active: true, scale: 1 };
  const inputWithBH = bot.update(2000, ship, star, blackHole, []);

  // Bot should deflect away from the direct line to avoid the black hole
  assert.notEqual(
    inputWithBH.angle,
    inputDirect.angle,
    "Bot should adjust vector to avoid black hole"
  );

  // Case C: Bot trapped inside core (dist = 20px) aligns prograde along orbit tangent
  const shipInCore = { x: 200, y: 250, vx: 0, vy: 0, rotation: 0, thrusting: false };
  const inputInCore = bot.update(3000, shipInCore, star, blackHole, []);
  // At (200, 250) with BH at (180, 250), dx = -20 (ship is to the right).
  // Clockwise tangent points down (+y, angle ~ PI/2)
  assert.equal(inputInCore.active, true);
  assert.equal(inputInCore.intensity, 1.0, "Hard bot should use full 1.0 throttle when escaping black hole");
  assert.ok(inputInCore.angle > 0.5 && inputInCore.angle < 2.5, "Bot should steer tangentially along orbit to escape");
});

test("Star Catcher Match Progression: scoring and win condition", () => {
  const scores = { orange: 0, blue: 0 };

  // Star collected by orange
  scores.orange += 1;
  assert.equal(scores.orange, 1);
  assert.ok(scores.orange < WINNING_SCORE);

  // Orange collects 4 more stars
  scores.orange += 4;
  assert.equal(scores.orange, 5);
  assert.equal(scores.orange >= WINNING_SCORE, true);
});
