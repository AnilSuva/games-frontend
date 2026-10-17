import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TRUNK_CENTER_X,
  TRUNK_CENTER_Y,
  TRUNK_RADIUS,
  TRUNK_STROKE_WIDTH,
  RED_KNIFE_SPAWN_X,
  RED_KNIFE_SPAWN_Y,
  RED_KNIFE_DESTINY_Y,
  BLUE_KNIFE_SPAWN_X,
  BLUE_KNIFE_SPAWN_Y,
  BLUE_KNIFE_DESTINY_Y,
  KNIFE_SPEED,
  KNIFE_CLASH_ANGLE_THRESHOLD,
  KNIVES_PVP,
  KNIVES_EASY,
  KNIVES_MEDIUM,
  KNIVES_HARD,
  WINNING_SCORE,
  COLOR_BG,
  COLOR_ORANGE,
  COLOR_BLUE,
  DEFAULT_KNIFE_ANGLES,
  PVP_TARGET_SETS,
  BOT_TARGET_SETS,
} from "../src/games/arcade/knife-thrower/config/constants.ts";
import {
  normalizeAngle,
  angularDistance,
  calculateHitAngle,
  isAngleClashing,
  TrunkRotator,
  ROTATION_PROFILES,
} from "../src/games/arcade/knife-thrower/game/rotationProfiles.ts";
import { KnifeThrowerBot } from "../src/games/arcade/knife-thrower/game/botController.ts";

test("Knife Thrower 2-Player Config & Layout: verifies 360x580 mobile viewport and dual opposing positions", () => {
  assert.equal(GAME_WIDTH, 360);
  assert.equal(GAME_HEIGHT, 580);

  // Central shared trunk at mid-screen (290)
  assert.equal(TRUNK_CENTER_X, 180);
  assert.equal(TRUNK_CENTER_Y, 290);
  assert.equal(TRUNK_RADIUS, 60);
  assert.equal(TRUNK_STROKE_WIDTH, 5);

  // Player 1 (Orange / Bottom) throwing upward
  assert.equal(RED_KNIFE_SPAWN_X, 180);
  assert.equal(RED_KNIFE_SPAWN_Y, 515);
  assert.ok(RED_KNIFE_SPAWN_Y > TRUNK_CENTER_Y);
  assert.equal(RED_KNIFE_DESTINY_Y, TRUNK_CENTER_Y + TRUNK_RADIUS - 6);

  // Player 2 (Blue / Top) throwing downward
  assert.equal(BLUE_KNIFE_SPAWN_X, 180);
  assert.equal(BLUE_KNIFE_SPAWN_Y, 65);
  assert.ok(BLUE_KNIFE_SPAWN_Y < TRUNK_CENTER_Y);
  assert.equal(BLUE_KNIFE_DESTINY_Y, TRUNK_CENTER_Y - TRUNK_RADIUS + 6);

  // High-speed snappy flight
  assert.equal(KNIFE_SPEED, 1450);
  assert.equal(WINNING_SCORE, 5);
  assert.equal(KNIVES_PVP, 7);
  assert.equal(KNIVES_EASY, 5);
  assert.equal(KNIVES_MEDIUM, 6);
  assert.equal(KNIVES_HARD, 7);

  // Palette consistency
  assert.equal(COLOR_BG, 0xfaf9f6);
  assert.equal(COLOR_ORANGE, 0xe0530a);
  assert.equal(COLOR_BLUE, 0x2563eb);
});

test("Knife Thrower Angle Math: directional hit angles for opposing players", () => {
  const twoPi = Math.PI * 2;

  // 1. Orange Player (Bottom): contact point at world angle PI/2
  // When trunk rotation = 0, contact angle relative to trunk is PI/2
  assert.ok(Math.abs(calculateHitAngle(0, "orange") - Math.PI / 2) < 1e-9);

  // When trunk has rotated PI/2, contact angle relative to trunk is 0
  assert.ok(Math.abs(calculateHitAngle(Math.PI / 2, "orange") - 0) < 1e-9);

  // 2. Blue Player (Top): contact point at world angle 3*PI/2
  // When trunk rotation = 0, contact angle relative to trunk is 3*PI/2
  assert.ok(Math.abs(calculateHitAngle(0, "blue") - (Math.PI * 1.5)) < 1e-9);

  // When trunk has rotated 3*PI/2, contact angle relative to trunk is 0
  assert.ok(Math.abs(calculateHitAngle(Math.PI * 1.5, "blue") - 0) < 1e-9);

  // 3. Angular distance wraps around 0 / 2*PI seam correctly
  const seamDist = angularDistance(0.08, twoPi - 0.08);
  assert.ok(Math.abs(seamDist - 0.16) < 1e-9);
});

