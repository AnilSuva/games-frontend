import test from "node:test";
import assert from "node:assert/strict";

import {
  ARENA_BOTTOM,
  ARENA_HEIGHT,
  ARENA_LEFT,
  ARENA_PADDING_X,
  ARENA_PADDING_Y,
  ARENA_RIGHT,
  ARENA_TOP,
  ARENA_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  INITIAL_LIVES,
  INVULNERABILITY_DURATION_MS,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  STRIKE_RADIUS_BASE,
  WAVE_CONFIGURATIONS,
} from "../src/games/arcade/dodge-arena/config/balance.ts";
import { SeededPRNG } from "../src/games/arcade/dodge-arena/logic/prng.ts";
import {
  checkHazardCollision,
  createBouncingHazard,
  createFallingStrike,
  createSweepingLaser,
  getCurrentWaveConfig,
  updateHazard,
} from "../src/games/arcade/dodge-arena/logic/hazards.ts";
import { DodgeArenaSimulation } from "../src/games/arcade/dodge-arena/logic/simulation.ts";
import { DodgeArenaBotController } from "../src/games/arcade/dodge-arena/bot/botController.ts";

test("Dodge Arena Constants: Arena geometry, player settings, and hazard properties", () => {
  assert.equal(GAME_WIDTH, 480);
  assert.equal(GAME_HEIGHT, 640);
  assert.equal(ARENA_WIDTH, 432);
  assert.equal(ARENA_HEIGHT, 584);
  assert.equal(ARENA_LEFT, ARENA_PADDING_X);
  assert.equal(ARENA_RIGHT, ARENA_PADDING_X + ARENA_WIDTH);
  assert.equal(ARENA_TOP, ARENA_PADDING_Y);
  assert.equal(ARENA_BOTTOM, ARENA_PADDING_Y + ARENA_HEIGHT);
  assert.equal(INITIAL_LIVES, 3);
  assert.ok(PLAYER_MAX_SPEED >= 200);
  assert.equal(PLAYER_RADIUS, 18);
  assert.equal(INVULNERABILITY_DURATION_MS, 1400);
  assert.ok(WAVE_CONFIGURATIONS.length >= 4);
});

test("PRNG: Mulberry32 generates deterministic sequence", () => {
  const prng1 = new SeededPRNG(4242);
  const prng2 = new SeededPRNG(4242);

  const seq1 = [prng1.next(), prng1.next(), prng1.nextInt(1, 100), prng1.nextFloat(10, 20)];
  const seq2 = [prng2.next(), prng2.next(), prng2.nextInt(1, 100), prng2.nextFloat(10, 20)];

  assert.deepEqual(seq1, seq2);
});

test("Player Movement: acceleration, velocity, and deceleration", () => {
  const sim = new DodgeArenaSimulation(100);
  const startX = sim.state.players.orange.x;
  const startY = sim.state.players.orange.y;

  // Move right for 0.5s
  for (let i = 0; i < 30; i++) {
    sim.step(1 / 60, { dx: 1, dy: 0 }, { dx: 0, dy: 0 });
  }

  assert.ok(sim.state.players.orange.x > startX, "Player should have moved to the right");
  assert.equal(sim.state.players.orange.y, startY, "Vertical position should remain unchanged");
  assert.ok(sim.state.players.orange.vx > 0, "Velocity vx should be positive");

  // Deceleration: release input (dx: 0, dy: 0)
  for (let i = 0; i < 30; i++) {
    sim.step(1 / 60, { dx: 0, dy: 0 }, { dx: 0, dy: 0 });
  }

  assert.equal(sim.state.players.orange.vx, 0, "Player should come to a complete stop");
});

test("Diagonal Movement Normalization: diagonal movement does not exceed max speed", () => {
  const sim = new DodgeArenaSimulation(200);

  // Apply unnormalized diagonal input (dx: 1, dy: 1)
  for (let i = 0; i < 60; i++) {
    sim.step(1 / 60, { dx: 1, dy: 1 }, { dx: 0, dy: 0 });
  }

  const speed = Math.hypot(sim.state.players.orange.vx, sim.state.players.orange.vy);
  assert.ok(
    speed <= PLAYER_MAX_SPEED + 0.5,
    `Diagonal speed ${speed} should not exceed PLAYER_MAX_SPEED ${PLAYER_MAX_SPEED}`
  );
});

