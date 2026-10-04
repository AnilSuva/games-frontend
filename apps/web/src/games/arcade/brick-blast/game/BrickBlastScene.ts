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
import { soundManager } from "@/platform/audio";
import { BrickBlastBotController } from "./botController";

export interface OnlineNetworkingCallbacks {
  sendInput?: (input: string, data?: unknown) => void;
  sendGameEvent?: (event: string, data?: unknown) => void;
  myRole?: PlatformPlayer;
  myPlayerId?: string;
}

export interface SceneInitData {
  startingPlayer: PlatformPlayer;
  callbacks: BrickBlastCallbacks;
  mode?: "1v1" | "vs-bot" | "online";
  difficulty?: "easy" | "medium" | "hard";
  botPaddle?: PlatformPlayer;
  online?: OnlineNetworkingCallbacks;
}

export class BrickBlastScene extends Phaser.Scene {
  private callbacks!: BrickBlastCallbacks;
  private currentLevel = 1;
  private score = 0;
  private currentStarter: PlatformPlayer = "orange";
  private mode: "1v1" | "vs-bot" | "online" = "1v1";
  private difficulty: "easy" | "medium" | "hard" = "medium";
  private botPaddle: PlatformPlayer = "blue";
  private botController: BrickBlastBotController | null = null;
  private onlineConfig: OnlineNetworkingCallbacks | null = null;
  private myRole: PlatformPlayer = "orange";
  private myPlayerId: string | null = null;

  public get controlledBotPaddle(): PlatformPlayer {
    return this.botPaddle;
  }

  public get controlledHumanPaddle(): PlatformPlayer {
    return this.botPaddle === "orange" ? "blue" : "orange";
  }
  private opponentMoveIntent = 0;
  private opponentTargetX: number | null = null;
  private lastSentInput: string | null = null;
  private lastSentPointerX = 0;
  private lastPointerSendTime = 0;

  private orangePaddle!: Paddle;
  private bluePaddle!: Paddle;

  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: DroppedPowerUp[] = [];

  private isPaused = false;
  private isGameOver = false;
  private isTransitioningLevel = false;
  private hasLevelStarted = false;

  private onCanvasPointerDown?: (e: PointerEvent) => void;
  private onCanvasPointerMove?: (e: PointerEvent) => void;
  private onCanvasPointerUp?: (e: PointerEvent) => void;
  private onWindowPointerUp?: (e: PointerEvent) => void;
  private onWindowReset?: () => void;
  private activePointers = new Map<number, "orange" | "blue">();

  private ballIdCounter = 0;
  private powerUpIdCounter = 0;

  // Keyboard controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // Audio effects
  private tileBreakSound: Phaser.Sound.BaseSound | null = null;
  private lastTileBreakSoundTime = 0;