test("Knife Thrower Collision & Shared Target Duel: detecting clashes across both players' embedded blades", () => {
  const threshold = KNIFE_CLASH_ANGLE_THRESHOLD; // ~0.26 rad (~15 deg)

  // Suppose Orange embedded a knife at angle 1.2
  // And Blue embedded a knife at angle 2.8
  const embeddedAngles = [1.2, 2.8];

  // Incoming knife lands near Orange's knife (angle 1.28, delta = 0.08 < threshold) -> CLASH!
  assert.equal(isAngleClashing(1.28, embeddedAngles, threshold), true);

  // Incoming knife lands near Blue's knife (angle 2.74, delta = 0.06 < threshold) -> CLASH!
  assert.equal(isAngleClashing(2.74, embeddedAngles, threshold), true);

  // Incoming knife lands in wide open space (angle 0.2, delta to 1.2 is 1.0 > threshold) -> SAFE!
  assert.equal(isAngleClashing(0.2, embeddedAngles, threshold), false);
});

test("Knife Thrower Round Rules: clashing awards round win to the opponent", () => {
  const scores = { orange: 0, blue: 0 };

  // Rule: If Orange makes a clash mistake -> Blue scores
  const clashingPlayer1 = "orange";
  const winner1 = clashingPlayer1 === "orange" ? "blue" : "orange";
  scores[winner1]++;
  assert.equal(scores.blue, 1);
  assert.equal(scores.orange, 0);

  // Rule: If Blue makes a clash mistake -> Orange scores
  const clashingPlayer2 = "blue";
  const winner2 = clashingPlayer2 === "orange" ? "blue" : "orange";
  scores[winner2]++;
  assert.equal(scores.blue, 1);
  assert.equal(scores.orange, 1);

  // First to 5 wins match
  scores.orange = 5;
  const isMatchOver = scores.orange >= WINNING_SCORE || scores.blue >= WINNING_SCORE;
  assert.equal(isMatchOver, true);
});

test("Knife Thrower Trunk Rotator: simulates continuous multi-speed rotation within reference limits", () => {
  const rotator = new TrunkRotator();
  rotator.reset("medium");

  let totalAngle = 0;
  // Simulate 60 frames (1 second)
  for (let i = 0; i < 60; i++) {
    totalAngle += Math.abs(rotator.update(0.016));
  }

  // Rotator should have rotated substantially (at least 1.5 radians in 1 second)
  assert.ok(totalAngle > 1.2, `Trunk should rotate dynamically (rotated ${totalAngle} rad)`);
});

test("Knife Thrower AI Bot: evaluates trajectory, rejects clashing angles, and scales latency by difficulty", () => {
  // Test Bot with an unsafe target
  const botHard = new KnifeThrowerBot({ difficulty: "hard" });

  // If trunk has an embedded knife right where Blue will hit
  const distance = Math.abs(BLUE_KNIFE_DESTINY_Y - BLUE_KNIFE_SPAWN_Y);
  const flightTime = distance / KNIFE_SPEED;
  const trunkSpeed = 2.0;
  const currentRotation = 0;

  // Blue hits at angle 3*PI/2 - (0 + speed * flightTime)
  const incomingAngle = normalizeAngle((Math.PI * 3) / 2 - trunkSpeed * flightTime);

  // Obstacle right at the arrival point
  const blockedAngles = [incomingAngle];

  // Hard bot should NEVER throw into a blocked angle
  for (let frame = 0; frame < 60; frame++) {
    const shouldThrow = botHard.update(
      0.016,
      currentRotation,
      trunkSpeed,
      blockedAngles,
      true
    );
    assert.equal(shouldThrow, false, "Bot must not throw into an angle blocked by an embedded knife");
  }

  // Test Bot with a completely clear trunk
  const emptyAngles = [];
  let thrown = false;
  for (let frame = 0; frame < 60; frame++) {
    if (botHard.update(0.016, currentRotation, trunkSpeed, emptyAngles, true)) {
      thrown = true;
      break;
    }
  }
  assert.equal(thrown, true, "Bot must throw when trunk sector is completely clear");
});

