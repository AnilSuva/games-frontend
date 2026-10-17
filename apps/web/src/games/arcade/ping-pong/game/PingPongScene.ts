import Phaser from "phaser";
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
  TOP_PADDLE_Y,
  BOTTOM_PADDLE_Y,
  PADDLE_FACE_RADIUS,
  HANDLE_WIDTH,
  HANDLE_HEIGHT,
  PADDLE_STROKE_WIDTH,
  PADDLE_KEYBOARD_SPEED,
  BALL_RADIUS,
  BALL_STROKE_WIDTH,
  INITIAL_BALL_SPEED,
  MIN_BALL_SPEED,
  MAX_BALL_SPEED,
  SPEED_INCREMENT,
  WINNING_SCORE,
  SWIPE_SAMPLING_TIME,
  MAX_DEFLECTION_ANGLE,
  SWIPE_VELOCITY_INFLUENCE,
  SMASH_FORWARD_THRESHOLD,
  SMASH_BOOST,
  Z_ARC_HEIGHT,
  COLOR_BG,
  COLOR_TABLE,
  COLOR_STROKE,
  COLOR_NET,
  COLOR_ORANGE,
  COLOR_BLUE,
  COLOR_HANDLE,
  COLOR_BALL,
} from "../config/constants";
import type {
  Ball,
  BallSyncPayload,
  BounceRipple,
  OnlineNetworkingCallbacks,
  Paddle,
  PingPongCallbacks,
  PingPongScore,
  SceneInitData,
} from "./types";
import type { PlatformPlayer } from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import { PingPongBotController } from "./botController";

export class PingPongScene extends Phaser.Scene {
  private callbacks!: PingPongCallbacks;
  private mode: "1v1" | "vs-bot" | "online" = "1v1";
  private difficulty: "easy" | "medium" | "hard" = "medium";
  private localPlayerRole: PlatformPlayer = "orange";
  private isHost: boolean = true;
  private onlineConfig: OnlineNetworkingCallbacks | null = null;

  // Paddles (Rackets)
  private orangePaddle!: Paddle;
  private bluePaddle!: Paddle;

  // Ball & Particle Systems
  private ball!: Ball;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ripples: BounceRipple[] = [];
  private botController: PingPongBotController | null = null;

  // Match state & Shot rules (Host = Orange, Guest = Blue)
  public hostScore: number = 0;
  public guestScore: number = 0;
  private scores: PingPongScore = { orange: 0, blue: 0, host: 0, guest: 0 };
  private isPaused = false;
  private isGameOver = false;
  private isServing = false;
  private lastHitBy: PlatformPlayer = "orange";
  private hasBouncedOnReceiverSide = false;

  // Networking state
  private lastSyncTime = 0;
  private lastBounceSyncTime = 0;
  private lastSentPointerX = 0;
  private lastPointerSendTime = 0;
  private opponentTargetX: number | null = null;

  // Touch & Pointer handling
  private activePointers = new Map<number, "orange" | "blue">();
  private onCanvasPointerDown?: (e: PointerEvent) => void;
  private onCanvasPointerMove?: (e: PointerEvent) => void;
  private onCanvasPointerUp?: (e: PointerEvent) => void;
  private onWindowPointerUp?: (e: PointerEvent) => void;
  private onWindowReset?: () => void;

  // Keyboard controls (Desktop)
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // Visual text overlay
  private statusText!: Phaser.GameObjects.Text;

  public get isFlippedPerspective(): boolean {
    return this.mode === "online" && this.localPlayerRole === "blue";
  }

  constructor() {
    super({ key: "PingPongScene" });
  }

  preload() {
    soundManager.preloadPhaser(this, "dropBall");
  }

  init(data: SceneInitData) {
    this.callbacks = data.callbacks || {};
    this.mode = data.mode || "1v1";
    this.difficulty = data.difficulty || "medium";
    this.onlineConfig = data.online || null;
    this.localPlayerRole = data.online?.myRole || data.localPlayerRole || "orange";
    this.isHost =
      this.mode !== "online" ||
      (data.isHost ?? data.online?.isHost ?? (this.localPlayerRole === "orange"));

    this.hostScore = 0;
    this.guestScore = 0;
    this.scores = { orange: 0, blue: 0, host: 0, guest: 0 };

    // Register React bridge callbacks into Phaser Game Registry
    if (data.onScoreChange) {
      this.registry.set("onScoreChange", data.onScoreChange);
    }
    if (data.onGameOver) {
      this.registry.set("onGameOver", data.onGameOver);
    }
    if (data.callbacks?.onScoreChange) {
      this.registry.set("onScoreChange", data.callbacks.onScoreChange);
    }
    if (data.callbacks?.onGameOver) {
      this.registry.set("onGameOver", data.callbacks.onGameOver);
    }

    this.isPaused = false;
    this.isGameOver = false;
    this.isServing = false;
    this.lastHitBy = "orange";
    this.hasBouncedOnReceiverSide = false;

    this.lastSyncTime = 0;
    this.lastBounceSyncTime = 0;
    this.lastSentPointerX = 0;
    this.lastPointerSendTime = 0;
    this.opponentTargetX = null;

    this.botController =
      this.mode === "vs-bot"
        ? new PingPongBotController({ difficulty: this.difficulty })
        : null;

    this.activePointers.clear();
  }

