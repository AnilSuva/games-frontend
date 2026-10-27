import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WINNING_SCORE,
  SHIP_RADIUS,
  SHIP_THRUST,
  SHIP_MAX_SPEED,
  SHIP_DRAG,
  SHIP_ROTATION_LERP,
  SHIP_BOUNCE_IMPULSE,
  WRAP_MARGIN,
  STAR_COLLECT_RADIUS,
  STAR_RESPAWN_DELAY_MS,
  STAR_SPAWN_PADDING_X,
  STAR_SPAWN_PADDING_Y,
  BLACK_HOLE_FIRST_SPAWN_DELAY_MS,
  BLACK_HOLE_INTERVAL_MS,
  BLACK_HOLE_DURATION_MS,
  NUM_ASTEROIDS,
  ASTEROID_RADIUS,
  COLOR_BG,
  COLOR_ORANGE,
  COLOR_BLUE,
  BLUE_START_X,
  BLUE_START_Y,
  BLUE_START_ANGLE,
  ORANGE_START_X,
  ORANGE_START_Y,
  ORANGE_START_ANGLE,
} from "../config/constants";
import type {
  AsteroidState,
  BlackHoleState,
  BotDifficulty,
  GameMode,
  JoystickInput,
  PlayerRole,
  ShipState,
  StarCatcherCallbacks,
  StarCatcherInitData,
  StarCatcherScore,
  StarState,
} from "./types";
import { createStarCatcherTextures } from "./starCatcherTextures";
import { StarCatcherBot } from "./starCatcherBot";
import {
  resolveShipCollision,
  calculateBlackHoleEffect,
  getToroidalDelta,
} from "./starCatcherPhysics";
import { soundManager } from "@/platform/audio";

interface ShipEntity {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image;
  flameLeft: Phaser.GameObjects.Image;
  flameRight: Phaser.GameObjects.Image;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  state: ShipState;
  wasCaptured?: boolean;
  orbitAngleAccum: number;
  prevBhAngle: number | null;
  escapeGraceTimer: number;
}

interface AsteroidEntity {
  sprite: Phaser.GameObjects.Image;
  state: AsteroidState;
}

interface TouchPointerState {
  pointerId: number;
  player: PlayerRole;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  baseCircle: Phaser.GameObjects.Arc;
  thumbCircle: Phaser.GameObjects.Arc;
}

export class StarCatcherScene extends Phaser.Scene {
  private callbacks!: StarCatcherCallbacks;
  private mode: GameMode = "1v1";
  private difficulty: BotDifficulty = "medium";
  public myRole: PlayerRole = "orange";

  // Match state
  public scores: StarCatcherScore = { orange: 0, blue: 0 };
  public isMatchStarted = true;
  private isGameOver = false;
  private isPaused = false;

  // Online network sync
  private lastNetworkSyncTime = 0;
  private remoteShipState: ShipState | null = null;

  // Entities
  private shipOrange!: ShipEntity;
  private shipBlue!: ShipEntity;

  // Star
  private starSprite!: Phaser.GameObjects.Image;
  private starHaloSprite!: Phaser.GameObjects.Image;
  private starState: StarState = { x: 0, y: 0, active: false, scale: 0 };
  private starTween: Phaser.Tweens.Tween | null = null;
  private starHaloTween: Phaser.Tweens.Tween | null = null;
  private starRespawnTimer: Phaser.Time.TimerEvent | null = null;

  // Black Hole
  private blackHoleSprite!: Phaser.GameObjects.Image;
  private blackHoleCoreGlow!: Phaser.GameObjects.Arc;
  private blackHoleState: BlackHoleState = { x: 0, y: 0, active: false, scale: 0 };
  private blackHoleSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private blackHoleDurationTimer: Phaser.Time.TimerEvent | null = null;
  private blackHoleInfallEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Asteroids
  private asteroids: AsteroidEntity[] = [];

  // Particle systems
  private starburstEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rockDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private warpFlashEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shockwaveSprite!: Phaser.GameObjects.Image;

  // AI Bot
  private botController: StarCatcherBot | null = null;

  // Touch & Virtual Joysticks
  private touchPointers: Map<number, TouchPointerState> = new Map();
  private orangeInput: JoystickInput = { active: false, angle: 0, intensity: 0 };
  private blueInput: JoystickInput = { active: false, angle: 0, intensity: 0 };

