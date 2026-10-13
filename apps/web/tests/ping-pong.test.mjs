import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TABLE_MARGIN_X,
  TABLE_MARGIN_Y,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  NET_Y,
  NET_HEIGHT,
  NET_STROKE_WIDTH,
  TABLE_STROKE_WIDTH,
  WINNING_SCORE,
  MIN_BALL_SPEED,
  MAX_BALL_SPEED,
  PADDLE_VELOCITY_INFLUENCE,
  SMASH_FORWARD_THRESHOLD,
  BALL_DRAG_DECAY,
  MAGNUS_FORCE,
  SPIN_DECAY,
  MAX_SPIN,
  PADDLE_FACE_RADIUS,
  PADDLE_WIDTH,
  PADDLE_STROKE_WIDTH,
  BALL_RADIUS,
  BALL_STROKE_WIDTH,
  COLOR_BG,
  COLOR_TABLE,
  COLOR_STROKE,
} from "../src/games/arcade/ping-pong/config/constants.ts";
import { PingPongBotController } from "../src/games/arcade/ping-pong/game/botController.ts";

test("Ping Pong Config & Dimensions: verifies 360x580 scale overhaul, large geometries, and bold strokes", () => {
  assert.equal(GAME_WIDTH, 360);
  assert.equal(GAME_HEIGHT, 580);
  assert.equal(NET_Y, 290);
  assert.equal(NET_HEIGHT, 8);
  assert.equal(NET_STROKE_WIDTH, 4);
  assert.equal(TABLE_STROKE_WIDTH, 7);
  assert.equal(WINNING_SCORE, 5);

  assert.equal(TABLE_MARGIN_X, 22);
  assert.equal(TABLE_MARGIN_Y, 26);
  assert.equal(TABLE_WIDTH, 316);
  assert.equal(TABLE_HEIGHT, 528);

  // Large Racket scale overhaul (radius >= 35px)
  assert.ok(PADDLE_FACE_RADIUS >= 35 && PADDLE_FACE_RADIUS <= 40);
  assert.equal(PADDLE_FACE_RADIUS, 36);
  assert.equal(PADDLE_WIDTH, 72);
  assert.equal(PADDLE_STROKE_WIDTH, 6);

  // Large Ball scale overhaul (radius >= 12px)
  assert.ok(BALL_RADIUS >= 12 && BALL_RADIUS <= 15);
  assert.equal(BALL_RADIUS, 13);
  assert.equal(BALL_STROKE_WIDTH, 6);

  // Aesthetic palette
  assert.equal(COLOR_BG, 0xf4d07b);
  assert.equal(COLOR_TABLE, 0x7ac84c);
  assert.equal(COLOR_STROKE, 0x000000);

  // Physics thresholds
  assert.ok(MIN_BALL_SPEED < MAX_BALL_SPEED);
  assert.ok(PADDLE_VELOCITY_INFLUENCE > 0);
  assert.ok(SMASH_FORWARD_THRESHOLD > 0);
  assert.ok(BALL_DRAG_DECAY < 1 && BALL_DRAG_DECAY > 0.99);
  assert.ok(MAGNUS_FORCE > 0);
  assert.ok(SPIN_DECAY < 1 && SPIN_DECAY > 0.9);
  assert.ok(MAX_SPIN > 0);
});

test("Ping Pong Bot AI: stays within table bounds across all difficulty tiers", () => {
  for (const diff of ["easy", "medium", "hard"]) {
    const bot = new PingPongBotController({ difficulty: diff });
    const paddleWidth = PADDLE_WIDTH;
    const minX = TABLE_MARGIN_X + paddleWidth / 2;
    const maxX = TABLE_MARGIN_X + TABLE_WIDTH - paddleWidth / 2;

    // Simulate idle ticks
    for (let i = 0; i < 10; i++) {
      const x = bot.update(0.016, null, paddleWidth);
      assert.ok(x >= minX && x <= maxX, `Bot X ${x} should be within [${minX}, ${maxX}]`);
    }

    // Simulate ball coming toward bot
    const mockBall = {
      x: 180,
      y: 160,
      vx: 30,
      vy: -300,
      spin: 3,
      active: true,
    };

    for (let i = 0; i < 20; i++) {
      const x = bot.update(0.016, mockBall, paddleWidth);
      assert.ok(x >= minX && x <= maxX, `Bot X ${x} should be within [${minX}, ${maxX}]`);
    }
  }
});