  // Visual text overlay
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BrickBlastScene" });
  }

  preload() {
    soundManager.preloadPhaser(this, "tileBreak");
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
    this.botPaddle = data.botPaddle || "blue";
    this.onlineConfig = data.online || null;
    this.myRole = data.online?.myRole || "orange";
    this.myPlayerId = data.online?.myPlayerId || null;
    this.opponentMoveIntent = 0;
    this.opponentTargetX = null;
    this.lastSentInput = null;
    this.lastSentPointerX = 0;
    this.lastPointerSendTime = 0;
    this.botController =
      this.mode === "vs-bot"
        ? new BrickBlastBotController({
            difficulty: this.difficulty,
            controlledPaddle: this.botPaddle,
          })
        : null;
    this.currentLevel = 1;
    this.score = 0;
    this.isPaused = false;
    this.isGameOver = false;
    this.isTransitioningLevel = false;
    this.hasLevelStarted = false;
    this.activePointers.clear();
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

    // 5. Setup Standards-based Multi-Touch / Pointer Controls (Chrome, Brave, Safari, Firefox)
    this.setupCanvasPointerListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // 6. Build Level 1 Bricks & Serve initial Ball
    this.buildCurrentLevel();
    this.serveBall(this.currentStarter);

    // 7. Instantiate preloaded audio
    this.tileBreakSound = soundManager.addPhaserSound(this, "tileBreak");
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

  private setupCanvasPointerListeners() {
    this.removeCanvasPointerListeners();

    const canvas = this.game.canvas;
    if (!canvas) return;

    canvas.style.touchAction = "none";

    this.onCanvasPointerDown = (e: PointerEvent) => this.handleNativePointerDown(e);
    this.onCanvasPointerMove = (e: PointerEvent) => this.handleNativePointerMove(e);
    this.onCanvasPointerUp = (e: PointerEvent) => this.handleNativePointerUp(e);

    canvas.addEventListener("pointerdown", this.onCanvasPointerDown, { passive: false });
    canvas.addEventListener("pointermove", this.onCanvasPointerMove, { passive: false });
    canvas.addEventListener("pointerup", this.onCanvasPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", this.onCanvasPointerUp, { passive: false });

    if (typeof window !== "undefined") {
      this.onWindowPointerUp = (e: PointerEvent) => this.handleNativePointerUp(e);
      this.onWindowReset = () => {
        this.activePointers.clear();
        if (this.mode === "online" && this.lastSentInput && this.lastSentInput !== "paddle.stop") {
          this.lastSentInput = "paddle.stop";
          this.onlineConfig?.sendInput?.("paddle.stop");
        }
      };

      window.addEventListener("pointerup", this.onWindowPointerUp, { passive: true });
      window.addEventListener("pointercancel", this.onWindowPointerUp, { passive: true });
      window.addEventListener("resize", this.onWindowReset, { passive: true });
      window.addEventListener("orientationchange", this.onWindowReset, { passive: true });
      window.addEventListener("blur", this.onWindowReset, { passive: true });
    }
  }

  private removeCanvasPointerListeners() {
    const canvas = this.game.canvas;
    if (canvas) {
      if (this.onCanvasPointerDown) {
        canvas.removeEventListener("pointerdown", this.onCanvasPointerDown);
      }
      if (this.onCanvasPointerMove) {
        canvas.removeEventListener("pointermove", this.onCanvasPointerMove);
      }
      if (this.onCanvasPointerUp) {
        canvas.removeEventListener("pointerup", this.onCanvasPointerUp);
        canvas.removeEventListener("pointercancel", this.onCanvasPointerUp);
      }
    }
    if (typeof window !== "undefined") {
      if (this.onWindowPointerUp) {
        window.removeEventListener("pointerup", this.onWindowPointerUp);
        window.removeEventListener("pointercancel", this.onWindowPointerUp);
        this.onWindowPointerUp = undefined;
      }
      if (this.onWindowReset) {
        window.removeEventListener("resize", this.onWindowReset);
        window.removeEventListener("orientationchange", this.onWindowReset);
        window.removeEventListener("blur", this.onWindowReset);
        this.onWindowReset = undefined;
      }
    }
    this.activePointers.clear();
  }

  private getCanvasGameCoords(e: PointerEvent): { x: number; y: number } | null {
    const canvas = this.game.canvas;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  }

  private handleNativePointerDown(e: PointerEvent) {
    if (this.isPaused || this.isGameOver) return;
    if (e.cancelable) e.preventDefault();

    const canvas = this.game.canvas;
    if (canvas && canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignored if pointer capture is not permitted
      }
    }

    const coords = this.getCanvasGameCoords(e);
    if (!coords) return;

    const clampedX = Phaser.Math.Clamp(
      coords.x,
      PADDLE_WIDTH / 2,
      GAME_WIDTH - PADDLE_WIDTH / 2
    );

    if (this.mode === "online") {
      const myTarget = this.myRole;
      this.activePointers.set(e.pointerId, myTarget);
      if (myTarget === "orange") {
        this.orangePaddle.x = clampedX;
        this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
      } else {
        this.bluePaddle.x = clampedX;
        this.renderPaddle(this.bluePaddle, COLOR_BLUE);
      }
      this.sendOnlinePaddlePosition(clampedX);
      return;
    }

    if (this.mode === "vs-bot") {
      const humanPaddle = this.controlledHumanPaddle;
      this.activePointers.set(e.pointerId, humanPaddle);
      if (humanPaddle === "orange") {
        this.orangePaddle.x = clampedX;
        this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
      } else {
        this.bluePaddle.x = clampedX;
        this.renderPaddle(this.bluePaddle, COLOR_BLUE);
      }
      return;
    }

    if (coords.y > GAME_HEIGHT / 2) {
      // Lower half touch controls Orange paddle
      this.activePointers.set(e.pointerId, "orange");
      this.orangePaddle.x = clampedX;
      this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    } else {
      // Upper half touch controls Blue paddle
      this.activePointers.set(e.pointerId, "blue");
      this.bluePaddle.x = clampedX;
      this.renderPaddle(this.bluePaddle, COLOR_BLUE);
    }
  }

  private handleNativePointerMove(e: PointerEvent) {
    if (this.isPaused || this.isGameOver) return;

    let target = this.activePointers.get(e.pointerId);

    const coords = this.getCanvasGameCoords(e);
    if (!coords) return;

    if (this.mode === "online") {
      target = this.myRole;
      this.activePointers.set(e.pointerId, target);
    } else if (this.mode === "vs-bot") {
      target = this.controlledHumanPaddle;
      this.activePointers.set(e.pointerId, target);
    } else if (!target && e.buttons > 0) {
      target = coords.y > GAME_HEIGHT / 2 ? "orange" : "blue";
      this.activePointers.set(e.pointerId, target);
    }

    if (!target) return;
    if (this.mode === "vs-bot" && target === this.botPaddle) return;
    if (e.cancelable) e.preventDefault();

    const clampedX = Phaser.Math.Clamp(
      coords.x,
      PADDLE_WIDTH / 2,
      GAME_WIDTH - PADDLE_WIDTH / 2
    );

    if (target === "orange") {
      this.orangePaddle.x = clampedX;
      this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    } else if (target === "blue") {
      this.bluePaddle.x = clampedX;
      this.renderPaddle(this.bluePaddle, COLOR_BLUE);
    }

    if (this.mode === "online") {
      this.sendOnlinePaddlePosition(clampedX);
    }
  }

  private handleNativePointerUp(e: PointerEvent) {
    const canvas = this.game.canvas;
    if (canvas && canvas.releasePointerCapture) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }
    }

    this.activePointers.delete(e.pointerId);

    if (this.mode === "online" && this.activePointers.size === 0) {
      const myPaddle = this.myRole === "orange" ? this.orangePaddle : this.bluePaddle;
      if (myPaddle && Math.abs(myPaddle.x - this.lastSentPointerX) >= 1) {
        this.lastSentPointerX = myPaddle.x;
        this.lastPointerSendTime = performance.now();
        this.onlineConfig?.sendInput?.("paddle.position", { x: myPaddle.x });
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
    } else if (this.mode === "online") {
      this.updateRemoteOpponentPaddle(dt);
    }

    // 3. Update active balls
    this.updateBalls(dt);

    // 4. Update dropped power-ups
    this.updatePowerUps(dt);

    // 5. Check level complete
    this.checkLevelCompletion();
  }

  private updateRemoteOpponentPaddle(dt: number) {
    const oppPaddle = this.myRole === "orange" ? this.bluePaddle : this.orangePaddle;
    const oppColor = this.myRole === "orange" ? COLOR_BLUE : COLOR_ORANGE;
    let oppMoved = false;

    if (this.opponentTargetX !== null) {
      const dx = this.opponentTargetX - oppPaddle.x;
      if (Math.abs(dx) > 1) {
        oppPaddle.x += dx * Math.min(1, dt * 15);
        oppMoved = true;
      } else {
        oppPaddle.x = this.opponentTargetX;
        this.opponentTargetX = null;
        oppMoved = true;
      }
    } else if (this.opponentMoveIntent !== 0) {
      oppPaddle.x += this.opponentMoveIntent * PADDLE_KEYBOARD_SPEED * dt;
      oppMoved = true;
    }

    if (oppMoved) {
      oppPaddle.x = Phaser.Math.Clamp(
        oppPaddle.x,
        PADDLE_WIDTH / 2,
        GAME_WIDTH - PADDLE_WIDTH / 2
      );
      this.renderPaddle(oppPaddle, oppColor);
    }
  }

  private updateBotPaddle(dt: number) {
    if (!this.botController) return;
    const targetPaddle = this.botPaddle === "orange" ? this.orangePaddle : this.bluePaddle;
    const targetColor = this.botPaddle === "orange" ? COLOR_ORANGE : COLOR_BLUE;

    const nextX = this.botController.update(
      this.balls,
      targetPaddle.x,
      targetPaddle.width,
      targetPaddle.y,
      GAME_WIDTH,
      dt
    );
    if (Math.abs(nextX - targetPaddle.x) > 0.01) {
      targetPaddle.x = nextX;
      this.renderPaddle(targetPaddle, targetColor);
    }
  }

  private handleKeyboardControls(dt: number) {
    let orangeMoved = false;
    let blueMoved = false;

    if (this.mode === "online") {
      const isMovingLeft = Boolean(this.keyA?.isDown || this.cursors?.left.isDown);
      const isMovingRight = Boolean(this.keyD?.isDown || this.cursors?.right.isDown);

      if (this.myRole === "orange") {
        if (isMovingLeft) {
          this.orangePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
          orangeMoved = true;
          if (this.lastSentInput !== "paddle.left") {
            this.lastSentInput = "paddle.left";
            this.onlineConfig?.sendInput?.("paddle.left");
          }
        } else if (isMovingRight) {
          this.orangePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
          orangeMoved = true;
          if (this.lastSentInput !== "paddle.right") {
            this.lastSentInput = "paddle.right";
            this.onlineConfig?.sendInput?.("paddle.right");
          }
        } else if (this.lastSentInput && this.lastSentInput !== "paddle.stop") {
          this.lastSentInput = "paddle.stop";
          this.onlineConfig?.sendInput?.("paddle.stop");
        }
      } else {
        if (isMovingLeft) {
          this.bluePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
          blueMoved = true;
          if (this.lastSentInput !== "paddle.left") {
            this.lastSentInput = "paddle.left";
            this.onlineConfig?.sendInput?.("paddle.left");
          }
        } else if (isMovingRight) {
          this.bluePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
          blueMoved = true;
          if (this.lastSentInput !== "paddle.right") {
            this.lastSentInput = "paddle.right";
            this.onlineConfig?.sendInput?.("paddle.right");
          }
        } else if (this.lastSentInput && this.lastSentInput !== "paddle.stop") {
          this.lastSentInput = "paddle.stop";
          this.onlineConfig?.sendInput?.("paddle.stop");
        }
      }
    } else if (this.mode === "vs-bot") {
      const isMovingLeft = Boolean(this.keyA?.isDown || this.cursors?.left.isDown);
      const isMovingRight = Boolean(this.keyD?.isDown || this.cursors?.right.isDown);
      const humanPaddle = this.controlledHumanPaddle;

      if (humanPaddle === "orange") {
        if (isMovingLeft) {
          this.orangePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
          orangeMoved = true;
        } else if (isMovingRight) {
          this.orangePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
          orangeMoved = true;
        }
      } else {
        if (isMovingLeft) {
          this.bluePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
          blueMoved = true;
        } else if (isMovingRight) {
          this.bluePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
          blueMoved = true;
        }
      }
    } else {
      // 1v1 local mode: Orange uses A/D, Blue uses Arrow keys
      if (this.keyA?.isDown) {
        this.orangePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
        orangeMoved = true;
      } else if (this.keyD?.isDown) {
        this.orangePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
        orangeMoved = true;
      }

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
    let hadEscape = false;
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
        hadEscape = true;
      } else if (ball.y + ball.radius < 0) {
        // Breached Blue (top) defense
        this.handleBallEscape(ball, "orange");
        hadEscape = true;
      } else {
        this.renderBall(ball);
      }
    }

    // Only rebuild the array when a ball was actually lost this frame.
    if (hadEscape) {
      this.balls = this.balls.filter((b) => b.active);
    }
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

          // 3. Play destruction sound effect
          this.playTileBreakSound();

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
    let hadPickup = false;
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
        hadPickup = true;
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
        hadPickup = true;
        continue;
      }

      // Despawn off bounds
      if (p.y < 0 || p.y > GAME_HEIGHT) {
        p.active = false;
        p.graphics.destroy();
        hadPickup = true;
      } else {
        this.renderPowerUp(p);
      }
    }

    // Only rebuild the array when a power-up was consumed or despawned this frame.
    if (hadPickup) {
      this.powerUps = this.powerUps.filter((p) => p.active);
    }
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

      if (this.mode === "online") {
        this.onlineConfig?.sendGameEvent?.("game_over", {
          winner: winnerIfLast,
          score: this.score,
        });
      }

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

    if (this.mode === "online") {
      this.onlineConfig?.sendGameEvent?.("level_complete", {
        level: this.currentLevel + 1,
        score: this.score,
      });
    }

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
    mode?: "1v1" | "vs-bot" | "online",
    difficulty?: "easy" | "medium" | "hard",
    online?: OnlineNetworkingCallbacks,
    botPaddle?: PlatformPlayer
  ) {
    this.clearAllGameObjects();
    this.botController?.reset(GAME_WIDTH / 2);
    this.init({
      startingPlayer: startingPlayer || this.currentStarter,
      callbacks: this.callbacks,
      mode: mode || this.mode,
      difficulty: difficulty || this.difficulty,
      botPaddle: botPaddle || this.botPaddle,
      online: online || (this.onlineConfig ?? undefined),
    });
    this.statusText?.setAlpha(0);
    if (this.orangePaddle) {
      this.orangePaddle.x = GAME_WIDTH / 2;
      this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    }
    if (this.bluePaddle) {
      this.bluePaddle.x = GAME_WIDTH / 2;
      this.renderPaddle(this.bluePaddle, COLOR_BLUE);
    }
    this.buildCurrentLevel();
    this.serveBall(this.currentStarter);
    this.callbacks.onLifecycleChange?.("playing");
    this.callbacks.onScoreUpdate?.(0);
    this.callbacks.onLevelChange?.(1);
  }

  private sendOnlinePaddlePosition(x: number) {
    if (this.mode !== "online" || !this.onlineConfig?.sendInput) return;
    const now = performance.now();
    // Throttle to at most 1 update per 50ms (20 updates/sec max) and only if movement is noticeable (> 3px)
    if (now - this.lastPointerSendTime >= 50 && Math.abs(x - this.lastSentPointerX) >= 3) {
      this.lastPointerSendTime = now;
      this.lastSentPointerX = x;
      this.onlineConfig.sendInput("paddle.position", { x });
    }
  }

  public pauseGame() {
    this.isPaused = true;
    if (this.statusText) {
      this.statusText.setText("PAUSED").setAlpha(1);
    }
    this.callbacks.onLifecycleChange?.("paused");
  }

  public resumeGame() {
    this.isPaused = false;
    if (this.statusText) {
      this.statusText.setAlpha(0);
    }
    this.callbacks.onLifecycleChange?.("playing");
  }

  private playTileBreakSound() {
    const now = performance.now();
    // Throttle closely-spaced events (< 25ms) to handle multiple brick breaks efficiently without distortion
    if (now - this.lastTileBreakSoundTime < 25) {
      return;
    }
    this.lastTileBreakSoundTime = now;

    if (this.tileBreakSound) {
      this.tileBreakSound.play();
    } else {
      soundManager.play("tileBreak");
    }
  }

  public handleRemoteInput(data: {
    input: string;
    data?: unknown;
    playerRole?: string;
    playerId?: string;
  }) {
    if (this.mode !== "online") return;

    // Reject self input echo
    if (data.playerRole && data.playerRole === this.myRole) return;
    if (this.myPlayerId && data.playerId && data.playerId === this.myPlayerId) return;

    // Only apply if the input corresponds to the expected opponent role
    const expectedOpponentRole = this.myRole === "orange" ? "blue" : "orange";
    if (data.playerRole && data.playerRole !== expectedOpponentRole) return;

    if (data.input === "paddle.left") {
      this.opponentMoveIntent = -1;
      this.opponentTargetX = null;
    } else if (data.input === "paddle.right") {
      this.opponentMoveIntent = 1;
      this.opponentTargetX = null;
    } else if (data.input === "paddle.stop") {
      this.opponentMoveIntent = 0;
    } else if (
      data.input === "paddle.position" &&
      data.data &&
      typeof (data.data as Record<string, unknown>).x === "number"
    ) {
      this.opponentTargetX = (data.data as { x: number }).x;
    }
  }

  public handleRemoteEvent(data: { event: string; data?: unknown }) {
    if (this.mode !== "online") return;
    if (data.event === "game_over" && !this.isGameOver) {
      this.isGameOver = true;
      const d = data.data as { winner?: PlatformPlayer; score?: number } | undefined;
      const winner = d?.winner ?? "orange";
      this.showFloatingNotice(`Game Over • ${winner === "orange" ? "Orange" : "Blue"} Wins!`);
      this.callbacks.onGameOver?.({
        winner,
        score: d?.score ?? this.score,
        details: {
          level: this.currentLevel,
          finalScore: d?.score ?? this.score,
        },
      });
      this.callbacks.onLifecycleChange?.("finished");
    }
  }



  public shutdown() {
    this.removeCanvasPointerListeners();
    this.botController?.reset();
    this.botController = null;
    this.clearAllGameObjects();
    this.orangePaddle?.graphics?.destroy();
    this.bluePaddle?.graphics?.destroy();
    this.statusText?.destroy();

    // Clean up audio resources on scene shutdown / destruction
    if (this.tileBreakSound) {
      this.tileBreakSound.destroy();
      this.tileBreakSound = null;
    }
  }
}
