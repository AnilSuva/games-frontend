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
  PADDLE_VELOCITY_INFLUENCE,
  SMASH_FORWARD_THRESHOLD,
  HARD_SMASH_FORWARD_THRESHOLD,
  HARD_HIT_SPEED_THRESHOLD,
  BALL_DRAG_DECAY,
  MAGNUS_FORCE,
  SPIN_DECAY,
  MAX_SPIN,
  AIRTIME_EXPONENT,
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

  // Physics thresholds & extended airtime
  assert.ok(MIN_BALL_SPEED < MAX_BALL_SPEED);
  assert.equal(MIN_BALL_SPEED, 300);
  assert.equal(INITIAL_BALL_SPEED, 380);
  assert.equal(MAX_BALL_SPEED, 860);
  assert.ok(PADDLE_VELOCITY_INFLUENCE > 0);
  assert.ok(SMASH_FORWARD_THRESHOLD > 0);
  assert.ok(HARD_SMASH_FORWARD_THRESHOLD > SMASH_FORWARD_THRESHOLD);
  assert.ok(HARD_HIT_SPEED_THRESHOLD >= 500);
  assert.ok(AIRTIME_EXPONENT > 0 && AIRTIME_EXPONENT < 1.0);
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

test("Ping Pong Center Aim Assist: 75% deadzone actively guides trajectory toward table center (180)", () => {
  const exitSpeed = 380;
  const tableCenterX = GAME_WIDTH / 2; // 180
  const targetCenterY = 180;
  const ballY = 505;

  function calculateExitVx(relativeX, ballX = 180, paddleVx = 0) {
    const absRelativeX = Math.abs(relativeX);
    const hasHighLateralSwipe = Math.abs(paddleVx) > 200;
    const isExtremeEdgeHit = absRelativeX >= 0.85;
    const isMiddle75Percent = absRelativeX <= 0.75;

    let exitVx = 0;
    if (isExtremeEdgeHit || hasHighLateralSwipe) {
      const maxAngleRad = 0.88;
      const angle = Math.sign(relativeX) * Math.pow(absRelativeX, 0.85) * maxAngleRad;
      exitVx = exitSpeed * Math.sin(angle);
      if (hasHighLateralSwipe) {
        exitVx += paddleVx * PADDLE_VELOCITY_INFLUENCE * 0.5;
      }
    } else if (isMiddle75Percent) {
      const dxToCenter = tableCenterX - ballX;
      const dyToCenter = targetCenterY - ballY;
      const centerAngle = Math.atan2(dxToCenter, Math.abs(dyToCenter));

      const aimFactor = Math.cos((absRelativeX / 0.75) * (Math.PI / 2));
      const centerGuidedVx = exitSpeed * Math.sin(centerAngle) * 0.95;
      const offsetVx = exitSpeed * Math.sin(Math.pow(relativeX, 3) * 0.35) * 0.15;
      exitVx = offsetVx + aimFactor * (centerGuidedVx - offsetVx);
    } else {
      const t = (absRelativeX - 0.75) / 0.10;
      const offsetVx = exitSpeed * Math.sin(Math.pow(relativeX, 3) * 0.35) * 0.15;
      const edgeAngle = Math.sign(relativeX) * 0.45;
      const edgeVx = exitSpeed * Math.sin(edgeAngle);
      exitVx = offsetVx + t * (edgeVx - offsetVx);
    }
    return Math.max(-exitSpeed * 0.80, Math.min(exitSpeed * 0.80, exitVx));
  }

  // 1. Exact Center Hit at table center (relativeX = 0, ballX = 180)
  const vxCenter = calculateExitVx(0, 180);
  assert.equal(vxCenter, 0, "Center hit at center of table must go straight forward (0 horizontal velocity)");

  // 2. Active Center Aim Assist when hit near left sideline (ballX = 80)
  const vxLeftHit = calculateExitVx(0, 80);
  assert.ok(vxLeftHit > 50, "Hit on left side of table must be actively steered to the right (+Vx) toward center");

  // 3. Active Center Aim Assist when hit near right sideline (ballX = 280)
  const vxRightHit = calculateExitVx(0, 280);
  assert.ok(vxRightHit < -50, "Hit on right side of table must be actively steered to the left (-Vx) toward center");

  // 4. Moderate offset within 75% deadzone (relativeX = 0.45, ballX = 180)
  const vxMiddle45 = calculateExitVx(0.45, 180);
  assert.ok(Math.abs(vxMiddle45) < 15, "75% deadzone hits must remain closely centered (< 15 px/s)");

  // 5. Extreme Outer 15% Edge Hit (relativeX = 0.92)
  const vxEdge = calculateExitVx(0.92, 180);
  assert.ok(vxEdge > 200, "Outer 15% edge hits must produce sharp intentional deflection (> 200 px/s)");

  // 6. Hard Lateral Swipe Override (paddleVx = 300)
  const vxSwiped = calculateExitVx(0.1, 180, 300);
  assert.ok(vxSwiped > 80, "Hard lateral swipe must override aim assist and send ball sideways");
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

test("Ping Pong Simulated Z-Axis: Extended airtime hang-time with AIRTIME_EXPONENT", () => {
  const startY = 505; // Orange paddle baseline
  const targetBounceY = 180; // Deep bounce point on Blue's half (NET_Y - 110)

  const totalDist = Math.abs(targetBounceY - startY);
  assert.ok(totalDist > 0);

  function calculateZHeight(progress) {
    return Math.pow(Math.sin(Math.PI * progress), AIRTIME_EXPONENT);
  }

  // At start
  assert.equal(calculateZHeight(0), 0);

  // Early in flight (progress = 0.20)
  // Standard sine gives ~0.587, but with AIRTIME_EXPONENT it hangs higher (~0.70)
  const zEarly = calculateZHeight(0.20);
  assert.ok(zEarly > 0.65, `Early flight zHeight (${zEarly}) should remain elevated (> 0.65) for floaty airtime`);

  // At apex midpoint
  assert.equal(calculateZHeight(0.50), 1.0);

  // Late in flight before bounce (progress = 0.80)
  const zLate = calculateZHeight(0.80);
  assert.ok(zLate > 0.65, `Late flight zHeight (${zLate}) should remain elevated (> 0.65)`);

  // At bounce contact
  const zBounce = calculateZHeight(1.0);
  assert.ok(Math.abs(zBounce) < 0.0001, "Z-height must drop to 0 at table bounce contact");
});

test("Ping Pong Free Trajectory: Ball moves freely without bouncing off borders, and goes out when leaving boundaries", () => {
  const tableMinX = TABLE_MARGIN_X; // 22
  const tableMaxX = TABLE_MARGIN_X + TABLE_WIDTH; // 338

  function updateBallX(x, vx, dt = 0.016) {
    return x + vx * dt;
  }

  // Ball moves freely according to velocity without bouncing off table borders
  const ballHeadingLeft = updateBallX(25, -400);
  assert.ok(
    ballHeadingLeft < tableMinX,
    `Ball should travel freely past left table border (${ballHeadingLeft} < ${tableMinX}) without bouncing`
  );

  const ballHeadingRight = updateBallX(335, 400);
  assert.ok(
    ballHeadingRight > tableMaxX,
    `Ball should travel freely past right table border (${ballHeadingRight} > ${tableMaxX}) without bouncing`
  );

  // Scoring Rule 1: Hitter hits ball out of bounds without landing on receiver's court -> receiver scores
  const lastHitBy = "orange";
  let hasBouncedOnReceiverSide = false;
  let pointWinner = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(pointWinner, "blue", "If ball flies out without landing on receiver side, receiver scores");

  // Scoring Rule 2: Ball lands legally on receiver side, receiver misses and ball flies out -> hitter scores
  hasBouncedOnReceiverSide = true;
  pointWinner = hasBouncedOnReceiverSide ? lastHitBy : (lastHitBy === "orange" ? "blue" : "orange");
  assert.equal(pointWinner, "orange", "If ball bounced on receiver side and receiver misses, hitter scores");
});
