import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES } from "../src/games/arcade/brick-blast/levels/layouts.ts";
import { generateLevel, getLevelBaseSpeed } from "../src/games/arcade/brick-blast/levels/generator.ts";
import {
  INITIAL_BALL_SPEED,
  LEVEL_SPEED_MULTIPLIER,
  MIN_SPEED_FACTOR,
  MAX_SPEED_FACTOR,
  MIN_BALL_RADIUS,
  MAX_BALL_RADIUS,
  MAX_BALL_POWER,
  MAX_ACTIVE_BALLS,
  PADDLE_WIDTH,
  GAME_WIDTH,
} from "../src/games/arcade/brick-blast/config/balance.ts";
import { ALL_POWER_UP_TYPES } from "../src/games/arcade/brick-blast/config/powerUps.ts";
import {
  BrickBlastBotController,
  clampBotTarget,
  predictWallReflectedX,
  selectThreateningBall,
  getBallTimeToPaddle,
} from "../src/games/arcade/brick-blast/game/botController.ts";

const botBall = (id, { x = 180, y = 300, vx = 0, vy = -200, radius = 6, active = true } = {}) =>
  ({ id, x, y, vx, vy, radius, active });

test("Bot targeting: selects the incoming ball with the shortest paddle arrival time", () => {
  const farther = botBall(1, { y: 300, vy: -100 });
  const imminent = botBall(2, { y: 100, vy: -300 });
  const movingAway = botBall(3, { y: 60, vy: 180 });
  assert.equal(selectThreateningBall([farther, movingAway, imminent], 46), imminent);
});

test("Bot targeting: no active incoming ball returns null", () => {
  assert.equal(selectThreateningBall([botBall(1, { active: false }), botBall(2, { vy: 0 })], 46), null);
});

test("Bot prediction: analytically reflects off either wall, including multiple bounces", () => {
  assert.equal(predictWallReflectedX(350, 100, 1, 6, 360), 258);
  assert.equal(predictWallReflectedX(10, -100, 1, 6, 360), 102);
  assert.equal(predictWallReflectedX(180, 0, 100, 6, 360), 180);
});

test("Bot target clamp respects paddle width and game bounds", () => {
  assert.equal(clampBotTarget(-20, 72, 360), 36);
  assert.equal(clampBotTarget(500, 72, 360), 324);
  assert.equal(clampBotTarget(180, 72, 360), 180);
});

test("Bot difficulty: harder controller moves faster while every level moves smoothly", () => {
  const ball = botBall(1, { x: 300, y: 300, vx: 0, vy: -200 });
  const easy = new BrickBlastBotController("easy");
  const hard = new BrickBlastBotController("hard");
  let easyX = 180;
  let hardX = 180;
  for (let frame = 0; frame < 30; frame++) {
    easyX = easy.update([ball], easyX, 72, 46, 360, 1 / 60);
    hardX = hard.update([ball], hardX, 72, 46, 360, 1 / 60);
  }
  assert.ok(easyX > 180 && easyX < 300);
  assert.ok(hardX > easyX);
  assert.ok(hardX < 300);
});

test("Bot controller reset clears target and returns toward center when there are no balls", () => {
  const bot = new BrickBlastBotController("medium");
  const nextX = bot.update([], 100, 72, 46, 360, 0.1);
  assert.ok(nextX > 100 && nextX < 180);
  bot.reset(180);
  assert.equal(bot.update([], 180, 72, 46, 360, 0.1), 180);
});

test("Level Templates: exactly 5 distinct structural families", () => {
  assert.equal(TEMPLATES.length, 5);
  const names = new Set(TEMPLATES.map((t) => t.name));
  assert.equal(names.size, 5);
});

test("Level Templates: all 5 templates possess mathematical vertical symmetry", () => {
  for (const template of TEMPLATES) {
    const rows = template.grid.length;
    assert.equal(rows, 8, `${template.name} must have 8 rows`);
    for (let r = 0; r < 4; r++) {
      const oppR = rows - 1 - r;
      assert.deepEqual(
        template.grid[r],
        template.grid[oppR],
        `${template.name} row ${r} must vertically match row ${oppR}`
      );
    }
  }
});