test("Arena Boundary Enforcement: player is strictly clamped inside walls", () => {
  const sim = new DodgeArenaSimulation(300);

  // Drive player far beyond left wall
  for (let i = 0; i < 120; i++) {
    sim.step(1 / 60, { dx: -1, dy: 0 }, { dx: 0, dy: 0 });
  }

  assert.ok(
    sim.state.players.orange.x - PLAYER_RADIUS >= ARENA_LEFT,
    `Player left edge ${sim.state.players.orange.x - PLAYER_RADIUS} should be >= ARENA_LEFT ${ARENA_LEFT}`
  );

  // Drive player far beyond bottom wall
  for (let i = 0; i < 120; i++) {
    sim.step(1 / 60, { dx: 0, dy: 1 }, { dx: 0, dy: 0 });
  }

  assert.ok(
    sim.state.players.orange.y + PLAYER_RADIUS <= ARENA_BOTTOM,
    `Player bottom edge ${sim.state.players.orange.y + PLAYER_RADIUS} should be <= ARENA_BOTTOM ${ARENA_BOTTOM}`
  );
});

test("Hazard Lifecycle: Falling Strike transitions warning -> active -> expired", () => {
  const prng = new SeededPRNG(123);
  const strike = createFallingStrike("s1", prng, 1000, []);

  assert.equal(strike.phase, "warning");
  assert.equal(strike.radius, STRIKE_RADIUS_BASE);

  // Advance 0.5s (still in warning)
  updateHazard(strike, 0.5);
  assert.equal(strike.phase, "warning");

  // Advance another 0.6s (total > 1.0s warning duration -> active)
  updateHazard(strike, 0.6);
  assert.equal(strike.phase, "active");

  // Advance past active duration (300ms)
  updateHazard(strike, 0.4);
  assert.equal(strike.phase, "expired");
});

test("Hazard Lifecycle: Sweeping Laser sweeps and expires", () => {
  const prng = new SeededPRNG(456);
  const laser = createSweepingLaser("l1", prng, 1000, 300);

  assert.equal(laser.phase, "warning");

  // Advance to active
  updateHazard(laser, 1.1);
  assert.equal(laser.phase, "active");

  const startCoord = laser.currentCoord;
  updateHazard(laser, 0.2);
  assert.notEqual(laser.currentCoord, startCoord, "Laser coordinate should advance during active phase");

  // Advance until sweep distance completes
  for (let i = 0; i < 40; i++) {
    updateHazard(laser, 0.1);
  }
  assert.equal(laser.phase, "expired");
});

test("Hazard Lifecycle: Bouncing Hazard moves and reflects off walls", () => {
  const prng = new SeededPRNG(789);
  const bouncer = createBouncingHazard("b1", prng, 250);

  assert.equal(bouncer.phase, "warning");

  // Advance past 800ms warning
  updateHazard(bouncer, 0.85);
  assert.equal(bouncer.phase, "active");

  // Run through multiple frames to observe bounce
  for (let i = 0; i < 200; i++) {
    updateHazard(bouncer, 1 / 60);
  }

  assert.ok(bouncer.bounceCount > 0, "Bouncer should have bounced off walls");
});

test("Collision Detection: Falling Strike damages player only when active", () => {
  const sim = new DodgeArenaSimulation(999);
  const orange = sim.state.players.orange;

  const strike = {
    id: "test-strike",
    type: "falling-strike",
    phase: "warning",
    warningDurationMs: 1000,
    activeDurationMs: 300,
    elapsedMs: 0,
    x: orange.x,
    y: orange.y,
    radius: 50,
  };

  // Warning phase should NOT collide
  assert.equal(checkHazardCollision(strike, orange), false);

  // Active phase should collide
  strike.phase = "active";
  assert.equal(checkHazardCollision(strike, orange), true);

  // Invulnerable player should NOT collide
  orange.isInvulnerable = true;
  assert.equal(checkHazardCollision(strike, orange), false);
});

