import test from "node:test";
import assert from "node:assert/strict";
import { getGameMetadata } from "../src/platform/registry/index.ts";
import { CARTRIDGE_MAP } from "../src/platform/registry/cartridges.ts";
import {
  BALL_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_STROKES_PER_HOLE,
  TOTAL_HOLES,
} from "../src/games/arcade/mini-golf-duel/config/constants.ts";
import { COURSES } from "../src/games/arcade/mini-golf-duel/game/courses.ts";
import {
  closestPointOnSegment,
  simulateShot,
  vecDistance,
  vecLength,
  vecNormalize,
} from "../src/games/arcade/mini-golf-duel/game/physics.ts";
import { MiniGolfBotController } from "../src/games/arcade/mini-golf-duel/game/botController.ts";

test("Mini Golf Duel: Platform Registry & Cartridge Integration", () => {
  const metadata = getGameMetadata("mini-golf-duel");
  assert.ok(metadata, "Mini Golf Duel manifest must exist in platform registry");
  assert.equal(metadata.id, "mini-golf-duel");
  assert.equal(metadata.title, "Mini Golf Duel");
  assert.equal(metadata.category, "arcade");
  assert.equal(metadata.engine, "phaser");
  assert.equal(metadata.status, "available");
  assert.equal(metadata.isVisible, true);
  assert.deepEqual(metadata.supportedModes, ["local-2p", "pvp-bot", "online-2p"]);
  assert.equal(metadata.defaultOrientation, "portrait");

  // Check Cartridge mapping
  assert.ok(
    CARTRIDGE_MAP["mini-golf-duel"],
    "Mini Golf Duel must have a registered lazy cartridge component"
  );
});

test("Mini Golf Duel: Geometry, 3 Courses, and Dimension Constants", () => {
  assert.equal(GAME_WIDTH, 380);
  assert.equal(GAME_HEIGHT, 600);
  assert.equal(BALL_RADIUS, 7);
  assert.equal(MAX_STROKES_PER_HOLE, 8);
  assert.equal(TOTAL_HOLES, 3);
  assert.equal(COURSES.length, 3);

  // Course 1: Garden Path
  const c1 = COURSES[0];
  assert.equal(c1.id, "garden-path");
  assert.equal(c1.name, "Garden Path");
  assert.equal(c1.par, 3);
  assert.ok(c1.walls.length >= 4, "Perimeter and inner obstacles");
  assert.ok(c1.bumpers.length >= 1);
  assert.ok(c1.surfaces.some((s) => s.type === "sand"));

  // Course 2: Bumper Alley
  const c2 = COURSES[1];
  assert.equal(c2.id, "bumper-alley");
  assert.equal(c2.name, "Bumper Alley");
  assert.equal(c2.par, 3);
  assert.ok(c2.bumpers.length >= 3, "Bumper Alley should feature multiple bumpers");

  // Course 3: Water Challenge
  const c3 = COURSES[2];
  assert.equal(c3.id, "water-challenge");
  assert.equal(c3.name, "Water Challenge");
  assert.equal(c3.par, 4);
  assert.ok(c3.surfaces.some((s) => s.type === "water"), "Water challenge must contain water hazards");
  assert.ok(c3.movingObstacles.length >= 1, "Water challenge must contain a moving hazard");
});

test("Mini Golf Duel: Physics Math & Segment Projection", () => {
  const p1 = { x: 20, y: 100 };
  const p2 = { x: 100, y: 100 };

  // Point directly above segment
  const q1 = closestPointOnSegment(p1, p2, { x: 50, y: 80 });
  assert.equal(q1.x, 50);
  assert.equal(q1.y, 100);

  // Point beyond p2
  const q2 = closestPointOnSegment(p1, p2, { x: 150, y: 120 });
  assert.equal(q2.x, 100);
  assert.equal(q2.y, 100);

  // Point before p1
  const q3 = closestPointOnSegment(p1, p2, { x: 0, y: 120 });
  assert.equal(q3.x, 20);
  assert.equal(q3.y, 100);

  // Vector helpers
  const v = vecNormalize({ x: 3, y: 4 });
  assert.ok(Math.abs(vecLength(v) - 1.0) < 1e-5);
  assert.equal(v.x, 0.6);
  assert.equal(v.y, 0.8);
});