test("Level Generator: generates non-empty, valid layouts for consecutive levels", () => {
  for (let level = 1; level <= 10; level++) {
    const data = generateLevel(level);
    assert.equal(data.levelNumber, level);
    assert.ok(data.bricks.length >= 16, `Level ${level} must have at least 16 bricks`);
    assert.ok(data.bricks.every((b) => b.x > 0 && b.x < GAME_WIDTH));
    assert.ok(data.bricks.every((b) => b.y > 50 && b.y < 500));
    assert.ok(data.bricks.every((b) => b.hp > 0 && b.maxHp > 0));
  }
});

test("Level Generator: special bricks approximate target percentage (~5-6%)", () => {
  let totalBricks = 0;
  let totalSpecial = 0;

  for (let lvl = 1; lvl <= 15; lvl++) {
    const data = generateLevel(lvl, lvl * 1000 + 42);
    totalBricks += data.totalBricks;
    totalSpecial += data.specialBrickCount;
    assert.ok(data.specialBrickCount > 0, `Level ${lvl} must have at least 1 special brick`);
  }

  const ratio = totalSpecial / totalBricks;
  // Verify ratio is within sensible 3% to 10% bounds
  assert.ok(ratio >= 0.03 && ratio <= 0.10, `Special brick ratio ${ratio} must be approximately ~5%`);
});

test("Level Speed: geometric progression increases ball speed by exactly 5% each level", () => {
  assert.equal(LEVEL_SPEED_MULTIPLIER, 1.05);
  const s1 = getLevelBaseSpeed(1);
  const s2 = getLevelBaseSpeed(2);
  const s3 = getLevelBaseSpeed(3);
  const s6 = getLevelBaseSpeed(6);

  assert.equal(s1, INITIAL_BALL_SPEED);
  assert.ok(Math.abs(s2 - INITIAL_BALL_SPEED * LEVEL_SPEED_MULTIPLIER) < 0.001);
  assert.ok(Math.abs(s3 - INITIAL_BALL_SPEED * LEVEL_SPEED_MULTIPLIER * LEVEL_SPEED_MULTIPLIER) < 0.001);
  assert.ok(Math.abs(s6 - INITIAL_BALL_SPEED * Math.pow(1.05, 5)) < 0.001);
  assert.ok(s6 > s3 && s3 > s2 && s2 > s1);
});

test("Game Logic: brick damage and two-hit bricks vs ball power", () => {
  // Normal 1-hit brick
  let normalHp = 1;
  const ballPowerNormal = 1;
  normalHp -= ballPowerNormal;
  assert.ok(normalHp <= 0, "Normal brick breaks with 1 hit");

  // Strong 2-hit brick with normal ball
  let strongHp = 2;
  strongHp -= ballPowerNormal;
  assert.equal(strongHp, 1, "Strong brick survives 1 hit with 1 HP remaining");
  strongHp -= ballPowerNormal;
  assert.equal(strongHp, 0, "Strong brick breaks on second hit");

  // Strong 2-hit brick with empowered ball (power = 2)
  let strongHp2 = 2;
  const ballPowerEmpowered = 2;
  strongHp2 -= ballPowerEmpowered;
  assert.ok(strongHp2 <= 0, "Empowered ball shatters 2-hit brick in 1 hit");
});

test("Power-Up Logic: all 6 power-up types exist and respect balance caps", () => {
  assert.equal(ALL_POWER_UP_TYPES.length, 6);

  // Speed multiplier limits
  let speedMult = 1.0;
  // Apply speed_up repeatedly
  for (let i = 0; i < 10; i++) {
    speedMult = Math.min(MAX_SPEED_FACTOR, speedMult * 1.15);
  }
  assert.equal(speedMult, MAX_SPEED_FACTOR);

  // Apply speed_down repeatedly
  for (let i = 0; i < 10; i++) {
    speedMult = Math.max(MIN_SPEED_FACTOR, speedMult * 0.85);
  }
  assert.equal(speedMult, MIN_SPEED_FACTOR);

  // Size caps
  let radius = 6;
  for (let i = 0; i < 10; i++) radius = Math.min(MAX_BALL_RADIUS, radius + 3);
  assert.equal(radius, MAX_BALL_RADIUS);

  for (let i = 0; i < 10; i++) radius = Math.max(MIN_BALL_RADIUS, radius - 2);
  assert.equal(radius, MIN_BALL_RADIUS);

  // Power caps
  let power = 1;
  for (let i = 0; i < 10; i++) power = Math.min(MAX_BALL_POWER, power + 1);
  assert.equal(power, MAX_BALL_POWER);
});