test("Collision Detection: Sweeping Laser line-to-circle collision", () => {
  const sim = new DodgeArenaSimulation(1001);
  const orange = sim.state.players.orange;

  const laser = {
    id: "test-laser",
    type: "sweeping-laser",
    phase: "active",
    warningDurationMs: 1000,
    activeDurationMs: 2000,
    elapsedMs: 500,
    orientation: "horizontal",
    startX: ARENA_LEFT,
    startY: orange.y + 10,
    endX: ARENA_RIGHT,
    endY: orange.y + 10,
    currentCoord: orange.y + 10, // within 10px of player
    targetCoord: ARENA_TOP,
    sweepSpeed: 200,
    beamWidth: 26,
    direction: -1,
  };

  assert.equal(checkHazardCollision(laser, orange), true);

  // When beam moves far away
  laser.currentCoord = ARENA_TOP + 50;
  assert.equal(checkHazardCollision(laser, orange), false);
});

test("Laser Hazard Fairness: Safe gaps allow clean player passage and independent escape", () => {
  const sim = new DodgeArenaSimulation(1002);
  const orange = sim.state.players.orange; // y ~ 522
  const blue = sim.state.players.blue;     // y ~ 118

  // 1. Horizontal laser with safe gap centered on Orange
  const gapSize = 100;
  const horizontalLaser = {
    id: "horizontal-gap-laser",
    type: "sweeping-laser",
    phase: "active",
    warningDurationMs: 1200,
    activeDurationMs: 2000,
    elapsedMs: 500,
    orientation: "horizontal",
    startX: ARENA_LEFT,
    startY: orange.y,
    endX: ARENA_RIGHT,
    endY: orange.y,
    currentCoord: orange.y, // Laser is passing directly through Orange's Y coordinate!
    targetCoord: ARENA_TOP,
    sweepSpeed: 200,
    beamWidth: 26,
    direction: -1,
    safeGaps: [
      { start: Math.round(orange.x - gapSize / 2), end: Math.round(orange.x + gapSize / 2) },
    ],
  };

  // Orange is positioned inside the safe gap -> NO collision!
  assert.equal(
    checkHazardCollision(horizontalLaser, orange),
    false,
    "Player positioned inside the laser safe gap must avoid collision"
  );

  // If Orange moves outside the safe gap onto the solid beam segment -> takes collision
  const exposedOrange = { ...orange, x: ARENA_LEFT + 20 };
  assert.equal(
    checkHazardCollision(horizontalLaser, exposedOrange),
    true,
    "Player outside the safe gap on solid laser segment must take collision"
  );

  // 2. Vertical laser generated by createSweepingLaser provides dual independent safe gaps
  const prng = new SeededPRNG(42);
  const verticalLaser = createSweepingLaser("vert-laser-1", prng, 1200, 200, 100);
  assert.equal(verticalLaser.safeGaps.length, 2, "Vertical laser must have dual safe gaps");

  // Gap 1 is in upper arena for Blue, Gap 2 is in lower arena for Orange
  const topGap = verticalLaser.safeGaps[0];
  const bottomGap = verticalLaser.safeGaps[1];
  assert.ok(topGap.start < ARENA_HEIGHT / 2, "Top gap should be in upper half of arena");
  assert.ok(bottomGap.start >= ARENA_HEIGHT / 2 - 50, "Bottom gap should be in lower half of arena");

  // Position Blue inside top gap and Orange inside bottom gap
  const safeBlue = { ...blue, y: Math.round((topGap.start + topGap.end) / 2) };
  const safeOrange = { ...orange, y: Math.round((bottomGap.start + bottomGap.end) / 2) };

  verticalLaser.phase = "active";
  verticalLaser.currentCoord = orange.x; // laser passes directly over both players' X coordinate

  assert.equal(
    checkHazardCollision(verticalLaser, safeBlue),
    false,
    "Blue player escapes independently via top safe gap"
  );
  assert.equal(
    checkHazardCollision(verticalLaser, safeOrange),
    false,
    "Orange player escapes independently via bottom safe gap"
  );
});