  // Keyboard controls
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "StarCatcherScene" });
  }

  public init(data: StarCatcherInitData): void {
    this.mode = data.mode ?? "1v1";
    this.difficulty = data.difficulty ?? "medium";
    this.myRole = data.myRole ?? "orange";
    this.callbacks = data.callbacks;
    this.scores = { orange: 0, blue: 0 };
    this.isMatchStarted = this.mode !== "online";
    this.isGameOver = false;
    this.isPaused = false;
    this.lastNetworkSyncTime = 0;
    this.remoteShipState = null;
    this.botController = new StarCatcherBot(this.difficulty);
  }

  public create(): void {
    // Generate high-DPI textures
    createStarCatcherTextures(this);

    // Cosmic background, nebulas, and starfield
    this.createCosmicBackground();

    // Particle systems
    this.createParticleSystems();

    // Spawn Ships
    this.shipOrange = this.createShip("orange", ORANGE_START_X, ORANGE_START_Y, ORANGE_START_ANGLE);
    this.shipBlue = this.createShip("blue", BLUE_START_X, BLUE_START_Y, BLUE_START_ANGLE);

    // Spawn Asteroids
    this.createAsteroids();

    // Star Object & Radiant Halo
    this.starHaloSprite = this.add.image(0, 0, "star_halo");
    this.starHaloSprite.setScale(0.5);
    this.starHaloSprite.setDepth(19);
    this.starHaloSprite.setVisible(false);

    this.starSprite = this.add.image(0, 0, "star_gold");
    this.starSprite.setScale(0.5);
    this.starSprite.setDepth(20);
    this.starSprite.setVisible(false);

    // Black Hole & Accretion Singularity
    this.blackHoleSprite = this.add.image(0, 0, "black_hole");
    this.blackHoleSprite.setScale(0.5);
    this.blackHoleSprite.setDepth(15);
    this.blackHoleSprite.setVisible(false);

    this.blackHoleCoreGlow = this.add.arc(0, 0, 16, 0, 360, false, 0xc084fc, 0.4);
    this.blackHoleCoreGlow.setDepth(16);
    this.blackHoleCoreGlow.setVisible(false);

    // Shockwave Ring for explosive events
    this.shockwaveSprite = this.add.image(0, 0, "shockwave_ring");
    this.shockwaveSprite.setScale(0);
    this.shockwaveSprite.setAlpha(0);
    this.shockwaveSprite.setDepth(24);

    // Setup hazard timers & initial star only for offline/local modes
    if (this.mode !== "online") {
      this.setupBlackHoleLifecycle();
      this.spawnStar();
    }

    // Input listeners
    this.setupInputs();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // Notify React host that scene textures and canvas are fully rendered
    this.callbacks.onSceneReady?.();
  }

  private createCosmicBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.setDepth(0);

    // Deep space nebulas (soft atmospheric cosmic clouds)
    const nebula = this.add.graphics();
    nebula.setDepth(1);

    // Top Blue Nebula Cloud
    nebula.fillStyle(0x1e1b4b, 0.35); // Deep Indigo
    nebula.fillCircle(80, 110, 140);
    nebula.fillStyle(0x0f172a, 0.25);
    nebula.fillCircle(240, 160, 160);

    // Bottom Orange Nebula Cloud
    nebula.fillStyle(0x311006, 0.3); // Deep Amber Void
    nebula.fillCircle(280, 490, 150);
    nebula.fillStyle(0x1e1026, 0.25); // Violet Accent
    nebula.fillCircle(90, 440, 130);

    // Arena Energy Border (Luminous rounded enclosure)
    const border = this.add.graphics();
    border.lineStyle(1.5, 0x334155, 0.45);
    border.strokeRoundedRect(8, 8, GAME_WIDTH - 16, GAME_HEIGHT - 16, 12);
    border.setDepth(2);

    // Split-screen dividing laser line (local 1v1 split only)
    if (this.mode === "1v1") {
      const divider = this.add.graphics();
      divider.lineStyle(1.5, 0x38bdf8, 0.3);
      for (let x = 16; x < GAME_WIDTH - 16; x += 14) {
        divider.lineBetween(x, GAME_HEIGHT / 2, x + 7, GAME_HEIGHT / 2);
      }
      // Glowing center node on dividing line
      divider.fillStyle(0x38bdf8, 0.5);
      divider.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 3);
      divider.setDepth(2);
    }

    // Twinkling multi-depth Starfield
    for (let i = 0; i < 54; i++) {
      const sx = Phaser.Math.Between(10, GAME_WIDTH - 10);
      const sy = Phaser.Math.Between(10, GAME_HEIGHT - 10);
      const radius = Phaser.Math.FloatBetween(0.8, 1.8);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.85);

      // Diverse stellar spectral classes (warm gold, cool blue, bright white)
      const colorRoll = Math.random();
      const color = colorRoll > 0.75 ? 0x93c5fd : colorRoll > 0.5 ? 0xfef08a : 0xffffff;

      const starDot = this.add.arc(sx, sy, radius, 0, 360, false, color, alpha);
      starDot.setDepth(2);

      // Random harmonic twinkle
      if (Math.random() > 0.3) {
        this.tweens.add({
          targets: starDot,
          alpha: { from: alpha, to: Math.min(1.0, alpha + 0.4) },
          duration: Phaser.Math.Between(1100, 2600),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: Phaser.Math.Between(0, 1800),
        });
      }
    }
  }

  private createParticleSystems(): void {
    // 1. Starburst explosion on star collect
    this.starburstEmitter = this.add.particles(0, 0, "spark_particle", {
      speed: { min: 100, max: 280 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 300, max: 650 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.starburstEmitter.setDepth(26);

    // 2. Rock debris on asteroid & ship collisions
    this.rockDebrisEmitter = this.add.particles(0, 0, "spark_particle", {
      speed: { min: 70, max: 210 },
      scale: { start: 0.5, end: 0.05 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 200, max: 400 },
      tint: 0x94a3b8,
      emitting: false,
    });
    this.rockDebrisEmitter.setDepth(26);

    // 3. Screen wrap / Quantum warp flash
    this.warpFlashEmitter = this.add.particles(0, 0, "warp_flash", {
      speed: { min: 15, max: 50 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 220,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.warpFlashEmitter.setDepth(25);

    // 4. Black hole accretion infall particle stream
    this.blackHoleInfallEmitter = this.add.particles(0, 0, "stardust_particle", {
      speed: { min: 30, max: 110 },
      scale: { start: 0.45, end: 0.05 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 450,
      tint: 0xc084fc,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.blackHoleInfallEmitter.setDepth(14);
  }

  private createShip(role: PlayerRole, startX: number, startY: number, startAngle: number): ShipEntity {
    const isOrange = role === "orange";
    const bodyKey = isOrange ? "ship_orange" : "ship_blue";
    const flameKey = isOrange ? "flame_orange" : "flame_blue";
    const shieldKey = isOrange ? "shield_orange" : "shield_blue";

    const container = this.add.container(startX, startY);
    container.setDepth(22);

    // Engine exhaust plasma trail emitter
    const emitter = this.add.particles(0, 0, "stardust_particle", {
      speed: { min: 45, max: 110 },
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 220,
      tint: isOrange ? 0xf97316 : 0x38bdf8,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(21);

    // Dual Thruster Flames behind engine nozzles
    const flameLeft = this.add.image(-14, -5.5, flameKey);
    flameLeft.setScale(0.5);
    flameLeft.setVisible(false);

    const flameRight = this.add.image(-14, 5.5, flameKey);
    flameRight.setScale(0.5);
    flameRight.setVisible(false);

    // Primary Ship Hull
    const body = this.add.image(0, 0, bodyKey);
    body.setScale(0.5);

    // Energy Shield Bubble (Triggered on collision)
    const shield = this.add.image(0, 0, shieldKey);
    shield.setScale(0.52);
    shield.setAlpha(0);

    container.add([flameLeft, flameRight, body, shield]);
    container.setRotation(startAngle);

    return {
      container,
      body,
      shield,
      flameLeft,
      flameRight,
      emitter,
      state: {
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        rotation: startAngle,
        thrusting: false,
      },
      wasCaptured: false,
      orbitAngleAccum: 0,
      prevBhAngle: null,
      escapeGraceTimer: 0,
    };
  }

  private createAsteroids(): void {
    this.asteroids = [];
    const configs = [
      {
        key: "asteroid_1",
        x: 90,
        y: GAME_HEIGHT / 2 - 40,
        vx: 38,
        vy: 24,
        rotSpeed: 0.015,
      },
      {
        key: "asteroid_2",
        x: GAME_WIDTH - 90,
        y: GAME_HEIGHT / 2 + 40,
        vx: -34,
        vy: -22,
        rotSpeed: -0.018,
      },
    ];

    for (let i = 0; i < NUM_ASTEROIDS; i++) {
      const cfg = configs[i % configs.length];
      const sprite = this.add.image(cfg.x, cfg.y, cfg.key);
      sprite.setScale(0.5);
      sprite.setDepth(12);

      this.asteroids.push({
        sprite,
        state: {
          x: cfg.x,
          y: cfg.y,
          vx: cfg.vx,
          vy: cfg.vy,
          radius: ASTEROID_RADIUS,
          rotation: 0,
          rotSpeed: cfg.rotSpeed,
        },
      });
    }
  }

  private setupInputs(): void {
    // Keyboard inputs
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }

    // Touch / Pointer Inputs
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isGameOver || this.isPaused) return;

    const isTopHalf = pointer.y < GAME_HEIGHT / 2;
    const playerRole: PlayerRole =
      this.mode === "1v1"
        ? (isTopHalf ? "blue" : "orange")
        : this.mode === "online"
        ? this.myRole
        : "orange";

    // Dynamic virtual joystick UI
    const baseColor = playerRole === "orange" ? COLOR_ORANGE : COLOR_BLUE;

    const baseCircle = this.add.arc(
      pointer.x,
      pointer.y,
      36,
      0,
      360,
      false,
      baseColor,
      0.18
    );
    baseCircle.setStrokeStyle(2, baseColor, 0.7);
    baseCircle.setDepth(40);

    const thumbCircle = this.add.arc(
      pointer.x,
      pointer.y,
      17,
      0,
      360,
      false,
      baseColor,
      0.85
    );
    thumbCircle.setDepth(41);

    this.touchPointers.set(pointer.id, {
      pointerId: pointer.id,
      player: playerRole,
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      baseCircle,
      thumbCircle,
    });
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const touch = this.touchPointers.get(pointer.id);
    if (!touch) return;

    touch.currentX = pointer.x;
    touch.currentY = pointer.y;

    const dx = pointer.x - touch.startX;
    const dy = pointer.y - touch.startY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 36;

    const angle = Math.atan2(dy, dx);
    const intensity = Math.min(1.0, dist / 22);

    const thumbX = touch.startX + Math.cos(angle) * Math.min(dist, maxRadius);
    const thumbY = touch.startY + Math.sin(angle) * Math.min(dist, maxRadius);
    touch.thumbCircle.setPosition(thumbX, thumbY);

    if (touch.player === "orange") {
      this.orangeInput = { active: dist > 5, angle, intensity };
    } else {
      this.blueInput = { active: dist > 5, angle, intensity };
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const touch = this.touchPointers.get(pointer.id);
    if (!touch) return;

    touch.baseCircle.destroy();
    touch.thumbCircle.destroy();
    this.touchPointers.delete(pointer.id);

    if (touch.player === "orange") {
      this.orangeInput = { active: false, angle: 0, intensity: 0 };
    } else {
      this.blueInput = { active: false, angle: 0, intensity: 0 };
    }
  }

  private setupBlackHoleLifecycle(): void {
    if (this.mode === "online" && this.myRole !== "orange") {
      return; // Guest listens to host broadcasts
    }
    this.blackHoleSpawnTimer = this.time.addEvent({
      delay: BLACK_HOLE_FIRST_SPAWN_DELAY_MS,
      callback: () => this.spawnBlackHole(),
      loop: false,
    });
  }

  public spawnBlackHole(customX?: number, customY?: number): void {
    if (this.isGameOver) return;

    // Pick random location in the central region of the arena if not specified
    const x = customX ?? Phaser.Math.Between(70, GAME_WIDTH - 70);
    const y = customY ?? Phaser.Math.Between(150, GAME_HEIGHT - 150);

    if (this.mode === "online" && this.myRole === "orange" && customX === undefined) {
      this.callbacks.onBlackHoleSpawn?.({ x, y });
    }

    this.blackHoleState = {
      x,
      y,
      active: true,
      scale: 0,
    };

    this.blackHoleSprite.setPosition(x, y);
    this.blackHoleSprite.setScale(0);
    this.blackHoleSprite.setVisible(true);

    this.blackHoleCoreGlow.setPosition(x, y);
    this.blackHoleCoreGlow.setScale(0);
    this.blackHoleCoreGlow.setVisible(true);

    soundManager.play("spinTick1");
    this.triggerShockwave(x, y, 0.6);

    // Expand tween with cosmic swell
    this.tweens.add({
      targets: [this.blackHoleSprite, this.blackHoleCoreGlow],
      scale: 0.5,
      duration: 850,
      ease: "Back.Out",
      onUpdate: () => {
        this.blackHoleState.scale = this.blackHoleSprite.scale;
      },
    });

    // Schedule despawn (host only schedules timer in online mode)
    if (this.mode !== "online" || this.myRole === "orange") {
      this.blackHoleDurationTimer = this.time.delayedCall(
        BLACK_HOLE_DURATION_MS,
        () => {
          this.despawnBlackHole();
        }
      );
    }
  }

  public despawnBlackHole(): void {
    if (!this.blackHoleState.active) return;

    if (this.mode === "online" && this.myRole === "orange") {
      this.callbacks.onBlackHoleDespawn?.();
    }

    this.tweens.add({
      targets: [this.blackHoleSprite, this.blackHoleCoreGlow],
      scale: 0,
      duration: 650,
      ease: "Quad.In",
      onComplete: () => {
        this.blackHoleState.active = false;
        this.blackHoleState.scale = 0;
        this.blackHoleSprite.setVisible(false);
        this.blackHoleCoreGlow.setVisible(false);

        // Schedule next spawn (host only in online mode)
        if (this.mode !== "online" || this.myRole === "orange") {
          this.blackHoleSpawnTimer = this.time.delayedCall(
            BLACK_HOLE_INTERVAL_MS,
            () => {
              this.spawnBlackHole();
            }
          );
        }
      },
    });
  }

  public spawnStar(customX?: number, customY?: number): void {
    if (this.isGameOver) return;

    if (this.mode === "online" && this.myRole !== "orange" && customX === undefined) {
      return; // Guest only spawns from host broadcast
    }

    let x = customX ?? 0;
    let y = customY ?? 0;

    if (customX === undefined || customY === undefined) {
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 25) {
        x = Phaser.Math.Between(
          STAR_SPAWN_PADDING_X,
          GAME_WIDTH - STAR_SPAWN_PADDING_X
        );
        y = Phaser.Math.Between(
          STAR_SPAWN_PADDING_Y,
          GAME_HEIGHT - STAR_SPAWN_PADDING_Y
        );

        const distOrange = Math.hypot(x - this.shipOrange.state.x, y - this.shipOrange.state.y);
        const distBlue = Math.hypot(x - this.shipBlue.state.x, y - this.shipBlue.state.y);
        let distBH = 999;
        if (this.blackHoleState.active) {
          distBH = Math.hypot(x - this.blackHoleState.x, y - this.blackHoleState.y);
        }

        if (distOrange > 60 && distBlue > 60 && distBH > 70) {
          valid = true;
        }
        attempts++;
      }

      if (this.mode === "online" && this.myRole === "orange") {
        this.callbacks.onStarSpawn?.({ x, y });
      }
    }

    this.starState = {
      x,
      y,
      active: true,
      scale: 0,
    };

    this.starSprite.setPosition(x, y);
    this.starSprite.setScale(0);
    this.starSprite.setVisible(true);

    this.starHaloSprite.setPosition(x, y);
    this.starHaloSprite.setScale(0);
    this.starHaloSprite.setVisible(true);

    soundManager.play("spinTick1");
    this.triggerShockwave(x, y, 0.45);

    if (this.starTween) this.starTween.stop();
    if (this.starHaloTween) this.starHaloTween.stop();

    // Radiant pop-in animation
    this.starTween = this.tweens.add({
      targets: this.starSprite,
      scale: 0.5,
      duration: 500,
      ease: "Back.Out",
      onUpdate: () => {
        this.starState.scale = this.starSprite.scale;
      },
    });

    // Breathing pulse for coronal halo
    this.starHaloTween = this.tweens.add({
      targets: this.starHaloSprite,
      scale: { from: 0.42, to: 0.58 },
      alpha: { from: 0.65, to: 0.95 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private collectStar(collector: PlayerRole): void {
    if (!this.starState.active || this.isGameOver) return;

    if (this.mode === "online" && this.myRole !== "orange") {
      return; // Only host evaluates and confirms star collection in online mode
    }

    const starX = this.starState.x;
    const starY = this.starState.y;

    this.starState.active = false;
    this.starSprite.setVisible(false);
    this.starHaloSprite.setVisible(false);

    // 1. Golden Starburst Particle Explosion
    this.starburstEmitter.explode(24, starX, starY);

    // 2. Expanding Celestial Shockwave Ring
    this.triggerShockwave(starX, starY, 0.7);

    // 3. Floating +1 Score Popup in the game world
    this.createFloatingScoreText(starX, starY, collector);

    // 4. Update Scores
    this.scores[collector] += 1;
    this.callbacks.onScoreUpdate(this.scores);
    this.callbacks.onStarCollected(collector, this.scores);

    // Check Win Condition
    if (this.scores[collector] >= WINNING_SCORE) {
      this.isGameOver = true;
      soundManager.play("victory");
      this.callbacks.onGameOver(collector, this.scores);
      return;
    }

    // Play collect chime
    soundManager.play("dropBall");

    // Respawn next star after verified 2400ms delay
    this.starRespawnTimer = this.time.delayedCall(
      STAR_RESPAWN_DELAY_MS,
      () => {
        this.spawnStar();
      }
    );
  }

  public handleRemoteShipSync(remoteState: ShipState): void {
    this.remoteShipState = { ...remoteState };
  }

  public handleRemoteStarSpawn(pos: { x: number; y: number }): void {
    this.spawnStar(pos.x, pos.y);
  }

  public handleRemoteStarCollected(
    collector: PlayerRole,
    newScores: StarCatcherScore
  ): void {
    const starX = this.starState.x;
    const starY = this.starState.y;

    this.starState.active = false;
    this.starSprite.setVisible(false);
    this.starHaloSprite.setVisible(false);

    this.starburstEmitter.explode(24, starX, starY);
    this.triggerShockwave(starX, starY, 0.7);
    this.createFloatingScoreText(starX, starY, collector);

    this.scores = { ...newScores };
    this.callbacks.onScoreUpdate(this.scores);

    if (this.scores[collector] >= WINNING_SCORE) {
      this.isGameOver = true;
      soundManager.play("victory");
      this.callbacks.onGameOver(collector, this.scores);
      return;
    }

    soundManager.play("dropBall");
  }

  public handleRemoteBlackHoleSpawn(pos: { x: number; y: number }): void {
    this.spawnBlackHole(pos.x, pos.y);
  }

  public handleRemoteBlackHoleDespawn(): void {
    this.despawnBlackHole();
  }

  public startOnlineMatch(starPos?: { x: number; y: number }): void {
    this.isMatchStarted = true;
    if (starPos) {
      this.spawnStar(starPos.x, starPos.y);
    } else if (this.myRole === "orange") {
      this.spawnStar();
    }
    if (this.mode !== "online" || this.myRole === "orange") {
      this.setupBlackHoleLifecycle();
    }
  }

  private createFloatingScoreText(x: number, y: number, collector: PlayerRole): void {
    const isOrange = collector === "orange";
    const colorHex = isOrange ? "#fb923c" : "#60a5fa";

    const text = this.add.text(x, y - 8, "+1 STAR", {
      fontFamily: "monospace",
      fontSize: "14px",
      fontStyle: "bold",
      color: colorHex,
      stroke: "#090d16",
      strokeThickness: 3,
    });
    text.setOrigin(0.5);
    text.setDepth(30);

    this.tweens.add({
      targets: text,
      y: y - 36,
      alpha: { from: 1, to: 0 },
      scale: { from: 1.1, to: 0.8 },
      duration: 650,
      ease: "Quad.Out",
      onComplete: () => {
        text.destroy();
      },
    });
  }

  private triggerShockwave(x: number, y: number, targetScale: number = 0.6): void {
    this.shockwaveSprite.setPosition(x, y);
    this.shockwaveSprite.setScale(0.1);
    this.shockwaveSprite.setAlpha(0.85);

    this.tweens.add({
      targets: this.shockwaveSprite,
      scale: targetScale,
      alpha: 0,
      duration: 400,
      ease: "Quad.Out",
    });
  }

  private triggerShieldFlash(ship: ShipEntity): void {
    ship.shield.setAlpha(1.0);
    this.tweens.add({
      targets: ship.shield,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
    });
  }

  public override update(time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    if (this.mode === "online" && !this.isMatchStarted) {
      if (this.remoteShipState) {
        const isLocalOrange = this.myRole === "orange";
        const remoteShip = isLocalOrange ? this.shipBlue : this.shipOrange;
        const rs = this.remoteShipState;
        remoteShip.container.setPosition(rs.x, rs.y);
        remoteShip.container.setRotation(rs.rotation);
      }
      return;
    }

    // Standardize delta to seconds (clamped to prevent tunnel glitch on tab switch)
    const dt = Math.min(delta / 1000, 0.05);

    // 1. Process Orange Input
    let orangeAngle = this.orangeInput.angle;
    let orangeActive = this.orangeInput.active;
    let orangeIntensity = this.orangeInput.intensity;

    const kbOrange = this.getKeyboardInput("orange");
    if (kbOrange.active) {
      orangeAngle = kbOrange.angle;
      orangeActive = true;
      orangeIntensity = 1.0;
    }

    // 2. Process Blue Input
    let blueAngle = this.blueInput.angle;
    let blueActive = this.blueInput.active;
    let blueIntensity = this.blueInput.intensity;

    if (this.mode === "bot") {
      const asteroidStates = this.asteroids.map((a) => a.state);
      const botInput = this.botController!.update(
        time,
        this.shipBlue.state,
        this.starState,
        this.blackHoleState,
        asteroidStates,
        this.shipOrange.state
      );
      blueAngle = botInput.angle;
      blueActive = botInput.active;
      blueIntensity = botInput.intensity;
    } else {
      const kbBlue = this.getKeyboardInput("blue");
      if (kbBlue.active) {
        blueAngle = kbBlue.angle;
        blueActive = true;
        blueIntensity = 1.0;
      }
    }

    // 3. Update Ship Physics & Visuals
    if (this.mode === "online") {
      const isLocalOrange = this.myRole === "orange";
      const localShip = isLocalOrange ? this.shipOrange : this.shipBlue;
      const remoteShip = isLocalOrange ? this.shipBlue : this.shipOrange;

      const localAngle = isLocalOrange ? orangeAngle : blueAngle;
      const localActive = isLocalOrange ? orangeActive : blueActive;
      const localIntensity = isLocalOrange ? orangeIntensity : blueIntensity;

      // Update local ship physics with user's input
      this.updateShipPhysics(localShip, localActive, localAngle, localIntensity, dt);

      // Throttled network sync stream (~30Hz)
      if (time - this.lastNetworkSyncTime >= 33) {
        this.lastNetworkSyncTime = time;
        this.callbacks.onLocalShipSync?.({ ...localShip.state });
      }

      // Smooth interpolation for remote opponent ship
      if (this.remoteShipState) {
        const rs = this.remoteShipState;
        const s = remoteShip.state;
        const dx = getToroidalDelta(rs.x, s.x, GAME_WIDTH);
        const dy = getToroidalDelta(rs.y, s.y, GAME_HEIGHT);

        s.x += dx * 0.45;
        s.y += dy * 0.45;
        s.vx = rs.vx;
        s.vy = rs.vy;
        s.rotation = Phaser.Math.Angle.RotateTo(s.rotation, rs.rotation, 0.4);
        s.thrusting = rs.thrusting;

        remoteShip.flameLeft.setVisible(rs.thrusting);
        remoteShip.flameRight.setVisible(rs.thrusting);
        remoteShip.container.setPosition(s.x, s.y);
        remoteShip.container.setRotation(s.rotation);
      }
    } else {
      this.updateShipPhysics(this.shipOrange, orangeActive, orangeAngle, orangeIntensity, dt);
      this.updateShipPhysics(this.shipBlue, blueActive, blueAngle, blueIntensity, dt);
    }

    // 4. Check Ship-to-Ship Rocket Collision
    this.checkShipCollision();

    // 5. Update Asteroids
    this.updateAsteroids(dt);

    // 6. Update Black Hole visuals & suction vortex
    if (this.blackHoleState.active) {
      this.blackHoleSprite.rotation += 0.035;

      // Inward swirling particle stream
      if (Math.random() < 0.45) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const radius = Phaser.Math.FloatBetween(45, 95);
        const px = this.blackHoleState.x + Math.cos(angle) * radius;
        const py = this.blackHoleState.y + Math.sin(angle) * radius;
        this.blackHoleInfallEmitter.emitParticleAt(px, py, 1);
      }
    }

    // 7. Check Star collection & rotations
    if (this.starState.active) {
      this.starSprite.rotation += 0.025;
      this.starHaloSprite.rotation -= 0.012;

      const dOrange = Math.hypot(
        this.shipOrange.state.x - this.starState.x,
        this.shipOrange.state.y - this.starState.y
      );
      const dBlue = Math.hypot(
        this.shipBlue.state.x - this.starState.x,
        this.shipBlue.state.y - this.starState.y
      );

      const orangeIn = dOrange <= STAR_COLLECT_RADIUS;
      const blueIn = dBlue <= STAR_COLLECT_RADIUS;

      if (orangeIn && blueIn) {
        if (dOrange <= dBlue) {
          this.collectStar("orange");
        } else {
          this.collectStar("blue");
        }
      } else if (orangeIn) {
        this.collectStar("orange");
      } else if (blueIn) {
        this.collectStar("blue");
      }
    }

    // 8. Check Asteroid collisions with Ships
    this.checkAsteroidCollisions(this.shipOrange);
    this.checkAsteroidCollisions(this.shipBlue);
  }

  private getKeyboardInput(player: PlayerRole): { active: boolean; angle: number } {
    let dx = 0;
    let dy = 0;

    if (this.mode === "online") {
      if (player !== this.myRole) {
        return { active: false, angle: 0 };
      }
      if (this.keyW?.isDown || this.cursors?.up.isDown) dy -= 1;
      if (this.keyS?.isDown || this.cursors?.down.isDown) dy += 1;
      if (this.keyA?.isDown || this.cursors?.left.isDown) dx -= 1;
      if (this.keyD?.isDown || this.cursors?.right.isDown) dx += 1;

      if (dx !== 0 || dy !== 0) {
        return { active: true, angle: Math.atan2(dy, dx) };
      }
      return { active: false, angle: 0 };
    }

    if (player === "orange") {
      if (this.keyW?.isDown) dy -= 1;
      if (this.keyS?.isDown) dy += 1;
      if (this.keyA?.isDown) dx -= 1;
      if (this.keyD?.isDown) dx += 1;

      if (this.mode === "bot" && this.cursors) {
        if (this.cursors.up.isDown) dy -= 1;
        if (this.cursors.down.isDown) dy += 1;
        if (this.cursors.left.isDown) dx -= 1;
        if (this.cursors.right.isDown) dx += 1;
      }
    } else {
      if (this.cursors) {
        if (this.cursors.up.isDown) dy -= 1;
        if (this.cursors.down.isDown) dy += 1;
        if (this.cursors.left.isDown) dx -= 1;
        if (this.cursors.right.isDown) dx += 1;
      }
    }

    if (dx !== 0 || dy !== 0) {
      return { active: true, angle: Math.atan2(dy, dx) };
    }
    return { active: false, angle: 0 };
  }

  private updateShipPhysics(
    ship: ShipEntity,
    thrusting: boolean,
    targetAngle: number,
    intensity: number,
    dt: number
  ): void {
    const s = ship.state;
    s.thrusting = thrusting;

    // Apply thrust acceleration
    if (thrusting) {
      const thrustVal = SHIP_THRUST * intensity * dt;
      s.vx += Math.cos(targetAngle) * thrustVal;
      s.vy += Math.sin(targetAngle) * thrustVal;

      const diff = Phaser.Math.Angle.Wrap(targetAngle - s.rotation);
      s.rotation += diff * SHIP_ROTATION_LERP;

      // Show flames
      ship.flameLeft.setVisible(true);
      ship.flameRight.setVisible(true);

      const flameScaleX = 0.45 + intensity * 0.25 + Math.random() * 0.12;
      ship.flameLeft.setScale(flameScaleX, 0.5);
      ship.flameRight.setScale(flameScaleX, 0.5);

      // Continuous plasma thruster exhaust particles
      const rearX = s.x - Math.cos(s.rotation) * 15;
      const rearY = s.y - Math.sin(s.rotation) * 15;
      ship.emitter.emitParticleAt(rearX, rearY, 1);
    } else {
      ship.flameLeft.setVisible(false);
      ship.flameRight.setVisible(false);

      const currentSpeed = Math.hypot(s.vx, s.vy);
      if (currentSpeed > 40) {
        const velAngle = Math.atan2(s.vy, s.vx);
        const diff = Phaser.Math.Angle.Wrap(velAngle - s.rotation);
        s.rotation += diff * (SHIP_ROTATION_LERP * 0.4);
      }
    }

    // Update escape grace timer
    if (ship.escapeGraceTimer > 0) {
      ship.escapeGraceTimer -= dt;
      if (ship.escapeGraceTimer < 0) ship.escapeGraceTimer = 0;
    }

    // Apply linear drag
    const dragFactor = Math.pow(SHIP_DRAG, dt * 60);
    s.vx *= dragFactor;
    s.vy *= dragFactor;

    // Apply Black Hole Gravitational Vortex & Orbital Mechanics
    const bh = calculateBlackHoleEffect(
      s,
      this.blackHoleState,
      dt,
      GAME_WIDTH,
      GAME_HEIGHT,
      ship.orbitAngleAccum,
      ship.prevBhAngle,
      ship.escapeGraceTimer
    );
    s.vx += bh.dvx;
    s.vy += bh.dvy;
    s.vx *= bh.damping;
    s.vy *= bh.damping;

    if (bh.isStuck) {
      ship.wasCaptured = true;
      ship.prevBhAngle = bh.currentAngle;
      ship.orbitAngleAccum = bh.accumAngle;

      // Check if full rotation orbit (~2*PI rad) under thrust triggered the slingshot escape!
      if (bh.orbitCompleted) {
        s.vx = bh.slingshotVx;
        s.vy = bh.slingshotVy;
        ship.orbitAngleAccum = 0;
        ship.prevBhAngle = null;
        ship.escapeGraceTimer = 0.85;
        ship.wasCaptured = false;

        // Slingshot breakout shockwave, sparks, and SFX
        this.triggerShockwave(s.x, s.y, 0.75);
        this.warpFlashEmitter.explode(12, s.x, s.y);
        this.rockDebrisEmitter.explode(14, s.x, s.y);
        this.cameras.main.shake(110, 0.006);
        soundManager.play("spinTick7");
      } else {
        // Visual sinking funnel scale
        ship.container.setScale(bh.targetScale);

        // Gravitational lensing violet tint
        ship.body.setTint(0xc084fc);

        // Visual orbital energy feedback:
        // As orbit accumulates toward 2*PI, emit glowing particles around ship
        const orbitRatio = Math.min(1.0, ship.orbitAngleAccum / (Math.PI * 1.9));
        if (Math.random() < 0.25 + orbitRatio * 0.45) {
          this.blackHoleInfallEmitter.emitParticleAt(s.x, s.y, 1);
        }

        // Flame overdrive visuals when thrusting along orbit
        if (thrusting) {
          const escapeFlame = 0.7 + orbitRatio * 0.35 + Math.random() * 0.2;
          ship.flameLeft.setScale(escapeFlame, 0.65);
          ship.flameRight.setScale(escapeFlame, 0.65);

          if (Math.random() < 0.45) {
            const rearX = s.x - Math.cos(s.rotation) * 17;
            const rearY = s.y - Math.sin(s.rotation) * 17;
            ship.emitter.emitParticleAt(rearX, rearY, 1);
          }
        }

        // Vacuum accretion dust particles
        if (Math.random() < 0.2) {
          this.rockDebrisEmitter.emitParticleAt(s.x, s.y, 1);
        }
      }
    } else {
      ship.orbitAngleAccum = Math.max(0, ship.orbitAngleAccum - dt * 2.0);
      ship.prevBhAngle = bh.currentAngle;

      // If ship was captured and broke free, provide escape feedback
      if (ship.wasCaptured) {
        ship.wasCaptured = false;
        this.triggerShockwave(s.x, s.y, 0.55);
        this.rockDebrisEmitter.explode(12, s.x, s.y);
        soundManager.play("spinTick1");
      }

      if (ship.container.scaleX !== 1.0) {
        const newScale = Phaser.Math.Linear(ship.container.scaleX, 1.0, 0.12);
        ship.container.setScale(Math.abs(newScale - 1.0) < 0.01 ? 1.0 : newScale);
      }
      ship.body.clearTint();
    }

    // Speed clamping (allows boosted slingshot velocity during escape grace)
    const speed = Math.hypot(s.vx, s.vy);
    const maxSpeed = ship.escapeGraceTimer > 0 ? 360 : SHIP_MAX_SPEED;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      s.vx *= scale;
      s.vy *= scale;
    }

    // Previous position for screen wrap detection
    const prevX = s.x;
    const prevY = s.y;

    // Update position
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Screen-edge wrapping (Teletrasporto) with Warp Flash VFX
    let wrapped = false;
    if (s.x < -WRAP_MARGIN) {
      s.x = GAME_WIDTH + WRAP_MARGIN;
      wrapped = true;
    } else if (s.x > GAME_WIDTH + WRAP_MARGIN) {
      s.x = -WRAP_MARGIN;
      wrapped = true;
    }

    if (s.y < -WRAP_MARGIN) {
      s.y = GAME_HEIGHT + WRAP_MARGIN;
      wrapped = true;
    } else if (s.y > GAME_HEIGHT + WRAP_MARGIN) {
      s.y = -WRAP_MARGIN;
      wrapped = true;
    }

    if (wrapped) {
      this.warpFlashEmitter.explode(4, prevX, prevY);
      this.warpFlashEmitter.explode(4, s.x, s.y);
    }

    // Apply to visual container
    ship.container.setPosition(s.x, s.y);
    ship.container.setRotation(s.rotation);
  }

  private updateAsteroids(dt: number): void {
    for (const ast of this.asteroids) {
      const s = ast.state;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rotation += s.rotSpeed;

      if (s.x < -WRAP_MARGIN) s.x = GAME_WIDTH + WRAP_MARGIN;
      else if (s.x > GAME_WIDTH + WRAP_MARGIN) s.x = -WRAP_MARGIN;

      if (s.y < -WRAP_MARGIN) s.y = GAME_HEIGHT + WRAP_MARGIN;
      else if (s.y > GAME_HEIGHT + WRAP_MARGIN) s.y = -WRAP_MARGIN;

      ast.sprite.setPosition(s.x, s.y);
      ast.sprite.setRotation(s.rotation);
    }
  }

  private checkShipCollision(): void {
    const res = resolveShipCollision(
      this.shipOrange.state,
      this.shipBlue.state,
      SHIP_RADIUS,
      SHIP_BOUNCE_IMPULSE,
      GAME_WIDTH,
      GAME_HEIGHT
    );

    if (res.collided) {
      // Angular deflection shock
      this.shipOrange.state.rotation += (Math.random() - 0.5) * 0.45;
      this.shipBlue.state.rotation += (Math.random() - 0.5) * 0.45;

      this.shipOrange.container.setPosition(this.shipOrange.state.x, this.shipOrange.state.y);
      this.shipBlue.container.setPosition(this.shipBlue.state.x, this.shipBlue.state.y);

      // Trigger protective plasma shield flash on both ships
      this.triggerShieldFlash(this.shipOrange);
      this.triggerShieldFlash(this.shipBlue);

      // Kinetic clash sparks & shockwave ring
      this.starburstEmitter.explode(16, res.midX, res.midY);
      this.rockDebrisEmitter.explode(10, res.midX, res.midY);
      this.triggerShockwave(res.midX, res.midY, 0.45);

      soundManager.play("dropBall");
      this.cameras.main.shake(90, 0.0045);
    }
  }

  private checkAsteroidCollisions(ship: ShipEntity): void {
    const s = ship.state;

    for (const ast of this.asteroids) {
      const a = ast.state;
      const dx = s.x - a.x;
      const dy = s.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = SHIP_RADIUS + a.radius;

      if (dist < minDist && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = minDist - dist;
        s.x += nx * overlap;
        s.y += ny * overlap;

        s.vx = nx * SHIP_BOUNCE_IMPULSE;
        s.vy = ny * SHIP_BOUNCE_IMPULSE;

        a.vx -= nx * 15;
        a.vy -= ny * 15;

        // Visual shield deflector feedback
        this.triggerShieldFlash(ship);
        this.rockDebrisEmitter.explode(10, s.x, s.y);

        soundManager.play("dropBall");
      }
    }
  }

  public restartGame(
    mode: GameMode = this.mode,
    difficulty: BotDifficulty = this.difficulty,
    myRole: PlayerRole = this.myRole
  ): void {
    this.mode = mode;
    this.difficulty = difficulty;
    this.myRole = myRole;
    this.scores = { orange: 0, blue: 0 };
    this.isMatchStarted = this.mode !== "online";
    this.isGameOver = false;
    this.isPaused = false;

    if (this.botController) {
      this.botController.setDifficulty(difficulty);
    }

    // Reset Ships
    this.shipOrange.state = {
      x: ORANGE_START_X,
      y: ORANGE_START_Y,
      vx: 0,
      vy: 0,
      rotation: ORANGE_START_ANGLE,
      thrusting: false,
    };
    this.shipOrange.container.setPosition(ORANGE_START_X, ORANGE_START_Y);
    this.shipOrange.container.setRotation(ORANGE_START_ANGLE);
    this.shipOrange.container.setScale(1.0);
    this.shipOrange.shield.setAlpha(0);
    this.shipOrange.body.clearTint();
    this.shipOrange.wasCaptured = false;
    this.shipOrange.orbitAngleAccum = 0;
    this.shipOrange.prevBhAngle = null;
    this.shipOrange.escapeGraceTimer = 0;

    this.shipBlue.state = {
      x: BLUE_START_X,
      y: BLUE_START_Y,
      vx: 0,
      vy: 0,
      rotation: BLUE_START_ANGLE,
      thrusting: false,
    };
    this.shipBlue.container.setPosition(BLUE_START_X, BLUE_START_Y);
    this.shipBlue.container.setRotation(BLUE_START_ANGLE);
    this.shipBlue.container.setScale(1.0);
    this.shipBlue.shield.setAlpha(0);
    this.shipBlue.body.clearTint();
    this.shipBlue.wasCaptured = false;
    this.shipBlue.orbitAngleAccum = 0;
    this.shipBlue.prevBhAngle = null;
    this.shipBlue.escapeGraceTimer = 0;

    // Reset Star
    if (this.starRespawnTimer) this.starRespawnTimer.remove();
    if (this.mode !== "online") {
      this.spawnStar();
    }

    // Reset Black Hole
    if (this.blackHoleDurationTimer) this.blackHoleDurationTimer.remove();
    if (this.blackHoleSpawnTimer) this.blackHoleSpawnTimer.remove();
    this.blackHoleState.active = false;
    this.blackHoleState.scale = 0;
    this.blackHoleSprite.setVisible(false);
    this.blackHoleCoreGlow.setVisible(false);
    if (this.mode !== "online") {
      this.setupBlackHoleLifecycle();
    }

    this.callbacks.onScoreUpdate(this.scores);
  }

  public pauseGame(): void {
    this.isPaused = true;
  }

  public resumeGame(): void {
    this.isPaused = false;
  }

  private shutdown(): void {
    if (this.starRespawnTimer) this.starRespawnTimer.remove();
    if (this.blackHoleSpawnTimer) this.blackHoleSpawnTimer.remove();
    if (this.blackHoleDurationTimer) this.blackHoleDurationTimer.remove();
    if (this.starTween) this.starTween.stop();
    if (this.starHaloTween) this.starHaloTween.stop();
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUp, this);
  }
}
