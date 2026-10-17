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
  BLACK_HOLE_PULL_RADIUS,
  BLACK_HOLE_MAX_FORCE,
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
import { soundManager } from "@/platform/audio";

interface ShipEntity {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  flameLeft: Phaser.GameObjects.Image;
  flameRight: Phaser.GameObjects.Image;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  state: ShipState;
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

  // Match state
  public scores: StarCatcherScore = { orange: 0, blue: 0 };
  private isGameOver = false;
  private isPaused = false;

  // Entities
  private shipOrange!: ShipEntity;
  private shipBlue!: ShipEntity;

  // Star
  private starSprite!: Phaser.GameObjects.Image;
  private starState: StarState = { x: 0, y: 0, active: false, scale: 0 };
  private starTween: Phaser.Tweens.Tween | null = null;
  private starRespawnTimer: Phaser.Time.TimerEvent | null = null;

  // Black Hole
  private blackHoleSprite!: Phaser.GameObjects.Image;
  private blackHoleState: BlackHoleState = { x: 0, y: 0, active: false, scale: 0 };
  private blackHoleSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private blackHoleDurationTimer: Phaser.Time.TimerEvent | null = null;

  // Asteroids
  private asteroids: AsteroidEntity[] = [];

  // Particle systems
  private starburstEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rockDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

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
    this.callbacks = data.callbacks;
    this.scores = { orange: 0, blue: 0 };
    this.isGameOver = false;
    this.isPaused = false;
    this.botController = new StarCatcherBot(this.difficulty);
  }

  public create(): void {
    // Generate high-DPI textures
    createStarCatcherTextures(this);

    // Cosmic background and starfield
    this.createCosmicBackground();

    // Particle systems
    this.createParticleSystems();

    // Spawn Ships
    this.shipOrange = this.createShip("orange", ORANGE_START_X, ORANGE_START_Y, ORANGE_START_ANGLE);
    this.shipBlue = this.createShip("blue", BLUE_START_X, BLUE_START_Y, BLUE_START_ANGLE);

    // Spawn Asteroids
    this.createAsteroids();

    // Star Object
    this.starSprite = this.add.image(0, 0, "star_gold");
    this.starSprite.setScale(0.5);
    this.starSprite.setDepth(20);
    this.starSprite.setVisible(false);

    // Black Hole Object
    this.blackHoleSprite = this.add.image(0, 0, "black_hole");
    this.blackHoleSprite.setScale(0.5);
    this.blackHoleSprite.setDepth(15);
    this.blackHoleSprite.setVisible(false);

    // Setup hazard timers
    this.setupBlackHoleLifecycle();

    // Input listeners
    this.setupInputs();

    // Spawn first star
    this.spawnStar();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
  }

  private createCosmicBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.setDepth(0);

    // Split-screen dividing subtle dashed line
    const divider = this.add.graphics();
    divider.lineStyle(1.5, 0x1e293b, 0.4);
    for (let x = 16; x < GAME_WIDTH - 16; x += 14) {
      divider.lineBetween(x, GAME_HEIGHT / 2, x + 7, GAME_HEIGHT / 2);
    }
    divider.setDepth(1);

    // Background twinkling stars (procedural stardust)
    for (let i = 0; i < 48; i++) {
      const sx = Phaser.Math.Between(8, GAME_WIDTH - 8);
      const sy = Phaser.Math.Between(8, GAME_HEIGHT - 8);
      const radius = Phaser.Math.FloatBetween(0.8, 1.8);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.7);

      const starDot = this.add.arc(sx, sy, radius, 0, 360, false, 0xffffff, alpha);
      starDot.setDepth(1);

      // Random twinkle
      if (Math.random() > 0.4) {
        this.tweens.add({
          targets: starDot,
          alpha: { from: alpha, to: Math.min(1.0, alpha + 0.4) },
          duration: Phaser.Math.Between(1200, 2800),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: Phaser.Math.Between(0, 2000),
        });
      }
    }
  }

  private createParticleSystems(): void {
    // Starburst explosion on star collect
    this.starburstEmitter = this.add.particles(0, 0, "spark_particle", {
      speed: { min: 90, max: 260 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 250, max: 550 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.starburstEmitter.setDepth(25);

    // Rock debris on asteroid collision
    this.rockDebrisEmitter = this.add.particles(0, 0, "spark_particle", {
      speed: { min: 60, max: 180 },
      scale: { start: 0.4, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 180, max: 350 },
      tint: 0x94a3b8,
      emitting: false,
    });
    this.rockDebrisEmitter.setDepth(25);
  }

  private createShip(role: PlayerRole, startX: number, startY: number, startAngle: number): ShipEntity {
    const isOrange = role === "orange";
    const bodyKey = isOrange ? "ship_orange" : "ship_blue";
    const flameKey = isOrange ? "flame_orange" : "flame_blue";

    const container = this.add.container(startX, startY);
    container.setDepth(22);

    // Thruster engine particles
    const emitter = this.add.particles(0, 0, "stardust_particle", {
      speed: { min: 40, max: 90 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 180,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(21);

    // Flames behind dual nozzles
    const flameLeft = this.add.image(-12, -5, flameKey);
    flameLeft.setScale(0.5);
    flameLeft.setVisible(false);

    const flameRight = this.add.image(-12, 5, flameKey);
    flameRight.setScale(0.5);
    flameRight.setVisible(false);

    // Ship Hull
    const body = this.add.image(0, 0, bodyKey);
    body.setScale(0.5);

    container.add([flameLeft, flameRight, body]);
    container.setRotation(startAngle);

    return {
      container,
      body,
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

    // In Bot mode, user can touch anywhere or in the bottom half
    const isTopHalf = pointer.y < GAME_HEIGHT / 2;
    if (this.mode === "bot" && isTopHalf) {
      // In bot mode, human controls Orange even if touching top half (or top half is ignored)
      // Let's assign Orange to any human touch in Bot mode
    }

    const playerRole: PlayerRole =
      this.mode === "1v1" ? (isTopHalf ? "blue" : "orange") : "orange";

    // Create dynamic virtual joystick UI
    const baseCircle = this.add.arc(
      pointer.x,
      pointer.y,
      34,
      0,
      360,
      false,
      playerRole === "orange" ? COLOR_ORANGE : COLOR_BLUE,
      0.22
    );
    baseCircle.setStrokeStyle(
      2,
      playerRole === "orange" ? COLOR_ORANGE : COLOR_BLUE,
      0.65
    );
    baseCircle.setDepth(40);

    const thumbCircle = this.add.arc(
      pointer.x,
      pointer.y,
      16,
      0,
      360,
      false,
      playerRole === "orange" ? COLOR_ORANGE : COLOR_BLUE,
      0.8
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
    const maxRadius = 34;

    const angle = Math.atan2(dy, dx);
    const intensity = Math.min(1.0, dist / 20);

    // Clamp thumb circle within maxRadius
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
    this.blackHoleSpawnTimer = this.time.addEvent({
      delay: BLACK_HOLE_FIRST_SPAWN_DELAY_MS,
      callback: () => this.spawnBlackHole(),
      loop: false,
    });
  }

  private spawnBlackHole(): void {
    if (this.isGameOver) return;

    // Pick random location in the central region of the arena
    const x = Phaser.Math.Between(70, GAME_WIDTH - 70);
    const y = Phaser.Math.Between(150, GAME_HEIGHT - 150);

    this.blackHoleState = {
      x,
      y,
      active: true,
      scale: 0,
    };

    this.blackHoleSprite.setPosition(x, y);
    this.blackHoleSprite.setScale(0);
    this.blackHoleSprite.setVisible(true);

    soundManager.play("spinTick1");

    // Expand tween
    this.tweens.add({
      targets: this.blackHoleSprite,
      scale: 0.5,
      duration: 800,
      ease: "Back.Out",
      onUpdate: () => {
        this.blackHoleState.scale = this.blackHoleSprite.scale;
      },
    });

    // Schedule despawn
    this.blackHoleDurationTimer = this.time.delayedCall(
      BLACK_HOLE_DURATION_MS,
      () => {
        this.despawnBlackHole();
      }
    );
  }

  private despawnBlackHole(): void {
    if (!this.blackHoleState.active) return;

    this.tweens.add({
      targets: this.blackHoleSprite,
      scale: 0,
      duration: 600,
      ease: "Quad.In",
      onComplete: () => {
        this.blackHoleState.active = false;
        this.blackHoleState.scale = 0;
        this.blackHoleSprite.setVisible(false);

        // Schedule next spawn
        this.blackHoleSpawnTimer = this.time.delayedCall(
          BLACK_HOLE_INTERVAL_MS,
          () => {
            this.spawnBlackHole();
          }
        );
      },
    });
  }

  public spawnStar(): void {
    if (this.isGameOver) return;

    // Find position with safe margin from edges, ships, and black hole
    let x = 0;
    let y = 0;
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

    this.starState = {
      x,
      y,
      active: true,
      scale: 0,
    };

    this.starSprite.setPosition(x, y);
    this.starSprite.setScale(0);
    this.starSprite.setVisible(true);

    soundManager.play("spinTick1");

    if (this.starTween) this.starTween.stop();

    this.starTween = this.tweens.add({
      targets: this.starSprite,
      scale: 0.5,
      duration: 500,
      ease: "Back.Out",
      onUpdate: () => {
        this.starState.scale = this.starSprite.scale;
      },
    });
  }

  private collectStar(collector: PlayerRole): void {
    if (!this.starState.active || this.isGameOver) return;

    this.starState.active = false;
    this.starSprite.setVisible(false);

    // Particle Burst
    this.starburstEmitter.explode(18, this.starState.x, this.starState.y);

    // Scores
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

    // Respawn next star after brief delay
    this.starRespawnTimer = this.time.delayedCall(
      STAR_RESPAWN_DELAY_MS,
      () => {
        this.spawnStar();
      }
    );
  }

  public override update(time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // Standardize delta to seconds (clamped to prevent tunnel glitch on tab switch)
    const dt = Math.min(delta / 1000, 0.05);

    // 1. Process Orange Input
    let orangeAngle = this.orangeInput.angle;
    let orangeActive = this.orangeInput.active;
    let orangeIntensity = this.orangeInput.intensity;

    // Check keyboard for Orange
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
        asteroidStates
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

    // 3. Update Ship Physics
    this.updateShipPhysics(this.shipOrange, orangeActive, orangeAngle, orangeIntensity, dt);
    this.updateShipPhysics(this.shipBlue, blueActive, blueAngle, blueIntensity, dt);

    // 4. Update Asteroids
    this.updateAsteroids(dt);

    // 5. Update Black Hole visual rotation & pull
    if (this.blackHoleState.active) {
      this.blackHoleSprite.rotation += 0.04;
    }

    // 6. Check Star collection
    if (this.starState.active) {
      this.starSprite.rotation += 0.02;

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
        // Tie-breaker: whoever is closer
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

    // 7. Check Asteroid collisions with Ships
    this.checkAsteroidCollisions(this.shipOrange);
    this.checkAsteroidCollisions(this.shipBlue);
  }

  private getKeyboardInput(player: PlayerRole): { active: boolean; angle: number } {
    let dx = 0;
    let dy = 0;

    if (player === "orange") {
      if (this.keyW?.isDown) dy -= 1;
      if (this.keyS?.isDown) dy += 1;
      if (this.keyA?.isDown) dx -= 1;
      if (this.keyD?.isDown) dx += 1;

      // In Bot mode, allow Arrow Keys for Orange as well
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

      // Smooth rotation toward target angle
      const diff = Phaser.Math.Angle.Wrap(targetAngle - s.rotation);
      s.rotation += diff * SHIP_ROTATION_LERP;

      // Show flames
      ship.flameLeft.setVisible(true);
      ship.flameRight.setVisible(true);

      // Flickering flame scale
      const flameScale = 0.45 + Math.random() * 0.15;
      ship.flameLeft.setScale(flameScale, 0.5);
      ship.flameRight.setScale(flameScale, 0.5);

      // Thruster particle exhaust
      const rearX = s.x - Math.cos(s.rotation) * 14;
      const rearY = s.y - Math.sin(s.rotation) * 14;
      ship.emitter.emitParticleAt(rearX, rearY, 1);
    } else {
      ship.flameLeft.setVisible(false);
      ship.flameRight.setVisible(false);

      // If moving with coasting speed, slowly align rotation with velocity
      const currentSpeed = Math.hypot(s.vx, s.vy);
      if (currentSpeed > 40) {
        const velAngle = Math.atan2(s.vy, s.vx);
        const diff = Phaser.Math.Angle.Wrap(velAngle - s.rotation);
        s.rotation += diff * (SHIP_ROTATION_LERP * 0.4);
      }
    }

    // Apply linear drag
    const dragFactor = Math.pow(SHIP_DRAG, dt * 60);
    s.vx *= dragFactor;
    s.vy *= dragFactor;

    // Apply Black Hole Gravitational Pull
    if (this.blackHoleState.active && this.blackHoleState.scale > 0.1) {
      const dx = this.blackHoleState.x - s.x;
      const dy = this.blackHoleState.y - s.y;
      const dist = Math.hypot(dx, dy);

      if (dist < BLACK_HOLE_PULL_RADIUS && dist > 4) {
        const pullFactor = 1.0 - dist / BLACK_HOLE_PULL_RADIUS;
        const pull = BLACK_HOLE_MAX_FORCE * pullFactor * dt;
        s.vx += (dx / dist) * pull;
        s.vy += (dy / dist) * pull;

        // Core tidal spin disruption if trapped deep inside
        if (dist < 32) {
          s.rotation += 0.25;
        }
      }
    }

    // Speed clamping
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > SHIP_MAX_SPEED) {
      const scale = SHIP_MAX_SPEED / speed;
      s.vx *= scale;
      s.vy *= scale;
    }

    // Update position
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Screen-edge wrapping (Teletrasporto)
    if (s.x < -WRAP_MARGIN) s.x = GAME_WIDTH + WRAP_MARGIN;
    else if (s.x > GAME_WIDTH + WRAP_MARGIN) s.x = -WRAP_MARGIN;

    if (s.y < -WRAP_MARGIN) s.y = GAME_HEIGHT + WRAP_MARGIN;
    else if (s.y > GAME_HEIGHT + WRAP_MARGIN) s.y = -WRAP_MARGIN;

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

      // Screen edge wrapping
      if (s.x < -WRAP_MARGIN) s.x = GAME_WIDTH + WRAP_MARGIN;
      else if (s.x > GAME_WIDTH + WRAP_MARGIN) s.x = -WRAP_MARGIN;

      if (s.y < -WRAP_MARGIN) s.y = GAME_HEIGHT + WRAP_MARGIN;
      else if (s.y > GAME_HEIGHT + WRAP_MARGIN) s.y = -WRAP_MARGIN;

      ast.sprite.setPosition(s.x, s.y);
      ast.sprite.setRotation(s.rotation);
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
        // Normal vector from asteroid to ship
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate objects to avoid sticking
        const overlap = minDist - dist;
        s.x += nx * overlap;
        s.y += ny * overlap;

        // Elastic impulse rebound
        s.vx = nx * SHIP_BOUNCE_IMPULSE;
        s.vy = ny * SHIP_BOUNCE_IMPULSE;

        // Asteroid slight deflection
        a.vx -= nx * 15;
        a.vy -= ny * 15;

        // Play bounce hit sound & particle burst
        soundManager.play("dropBall");
        this.rockDebrisEmitter.explode(8, s.x, s.y);
      }
    }
  }

  public restartGame(
    mode: GameMode = this.mode,
    difficulty: BotDifficulty = this.difficulty
  ): void {
    this.mode = mode;
    this.difficulty = difficulty;
    this.scores = { orange: 0, blue: 0 };
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

    // Reset Star
    if (this.starRespawnTimer) this.starRespawnTimer.remove();
    this.spawnStar();

    // Reset Black Hole
    if (this.blackHoleDurationTimer) this.blackHoleDurationTimer.remove();
    if (this.blackHoleSpawnTimer) this.blackHoleSpawnTimer.remove();
    this.blackHoleState.active = false;
    this.blackHoleState.scale = 0;
    this.blackHoleSprite.setVisible(false);
    this.setupBlackHoleLifecycle();

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
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUp, this);
  }
}
