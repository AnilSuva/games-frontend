import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TOP_PADDLE_Y,
  BOTTOM_PADDLE_Y,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_RADIUS,
  PADDLE_KEYBOARD_SPEED,
  COLOR_ORANGE,
  COLOR_BLUE,
  COLOR_BG,
  COLOR_WALL,
  DEFAULT_BALL_RADIUS,
  MIN_BALL_RADIUS,
  MAX_BALL_RADIUS,
  DEFAULT_BALL_POWER,
  MAX_BALL_POWER,
  MIN_SPEED_FACTOR,
  MAX_SPEED_FACTOR,
  MAX_ACTIVE_BALLS,
  POWERUP_FALL_SPEED,
  POINTS_NORMAL_BRICK,
  POINTS_STRONG_BRICK,
  POINTS_SPECIAL_BRICK,
  POINTS_WIN_LEVEL,
} from "../config/balance";
import { ALL_POWER_UP_TYPES, POWER_UP_DEFINITIONS, type PowerUpType } from "../config/powerUps";
import { generateLevel, getLevelBaseSpeed } from "../levels/generator";
import type { Ball, Brick, BrickBlastCallbacks, DroppedPowerUp, Paddle } from "./types";
import type { PlatformPlayer } from "@/games/common/startingPlayer";

export interface SceneInitData {
  startingPlayer: PlatformPlayer;
  callbacks: BrickBlastCallbacks;
  mode?: "1v1" | "vs-bot";
  difficulty?: "easy" | "medium" | "hard";
}

export class BrickBlastScene extends Phaser.Scene {
  private callbacks!: BrickBlastCallbacks;
  private currentLevel = 1;
  private score = 0;
  private currentStarter: PlatformPlayer = "orange";
  private mode: "1v1" | "vs-bot" = "1v1";
  private difficulty: "easy" | "medium" | "hard" = "medium";

  private orangePaddle!: Paddle;
  private bluePaddle!: Paddle;

  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: DroppedPowerUp[] = [];

  private isPaused = false;
  private isGameOver = false;
  private isTransitioningLevel = false;
  private hasLevelStarted = false;

  private ballIdCounter = 0;
  private powerUpIdCounter = 0;