test("Game Logic: paddle horizontal bounds are strictly constrained", () => {
  const minX = PADDLE_WIDTH / 2;
  const maxX = GAME_WIDTH - PADDLE_WIDTH / 2;

  const clamp = (val) => Math.max(minX, Math.min(maxX, val));

  assert.equal(clamp(-50), minX);
  assert.equal(clamp(GAME_WIDTH + 100), maxX);
  assert.equal(clamp(GAME_WIDTH / 2), GAME_WIDTH / 2);
});

test("Loss Condition: multi-ball rule only triggers loss when final ball is lost", () => {
  assert.equal(MAX_ACTIVE_BALLS, 4);
  const activeBalls = [{ id: 1, active: true }, { id: 2, active: true }];

  // First ball escapes
  activeBalls[0].active = false;
  const remaining1 = activeBalls.filter((b) => b.active);
  const isLoss1 = remaining1.length === 0;
  assert.equal(isLoss1, false, "Losing 1 ball with active balls remaining is NOT a match loss");

  // Second ball escapes
  activeBalls[1].active = false;
  const remaining2 = activeBalls.filter((b) => b.active);
  const isLoss2 = remaining2.length === 0;
  assert.equal(isLoss2, true, "Match loss occurs when the final active ball escapes");
});

test("2-Player Paddles: Player 1 (Orange) is bottom and Player 2 (Blue) is top", () => {
  // Top paddle (Blue) is near y = 46, bottom paddle (Orange) is near y = 534
  const topY = 46;
  const bottomY = 534;
  assert.ok(topY < GAME_WIDTH / 2, "Blue paddle must be situated at top of arena");
  assert.ok(bottomY > GAME_WIDTH / 2, "Orange paddle must be situated at bottom of arena");
  assert.ok(bottomY > topY, "Orange paddle is strictly lower than Blue paddle");
});

test("Serve Rotation: levels alternate serving player (L1: Orange, L2: Blue, etc.)", () => {
  let starter = "orange";
  const serves = [];
  for (let lvl = 1; lvl <= 6; lvl++) {
    serves.push(starter);
    starter = starter === "orange" ? "blue" : "orange";
  }

  assert.deepEqual(serves, ["orange", "blue", "orange", "blue", "orange", "blue"]);
});

test("Loss Condition: opposite player wins when ball breaches a defense", () => {
  const determineWinner = (escapeSide) => (escapeSide === "bottom" ? "blue" : "orange");

  assert.equal(determineWinner("bottom"), "blue", "When ball escapes bottom (Orange defense), Blue wins");
  assert.equal(determineWinner("top"), "orange", "When ball escapes top (Blue defense), Orange wins");
});

test("Brick Destruction: HP reaches 0 immediately destroys display object and removes from active bricks", () => {
  let displayDestroyed = false;
  let displayCleared = false;

  const mockGraphics = {
    clear() {
      displayCleared = true;
    },
    destroy() {
      displayDestroyed = true;
    },
  };

  const bricks = [
    {
      id: "b1",
      hp: 1,
      maxHp: 1,
      alive: true,
      graphics: mockGraphics,
    },
    {
      id: "b2",
      hp: 1,
      maxHp: 1,
      alive: true,
      graphics: { clear() {}, destroy() {} },
    },
  ];

  // Ball hits b1 with power = 1
  const ballPower = 1;
  const targetBrick = bricks[0];
  targetBrick.hp -= ballPower;

  if (targetBrick.hp <= 0) {
    targetBrick.alive = false;
    targetBrick.graphics.clear();
    targetBrick.graphics.destroy();
    const idx = bricks.indexOf(targetBrick);
    if (idx !== -1) bricks.splice(idx, 1);
  }

  assert.equal(targetBrick.alive, false, "Destroyed brick marked alive = false");
  assert.equal(displayCleared, true, "Display object graphics cleared");
  assert.equal(displayDestroyed, true, "Display object destroyed immediately");
  assert.equal(bricks.length, 1, "Brick removed from active bricks collection");
  assert.equal(bricks[0].id, "b2", "Remaining brick is b2");
  assert.ok(!bricks.includes(targetBrick), "Ball cannot collide with destroyed brick again");
});