test("Laser Hazard Fairness: Schedule prevents simultaneous laser traps and protects safe gaps", () => {
  const prng = new SeededPRNG(777);
  const sim = new DodgeArenaSimulation(777);

  // Active sweeping laser
  const laser = createSweepingLaser("active-laser", prng, 1200, 200, 100);
  sim.state.hazards.push(laser);

  // Falling strike generated while laser is active must not spawn directly in safe gap
  const strike = createFallingStrike("strike-check", prng, 1200, Object.values(sim.state.players), sim.state.hazards);

  for (const gap of laser.safeGaps) {
    if (laser.orientation === "horizontal") {
      assert.ok(
        strike.x < gap.start || strike.x > gap.end,
        "Falling strike must not spawn centered inside laser safe gap"
      );
    } else {
      assert.ok(
        strike.y < gap.start || strike.y > gap.end,
        "Falling strike must not spawn centered inside laser safe gap"
      );
    }
  }
});

test("Damage & Invulnerability: hit reduces lives and triggers grace window", () => {
  const sim = new DodgeArenaSimulation(2002);
  const orange = sim.state.players.orange;

  assert.equal(orange.lives, 3);
  assert.equal(orange.isInvulnerable, false);

  // Inject active hazard directly on orange
  sim.state.hazards.push({
    id: "lethal-strike",
    type: "falling-strike",
    phase: "active",
    warningDurationMs: 1000,
    activeDurationMs: 500,
    elapsedMs: 50,
    x: orange.x,
    y: orange.y,
    radius: 50,
  });

  const events = sim.step(1 / 60);
  const hitEvent = events.find((e) => e.type === "player_hit");

  assert.ok(hitEvent, "player_hit event should be emitted");
  assert.equal(orange.lives, 2, "Orange player lives should drop from 3 to 2");
  assert.equal(orange.isInvulnerable, true, "Player should be invulnerable after hit");
  assert.ok(orange.invulnerableTimeRemainingMs > 1000);

  // Repeated collision during invulnerability must NOT deduct additional lives
  sim.step(1 / 60);
  assert.equal(orange.lives, 2, "Lives should remain 2 during invulnerability");
});

test("Elimination & Winner Determination: 0 lives eliminates player and opposite player wins", () => {
  const sim = new DodgeArenaSimulation(3003);
  const orange = sim.state.players.orange;

  // Set lives to 1 and remove invulnerability
  orange.lives = 1;
  orange.isInvulnerable = false;

  sim.state.hazards.push({
    id: "finishing-strike",
    type: "falling-strike",
    phase: "active",
    warningDurationMs: 1000,
    activeDurationMs: 500,
    elapsedMs: 50,
    x: orange.x,
    y: orange.y,
    radius: 50,
  });

  const events = sim.step(1 / 60);

  assert.equal(orange.lives, 0);
  assert.equal(orange.isAlive, false);
  assert.ok(events.some((e) => e.type === "player_eliminated"));
  assert.equal(sim.state.isGameOver, true);
  assert.equal(sim.state.winner, "blue", "Blue should win when Orange is eliminated");
});

test("Draw Determination: both players eliminated on same tick results in draw", () => {
  const sim = new DodgeArenaSimulation(4004);
  sim.state.players.orange.lives = 1;
  sim.state.players.orange.isInvulnerable = false;
  sim.state.players.blue.lives = 1;
  sim.state.players.blue.isInvulnerable = false;

  // Global blast covering both
  sim.state.hazards.push(
    {
      id: "blast-orange",
      type: "falling-strike",
      phase: "active",
      warningDurationMs: 1000,
      activeDurationMs: 500,
      elapsedMs: 50,
      x: sim.state.players.orange.x,
      y: sim.state.players.orange.y,
      radius: 60,
    },
    {
      id: "blast-blue",
      type: "falling-strike",
      phase: "active",
      warningDurationMs: 1000,
      activeDurationMs: 500,
      elapsedMs: 50,
      x: sim.state.players.blue.x,
      y: sim.state.players.blue.y,
      radius: 60,
    }
  );

  const events = sim.step(1 / 60);

  assert.equal(sim.state.players.orange.isAlive, false);
  assert.equal(sim.state.players.blue.isAlive, false);
  assert.equal(sim.state.isGameOver, true);
  assert.equal(sim.state.winner, "draw", "Result should be draw if both die on same tick");
  assert.ok(events.some((e) => e.type === "game_over" && e.data.winner === "draw"));
});