  create() {
    // 1. Perspective normalization
    if (this.isFlippedPerspective) {
      this.cameras.main.setRotation(Math.PI);
    } else {
      this.cameras.main.setRotation(0);
    }

    // 2. Render Minimalist Bold Table & Court (360x580 scale)
    this.createTableCourt();

    // 3. Create Circular Rackets with Drop Shadows
    this.orangePaddle = this.createPaddle("orange", BOTTOM_PADDLE_Y, COLOR_ORANGE);
    this.bluePaddle = this.createPaddle("blue", TOP_PADDLE_Y, COLOR_BLUE);

    // 4. Initialize Procedural Particle Textures & Emitters
    this.initProceduralTextures();
    this.createParticleSystems();

    // 5. Create Ball & Drop Shadow
    this.createBall();

    // 6. Floating match status announcement text
    this.statusText = this.add
      .text(GAME_WIDTH / 2, NET_Y, "", {
        fontFamily: "Inter, Roboto, sans-serif",
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "#1c1917f0",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(40);

    if (this.isFlippedPerspective) {
      this.statusText.setRotation(Math.PI);
    } else {
      this.statusText.setRotation(0);
    }

    // 7. Setup Desktop Keyboard
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }

    // 8. Setup Standards-based Multi-Touch Pointer Listeners
    this.setupCanvasPointerListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // 9. Serve initial ball if Host/Local
    if (this.isHost) {
      this.serveBall("orange");
    }
  }

  /**
   * Initializes procedural textures for particle emitters:
   * - "ball_trail_particle": smooth white circle for comet tail
   * - "spark_particle": glowing spark circle for impact sparks
   */
  private initProceduralTextures() {
    if (!this.textures.exists("ball_trail_particle")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture("ball_trail_particle", 32, 32);
      g.destroy();
    }

    if (!this.textures.exists("spark_particle")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xfff3a1, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture("spark_particle", 16, 16);
      g.destroy();
    }
  }

  /**
   * Creates the Comet Tail ParticleEmitter and Impact Spark ParticleEmitter
   */
  private createParticleSystems() {
    // 1. High-end Comet Tail Particle Emitter
    this.trailEmitter = this.add.particles(0, 0, "ball_trail_particle", {
      speed: { min: 4, max: 28 },
      scale: { start: 0.85, end: 0.05 },
      alpha: { start: 0.65, end: 0 },
      lifespan: { min: 180, max: 400 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.trailEmitter.setDepth(22);

    // 2. Fast-fading Impact Sparks Emitter
    this.sparkEmitter = this.add.particles(0, 0, "spark_particle", {
      speed: { min: 150, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 140, max: 280 },
      gravityY: 80,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.sparkEmitter.setDepth(32);
  }

  /**
   * Renders the bold minimalist court:
   * - Soft yellow/tan outer floor (#f4d07b)
   * - Table drop shadow
   * - Vibrant green table (#7ac84c) with thick 7px bold black perimeter stroke
   * - Crisp white net with 4px black borders and side posts
   * - Subtle white dashed centerline
   */
  private createTableCourt() {
    const bgGraphics = this.add.graphics().setDepth(0);

    // Outer floor surrounding the table (Soft yellow/tan)
    bgGraphics.fillStyle(COLOR_BG, 1);
    bgGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Table drop shadow (minimalist dark silhouette)
    bgGraphics.fillStyle(0x000000, 0.14);
    bgGraphics.fillRect(
      TABLE_MARGIN_X + 8,
      TABLE_MARGIN_Y + 10,
      TABLE_WIDTH,
      TABLE_HEIGHT
    );

    // Solid vibrant green table surface
    bgGraphics.fillStyle(COLOR_TABLE, 1);
    bgGraphics.fillRect(
      TABLE_MARGIN_X,
      TABLE_MARGIN_Y,
      TABLE_WIDTH,
      TABLE_HEIGHT
    );

    // Very thick, bold black stroke around the entire table perimeter
    bgGraphics.lineStyle(TABLE_STROKE_WIDTH, COLOR_STROKE, 1);
    bgGraphics.strokeRect(
      TABLE_MARGIN_X,
      TABLE_MARGIN_Y,
      TABLE_WIDTH,
      TABLE_HEIGHT
    );

    // Table Centerline (Vertical dashed white line dividing service courts)
    bgGraphics.lineStyle(2, 0xffffff, 0.65);
    const tableCenterX = GAME_WIDTH / 2;
    for (let y = TABLE_MARGIN_Y + 8; y < TABLE_MARGIN_Y + TABLE_HEIGHT - 8; y += 16) {
      bgGraphics.lineBetween(tableCenterX, y, tableCenterX, y + 9);
    }

    // The Net: Thick white line with bold black border spanning horizontally across center
    const netGraphics = this.add.graphics().setDepth(15);

    // Net side brackets / posts extending beyond the table
    netGraphics.fillStyle(0x000000, 1);
    netGraphics.fillRect(TABLE_MARGIN_X - 8, NET_Y - 6, 8, 12);
    netGraphics.fillRect(TABLE_MARGIN_X + TABLE_WIDTH, NET_Y - 6, 8, 12);

    // White net bar
    netGraphics.fillStyle(COLOR_NET, 1);
    netGraphics.fillRect(
      TABLE_MARGIN_X,
      NET_Y - NET_HEIGHT / 2,
      TABLE_WIDTH,
      NET_HEIGHT
    );

    // Bold black border on the net
    netGraphics.lineStyle(NET_STROKE_WIDTH, COLOR_STROKE, 1);
    netGraphics.strokeRect(
      TABLE_MARGIN_X,
      NET_Y - NET_HEIGHT / 2,
      TABLE_WIDTH,
      NET_HEIGHT
    );
  }

  /**
   * Creates a racket consisting of a circular paddle face (radius >= 35px)
   * with a protruding handle and semi-transparent drop shadow.
   */
  private createPaddle(player: PlatformPlayer, y: number, color: number): Paddle {
    const shadowGraphics = this.add.graphics().setDepth(18);
    const graphics = this.add.graphics().setDepth(24);

    const paddle: Paddle = {
      player,
      x: GAME_WIDTH / 2,
      y,
      prevX: GAME_WIDTH / 2,
      prevY: y,
      vx: 0,
      vy: 0,
      faceRadius: PADDLE_FACE_RADIUS,
      handleWidth: HANDLE_WIDTH,
      handleHeight: HANDLE_HEIGHT,
      graphics,
      shadowGraphics,
      history: [],
    };
    this.renderPaddle(paddle, color);
    return paddle;
  }

  private renderPaddle(paddle: Paddle, color: number) {
    paddle.graphics.clear();
    paddle.shadowGraphics.clear();

    const isOrange = paddle.player === "orange";
    const faceR = paddle.faceRadius;
    const handleW = paddle.handleWidth;
    const handleH = paddle.handleHeight;

    // Handle position:
    // Orange (bottom): handle protrudes DOWNWARDS towards bottom edge
    // Blue (top): handle protrudes UPWARDS towards top edge
    const handleY = isOrange ? paddle.y + faceR - 8 : paddle.y - faceR - handleH + 8;

    // 1. Subtle, semi-transparent black drop shadow beneath the racket
    const shadowOffsetX = 6;
    const shadowOffsetY = 8;
    paddle.shadowGraphics.fillStyle(0x000000, 0.18);
    paddle.shadowGraphics.fillRoundedRect(
      paddle.x - handleW / 2 + shadowOffsetX,
      handleY + shadowOffsetY,
      handleW,
      handleH,
      4
    );
    paddle.shadowGraphics.fillCircle(
      paddle.x + shadowOffsetX,
      paddle.y + shadowOffsetY,
      faceR
    );

    // 2. Draw Handle with bold black outline
    paddle.graphics.fillStyle(COLOR_HANDLE, 1);
    paddle.graphics.fillRoundedRect(paddle.x - handleW / 2, handleY, handleW, handleH, 4);
    paddle.graphics.lineStyle(PADDLE_STROKE_WIDTH, COLOR_STROKE, 1);
    paddle.graphics.strokeRoundedRect(paddle.x - handleW / 2, handleY, handleW, handleH, 4);

    // 3. Draw Circular Paddle Face with bold 6px black outline
    paddle.graphics.fillStyle(color, 1);
    paddle.graphics.fillCircle(paddle.x, paddle.y, faceR);
    paddle.graphics.lineStyle(PADDLE_STROKE_WIDTH, COLOR_STROKE, 1);
    paddle.graphics.strokeCircle(paddle.x, paddle.y, faceR);

    // 4. Clean vector highlight on the rubber face
    paddle.graphics.fillStyle(0xffffff, 0.22);
    paddle.graphics.fillCircle(paddle.x - faceR * 0.32, paddle.y - faceR * 0.32, faceR * 0.35);
  }

  private createBall() {
    const shadowGraphics = this.add.graphics().setDepth(20);
    const graphics = this.add.graphics().setDepth(26);

    this.ball = {
      x: GAME_WIDTH / 2,
      y: NET_Y,
      vx: 0,
      vy: 0,
      spin: 0,
      zHeight: 0,
      zPhase: "paddle_to_bounce",
      startY: NET_Y,
      targetBounceY: NET_Y + 110,
      targetPaddleY: BOTTOM_PADDLE_Y,
      trailLength: 0,
      active: false,
      isHardDirectHit: false,
      graphics,
      shadowGraphics,
    };
  }

  private serveBall(server: PlatformPlayer) {
    if (!this.isHost) return;

    this.isServing = true;
    const isOrangeServer = server === "orange";
    const startX = GAME_WIDTH / 2 + (Math.random() - 0.5) * 36;
    const startY = isOrangeServer ? BOTTOM_PADDLE_Y - 42 : TOP_PADDLE_Y + 42;

    this.ball.x = startX;
    this.ball.y = startY;
    this.ball.spin = 0;
    this.ball.zHeight = 0;
    this.ball.zPhase = "paddle_to_bounce";
    this.ball.startY = startY;
    this.ball.targetBounceY = isOrangeServer ? (NET_Y - 95) : (NET_Y + 95);
    this.ball.targetPaddleY = isOrangeServer ? TOP_PADDLE_Y : BOTTOM_PADDLE_Y;
    this.ball.trailLength = 0;
    this.ball.active = true;
    this.ball.isHardDirectHit = false;

    this.lastHitBy = server;
    this.hasBouncedOnReceiverSide = false;

    // Launch speed towards opponent with subtle angle
    const dirY = isOrangeServer ? -1 : 1;
    const angleOffset = (Math.random() - 0.5) * 0.22;
    this.ball.vx = INITIAL_BALL_SPEED * Math.sin(angleOffset);
    this.ball.vy = dirY * INITIAL_BALL_SPEED * Math.cos(angleOffset);

    this.isServing = false;

    if (this.mode === "online" && this.isHost) {
      this.sendBallSyncImmediate();
    }
  }

  private triggerBounceRipple(x: number, y: number) {
    const graphics = this.add.graphics().setDepth(17);
    const ripple: BounceRipple = {
      x,
      y,
      radius: BALL_RADIUS,
      maxRadius: BALL_RADIUS * 3.4,
      alpha: 0.85,
      graphics,
    };
    this.ripples.push(ripple);

    try {
      soundManager.play("dropBall");
    } catch {
      // Audio fallback
    }
  }

  /**
   * Triggers a burst of fast-fading particle sparks at impact coordinates
   */
  private triggerImpactSparks(x: number, y: number, intensity: number) {
    const count = Math.round(Phaser.Math.Clamp(10 + intensity * 14, 8, 24));
    this.sparkEmitter.explode(count, x, y);
  }

  update(_time: number, delta: number) {
    if (this.isPaused || this.isGameOver) return;

    const dt = Math.min(delta / 1000, 0.05);

    // 1. Update Paddles
    this.updatePaddles(dt);

    // 2. Physics & Ball Update (Host or Local)
    if (this.isHost) {
      this.updateHostBallPhysics(dt);
    } else {
      this.updateGuestBallDeadReckoning(dt);
    }

    // 3. Render Visual Ball, Dynamic Drop Shadow & Comet Tail
    this.renderBallVisuals();

    // 4. Update Ripple Animations
    this.updateRipples(dt);

    // 5. Host-Authoritative Sync Throttling (100ms / 10Hz)
    if (this.mode === "online" && this.isHost && this.ball.active) {
      const now = performance.now();
      if (now - this.lastSyncTime >= 100) {
        this.lastSyncTime = now;
        this.sendBallSyncImmediate();
      }
    }
  }

  private updatePaddles(dt: number) {
    const minX = TABLE_MARGIN_X + PADDLE_FACE_RADIUS;
    const maxX = TABLE_MARGIN_X + TABLE_WIDTH - PADDLE_FACE_RADIUS;

    // Save previous position for 2D velocity calculation
    this.orangePaddle.prevX = this.orangePaddle.x;
    this.orangePaddle.prevY = this.orangePaddle.y;
    this.bluePaddle.prevX = this.bluePaddle.x;
    this.bluePaddle.prevY = this.bluePaddle.y;

    // Desktop Keyboard Controls (Local 1v1 / vs-bot)
    if (this.cursors && this.input.keyboard) {
      if (this.mode === "1v1" || this.mode === "vs-bot") {
        if (this.cursors.left.isDown) {
          this.orangePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
        } else if (this.cursors.right.isDown) {
          this.orangePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
        }
      }

      if (this.mode === "1v1" && this.keyA && this.keyD) {
        if (this.keyA.isDown) {
          this.bluePaddle.x -= PADDLE_KEYBOARD_SPEED * dt;
        } else if (this.keyD.isDown) {
          this.bluePaddle.x += PADDLE_KEYBOARD_SPEED * dt;
        }
      }
    }

    // Bot AI update in vs-bot mode
    if (this.mode === "vs-bot" && this.botController) {
      this.bluePaddle.x = this.botController.update(
        dt,
        this.ball.active ? this.ball : null,
        PADDLE_FACE_RADIUS * 2
      );
    }

    // Online opponent interpolation
    if (this.mode === "online" && this.opponentTargetX !== null) {
      const opponentPaddle = this.localPlayerRole === "orange" ? this.bluePaddle : this.orangePaddle;
      opponentPaddle.x = Phaser.Math.Linear(opponentPaddle.x, this.opponentTargetX, 0.4);
    }

    // Clamp paddle positions within table sidelines
    this.orangePaddle.x = Phaser.Math.Clamp(this.orangePaddle.x, minX, maxX);
    this.bluePaddle.x = Phaser.Math.Clamp(this.bluePaddle.x, minX, maxX);

    // Compute paddle velocity using 200ms sample window (secondiSuCuiFareIlSampling from base.apk)
    const now = performance.now();
    const sampleWindowMs = SWIPE_SAMPLING_TIME * 1000;

    this.updatePaddleVelocity(this.orangePaddle, now, sampleWindowMs, dt);
    this.updatePaddleVelocity(this.bluePaddle, now, sampleWindowMs, dt);

    // Render updated circular rackets with drop shadows
    this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    this.renderPaddle(this.bluePaddle, COLOR_BLUE);
  }

  private updatePaddleVelocity(
    paddle: Paddle,
    now: number,
    sampleWindowMs: number,
    dt: number
  ) {
    if (!paddle.history) paddle.history = [];
    paddle.history.push({ x: paddle.x, y: paddle.y, time: now });

    while (
      paddle.history.length > 2 &&
      now - paddle.history[0].time > sampleWindowMs
    ) {
      paddle.history.shift();
    }

    if (paddle.history.length >= 2) {
      const oldest = paddle.history[0];
      const elapsed = Math.max(0.016, (now - oldest.time) / 1000);
      paddle.vx = (paddle.x - oldest.x) / elapsed;
      paddle.vy = (paddle.y - oldest.y) / elapsed;
    } else {
      paddle.vx = (paddle.x - paddle.prevX) / dt;
      paddle.vy = (paddle.y - paddle.prevY) / dt;
    }
  }

  private updateHostBallPhysics(dt: number) {
    if (!this.ball.active) return;

    // 1. Move Ball (Direct physical flight without fake Magnus curvature or linear drag decay)
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // 2. Clean Parabolic Z-Axis Arc & Table Landing Check
    this.updateZAxisArc();

    // 3. Authentic Paddle Deflection & Contact Resolution
    this.checkPaddleCollisions();

    // 4. Out of Bounds & Table Tennis Scoring Check
    this.checkOutOfBounds();
  }

  private updateZAxisArc() {
    if (!this.ball.active) return;

    if (this.ball.zPhase === "paddle_to_bounce") {
      const totalDist = Math.abs(this.ball.targetBounceY - this.ball.startY);
      const traveled = Math.abs(this.ball.y - this.ball.startY);
      const progress =
        totalDist > 0 ? Phaser.Math.Clamp(traveled / totalDist, 0, 1) : 1;

      // Clean parabolic arc: 4 * h_max * p * (1 - p)
      this.ball.zHeight = 4 * Z_ARC_HEIGHT * progress * (1 - progress);

      // Check if ball has arrived at the bounce plane
      const passedBouncePoint =
        (this.ball.vy > 0 && this.ball.y >= this.ball.targetBounceY) ||
        (this.ball.vy < 0 && this.ball.y <= this.ball.targetBounceY);

      if (passedBouncePoint) {
        // Check if ball landed legally on receiver's table half
        const isWithinTableX =
          this.ball.x >= TABLE_MARGIN_X &&
          this.ball.x <= TABLE_MARGIN_X + TABLE_WIDTH;
        const isWithinTableY =
          this.ball.y >= TABLE_MARGIN_Y &&
          this.ball.y <= TABLE_MARGIN_Y + TABLE_HEIGHT;

        if (isWithinTableX && isWithinTableY) {
          const isReceiverHalf =
            (this.lastHitBy === "orange" && this.ball.y < NET_Y) ||
            (this.lastHitBy === "blue" && this.ball.y > NET_Y);

          if (isReceiverHalf) {
            this.hasBouncedOnReceiverSide = true;
          }

          // Table surface strike: trigger ripple, reset height, start upward bounce arc
          this.ball.zHeight = 0;
          this.triggerBounceRipple(this.ball.x, this.ball.y);
          this.ball.zPhase = "bounce_to_paddle";
          this.ball.startY = this.ball.targetBounceY;
        }
      }
    } else {
      // Phase 2: Arcing upwards from table bounce towards receiver's paddle
      const totalDist = Math.abs(this.ball.targetPaddleY - this.ball.startY);
      const traveled = Math.abs(this.ball.y - this.ball.startY);
      const progress =
        totalDist > 0 ? Phaser.Math.Clamp(traveled / totalDist, 0, 1) : 1;

      // Parabolic upward arc on bounce towards receiver paddle
      this.ball.zHeight =
        4 * (Z_ARC_HEIGHT * 0.7) * progress * (1 - progress * 0.5);
    }
  }

  /**
   * Authentic Paddle Collision Resolution:
   * Direct deflection angle based on contact position and swipe gesture.
   */
  private checkPaddleCollisions() {
    // Orange Racket (Bottom) - Only hit when ball travels downward towards Orange
    if (this.ball.vy > 0) {
      this.testPaddleCollision(this.orangePaddle, -1);
    }

    // Blue Racket (Top) - Only hit when ball travels upward towards Blue
    if (this.ball.vy < 0) {
      this.testPaddleCollision(this.bluePaddle, 1);
    }
  }

  private testPaddleCollision(paddle: Paddle, newDirY: number) {
    const dx = this.ball.x - paddle.x;
    const dy = this.ball.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const contactDistance = paddle.faceRadius + BALL_RADIUS;

    if (dist <= contactDistance) {
      // 1. Relative contact position on paddle face: normalized to [-1, 1]
      const relativeX = Phaser.Math.Clamp(dx / paddle.faceRadius, -1, 1);

      // 2. Base incoming speed & forward smash velocity transfer
      const incomingSpeed = Math.hypot(this.ball.vx, this.ball.vy);
      let nextSpeed = Math.max(MIN_BALL_SPEED, incomingSpeed * SPEED_INCREMENT);

      // Forward swipe velocity:
      // For Orange (bottom): forward is swiping UP towards net (-vy)
      // For Blue (top): forward is swiping DOWN towards net (+vy)
      const forwardVelocity = newDirY < 0 ? -paddle.vy : paddle.vy;
      const isForwardSmash = forwardVelocity > SMASH_FORWARD_THRESHOLD;

      if (isForwardSmash) {
        const smashRatio = Phaser.Math.Clamp(
          (forwardVelocity - SMASH_FORWARD_THRESHOLD) / 300,
          0,
          1
        );
        nextSpeed += smashRatio * SMASH_BOOST;

        // Visual impact feedback for hard forward strikes
        this.cameras.main.shake(80, 0.008);
        this.triggerImpactSparks(this.ball.x, this.ball.y, 0.9);
      } else if (nextSpeed > 620) {
        this.triggerImpactSparks(this.ball.x, this.ball.y, 0.4);
      }

      nextSpeed = Phaser.Math.Clamp(nextSpeed, MIN_BALL_SPEED, MAX_BALL_SPEED);

      // 3. Authentic Deflection Angle (No artificial center deadzone!)
      // Contact position directly deflects the ball:
      // left side -> left (-X), right side -> right (+X), center -> straight
      const baseAngle = relativeX * MAX_DEFLECTION_ANGLE;
      const swipeAngleShift =
        Phaser.Math.Clamp(paddle.vx / 1000, -0.3, 0.3) * SWIPE_VELOCITY_INFLUENCE;
      const finalAngle = Phaser.Math.Clamp(
        baseAngle + swipeAngleShift,
        -0.82,
        0.82
      );

      // Derive velocity components maintaining nextSpeed magnitude
      this.ball.vx = nextSpeed * Math.sin(finalAngle);
      this.ball.vy = newDirY * nextSpeed * Math.cos(finalAngle);
      this.ball.spin = 0;

      // Play hit audio
      try {
        soundManager.play("dropBall");
      } catch {
        // Audio fallback
      }

      // Reset shot state
      this.lastHitBy = paddle.player;
      this.hasBouncedOnReceiverSide = false;
      this.ball.zPhase = "paddle_to_bounce";
      this.ball.startY = paddle.y;
      this.ball.targetBounceY = newDirY < 0 ? (NET_Y - 95) : (NET_Y + 95);
      this.ball.targetPaddleY = newDirY < 0 ? TOP_PADDLE_Y : BOTTOM_PADDLE_Y;

      // Immediate bounce sync packet on Host
      if (this.mode === "online" && this.isHost) {
        const now = performance.now();
        if (now - this.lastBounceSyncTime >= 50) {
          this.lastBounceSyncTime = now;
          this.sendBallSyncImmediate();
        }
      }
    }
  }

  /**
   * Out of Bounds & Table Tennis Scoring:
   * If the ball leaves table boundaries without returning, it is OUT.
   * - If the ball already bounced on receiver's half, receiver failed to return -> hitter scores!
   * - If the ball did NOT bounce on receiver's half, hitter hit it out -> receiver scores!
   */
  private checkOutOfBounds() {
    const tableLeft = TABLE_MARGIN_X;
    const tableRight = TABLE_MARGIN_X + TABLE_WIDTH;
    const tableTop = TABLE_MARGIN_Y;
    const tableBottom = TABLE_MARGIN_Y + TABLE_HEIGHT;

    const isOutLeft = this.ball.x < tableLeft - 10;
    const isOutRight = this.ball.x > tableRight + 10;
    const isOutTop = this.ball.y < tableTop - 22;
    const isOutBottom = this.ball.y > tableBottom + 22;

    if (isOutLeft || isOutRight || isOutTop || isOutBottom) {
      let scorer: PlatformPlayer;
      const receiver: PlatformPlayer = this.lastHitBy === "orange" ? "blue" : "orange";

      if (this.hasBouncedOnReceiverSide) {
        // Hitter successfully landed the ball on the receiver's court; receiver missed
        scorer = this.lastHitBy;
      } else {
        // Hitter hit the ball directly out of bounds
        scorer = receiver;
      }

      this.handlePointScored(scorer);
    }
  }

  private handlePointScored(scorer: PlatformPlayer) {
    this.ball.active = false;

    // Increment internal scene scores (Host = Orange, Guest = Blue)
    if (scorer === "orange") {
      this.hostScore++;
    } else {
      this.guestScore++;
    }
    this.scores.orange = this.hostScore;
    this.scores.blue = this.guestScore;
    this.scores.host = this.hostScore;
    this.scores.guest = this.guestScore;

    // IMMEDIATELY notify React DOM UI via registry callback
    const registryScoreChange = this.registry.get("onScoreChange") as
      | ((hostScore: number, guestScore: number) => void)
      | undefined;
    if (typeof registryScoreChange === "function") {
      registryScoreChange(this.hostScore, this.guestScore);
    }
    this.callbacks.onScoreChange?.(this.hostScore, this.guestScore);
    this.callbacks.onScoresChange?.(this.scores);
    this.callbacks.onScoreUpdate?.(this.hostScore);

    if (this.mode === "online" && this.isHost) {
      this.onlineConfig?.sendGameEvent?.("score_update", {
        scores: this.scores,
        scorer,
      });
    }

    // Check Win Condition: First to WINNING_SCORE (5) points
    if (this.hostScore >= WINNING_SCORE || this.guestScore >= WINNING_SCORE) {
      const winner: PlatformPlayer = this.hostScore >= WINNING_SCORE ? "orange" : "blue";
      this.handleMatchWon(winner);
      return;
    }

    // Show floating score notice
    this.showFloatingNotice(
      `Point ${scorer === "orange" ? "Orange" : "Blue"}! • ${this.hostScore} - ${this.guestScore}`
    );

    // Reset ball to center and serve toward the player who conceded the point
    this.time.delayedCall(1100, () => {
      if (!this.isGameOver) {
        this.serveBall(scorer === "orange" ? "blue" : "orange");
      }
    });
  }

  private handleMatchWon(winner: PlatformPlayer) {
    this.isGameOver = true;
    this.ball.active = false;

    this.showFloatingNotice(
      `Match Point! ${winner === "orange" ? "Orange" : "Blue"} Wins ${this.hostScore} - ${this.guestScore}`
    );

    if (this.mode === "online" && this.isHost) {
      this.onlineConfig?.sendGameEvent?.("game_over", {
        winner,
        scores: this.scores,
      });
    }

    const finalResult = {
      winner,
      score: winner === "orange" ? this.hostScore : this.guestScore,
    };

    // IMMEDIATELY trigger end-game modal via registry callback
    const registryGameOver = this.registry.get("onGameOver") as
      | ((result: { winner: PlatformPlayer; score: number }) => void)
      | undefined;
    if (typeof registryGameOver === "function") {
      registryGameOver(finalResult);
    }
    this.callbacks.onGameOver?.(finalResult);
    this.callbacks.onLifecycleChange?.("finished");
  }

  private updateGuestBallDeadReckoning(dt: number) {
    if (!this.ball.active) return;

    // Apply Dead Reckoning velocity
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Smooth position interpolation toward host packet
    if (this.ball.targetX !== undefined && this.ball.targetY !== undefined) {
      this.ball.x = Phaser.Math.Linear(this.ball.x, this.ball.targetX, 0.25);
      this.ball.y = Phaser.Math.Linear(this.ball.y, this.ball.targetY, 0.25);
    }

    this.updateZAxisArc();
  }

  /**
   * Renders:
   * 1. Dynamic Drop Shadow: Distances and fades as zHeight increases (3D depth illusion).
   * 2. Scaled Ball Body: Radius >= 12px with bold 6px black outline.
   * 3. High-End Particle Comet Tail: Lengthens dynamically with velocity.
   */
  private renderBallVisuals() {
    this.ball.graphics.clear();
    this.ball.shadowGraphics.clear();

    if (!this.ball.active) return;

    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    const speedRatio = Phaser.Math.Clamp(
      (speed - MIN_BALL_SPEED) / (MAX_BALL_SPEED - MIN_BALL_SPEED),
      0,
      1
    );

    // 1. Particle Trail System (Comet Tail)
    if (speed > 30 && this.ball.zHeight > 0.04) {
      // Dynamic lifespan lengthens the tail based on velocity
      const particleLifespan = 160 + 360 * speedRatio;
      this.trailEmitter.setParticleLifespan(particleLifespan);

      const count = speed > 520 ? 3 : speed > 340 ? 2 : 1;
      const dirX = this.ball.vx / speed;
      const dirY = this.ball.vy / speed;

      for (let i = 0; i < count; i++) {
        const offset = (i * 7) + (Math.random() - 0.5) * 3;
        this.trailEmitter.emitParticleAt(
          this.ball.x - dirX * offset,
          this.ball.y - dirY * offset,
          1
        );
      }
    }

    // 2. Dynamic Drop Shadow on Table (Airtime & 3D Depth Illusion)
    const shadowDistX = 4 + 16 * this.ball.zHeight;
    const shadowDistY = 6 + 22 * this.ball.zHeight;
    const shadowAlpha = 0.34 * (1 - 0.7 * this.ball.zHeight);
    const shadowRadius = BALL_RADIUS * (0.95 - 0.25 * this.ball.zHeight);

    this.ball.shadowGraphics.fillStyle(0x000000, shadowAlpha);
    this.ball.shadowGraphics.fillCircle(
      this.ball.x + shadowDistX,
      this.ball.y + shadowDistY,
      shadowRadius
    );

    // 3. Scaled Ball Body: White with bold 6px black outline
    const visualRadius = BALL_RADIUS * (1 + 0.42 * this.ball.zHeight);
    this.ball.graphics.fillStyle(COLOR_BALL, 1);
    this.ball.graphics.fillCircle(this.ball.x, this.ball.y, visualRadius);
    this.ball.graphics.lineStyle(BALL_STROKE_WIDTH, COLOR_STROKE, 1);
    this.ball.graphics.strokeCircle(this.ball.x, this.ball.y, visualRadius);
  }

  private updateRipples(dt: number) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += (r.maxRadius - r.radius) * Math.min(1, 14 * dt);
      r.alpha -= 4.2 * dt;

      r.graphics.clear();
      if (r.alpha <= 0.02 || r.radius >= r.maxRadius - 1) {
        r.graphics.destroy();
        this.ripples.splice(i, 1);
      } else {
        r.graphics.lineStyle(3, 0xffffff, r.alpha);
        r.graphics.strokeCircle(r.x, r.y, r.radius);
      }
    }
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
      };

      window.addEventListener("pointerup", this.onWindowPointerUp, { passive: true });
      window.addEventListener("pointercancel", this.onWindowPointerUp, { passive: true });
      window.addEventListener("resize", this.onWindowReset, { passive: true });
    }
  }

  private removeCanvasPointerListeners() {
    const canvas = this.game.canvas;
    if (canvas) {
      if (this.onCanvasPointerDown) canvas.removeEventListener("pointerdown", this.onCanvasPointerDown);
      if (this.onCanvasPointerMove) canvas.removeEventListener("pointermove", this.onCanvasPointerMove);
      if (this.onCanvasPointerUp) {
        canvas.removeEventListener("pointerup", this.onCanvasPointerUp);
        canvas.removeEventListener("pointercancel", this.onCanvasPointerUp);
      }
    }

    if (typeof window !== "undefined") {
      if (this.onWindowPointerUp) {
        window.removeEventListener("pointerup", this.onWindowPointerUp);
        window.removeEventListener("pointercancel", this.onWindowPointerUp);
      }
      if (this.onWindowReset) {
        window.removeEventListener("resize", this.onWindowReset);
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

    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    if (this.isFlippedPerspective) {
      x = GAME_WIDTH - x;
      y = GAME_HEIGHT - y;
    }

    return { x, y };
  }

  private handleNativePointerDown(e: PointerEvent) {
    const coords = this.getCanvasGameCoords(e);
    if (!coords) return;

    if (this.mode === "1v1") {
      // Local 1v1 Touch Splitting: y > NET_Y is Orange, y < NET_Y is Blue
      const assignedPaddle: "orange" | "blue" = coords.y > NET_Y ? "orange" : "blue";
      this.activePointers.set(e.pointerId, assignedPaddle);
      this.applyPointerMove(assignedPaddle, coords.x, coords.y);
    } else if (this.mode === "vs-bot") {
      this.activePointers.set(e.pointerId, "orange");
      this.applyPointerMove("orange", coords.x, coords.y);
    } else if (this.mode === "online") {
      this.activePointers.set(e.pointerId, this.localPlayerRole);
      this.applyPointerMove(this.localPlayerRole, coords.x, coords.y);
      this.sendOnlinePaddlePosition(coords.x);
    }
  }

  private handleNativePointerMove(e: PointerEvent) {
    const assignedPaddle = this.activePointers.get(e.pointerId);
    if (!assignedPaddle) return;

    const coords = this.getCanvasGameCoords(e);
    if (!coords) return;

    this.applyPointerMove(assignedPaddle, coords.x, coords.y);

    if (this.mode === "online" && assignedPaddle === this.localPlayerRole) {
      this.sendOnlinePaddlePosition(coords.x);
    }
  }

  private handleNativePointerUp(e: PointerEvent) {
    this.activePointers.delete(e.pointerId);
  }

  private applyPointerMove(player: "orange" | "blue", targetX: number, targetY?: number) {
    const minX = TABLE_MARGIN_X + PADDLE_FACE_RADIUS;
    const maxX = TABLE_MARGIN_X + TABLE_WIDTH - PADDLE_FACE_RADIUS;
    const clampedX = Phaser.Math.Clamp(targetX, minX, maxX);

    if (player === "orange") {
      this.orangePaddle.x = clampedX;
      if (typeof targetY === "number") {
        this.orangePaddle.y = Phaser.Math.Clamp(
          targetY,
          NET_Y + 36,
          TABLE_MARGIN_Y + TABLE_HEIGHT - PADDLE_FACE_RADIUS - 6
        );
      }
    } else {
      this.bluePaddle.x = clampedX;
      if (typeof targetY === "number") {
        this.bluePaddle.y = Phaser.Math.Clamp(
          targetY,
          TABLE_MARGIN_Y + PADDLE_FACE_RADIUS + 6,
          NET_Y - 36
        );
      }
    }
  }

  private sendOnlinePaddlePosition(x: number) {
    if (this.mode !== "online" || !this.onlineConfig?.sendInput) return;
    const now = performance.now();
    if (now - this.lastPointerSendTime >= 50 && Math.abs(x - this.lastSentPointerX) >= 2) {
      this.lastPointerSendTime = now;
      this.lastSentPointerX = x;
      this.onlineConfig.sendInput("paddle.position", { x });
    }
  }

  private sendBallSyncImmediate() {
    if (this.mode !== "online" || !this.isHost || !this.onlineConfig?.sendBallSync) return;
    const syncData: BallSyncPayload = {
      x: this.ball.x,
      y: this.ball.y,
      vx: this.ball.vx,
      vy: this.ball.vy,
      spin: this.ball.spin,
      zHeight: this.ball.zHeight,
      scoreOrange: this.scores.orange,
      scoreBlue: this.scores.blue,
      lastBounceAt: performance.now(),
    };
    this.onlineConfig.sendBallSync(syncData);
  }

  public handleBallSync(payload: BallSyncPayload) {
    if (this.mode !== "online" || this.isHost) return;
    if (!payload) return;

    this.ball.targetX = payload.x;
    this.ball.targetY = payload.y;

    const velDiffSq = (this.ball.vx - payload.vx) ** 2 + (this.ball.vy - payload.vy) ** 2;
    if (velDiffSq > 60) {
      this.ball.vx = payload.vx;
      this.ball.vy = payload.vy;
    }

    const distSq = (this.ball.x - payload.x) ** 2 + (this.ball.y - payload.y) ** 2;
    if (distSq > 3600) {
      this.ball.x = payload.x;
      this.ball.y = payload.y;
    }

    this.ball.spin = payload.spin;
    this.ball.zHeight = payload.zHeight;
    this.ball.active = true;

    if (payload.scoreOrange !== this.hostScore || payload.scoreBlue !== this.guestScore) {
      this.hostScore = payload.scoreOrange;
      this.guestScore = payload.scoreBlue;
      this.scores.orange = this.hostScore;
      this.scores.blue = this.guestScore;
      this.scores.host = this.hostScore;
      this.scores.guest = this.guestScore;

      const registryScoreChange = this.registry.get("onScoreChange") as
        | ((hostScore: number, guestScore: number) => void)
        | undefined;
      if (typeof registryScoreChange === "function") {
        registryScoreChange(this.hostScore, this.guestScore);
      }
      this.callbacks.onScoreChange?.(this.hostScore, this.guestScore);
      this.callbacks.onScoresChange?.(this.scores);
    }
  }

  public handleRemoteInput(data: { input: string; data?: unknown }) {
    if (this.mode !== "online") return;
    if (
      data.input === "paddle.position" &&
      data.data &&
      typeof (data.data as Record<string, unknown>).x === "number"
    ) {
      this.opponentTargetX = (data.data as { x: number }).x;
    }
  }

  public handleRemoteEvent(data: { event: string; data?: unknown }) {
    if (this.mode !== "online") return;

    if (data.event === "score_update") {
      const d = data.data as { scores?: PingPongScore; scorer?: PlatformPlayer } | undefined;
      if (d?.scores) {
        this.hostScore = d.scores.host ?? d.scores.orange ?? this.hostScore;
        this.guestScore = d.scores.guest ?? d.scores.blue ?? this.guestScore;
        this.scores = {
          orange: this.hostScore,
          blue: this.guestScore,
          host: this.hostScore,
          guest: this.guestScore,
        };

        const registryScoreChange = this.registry.get("onScoreChange") as
          | ((hostScore: number, guestScore: number) => void)
          | undefined;
        if (typeof registryScoreChange === "function") {
          registryScoreChange(this.hostScore, this.guestScore);
        }
        this.callbacks.onScoreChange?.(this.hostScore, this.guestScore);
        this.callbacks.onScoresChange?.(this.scores);
        this.showFloatingNotice(
          `Point ${d.scorer === "orange" ? "Orange" : "Blue"}! • ${this.hostScore} - ${this.guestScore}`
        );
      }
    } else if (data.event === "game_over" && !this.isGameOver) {
      const d = data.data as { winner?: PlatformPlayer; scores?: PingPongScore } | undefined;
      const winner = d?.winner ?? "orange";
      this.isGameOver = true;
      this.ball.active = false;
      this.showFloatingNotice(
        `Match Point! ${winner === "orange" ? "Orange" : "Blue"} Wins ${this.hostScore} - ${this.guestScore}`
      );
      const finalResult = {
        winner,
        score: winner === "orange" ? this.hostScore : this.guestScore,
      };
      const registryGameOver = this.registry.get("onGameOver") as
        | ((result: { winner: PlatformPlayer; score: number }) => void)
        | undefined;
      if (typeof registryGameOver === "function") {
        registryGameOver(finalResult);
      }
      this.callbacks.onGameOver?.(finalResult);
      this.callbacks.onLifecycleChange?.("finished");
    }
  }

  private showFloatingNotice(text: string) {
    this.statusText.setText(text).setAlpha(1);
    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      duration: 1600,
      ease: "Power2",
    });
  }

  public restartMatch(
    mode?: "1v1" | "vs-bot" | "online",
    difficulty?: "easy" | "medium" | "hard",
    online?: OnlineNetworkingCallbacks
  ) {
    this.init({
      callbacks: this.callbacks,
      mode: mode || this.mode,
      difficulty: difficulty || this.difficulty,
      online: online || (this.onlineConfig ?? undefined),
      isHost: online?.isHost ?? (online?.myRole ? online.myRole === "orange" : this.isHost),
      localPlayerRole: online?.myRole ?? this.localPlayerRole,
    });

    if (this.isFlippedPerspective) {
      this.cameras.main.setRotation(Math.PI);
      this.statusText?.setRotation(Math.PI);
    } else {
      this.cameras.main.setRotation(0);
      this.statusText?.setRotation(0);
    }

    this.orangePaddle.x = GAME_WIDTH / 2;
    this.orangePaddle.y = BOTTOM_PADDLE_Y;
    this.bluePaddle.x = GAME_WIDTH / 2;
    this.bluePaddle.y = TOP_PADDLE_Y;
    this.renderPaddle(this.orangePaddle, COLOR_ORANGE);
    this.renderPaddle(this.bluePaddle, COLOR_BLUE);

    if (this.isHost) {
      this.serveBall("orange");
    }

    this.hostScore = 0;
    this.guestScore = 0;
    this.scores = { orange: 0, blue: 0, host: 0, guest: 0 };
    const registryScoreChange = this.registry.get("onScoreChange") as
      | ((hostScore: number, guestScore: number) => void)
      | undefined;
    if (typeof registryScoreChange === "function") {
      registryScoreChange(0, 0);
    }
    this.callbacks.onScoreChange?.(0, 0);
    this.callbacks.onScoreUpdate?.(0);
    this.callbacks.onScoresChange?.(this.scores);
    this.callbacks.onLifecycleChange?.("playing");
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

  public shutdown() {
    this.removeCanvasPointerListeners();
    this.botController?.reset();
    this.botController = null;
    this.activePointers.clear();

    for (const r of this.ripples) {
      r.graphics?.destroy();
    }
    this.ripples = [];

    this.trailEmitter?.destroy();
    this.sparkEmitter?.destroy();
    this.ball?.graphics?.destroy();
    this.ball?.shadowGraphics?.destroy();
    this.orangePaddle?.graphics?.destroy();
    this.orangePaddle?.shadowGraphics?.destroy();
    this.bluePaddle?.graphics?.destroy();
    this.bluePaddle?.shadowGraphics?.destroy();
    this.statusText?.destroy();
  }
}