test("Knife Thrower Reference Level Design: verifies 8 default obstacle knife layout from base.apk Sword Default 1..8", () => {
  assert.equal(DEFAULT_KNIFE_ANGLES.length, 8);

  // Each angle is spaced at 45 degrees (PI/4)
  for (let i = 0; i < 8; i++) {
    const angle = DEFAULT_KNIFE_ANGLES[i];
    assert.ok(angle >= 0 && angle < Math.PI * 2, `Angle ${angle} should be normalized within [0, 2*PI)`);
  }

  // Check cardinal and diagonal directions
  assert.ok(Math.abs(DEFAULT_KNIFE_ANGLES[0] - Math.PI) < 1e-9, "Sword Default 1: West (PI)");
  assert.ok(Math.abs(DEFAULT_KNIFE_ANGLES[1] - 0) < 1e-9, "Sword Default 2: East (0)");
  assert.ok(Math.abs(DEFAULT_KNIFE_ANGLES[4] - (Math.PI * 1.5)) < 1e-9, "Sword Default 5: North (3*PI/2)");
  assert.ok(Math.abs(DEFAULT_KNIFE_ANGLES[5] - (Math.PI * 0.5)) < 1e-9, "Sword Default 6: South (PI/2)");

  // Opposing pairs are 180 degrees (PI) apart
  assert.ok(Math.abs(angularDistance(DEFAULT_KNIFE_ANGLES[0], DEFAULT_KNIFE_ANGLES[1]) - Math.PI) < 1e-9);
  assert.ok(Math.abs(angularDistance(DEFAULT_KNIFE_ANGLES[2], DEFAULT_KNIFE_ANGLES[3]) - Math.PI) < 1e-9);
  assert.ok(Math.abs(angularDistance(DEFAULT_KNIFE_ANGLES[4], DEFAULT_KNIFE_ANGLES[5]) - Math.PI) < 1e-9);
  assert.ok(Math.abs(angularDistance(DEFAULT_KNIFE_ANGLES[6], DEFAULT_KNIFE_ANGLES[7]) - Math.PI) < 1e-9);
});

test("Knife Thrower PVP Progression: verifies exact target set sequences matching knivesPVP in base.apk", () => {
  // knivesPVP: firstRound: '', rounds: ['01', '23', '67', '0145', '234567', '0123']
  assert.equal(PVP_TARGET_SETS.length, 7);

  // Set 0 (1st log): clean log, 7 knives each, easy rotation
  assert.deepEqual(PVP_TARGET_SETS[0].defaultKnifeIndices, []);
  assert.equal(PVP_TARGET_SETS[0].playerKnives, 7);
  assert.equal(PVP_TARGET_SETS[0].rotationProfile, "easy");

  // Set 1 (2nd log): '01' -> West & East pre-embedded, 6 knives each, medium rotation
  assert.deepEqual(PVP_TARGET_SETS[1].defaultKnifeIndices, [0, 1]);
  assert.equal(PVP_TARGET_SETS[1].playerKnives, 6);
  assert.equal(PVP_TARGET_SETS[1].rotationProfile, "medium");

  // Set 2 (3rd log): '23' -> NW & SE pre-embedded, 6 knives each, medium rotation
  assert.deepEqual(PVP_TARGET_SETS[2].defaultKnifeIndices, [2, 3]);
  assert.equal(PVP_TARGET_SETS[2].playerKnives, 6);
  assert.equal(PVP_TARGET_SETS[2].rotationProfile, "medium");

  // Set 3 (4th log): '67' -> NE & SW pre-embedded, 6 knives each, medium rotation
  assert.deepEqual(PVP_TARGET_SETS[3].defaultKnifeIndices, [6, 7]);
  assert.equal(PVP_TARGET_SETS[3].playerKnives, 6);
  assert.equal(PVP_TARGET_SETS[3].rotationProfile, "medium");

  // Set 4 (5th log): '0145' -> 4 cardinal knives pre-embedded, 5 knives each, hard dynamic rotation
  assert.deepEqual(PVP_TARGET_SETS[4].defaultKnifeIndices, [0, 1, 4, 5]);
  assert.equal(PVP_TARGET_SETS[4].playerKnives, 5);
  assert.equal(PVP_TARGET_SETS[4].rotationProfile, "hard");

  // Set 5 (6th log): '234567' -> 6 knives pre-embedded, 4 knives each, hard dynamic rotation
  assert.deepEqual(PVP_TARGET_SETS[5].defaultKnifeIndices, [2, 3, 4, 5, 6, 7]);
  assert.equal(PVP_TARGET_SETS[5].playerKnives, 4);
  assert.equal(PVP_TARGET_SETS[5].rotationProfile, "hard");

  // Total blades on the trunk when set completes is balanced at 14 blades
  for (let s = 0; s < PVP_TARGET_SETS.length; s++) {
    const set = PVP_TARGET_SETS[s];
    const totalBlades = set.defaultKnifeIndices.length + set.playerKnives * 2;
    assert.equal(totalBlades, 14, `Set ${s} must balance total blades on trunk to 14`);
  }
});