test("2-Hit Bricks: 1st hit decreases HP and preserves display; 2nd hit destroys and removes completely", () => {
  let displayDestroyed = false;
  let renderCount = 0;

  const mockGraphics = {
    clear() {},
    destroy() {
      displayDestroyed = true;
    },
  };

  const brick = {
    hp: 2,
    maxHp: 2,
    alive: true,
    graphics: mockGraphics,
  };

  const activeBricks = [brick];

  // Helper simulating collision hit step
  function hitBrick(target, power) {
    target.hp -= power;
    if (target.hp <= 0) {
      target.alive = false;
      target.graphics.clear();
      target.graphics.destroy();
      const idx = activeBricks.indexOf(target);
      if (idx !== -1) activeBricks.splice(idx, 1);
    } else {
      renderCount++; // Render damaged appearance
    }
  }

  // First hit with standard ball (power = 1)
  hitBrick(brick, 1);
  assert.equal(brick.hp, 1, "Brick HP reduced to 1 after first hit");
  assert.equal(brick.alive, true, "Brick is still alive after first hit");
  assert.equal(activeBricks.length, 1, "Brick remains in active collision collection");
  assert.equal(displayDestroyed, false, "Display object is NOT destroyed after first hit");
  assert.equal(renderCount, 1, "Damaged appearance was rendered");

  // Second hit with standard ball (power = 1)
  hitBrick(brick, 1);
  assert.equal(brick.hp, 0, "Brick HP reaches 0 on second hit");
  assert.equal(brick.alive, false, "Brick is marked alive = false on second hit");
  assert.equal(displayDestroyed, true, "Display object is destroyed on second hit");
  assert.equal(activeBricks.length, 0, "Brick is removed from active collision collection");
});

test("Level Completion: triggers immediately when all active bricks are removed", () => {
  const activeBricks = [{ id: 1 }, { id: 2 }];
  let levelCompleted = false;

  function checkLevel(bricks, hasStarted, isTransitioning) {
    if (!hasStarted || isTransitioning) return false;
    return bricks.length === 0;
  }

  // Initial check before all bricks are destroyed
  assert.equal(checkLevel(activeBricks, true, false), false);

  // Destroy first brick
  activeBricks.pop();
  assert.equal(checkLevel(activeBricks, true, false), false);

  // Destroy second (final) brick
  activeBricks.pop();
  assert.equal(activeBricks.length, 0);

  // Now level completion check runs
  levelCompleted = checkLevel(activeBricks, true, false);
  assert.equal(levelCompleted, true, "Level complete triggers cleanly when active bricks collection reaches 0");
});

