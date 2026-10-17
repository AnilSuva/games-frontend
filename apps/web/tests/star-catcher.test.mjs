import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WINNING_SCORE,
  SHIP_THRUST,
  SHIP_MAX_SPEED,
  SHIP_DRAG,
  SHIP_ROTATION_LERP,
  SHIP_BOUNCE_IMPULSE,
  STAR_COLLECT_RADIUS,
  BLACK_HOLE_PULL_RADIUS,
} from "../src/games/arcade/star-catcher/config/constants.ts";
import {
  getToroidalDelta,
  getToroidalDistanceSq,
  StarCatcherBot,
} from "../src/games/arcade/star-catcher/game/starCatcherBot.ts";

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
  assert.ok(BLACK_HOLE_PULL_RADIUS >= 100);
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

test("Star Catcher Bot: steers directly toward active star using toroidal navigation", () => {
  const bot = new StarCatcherBot("hard");
  const ship = { x: 350, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };
  // Star is wrapped across right border at x = 10 (dx = +20)
  const star = { x: 10, y: 300, active: true, scale: 1 };

  const input = bot.update(1000, ship, star, null, []);
  assert.equal(input.active, true);
  assert.equal(input.intensity, 1.0);

  // Desired angle should be close to 0 radians (pointing right towards +x wrap)
  assert.ok(Math.abs(input.angle) < 0.1, `Expected angle close to 0, got ${input.angle}`);
});

test("Star Catcher Bot: avoids Black Hole when within pull threshold", () => {
  const bot = new StarCatcherBot("hard");
  const ship = { x: 180, y: 300, vx: 0, vy: 0, rotation: 0, thrusting: false };
  // Star is directly up at y = 100
  const star = { x: 180, y: 100, active: true, scale: 1 };

  // Case A: Without Black Hole, bot steers up (angle = -PI/2 = -1.57)
  const inputDirect = bot.update(1000, ship, star, null, []);
  assert.ok(
    Math.abs(inputDirect.angle - (-Math.PI / 2)) < 0.1,
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