  // Keyboard controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // Visual text overlay
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BrickBlastScene" });
  }

  private clearAllGameObjects() {
    if (this.balls) {
      for (const ball of this.balls) {
        ball.active = false;
        ball.graphics?.clear();
        ball.graphics?.destroy();
      }
      this.balls = [];
    }

    if (this.bricks) {
      for (const brick of this.bricks) {
        brick.alive = false;
        brick.graphics?.clear();
        brick.graphics?.destroy();
      }
      this.bricks = [];
    }

    if (this.powerUps) {
      for (const p of this.powerUps) {
        p.active = false;
        p.graphics?.clear();
        p.graphics?.destroy();
      }
      this.powerUps = [];
    }
  }

  init(data: SceneInitData) {
    this.currentStarter = data.startingPlayer || "orange";
    this.callbacks = data.callbacks || {};
    this.mode = data.mode || "1v1";
    this.difficulty = data.difficulty || "medium";
    this.currentLevel = 1;
    this.score = 0;
    this.isPaused = false;
    this.isGameOver = false;
    this.isTransitioningLevel = false;
    this.hasLevelStarted = false;
    this.clearAllGameObjects();
    this.ballIdCounter = 0;
    this.powerUpIdCounter = 0;
  }

  create() {
    // 1. Draw Canvas background & boundary lines
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(COLOR_BG, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle center division line
    bgGraphics.lineStyle(1, COLOR_WALL, 0.6);
    bgGraphics.lineBetween(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2);

    // 2. Create Paddles
    this.bluePaddle = this.createPaddle("blue", TOP_PADDLE_Y, COLOR_BLUE);
    this.orangePaddle = this.createPaddle("orange", BOTTOM_PADDLE_Y, COLOR_ORANGE);

    // 3. Status announcement text (Subtle, OmniPlay aesthetic)
    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "Inter, Roboto, sans-serif",
        fontSize: "14px",
        color: "#6b665f",
        fontStyle: "bold",
        backgroundColor: "#ffffff",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);

    // 4. Setup Inputs (Desktop Keyboard)
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }

    // 5. Setup Touch / Pointer Controls
    this.input.on("pointerdown", this.handlePointerInput, this);
    this.input.on("pointermove", this.handlePointerInput, this);

    // 6. Build Level 1 Bricks & Serve initial Ball
    this.buildCurrentLevel();
    this.serveBall(this.currentStarter);
  }

  private createPaddle(player: PlatformPlayer, y: number, color: number): Paddle {
    const graphics = this.add.graphics().setDepth(5);
    const paddle: Paddle = {
      player,
      x: GAME_WIDTH / 2,
      y,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      graphics,
    };
    this.renderPaddle(paddle, color);
    return paddle;
  }

  private renderPaddle(paddle: Paddle, color: number) {
    paddle.graphics.clear();
    paddle.graphics.fillStyle(color, 1);
    paddle.graphics.fillRoundedRect(
      paddle.x - paddle.width / 2,
      paddle.y - paddle.height / 2,
      paddle.width,
      paddle.height,
      PADDLE_RADIUS
    );
  }

  private buildCurrentLevel() {
    // Clear old bricks
    for (const b of this.bricks) {
      b.alive = false;
      b.graphics?.clear();
      b.graphics?.destroy();
    }
    this.bricks = [];

    const levelData = generateLevel(this.currentLevel);

    for (const def of levelData.bricks) {
      const graphics = this.add.graphics().setDepth(2);
      const brick: Brick = {
        def,
        hp: def.hp,
        alive: true,
        graphics,
      };
      this.renderBrick(brick);
      this.bricks.push(brick);
    }

    this.hasLevelStarted = true;
  }

  private renderBrick(brick: Brick) {
    brick.graphics.clear();
    if (!brick.alive || brick.hp <= 0) {
      brick.graphics.destroy();
      return;
    }

    const { x, y, width, height, isSpecial } = brick.def;
    const isDamaged = brick.def.maxHp === 2 && brick.hp === 1;

    // Fill
    brick.graphics.fillStyle(brick.def.color, isDamaged ? 0.75 : 1);
    brick.graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, 3);

    // Border
    if (isSpecial) {
      brick.graphics.lineStyle(1.5, 0xfef08a, 1);
      brick.graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 3);
    } else if (isDamaged) {
      brick.graphics.lineStyle(1, 0xffffff, 0.8);
      brick.graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 3);
    }
  }

  private serveBall(server: PlatformPlayer) {
    const baseSpeed = getLevelBaseSpeed(this.currentLevel);
    const radius = DEFAULT_BALL_RADIUS;
    const power = DEFAULT_BALL_POWER;

    const x = GAME_WIDTH / 2;
    const y = server === "orange" ? this.orangePaddle.y - 18 : this.bluePaddle.y + 18;

    // Launch trajectory: toward the opposing player with subtle horizontal variation
    const launchAngleDeg = (Math.random() - 0.5) * 36; // -18 to +18 deg
    const rad = (launchAngleDeg * Math.PI) / 180;
    const dirY = server === "orange" ? -1 : 1;

    const vx = baseSpeed * Math.sin(rad);
    const vy = dirY * baseSpeed * Math.cos(rad);

    const graphics = this.add.graphics().setDepth(10);
    const ball: Ball = {
      id: ++this.ballIdCounter,
      x,
      y,
      vx,
      vy,
      radius,
      power,
      speedMultiplier: 1.0,
      active: true,
      graphics,
    };

    this.renderBall(ball);
    this.balls.push(ball);
  }

  private renderBall(ball: Ball) {
    ball.graphics.clear();
    if (!ball.active) return;

    // Ball color: Orange if moving up (toward blue), Blue if moving down (toward orange)
    const color = ball.vy < 0 ? COLOR_ORANGE : COLOR_BLUE;
    ball.graphics.fillStyle(color, 1);
    ball.graphics.fillCircle(ball.x, ball.y, ball.radius);

    // Center specular dot
    ball.graphics.fillStyle(0xffffff, 0.7);
    ball.graphics.fillCircle(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.3);
  }

  private handlePointerInput(pointer: Phaser.Input.Pointer) {
    if (this.isPaused || this.isGameOver) return;
    if (!pointer.isDown) return;

    const clampedX = Phaser.Math.Clamp(
      pointer.x,
      PADDLE_WIDTH / 2,
      GAME_WIDTH - PADDLE_WIDTH / 2
    );

    if (this.mode === "vs-bot") {
      // In vs-bot mode, touch controls the bottom Orange paddle regardless of screen half
      this.orangePaddle.x = clampedX;
      this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    } else {
      if (pointer.y > GAME_HEIGHT / 2) {
        // Lower half controls Orange paddle
        this.orangePaddle.x = clampedX;
        this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
      } else {
        // Upper half controls Blue paddle
        this.bluePaddle.x = clampedX;
        this.renderPaddle(this.bluePaddle, COLOR_BLUE);
      }
    }
  }

  update(_time: number, delta: number) {
    if (this.isPaused || this.isGameOver || this.isTransitioningLevel) return;
    const dt = delta / 1000;

    // 1. Keyboard fallback controls
    this.handleKeyboardControls(dt);

    // 2. AI Bot paddle update if in vs-bot mode
    if (this.mode === "vs-bot") {
      this.updateBotPaddle(dt);
    }

    // 3. Update active balls
    this.updateBalls(dt);

    // 4. Update dropped power-ups
    this.updatePowerUps(dt);

    // 5. Check level complete
    this.checkLevelCompletion();
  }

  private updateBotPaddle(dt: number) {
    const botSpeed =
      this.difficulty === "easy"
        ? 190
        : this.difficulty === "hard"
        ? 340
        : 260;

    // Track active ball moving towards top paddle
    const incomingBalls = this.balls.filter((b) => b.active && b.vy < 0);

    let targetX = GAME_WIDTH / 2;
    if (incomingBalls.length > 0) {
      const closest = incomingBalls.reduce((prev, curr) => (curr.y < prev.y ? curr : prev));
      targetX = closest.x;
    }

    const diff = targetX - this.bluePaddle.x;
    if (Math.abs(diff) > 4) {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), botSpeed * dt);
      this.bluePaddle.x = Phaser.Math.Clamp(
        this.bluePaddle.x + step,
        PADDLE_WIDTH / 2,
        GAME_WIDTH - PADDLE_WIDTH / 2
      );
      this.renderPaddle(this.bluePaddle, COLOR_BLUE);
    }
  }

  private handleKeyboardControls(dt: number) {
    let orangeMoved = false;
    let blueMoved = false;

    // Orange (Bottom): A / D
    if (this.keyA?.isDown) {
      this.orangePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
      orangeMoved = true;
    } else if (this.keyD?.isDown) {
      this.orangePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
      orangeMoved = true;
    }

    // Blue (Top): Arrow Left / Arrow Right (only in 1v1 mode)
    if (this.mode !== "vs-bot") {
      if (this.cursors?.left.isDown) {
        this.bluePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
        blueMoved = true;
      } else if (this.cursors?.right.isDown) {
        this.bluePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
        blueMoved = true;
      }
    }

    if (orangeMoved) {
      this.orangePaddle.x = Phaser.Math.Clamp(
        this.orangePaddle.x,
        PADDLE_WIDTH / 2,
        GAME_WIDTH - PADDLE_WIDTH / 2
      );
      this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    }

    if (blueMoved) {
      this.bluePaddle.x = Phaser.Math.Clamp(
        this.bluePaddle.x,
        PADDLE_WIDTH / 2,
        GAME_WIDTH - PADDLE_WIDTH / 2
      );
      this.renderPaddle(this.bluePaddle, COLOR_BLUE);
    }
  }

  private updateBalls(dt: number) {
    for (const ball of this.balls) {
      if (!ball.active) continue;

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Wall reflections (Left & Right)
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius >= GAME_WIDTH) {
        ball.x = GAME_WIDTH - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }

      // Paddle deflection
      this.checkPaddleDeflection(ball, this.orangePaddle, -1);
      this.checkPaddleDeflection(ball, this.bluePaddle, 1);

      // Brick collisions
      this.checkBrickCollisions(ball);

      // Boundary escape / Loss condition
      if (ball.y - ball.radius > GAME_HEIGHT) {
        // Breached Orange (bottom) defense
        this.handleBallEscape(ball, "blue");
      } else if (ball.y + ball.radius < 0) {
        // Breached Blue (top) defense
        this.handleBallEscape(ball, "orange");
      } else {
        this.renderBall(ball);
      }
    }

    // Filter out inactive balls
    this.balls = this.balls.filter((b) => b.active);
  }

  private checkPaddleDeflection(ball: Ball, paddle: Paddle, bounceDirY: number) {
    // bounceDirY = -1 (bouncing up from bottom paddle), +1 (bouncing down from top paddle)
    const isMovingTowardPaddle = bounceDirY === -1 ? ball.vy > 0 : ball.vy < 0;
    if (!isMovingTowardPaddle) return;

    const padHalfW = paddle.width / 2;
    const padHalfH = paddle.height / 2;

    const inRangeX =
      ball.x + ball.radius >= paddle.x - padHalfW &&
      ball.x - ball.radius <= paddle.x + padHalfW;

    const inRangeY =
      bounceDirY === -1
        ? ball.y + ball.radius >= paddle.y - padHalfH &&
          ball.y - ball.radius <= paddle.y + padHalfH
        : ball.y - ball.radius <= paddle.y + padHalfH &&
          ball.y + ball.radius >= paddle.y - padHalfH;

    if (inRangeX && inRangeY) {
      // Sensible collision-angle deflection: offset from paddle center
      const offset = Phaser.Math.Clamp((ball.x - paddle.x) / padHalfW, -1, 1);
      const maxAngleRad = (62 * Math.PI) / 180; // 62 degrees max
      const angle = offset * maxAngleRad;

      const currentSpeed = Math.hypot(ball.vx, ball.vy);
      ball.vx = currentSpeed * Math.sin(angle);
      ball.vy = bounceDirY * currentSpeed * Math.cos(angle);

      // Prevent strictly horizontal traps: ensure |vy| is at least 30% of total speed
      if (Math.abs(ball.vy) < currentSpeed * 0.3) {
        ball.vy = bounceDirY * currentSpeed * 0.3;
        ball.vx = Math.sign(ball.vx || 1) * currentSpeed * Math.sqrt(1 - 0.09);
      }

      // Reposition to paddle surface
      ball.y = bounceDirY === -1 ? paddle.y - padHalfH - ball.radius : paddle.y + padHalfH + ball.radius;
    }
  }

  private checkBrickCollisions(ball: Ball) {
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i];
      if (!brick || !brick.alive || brick.hp <= 0) continue;

      const { x, y, width, height } = brick.def;
      const halfW = width / 2;
      const halfH = height / 2;

      // Circle to AABB clamp test
      const closestX = Phaser.Math.Clamp(ball.x, x - halfW, x + halfW);
      const closestY = Phaser.Math.Clamp(ball.y, y - halfH, y + halfH);

      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= ball.radius * ball.radius) {
        // Collision hit!
        const overlapX = ball.radius - Math.abs(dx);
        const overlapY = ball.radius - Math.abs(dy);

        // Reflect velocity along minimum overlap axis
        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
        } else {
          ball.vy = -ball.vy;
        }

        // Damage brick according to ball power
        brick.hp -= ball.power;

        if (brick.hp <= 0) {
          brick.alive = false;

          // 1. Immediately destroy/clear its Phaser display object
          brick.graphics.clear();
          brick.graphics.destroy();

          // 2. Remove brick from active collision collection immediately
          this.bricks.splice(i, 1);

          const pts = brick.def.isSpecial
            ? POINTS_SPECIAL_BRICK
            : brick.def.maxHp === 2
            ? POINTS_STRONG_BRICK
            : POINTS_NORMAL_BRICK;

          this.score += pts;
          this.callbacks.onScoreUpdate?.(this.score);

          // If special, spawn a collectible power-up
          if (brick.def.isSpecial) {
            this.spawnPowerUp(brick.def.x, brick.def.y, ball.vy);
          }
        } else {
          // Brick takes damage but survives (e.g. 2-hit brick with 1 HP remaining)
          this.renderBrick(brick);
        }

        // Handle one brick collision per step to prevent multi-hit tunneling
        break;
      }
    }
  }

  private spawnPowerUp(x: number, y: number, ballVy: number) {
    const randomType =
      ALL_POWER_UP_TYPES[Math.floor(Math.random() * ALL_POWER_UP_TYPES.length)];

    // Capsule drifts in the direction the ball was traveling so both sides can play for it
    const vy = ballVy < 0 ? -POWERUP_FALL_SPEED : POWERUP_FALL_SPEED;

    const graphics = this.add.graphics().setDepth(8);
    const powerUp: DroppedPowerUp = {
      id: ++this.powerUpIdCounter,
      type: randomType,
      x,
      y,
      vy,
      active: true,
      graphics,
    };

    this.renderPowerUp(powerUp);
    this.powerUps.push(powerUp);
  }

  private renderPowerUp(p: DroppedPowerUp) {
    p.graphics.clear();
    if (!p.active) return;

    const def = POWER_UP_DEFINITIONS[p.type];
    p.graphics.fillStyle(def.color, 1);
    p.graphics.fillRoundedRect(p.x - 12, p.y - 7, 24, 14, 5);

    p.graphics.lineStyle(1.5, 0xffffff, 0.9);
    p.graphics.strokeRoundedRect(p.x - 12, p.y - 7, 24, 14, 5);
  }

  private updatePowerUps(dt: number) {
    for (const p of this.powerUps) {
      if (!p.active) continue;

      p.y += p.vy * dt;

      // Check intercept with Orange (Bottom) Paddle
      if (
        p.y + 7 >= this.orangePaddle.y - PADDLE_HEIGHT / 2 &&
        p.y - 7 <= this.orangePaddle.y + PADDLE_HEIGHT / 2 &&
        p.x >= this.orangePaddle.x - PADDLE_WIDTH / 2 &&
        p.x <= this.orangePaddle.x + PADDLE_WIDTH / 2
      ) {
        p.active = false;
        p.graphics.destroy();
        this.applyPowerUp(p.type, "orange");
        continue;
      }

      // Check intercept with Blue (Top) Paddle
      if (
        p.y - 7 <= this.bluePaddle.y + PADDLE_HEIGHT / 2 &&
        p.y + 7 >= this.bluePaddle.y - PADDLE_HEIGHT / 2 &&
        p.x >= this.bluePaddle.x - PADDLE_WIDTH / 2 &&
        p.x <= this.bluePaddle.x + PADDLE_WIDTH / 2
      ) {
        p.active = false;
        p.graphics.destroy();
        this.applyPowerUp(p.type, "blue");
        continue;
      }

      // Despawn off bounds
      if (p.y < 0 || p.y > GAME_HEIGHT) {
        p.active = false;
        p.graphics.destroy();
      } else {
        this.renderPowerUp(p);
      }
    }

    this.powerUps = this.powerUps.filter((p) => p.active);
  }

  private applyPowerUp(type: PowerUpType, collectingPlayer: PlatformPlayer) {
    const def = POWER_UP_DEFINITIONS[type];
    this.showFloatingNotice(`${def.label}!`);

    switch (type) {
      case "extra_ball": {
        if (this.balls.length < MAX_ACTIVE_BALLS) {
          this.serveBall(collectingPlayer);
        }
        break;
      }
      case "speed_up": {
        for (const ball of this.balls) {
          ball.speedMultiplier = Phaser.Math.Clamp(
            ball.speedMultiplier * 1.15,
            MIN_SPEED_FACTOR,
            MAX_SPEED_FACTOR
          );
          const currentSpeed = Math.hypot(ball.vx, ball.vy);
          const newSpeed = getLevelBaseSpeed(this.currentLevel) * ball.speedMultiplier;
          ball.vx = (ball.vx / currentSpeed) * newSpeed;
          ball.vy = (ball.vy / currentSpeed) * newSpeed;
        }
        break;
      }
      case "speed_down": {
        for (const ball of this.balls) {
          ball.speedMultiplier = Phaser.Math.Clamp(
            ball.speedMultiplier * 0.85,
            MIN_SPEED_FACTOR,
            MAX_SPEED_FACTOR
          );
          const currentSpeed = Math.hypot(ball.vx, ball.vy);
          const newSpeed = getLevelBaseSpeed(this.currentLevel) * ball.speedMultiplier;
          ball.vx = (ball.vx / currentSpeed) * newSpeed;
          ball.vy = (ball.vy / currentSpeed) * newSpeed;
        }
        break;
      }
      case "size_up": {
        for (const ball of this.balls) {
          ball.radius = Math.min(MAX_BALL_RADIUS, ball.radius + 3);
        }
        break;
      }
      case "size_down": {
        for (const ball of this.balls) {
          ball.radius = Math.max(MIN_BALL_RADIUS, ball.radius - 2);
        }
        break;
      }
      case "power_up": {
        for (const ball of this.balls) {
          ball.power = Math.min(MAX_BALL_POWER, ball.power + 1);
        }
        break;
      }
    }
  }

  private handleBallEscape(ball: Ball, winnerIfLast: PlatformPlayer) {
    ball.active = false;
    ball.graphics.destroy();

    const remainingActiveBalls = this.balls.filter((b) => b.active);

    // Multi-ball failure condition: Match only ends when the final active ball is lost
    if (remainingActiveBalls.length === 0) {
      this.isGameOver = true;
      this.showFloatingNotice(`Game Over • ${winnerIfLast === "orange" ? "Orange" : "Blue"} Wins!`);

      this.callbacks.onGameOver?.({
        winner: winnerIfLast,
        score: this.score,
        details: {
          level: this.currentLevel,
          finalScore: this.score,
        },
      });
      this.callbacks.onLifecycleChange?.("finished");
    }
  }

  private checkLevelCompletion() {
    if (!this.hasLevelStarted || this.isTransitioningLevel) return;
    if (this.bricks.length > 0) return;

    // All bricks destroyed! Level complete sequence
    this.isTransitioningLevel = true;
    this.score += POINTS_WIN_LEVEL;
    this.callbacks.onScoreUpdate?.(this.score);

    this.showFloatingNotice(`Level ${this.currentLevel} Clear!`);

    this.time.delayedCall(1200, () => {
      this.currentLevel++;
      // Alternate starting serve
      this.currentStarter = this.currentStarter === "orange" ? "blue" : "orange";

      this.callbacks.onLevelChange?.(this.currentLevel);

      // Despawn old balls and powerups
      for (const b of this.balls) {
        b.active = false;
        b.graphics?.clear();
        b.graphics?.destroy();
      }
      this.balls = [];

      for (const p of this.powerUps) {
        p.active = false;
        p.graphics?.clear();
        p.graphics?.destroy();
      }
      this.powerUps = [];

      // Build fresh layout from next template
      this.buildCurrentLevel();

      // Serve new ball from alternating starter
      this.serveBall(this.currentStarter);

      this.isTransitioningLevel = false;
      this.statusText.setAlpha(0);
    });
  }

  private showFloatingNotice(text: string) {
    this.statusText.setText(text).setAlpha(1);
    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      duration: 1800,
      ease: "Power2",
    });
  }

  // Controller API exposed to React GameHost
  public restartMatch(
    startingPlayer?: PlatformPlayer,
    mode?: "1v1" | "vs-bot",
    difficulty?: "easy" | "medium" | "hard"
  ) {
    this.clearAllGameObjects();
    this.init({
      startingPlayer: startingPlayer || this.currentStarter,
      callbacks: this.callbacks,
      mode: mode || this.mode,
      difficulty: difficulty || this.difficulty,
    });
    this.buildCurrentLevel();
    this.serveBall(this.currentStarter);
    this.callbacks.onLifecycleChange?.("playing");
    this.callbacks.onScoreUpdate?.(0);
    this.callbacks.onLevelChange?.(1);
  }

  public pauseGame() {
    this.isPaused = true;
    this.statusText.setText("PAUSED").setAlpha(1);
    this.callbacks.onLifecycleChange?.("paused");
  }

  public resumeGame() {
    this.isPaused = false;
    this.statusText.setAlpha(0);
    this.callbacks.onLifecycleChange?.("playing");
  }
}