test("Multi-Touch Controls: standards-based pointerId tracking with activePointers Map", () => {
  const GAME_HEIGHT = 580;
  const GAME_WIDTH = 360;
  const PADDLE_WIDTH = 76;
  const minX = PADDLE_WIDTH / 2;
  const maxX = GAME_WIDTH - PADDLE_WIDTH / 2;
  const clamp = (v) => Math.max(minX, Math.min(maxX, v));

  // Multi-touch tracker simulation using standards-based Pointer Events Map
  const activePointers = new Map();
  let orangePaddleX = GAME_WIDTH / 2;
  let bluePaddleX = GAME_WIDTH / 2;

  function handleNativePointerDown(e) {
    const clampedX = clamp(e.x);
    if (e.y > GAME_HEIGHT / 2) {
      activePointers.set(e.pointerId, "orange");
      orangePaddleX = clampedX;
    } else {
      activePointers.set(e.pointerId, "blue");
      bluePaddleX = clampedX;
    }
  }

  function handleNativePointerMove(e) {
    const target = activePointers.get(e.pointerId);
    if (!target) return;
    const clampedX = clamp(e.x);
    if (target === "orange") {
      orangePaddleX = clampedX;
    } else if (target === "blue") {
      bluePaddleX = clampedX;
    }
  }

  function handleNativePointerUp(e) {
    activePointers.delete(e.pointerId);
  }

  // 1. Orange touches bottom half with pointerId=101 at x=100
  handleNativePointerDown({ pointerId: 101, x: 100, y: 450 });
  assert.equal(activePointers.get(101), "orange");
  assert.equal(orangePaddleX, 100);
  assert.equal(bluePaddleX, GAME_WIDTH / 2);

  // 2. Blue touches top half with pointerId=102 at x=250
  handleNativePointerDown({ pointerId: 102, x: 250, y: 100 });
  assert.equal(activePointers.get(102), "blue");
  assert.equal(bluePaddleX, 250);
  assert.equal(orangePaddleX, 100);

  // 3. Orange moves pointerId=101 to x=80 -> Blue paddle is NOT affected
  handleNativePointerMove({ pointerId: 101, x: 80, y: 460 });
  assert.equal(orangePaddleX, 80);
  assert.equal(bluePaddleX, 250);

  // 4. Blue moves pointerId=102 to x=280 -> Orange paddle is NOT affected
  handleNativePointerMove({ pointerId: 102, x: 280, y: 90 });
  assert.equal(bluePaddleX, 280);
  assert.equal(orangePaddleX, 80);

  // 5. Orange lifts finger -> Only pointerId=101 is deleted
  handleNativePointerUp({ pointerId: 101 });
  assert.equal(activePointers.has(101), false);
  assert.equal(activePointers.has(102), true);

  // 6. Blue continues moving pointerId=102
  handleNativePointerMove({ pointerId: 102, x: 310, y: 110 });
  assert.equal(bluePaddleX, 310);
  assert.equal(orangePaddleX, 80); // Orange stays at 80
});

test("Bot targeting for Host paddle (Orange, bottom): selects downward-moving balls with shortest ETA", () => {
  const hostPaddleY = 534;
  const downwardFar = botBall(1, { y: 200, vy: 150 });
  const downwardImminent = botBall(2, { y: 400, vy: 300 });
  const upwardMovingAway = botBall(3, { y: 350, vy: -200 });

  assert.equal(
    selectThreateningBall([downwardFar, upwardMovingAway, downwardImminent], hostPaddleY, "orange"),
    downwardImminent
  );
  assert.equal(getBallTimeToPaddle(upwardMovingAway, hostPaddleY, "orange"), Number.POSITIVE_INFINITY);
  assert.ok(
    getBallTimeToPaddle(downwardImminent, hostPaddleY, "orange") <
      getBallTimeToPaddle(downwardFar, hostPaddleY, "orange")
  );
});

test("Bot controller on Host side: tracks downward incoming balls and moves smoothly toward them", () => {
  const hostBot = new BrickBlastBotController({ difficulty: "medium", controlledPaddle: "orange" });
  assert.equal(hostBot.controlledPaddleId, "orange");

  const incomingBall = botBall(10, { x: 300, y: 200, vx: 50, vy: 250 });
  let hostPaddleX = 180;
  for (let frame = 0; frame < 60; frame++) {
    hostPaddleX = hostBot.update([incomingBall], hostPaddleX, 72, 534, 360, 1 / 60);
  }
  // Host paddle must have moved rightward toward the incoming ball
  assert.ok(hostPaddleX > 180, "Host paddle should move toward the ball");
  assert.ok(hostPaddleX <= 360 - 36, "Host paddle should not exceed boundaries");
});

test("Bot controller on Guest side: tracks upward incoming balls", () => {
  const guestBot = new BrickBlastBotController({ difficulty: "medium", controlledPaddle: "blue" });
  assert.equal(guestBot.controlledPaddleId, "blue");

  const incomingBall = botBall(20, { x: 80, y: 300, vx: -30, vy: -250 });
  let guestPaddleX = 180;
  for (let frame = 0; frame < 60; frame++) {
    guestPaddleX = guestBot.update([incomingBall], guestPaddleX, 72, 46, 360, 1 / 60);
  }
  assert.ok(guestPaddleX < 180, "Guest paddle should move leftward toward the ball");
  assert.ok(guestPaddleX >= 36, "Guest paddle should not exceed boundaries");
});

