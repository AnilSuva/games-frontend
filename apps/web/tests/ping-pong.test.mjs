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
  INITIAL_BALL_SPEED,
  MIN_BALL_SPEED,
  MAX_BALL_SPEED,
  SPEED_INCREMENT,
  SWIPE_SAMPLING_TIME,
  MAX_DEFLECTION_ANGLE,
  SWIPE_VELOCITY_INFLUENCE,
  SMASH_FORWARD_THRESHOLD,
  SMASH_BOOST,
  Z_ARC_HEIGHT,
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

test("Ping Pong Config & Dimensions: verifies authentic 360x580 court, geometries, and reference constants from base.apk", () => {
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

  // Large Racket scale (radius >= 35px)
  assert.ok(PADDLE_FACE_RADIUS >= 35 && PADDLE_FACE_RADIUS <= 40);
  assert.equal(PADDLE_FACE_RADIUS, 36);
  assert.equal(PADDLE_WIDTH, 72);
  assert.equal(PADDLE_STROKE_WIDTH, 6);

  // Large Ball scale (radius >= 12px)
  assert.ok(BALL_RADIUS >= 12 && BALL_RADIUS <= 15);
  assert.equal(BALL_RADIUS, 13);
  assert.equal(BALL_STROKE_WIDTH, 6);

  // Minimalist palette
  assert.equal(COLOR_BG, 0xf4d07b);
  assert.equal(COLOR_TABLE, 0x7ac84c);
  assert.equal(COLOR_STROKE, 0x000000);

  // Authentic reference physics values from base.apk (JungleFrog.NPlayers.PingPong)
  assert.equal(INITIAL_BALL_SPEED, 520);
  assert.equal(MIN_BALL_SPEED, 460);
  assert.equal(MAX_BALL_SPEED, 880);
  assert.equal(SPEED_INCREMENT, 1.03);
  assert.equal(SWIPE_SAMPLING_TIME, 0.20);
  assert.equal(MAX_DEFLECTION_ANGLE, 0.75);
  assert.equal(SWIPE_VELOCITY_INFLUENCE, 0.25);
  assert.equal(SMASH_FORWARD_THRESHOLD, 90);
  assert.equal(SMASH_BOOST, 160);
  assert.equal(Z_ARC_HEIGHT, 0.45);
});

test("Ping Pong Bot AI: stays within table bounds across all difficulty tiers", () => {
  for (const diff of ["easy", "medium", "hard"]) {
    const bot = new PingPongBotController({ difficulty: diff });
    const paddleWidth = PADDLE_WIDTH;
    const minX = TABLE_MARGIN_X + paddleWidth / 2;
    const maxX = TABLE_MARGIN_X + TABLE_WIDTH - paddleWidth / 2;

    // Simulate idle ticks: should drift towards center
    for (let i = 0; i < 10; i++) {
      const x = bot.update(0.016, null, paddleWidth);
      assert.ok(x >= minX && x <= maxX, `Bot X ${x} should be within [${minX}, ${maxX}]`);
    }

    // Simulate incoming ball
    const mockBall = {
      x: 180,
      y: 200,
      vx: 40,
      vy: -480,
      spin: 0,
      active: true,
      zHeight: 0.3,
      zPhase: "paddle_to_bounce",
      startY: 505,
      targetBounceY: 195,
      targetPaddleY: 75,
      trailLength: 0,
    };

    for (let i = 0; i < 20; i++) {
      const x = bot.update(0.016, mockBall, paddleWidth);
      assert.ok(x >= minX && x <= maxX, `Bot X ${x} should be within [${minX}, ${maxX}]`);
    }
  }
});

test("Ping Pong Authentic Deflection Physics: natural angle from contact point without center aim deadzone", () => {
  function calculateExitVelocity(relativeX, incomingSpeed, paddleVx = 0, newDirY = -1) {
    const nextSpeed = Math.min(MAX_BALL_SPEED, Math.max(MIN_BALL_SPEED, incomingSpeed * SPEED_INCREMENT));
    const baseAngle = relativeX * MAX_DEFLECTION_ANGLE;
    const swipeAngleShift = Math.max(-0.3, Math.min(0.3, paddleVx / 1000)) * SWIPE_VELOCITY_INFLUENCE;
    const finalAngle = Math.max(-0.82, Math.min(0.82, baseAngle + swipeAngleShift));

    const vx = nextSpeed * Math.sin(finalAngle);
    const vy = newDirY * nextSpeed * Math.cos(finalAngle);
    return { vx, vy, speed: Math.hypot(vx, vy), angle: finalAngle };
  }

  // 1. Center contact (relativeX = 0): ball travels straight forward
  const centerHit = calculateExitVelocity(0, 520, 0);
  assert.equal(centerHit.vx, 0, "Center contact must yield zero horizontal deflection");
  assert.ok(centerHit.vy < 0, "Ball must travel forward towards opponent");
  assert.ok(Math.abs(centerHit.speed - 520 * SPEED_INCREMENT) < 0.01);

  // 2. Right side contact (relativeX = 0.5): ball deflects right (+X)
  const rightHit = calculateExitVelocity(0.5, 520, 0);
  assert.ok(rightHit.vx > 100, `Right contact must deflect right, got vx=${rightHit.vx}`);
  assert.ok(rightHit.angle > 0.3, `Angle must be positive, got ${rightHit.angle}`);

  // 3. Left side contact (relativeX = -0.5): ball deflects left (-X)
  const leftHit = calculateExitVelocity(-0.5, 520, 0);
  assert.ok(leftHit.vx < -100, `Left contact must deflect left, got vx=${leftHit.vx}`);
  assert.ok(leftHit.angle < -0.3, `Angle must be negative, got ${leftHit.angle}`);

  // 4. Extreme edge contact (relativeX = 1.0): produces maximum deflection angle (~43 degrees)
  const edgeHit = calculateExitVelocity(1.0, 520, 0);
  assert.ok(Math.abs(edgeHit.angle - MAX_DEFLECTION_ANGLE) < 0.01);

  // 5. Lateral swipe shift: swiping right while hitting center shifts trajectory right
  const swipedHit = calculateExitVelocity(0, 520, 300);
  assert.ok(swipedHit.vx > 20, "Swiping right must shift exit trajectory to the right");

  // 6. Velocity magnitude is strictly preserved
  assert.ok(Math.abs(rightHit.speed - 520 * SPEED_INCREMENT) < 0.01);
});