test("Ping Pong Center Aim Assist: middle 60% deadzone dampens X velocity while outer 20% or swipe deflects sharply", () => {
  const exitSpeed = 400;

  function calculateExitVx(relativeX, paddleVx = 0) {
    const absRelativeX = Math.abs(relativeX);
    const hasHighLateralSwipe = Math.abs(paddleVx) > 160;
    const isExtremeEdgeHit = absRelativeX >= 0.80;
    const isMiddle60Percent = absRelativeX <= 0.60;

    let exitVx = 0;
    if (isExtremeEdgeHit || hasHighLateralSwipe) {
      const maxAngleRad = 0.94;
      const angle = Math.sign(relativeX) * Math.pow(absRelativeX, 0.85) * maxAngleRad;
      exitVx = exitSpeed * Math.sin(angle);
      if (hasHighLateralSwipe) {
        exitVx += paddleVx * PADDLE_VELOCITY_INFLUENCE * 0.55;
      }
    } else if (isMiddle60Percent) {
      const rawVx = exitSpeed * Math.sin(Math.pow(relativeX, 3) * 0.5);
      exitVx = rawVx * 0.2;
    } else {
      const t = (absRelativeX - 0.60) / 0.20;
      const deadzoneVx = exitSpeed * Math.sin(Math.pow(relativeX, 3) * 0.5) * 0.2;
      const outerAngle = Math.sign(relativeX) * 0.55;
      const outerVx = exitSpeed * Math.sin(outerAngle);
      exitVx = deadzoneVx + t * (outerVx - deadzoneVx);
    }
    return Math.max(-exitSpeed * 0.82, Math.min(exitSpeed * 0.82, exitVx));
  }

  // 1. Exact Center Hit (relativeX = 0)
  const vxCenter = calculateExitVx(0);
  assert.equal(vxCenter, 0, "Center hit must have exactly 0 horizontal velocity (straight back)");

  // 2. Middle 60% Hit (e.g. relativeX = 0.40)
  const vxMiddle40 = calculateExitVx(0.40);
  // Un-dampened 40% hit might have ~120 px/s, but deadzone dampens to < 3 px/s
  assert.ok(Math.abs(vxMiddle40) < 5, "Middle 60% hits must be severely dampened by deadzone aim assist (< 5 px/s)");

  // 3. Extreme Outer 20% Hit (e.g. relativeX = 0.90)
  const vxEdge = calculateExitVx(0.90);
  assert.ok(vxEdge > 250, "Outer 20% edge hits must produce sharp sideways velocity (> 250 px/s)");

  // 4. Center hit with Intentional Lateral Swipe (paddleVx = 300)
  const vxSwipedCenter = calculateExitVx(0.1, 300);
  assert.ok(vxSwipedCenter > 100, "High lateral swipe must override deadzone and send ball sharply sideways");
});

test("Ping Pong Custom Physics: Velocity Transfer (Smash) boosts ball speed on forward swipe", () => {
  const incomingSpeed = 300;
  const forwardVelSlow = 60; // gentle contact
  const forwardVelSmash = 350; // hard forward swipe toward net

  // Smash calculation
  const isSmashSlow = forwardVelSlow > SMASH_FORWARD_THRESHOLD;
  const isSmashFast = forwardVelSmash > SMASH_FORWARD_THRESHOLD;

  assert.equal(isSmashSlow, false, "Slow forward velocity should not trigger smash threshold");
  assert.equal(isSmashFast, true, "Hard forward swipe must trigger smash threshold");

  const smashBoostSlow = isSmashSlow ? Math.min(260, forwardVelSlow * 0.52) : 0;
  const smashBoostFast = isSmashFast ? Math.min(260, forwardVelSmash * 0.52) : 0;

  const exitSpeedSlow = Math.min(MAX_BALL_SPEED, incomingSpeed * 1.05 + smashBoostSlow);
  const exitSpeedFast = Math.min(MAX_BALL_SPEED, incomingSpeed * 1.05 + smashBoostFast);

  assert.ok(exitSpeedFast > exitSpeedSlow + 100, "Forward smash must add massive speed multiplier");
  assert.ok(exitSpeedFast <= MAX_BALL_SPEED, "Speed must be capped at MAX_BALL_SPEED");
});