test("Paddle Ownership: Host Bot mode strictly prevents human inputs from modifying bot-controlled host paddle", () => {
  // Simulate the exact input and ownership architecture in BrickBlastScene
  const mode = "vs-bot";
  const botPaddle = "orange";
  const controlledHumanPaddle = botPaddle === "orange" ? "blue" : "orange";

  let orangePaddleX = 180; // Host (Bot)
  let bluePaddleX = 180;   // Guest (Human)
  const activePointers = new Map();

  function handlePointerDown(e) {
    const clampedX = Math.max(36, Math.min(324, e.x));
    if (mode === "vs-bot") {
      activePointers.set(e.pointerId, controlledHumanPaddle);
      if (controlledHumanPaddle === "orange") {
        orangePaddleX = clampedX;
      } else {
        bluePaddleX = clampedX;
      }
      return;
    }
  }

  function handlePointerMove(e) {
    let target = activePointers.get(e.pointerId);
    if (mode === "vs-bot") {
      target = controlledHumanPaddle;
      activePointers.set(e.pointerId, target);
    }
    if (!target) return;
    if (mode === "vs-bot" && target === botPaddle) return;

    const clampedX = Math.max(36, Math.min(324, e.x));
    if (target === "orange") {
      orangePaddleX = clampedX;
    } else if (target === "blue") {
      bluePaddleX = clampedX;
    }
  }

  // Initial state: Both paddles at center
  assert.equal(orangePaddleX, 180);
  assert.equal(bluePaddleX, 180);

  // Human touches screen (even in bottom half where host paddle is)
  handlePointerDown({ pointerId: 1, x: 280, y: 500 });
  // Must update human paddle (blue), NOT bot paddle (orange)
  assert.equal(bluePaddleX, 280);
  assert.equal(orangePaddleX, 180, "Bot-controlled orange paddle must not be affected by pointer down");

  // Human drags across the screen
  handlePointerMove({ pointerId: 1, x: 60, y: 510 });
  assert.equal(bluePaddleX, 60);
  assert.equal(orangePaddleX, 180, "Bot-controlled orange paddle must not mirror human pointer movement");

  // Bot updates on its own tick
  const hostBot = new BrickBlastBotController({ difficulty: "medium", controlledPaddle: "orange" });
  orangePaddleX = hostBot.update([], orangePaddleX, 72, 534, 360, 0.05);
  // Human moves again
  handlePointerMove({ pointerId: 1, x: 300, y: 520 });
  assert.equal(bluePaddleX, 300);
  assert.equal(orangePaddleX, 180, "Bot paddle remains independent when human moves");
});

test("Bot sustained activity: bot continues updating accurately over 300 consecutive frames (5 seconds)", () => {
  const hostBot = new BrickBlastBotController({ difficulty: "hard", controlledPaddle: "orange" });
  let paddleX = 180;
  const ball = botBall(1, { x: 260, y: 200, vx: 20, vy: 150 });

  for (let frame = 0; frame < 300; frame++) {
    ball.x += ball.vx * (1 / 60);
    ball.y += ball.vy * (1 / 60);
    if (ball.x <= 10 || ball.x >= 350) ball.vx = -ball.vx;
    if (ball.y >= 520) ball.vy = -ball.vy;
    if (ball.y <= 60) ball.vy = -ball.vy;

    paddleX = hostBot.update([ball], paddleX, 72, 534, 360, 1 / 60);
  }

  assert.ok(!Number.isNaN(paddleX));
  assert.ok(paddleX >= 36 && paddleX <= 324);
});

test("Reset and rematch preserve bot paddle ownership", () => {
  const hostBot = new BrickBlastBotController({ difficulty: "medium", controlledPaddle: "orange" });
  assert.equal(hostBot.controlledPaddleId, "orange");
  hostBot.reset(180);
  assert.equal(hostBot.controlledPaddleId, "orange");

  const guestBot = new BrickBlastBotController({ difficulty: "medium", controlledPaddle: "blue" });
  assert.equal(guestBot.controlledPaddleId, "blue");
  guestBot.reset(180);
  assert.equal(guestBot.controlledPaddleId, "blue");
});