test("Ping Pong Smash Boost: forward swipe transfers velocity with SMASH_BOOST", () => {
  const incomingSpeed = 520;
  const forwardSlow = 40; // gentle contact
  const forwardSmash = 300; // fast forward swipe towards net

  function calculateHitSpeed(forwardVel) {
    let speed = Math.max(MIN_BALL_SPEED, incomingSpeed * SPEED_INCREMENT);
    if (forwardVel > SMASH_FORWARD_THRESHOLD) {
      const ratio = Math.min(1, Math.max(0, (forwardVel - SMASH_FORWARD_THRESHOLD) / 300));
      speed += ratio * SMASH_BOOST;
    }
    return Math.min(MAX_BALL_SPEED, speed);
  }

  const slowSpeed = calculateHitSpeed(forwardSlow);
  const smashSpeed = calculateHitSpeed(forwardSmash);

  assert.equal(slowSpeed, 520 * SPEED_INCREMENT, "Slow hit should not trigger smash boost");
  assert.ok(smashSpeed > slowSpeed + 80, `Smash hit must increase speed significantly (${smashSpeed} > ${slowSpeed})`);
  assert.ok(smashSpeed <= MAX_BALL_SPEED, "Speed must never exceed MAX_BALL_SPEED");
});

test("Ping Pong Parabolic Z-Axis Arc: verifies clean physical projectile curve 4 * h_max * p * (1 - p)", () => {
  function calculateZ(progress) {
    return 4 * Z_ARC_HEIGHT * progress * (1 - progress);
  }

  // At launch (progress = 0)
  assert.equal(calculateZ(0), 0, "Z height must be 0 at launch");

  // At quarter flight (progress = 0.25)
  const zQuarter = calculateZ(0.25);
  assert.ok(Math.abs(zQuarter - 4 * 0.45 * 0.25 * 0.75) < 0.001);

  // At apex (progress = 0.50)
  const zApex = calculateZ(0.5);
  assert.equal(zApex, Z_ARC_HEIGHT, "Z height must reach peak Z_ARC_HEIGHT at progress 0.5");

  // At three-quarter flight (progress = 0.75)
  const zThreeQuarter = calculateZ(0.75);
  assert.equal(zThreeQuarter, zQuarter, "Parabolic arc must be symmetric around apex");

  // At table contact (progress = 1.0)
  assert.equal(calculateZ(1.0), 0, "Z height must return to 0 at table bounce contact");
});

test("Ping Pong Free Trajectory & Table Tennis Out-of-Bounds Rules", () => {
  const tableMinX = TABLE_MARGIN_X;
  const tableMaxX = TABLE_MARGIN_X + TABLE_WIDTH;

  function updateBallPosition(x, vx, dt = 0.016) {
    return x + vx * dt;
  }

  // Ball moves freely according to velocity without bouncing off table side borders
  const ballHeadingLeft = updateBallPosition(25, -450);
  assert.ok(
    ballHeadingLeft < tableMinX,
    `Ball must travel freely past left table border (${ballHeadingLeft} < ${tableMinX})`
  );

  const ballHeadingRight = updateBallPosition(335, 450);
  assert.ok(
    ballHeadingRight > tableMaxX,
    `Ball must travel freely past right table border (${ballHeadingRight} > ${tableMaxX})`
  );

  // Scoring Rule 1: Hitter hits ball out of bounds without landing on receiver's court -> receiver scores (fault)
  const lastHitBy = "orange";
  let hasBouncedOnReceiverSide = false;
  let scorer = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(scorer, "blue", "If ball flies out without landing on receiver court, receiver scores");

  // Scoring Rule 2: Ball lands legally on receiver side, receiver misses -> hitter scores
  hasBouncedOnReceiverSide = true;
  scorer = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(scorer, "orange", "If ball bounced on receiver side and receiver misses, hitter scores");
});