test("Wave Difficulty Progression: hazard frequency and speed increase over time", () => {
  const wave1 = getCurrentWaveConfig(5000); // 5 sec
  const wave2 = getCurrentWaveConfig(20000); // 20 sec
  const wave3 = getCurrentWaveConfig(45000); // 45 sec
  const wave4 = getCurrentWaveConfig(70000); // 70 sec

  assert.equal(wave1.waveNumber, 1);
  assert.equal(wave2.waveNumber, 2);
  assert.equal(wave3.waveNumber, 3);
  assert.equal(wave4.waveNumber, 4);

  // Interval decreases (more frequent hazards)
  assert.ok(wave2.hazardIntervalMs < wave1.hazardIntervalMs);
  assert.ok(wave3.hazardIntervalMs < wave2.hazardIntervalMs);
  assert.ok(wave4.hazardIntervalMs < wave3.hazardIntervalMs);

  // Telegraph warning time decreases
  assert.ok(wave4.strikeWarningMs < wave1.strikeWarningMs);

  // Bouncer speed increases
  assert.ok(wave4.bouncerSpeed > wave1.bouncerSpeed);
});

test("Bot Opponent: detects hazards and evades visible danger zones", () => {
  const sim = new DodgeArenaSimulation(5005);
  const bot = new DodgeArenaBotController("blue", "medium");

  const blue = sim.state.players.blue;

  // Spawn incoming falling strike directly at blue player's position
  sim.state.hazards.push({
    id: "strike-at-bot",
    type: "falling-strike",
    phase: "warning",
    warningDurationMs: 1200,
    activeDurationMs: 300,
    elapsedMs: 100,
    x: blue.x,
    y: blue.y,
    radius: 55,
  });

  const input = bot.update(sim.state, 0.1);

  // Bot should NOT stay still — it must choose an evasion vector
  const moveDist = Math.hypot(input.dx, input.dy);
  assert.ok(moveDist > 0.3, "Bot should actively move away from danger zone");
});

test("Bot Opponent: operates legally across different difficulty levels", () => {
  const sim = new DodgeArenaSimulation(6006);
  const botEasy = new DodgeArenaBotController("blue", "easy");
  const botHard = new DodgeArenaBotController("blue", "hard");

  const inputEasy = botEasy.update(sim.state, 0.25);
  const inputHard = botHard.update(sim.state, 0.05);

  assert.ok(Number.isFinite(inputEasy.dx) && Number.isFinite(inputEasy.dy));
  assert.ok(Number.isFinite(inputHard.dx) && Number.isFinite(inputHard.dy));
  assert.ok(Math.hypot(inputEasy.dx, inputEasy.dy) <= 1.05);
  assert.ok(Math.hypot(inputHard.dx, inputHard.dy) <= 1.05);
});

test("Local 1v1: both players move independently without crosstalk", () => {
  const sim = new DodgeArenaSimulation(7007);
  const orangeStart = { ...sim.state.players.orange };
  const blueStart = { ...sim.state.players.blue };

  // Move Orange right and Blue left simultaneously
  for (let i = 0; i < 30; i++) {
    sim.step(1 / 60, { dx: 1, dy: 0 }, { dx: -1, dy: 0 });
  }

  assert.ok(sim.state.players.orange.x > orangeStart.x, "Orange should move right");
  assert.ok(sim.state.players.blue.x < blueStart.x, "Blue should move left");
  assert.equal(sim.state.players.orange.lives, 3);
  assert.equal(sim.state.players.blue.lives, 3);
});