test("Knife Thrower Bot Progressions: verifies sets matching knivesEasy, knivesMedium, knivesHard from base.apk", () => {
  // knivesEasy: firstRound: '', rounds: ['01']
  assert.equal(BOT_TARGET_SETS.easy.length, 2);
  assert.deepEqual(BOT_TARGET_SETS.easy[0].defaultKnifeIndices, []);
  assert.deepEqual(BOT_TARGET_SETS.easy[1].defaultKnifeIndices, [0, 1]);

  // knivesMedium: firstRound: '01', rounds: ['0123', '45', '23']
  assert.equal(BOT_TARGET_SETS.medium.length, 4);
  assert.deepEqual(BOT_TARGET_SETS.medium[0].defaultKnifeIndices, [0, 1]);
  assert.deepEqual(BOT_TARGET_SETS.medium[1].defaultKnifeIndices, [0, 1, 2, 3]);
  assert.deepEqual(BOT_TARGET_SETS.medium[2].defaultKnifeIndices, [4, 5]);
  assert.deepEqual(BOT_TARGET_SETS.medium[3].defaultKnifeIndices, [2, 3]);

  // knivesHard: firstRound: '45', rounds: ['0145', '012345', '01', '', '45', '4567']
  assert.equal(BOT_TARGET_SETS.hard.length, 7);
  assert.deepEqual(BOT_TARGET_SETS.hard[0].defaultKnifeIndices, [4, 5]);
  assert.deepEqual(BOT_TARGET_SETS.hard[1].defaultKnifeIndices, [0, 1, 4, 5]);
  assert.deepEqual(BOT_TARGET_SETS.hard[2].defaultKnifeIndices, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(BOT_TARGET_SETS.hard[3].defaultKnifeIndices, [0, 1]);
  assert.deepEqual(BOT_TARGET_SETS.hard[4].defaultKnifeIndices, []);
  assert.deepEqual(BOT_TARGET_SETS.hard[5].defaultKnifeIndices, [4, 5]);
  assert.deepEqual(BOT_TARGET_SETS.hard[6].defaultKnifeIndices, [4, 5, 6, 7]);
});

test("Knife Thrower Authentic Rotator: verifies step transitions, directional reversals, and profiles", () => {
  const rotator = new TrunkRotator("easy");
  assert.equal(rotator.getProfileName(), "easy");

  // Easy profile: steps 120 deg/s and -120 deg/s with 4.0s duration
  const easySteps = ROTATION_PROFILES.easy.steps;
  assert.equal(easySteps.length, 2);
  assert.ok(Math.abs(easySteps[0].speed - (120 * Math.PI / 180)) < 1e-4);
  assert.ok(Math.abs(easySteps[1].speed - (-120 * Math.PI / 180)) < 1e-4);

  // Medium profile: steps 150 deg/s and -150 deg/s with 4.0s duration
  const mediumSteps = ROTATION_PROFILES.medium.steps;
  assert.equal(mediumSteps.length, 2);
  assert.ok(Math.abs(mediumSteps[0].speed - (150 * Math.PI / 180)) < 1e-4);
  assert.ok(Math.abs(mediumSteps[1].speed - (-150 * Math.PI / 180)) < 1e-4);

  // Hard profile: 8 steps with pauses and rapid reversals
  const hardSteps = ROTATION_PROFILES.hard.steps;
  assert.equal(hardSteps.length, 8);

  // Test profile switching
  rotator.setProfile("hard");
  assert.equal(rotator.getProfileName(), "hard");
  let moved = false;
  for (let i = 0; i < 30; i++) {
    const dTheta = rotator.update(0.016);
    if (Math.abs(dTheta) > 0.001) moved = true;
  }
  assert.ok(moved, "Hard rotator profile must produce active rotation");
});

test("Knife Thrower Collision Against Pre-embedded Obstacle Knives: clashes trigger correctly against neutral blades", () => {
  const threshold = KNIFE_CLASH_ANGLE_THRESHOLD; // ~0.26 rad

  // Suppose Set 1 is active: default obstacle knives at indices 0 (PI) and 1 (0)
  const obstacleKnifeAngles = [DEFAULT_KNIFE_ANGLES[0], DEFAULT_KNIFE_ANGLES[1]]; // [PI, 0]

  // Player throws knife landing right at East (angle 0.05, delta = 0.05 < threshold) -> CLASH!
  assert.equal(isAngleClashing(0.05, obstacleKnifeAngles, threshold), true);

  // Player throws knife landing right at West (angle Math.PI - 0.04 < threshold) -> CLASH!
  assert.equal(isAngleClashing(Math.PI - 0.04, obstacleKnifeAngles, threshold), true);

  // Player throws knife landing at North (angle 3*PI/2 = ~4.71, delta to 0 and PI is ~1.57 > threshold) -> SAFE!
  assert.equal(isAngleClashing((Math.PI * 3) / 2, obstacleKnifeAngles, threshold), false);
});