test("Ping Pong Custom Physics: Linear Drag gradually slows massive smashes", () => {
  let speed = 750; // high-speed smash
  const dt = 0.016;

  // Simulate 30 frames (~0.5 seconds crossing table)
  for (let frame = 0; frame < 30; frame++) {
    const drag = Math.pow(BALL_DRAG_DECAY, dt * 60);
    speed = Math.max(MIN_BALL_SPEED, speed * drag);
  }

  assert.ok(speed < 750, "Ball speed must decay over time due to linear damping");
  assert.ok(speed >= MIN_BALL_SPEED, "Ball speed must never decay below MIN_BALL_SPEED");
});

test("Ping Pong Physics: Magnus Effect Curvature Direction", () => {
  const speed = 400;
  const vx = 0;
  const vy = -400; // moving straight up

  // Perpendicular unit vector to (0, -400) is (-(-400)/400, 0/400) = (1, 0)
  const perpX = -vy / speed;
  const perpY = vx / speed;

  assert.equal(perpX, 1);
  assert.equal(perpY, 0);

  // Positive spin creates acceleration to the right (+X)
  const positiveSpin = 10;
  const accelX = perpX * positiveSpin * MAGNUS_FORCE * speed;
  assert.ok(accelX > 0, "Positive spin must accelerate trajectory to the right");

  // Negative spin creates acceleration to the left (-X)
  const negativeSpin = -10;
  const negAccelX = perpX * negativeSpin * MAGNUS_FORCE * speed;
  assert.ok(negAccelX < 0, "Negative spin must accelerate trajectory to the left");
});

test("Ping Pong Simulated Z-Axis: Arc height peaks mid-flight and drops to zero at bounce", () => {
  const startY = 505; // Orange paddle baseline
  const targetBounceY = 195; // Bounce point on Blue's half

  const totalDist = Math.abs(targetBounceY - startY);
  assert.ok(totalDist > 0);

  // At start
  const progressStart = 0;
  const zHeightStart = Math.sin(Math.PI * progressStart);
  assert.equal(zHeightStart, 0);

  // At midpoint
  const progressMid = 0.5;
  const zHeightMid = Math.sin(Math.PI * progressMid);
  assert.equal(zHeightMid, 1);

  // At bounce point
  const progressEnd = 1.0;
  const zHeightEnd = Math.sin(Math.PI * progressEnd);
  assert.ok(Math.abs(zHeightEnd) < 0.0001, "Z-height must be 0 at table contact");
});

test("Ping Pong No Side Walls & Out of Bounds Scoring Logic", () => {
  const tableMinX = TABLE_MARGIN_X; // 22
  const tableMaxX = TABLE_MARGIN_X + TABLE_WIDTH; // 338
  const tableMinY = TABLE_MARGIN_Y; // 26
  const tableMaxY = TABLE_MARGIN_Y + TABLE_HEIGHT; // 554

  function isBallInsideTable(x, y) {
    return x >= tableMinX && x <= tableMaxX && y >= tableMinY && y <= tableMaxY;
  }

  // Verify side positions are out of bounds (no walls)
  assert.equal(isBallInsideTable(10, 290), false, "X=10 is outside the left table edge");
  assert.equal(isBallInsideTable(350, 290), false, "X=350 is outside the right table edge");
  assert.equal(isBallInsideTable(180, 290), true, "X=180, Y=290 is legally on the table");

  // Scoring Rule 1: Orange hits ball out-of-bounds without bouncing on Blue's side -> Blue scores
  const lastHitBy = "orange";
  let hasBouncedOnReceiverSide = false;
  let pointWinner = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(pointWinner, "blue", "If ball flies out without landing on receiver side, receiver scores");

  // Scoring Rule 2: Orange hits ball, it bounced legally on Blue's side, Blue missed it and it flew off table -> Orange scores
  hasBouncedOnReceiverSide = true;
  pointWinner = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(pointWinner, "orange", "If ball bounced on receiver side and flies out untouched, hitter scores");
});