test("Mini Golf Duel: Physics Simulation Mechanics", () => {
  const c0 = COURSES[0];

  // 1. Distance & Velocity scaling
  const lowShot = simulateShot(c0, { x: 190, y: 500 }, { x: 0, y: -1 }, 0.2);
  const highShot = simulateShot(c0, { x: 190, y: 500 }, { x: 0, y: -1 }, 0.7);
  assert.ok(lowShot.settled && highShot.settled);
  assert.ok(
    vecDistance({ x: 190, y: 500 }, highShot.finalPosition) >
      vecDistance({ x: 190, y: 500 }, lowShot.finalPosition)
  );

  // 2. Wall Bounce Reflection
  const bounceShot = simulateShot(c0, { x: 80, y: 400 }, { x: -1, y: 0 }, 0.4);
  assert.ok(bounceShot.events.some((e) => e.type === "wall_bounce"));
  assert.ok(bounceShot.finalPosition.x > 30);

  // 3. Sand Bunker Deceleration
  const grassShot = simulateShot(c0, { x: 80, y: 240 }, { x: 0, y: -1 }, 0.4);
  const sandShot = simulateShot(c0, { x: 300, y: 230 }, { x: 0, y: -1 }, 0.4);
  const grassDist = Math.abs(grassShot.finalPosition.y - 240);
  const sandDist = Math.abs(sandShot.finalPosition.y - 230);
  assert.ok(sandDist < grassDist, "Sand bunker must decelerate the ball more strongly than grass");

  // 4. Water Hazard Penalty
  const c2 = COURSES[2];
  const waterShot = simulateShot(c2, { x: 80, y: 320 }, { x: 0, y: -1 }, 0.4);
  assert.ok(waterShot.waterHazard, "Should register as water hazard");
  assert.equal(waterShot.finalPosition.x, 80);
  assert.equal(waterShot.finalPosition.y, 320);

  // 5. Hole Capture
  const sinkShot = simulateShot(c0, { x: 190, y: 140 }, { x: 0, y: -1 }, 0.26);
  assert.ok(sinkShot.sunk, "Gentle shot should sink in cup");
  assert.equal(sinkShot.finalPosition.x, c0.hole.x);
  assert.equal(sinkShot.finalPosition.y, c0.hole.y);
});

test("Mini Golf Duel: Intelligent Bot Controller Decision Making", () => {
  const c0 = COURSES[0];
  const ballPos = { x: 150, y: 520 };

  // Easy bot
  const easyDecision = MiniGolfBotController.calculateShot(c0, ballPos, "easy");
  assert.ok(easyDecision.power >= 0.1 && easyDecision.power <= 1.0);
  assert.ok(Math.abs(vecLength(easyDecision.aim) - 1.0) < 0.05);

  // Medium bot
  const medDecision = MiniGolfBotController.calculateShot(c0, ballPos, "medium");
  assert.ok(medDecision.power >= 0.1 && medDecision.power <= 1.0);
  assert.ok(Math.abs(vecLength(medDecision.aim) - 1.0) < 0.05);

  // Hard bot
  const hardDecision = MiniGolfBotController.calculateShot(c0, ballPos, "hard");
  assert.ok(hardDecision.power >= 0.1 && hardDecision.power <= 1.0);
  assert.ok(Math.abs(vecLength(hardDecision.aim) - 1.0) < 0.05);

  // Water hazard avoidance test on Course 3:
  const c2 = COURSES[2];
  // Ball placed south of fairway bridge: direct line through left water is obstructed
  const botChoiceOnWater = MiniGolfBotController.calculateShot(c2, { x: 190, y: 450 }, "hard");
  const testSim = simulateShot(c2, { x: 190, y: 450 }, botChoiceOnWater.aim, botChoiceOnWater.power);
  assert.ok(!testSim.waterHazard, "Hard bot must avoid landing in water hazard");
});
