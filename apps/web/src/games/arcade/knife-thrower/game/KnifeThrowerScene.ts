import Phaser from "phaser";
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
  WINNING_SCORE,
  RESPAWN_COOLDOWN_MS,
  ROUND_RESET_DELAY_MS,
  GAME_OVER_MODAL_DELAY_MS,
  COLOR_BG,
  COLOR_ORANGE,
  COLOR_BLUE,
  COLOR_TRUNK_WOOD,
  COLOR_TRUNK_BARK,
  COLOR_TRUNK_RING,
  COLOR_TRUNK_CORE,
  COLOR_TRUNK_STROKE,
  COLOR_BLADE,
  COLOR_BLADE_BEVEL,
  COLOR_HANDLE,
  COLOR_SPARK,
  COLOR_WOOD_CHIP,
  COLOR_DIVIDER,
  DEFAULT_KNIFE_ANGLES,
  PVP_TARGET_SETS,
  BOT_TARGET_SETS,
  type TargetSetConfig,
} from "../config/constants";
import type {
  EmbeddedKnife,
  KnifeOwner,
  KnifeThrowerCallbacks,
  KnifeThrowerInitData,
  KnifeThrowerInventory,
  KnifeThrowerScore,
  PlayerRole,
} from "./types";
import {
  calculateHitAngle,
  isAngleClashing,
  TrunkRotator,
} from "./rotationProfiles";
import { KnifeThrowerBot } from "./botController";
import { soundManager } from "@/platform/audio";

const TEX_SCALE = 4;
const KNIFE_SCALE = 1 / TEX_SCALE;
const TRUNK_SCALE = 1 / TEX_SCALE;

export class KnifeThrowerScene extends Phaser.Scene {
  private callbacks!: KnifeThrowerCallbacks;
  private mode: "1v1" | "bot" = "1v1";
  private difficulty: "easy" | "medium" | "hard" = "medium";

  // Match & Progression State
  public scores: KnifeThrowerScore = { orange: 0, blue: 0 };
  public inventories: KnifeThrowerInventory = { orange: 7, blue: 7 };
  public maxKnivesPerRound = 7;
  public currentSetIndex = 0;
  public currentSetConfig!: TargetSetConfig;
  private isRoundOver = false;
  private isGameOver = false;
  private isPaused = false;

  // Player throw states
  private orangeCanThrow = true;
  private blueCanThrow = true;
  private readyOrangeKnife: Phaser.GameObjects.Image | null = null;
  private readyBlueKnife: Phaser.GameObjects.Image | null = null;
  private flyingOrangeKnife: Phaser.GameObjects.Image | null = null;
  private flyingBlueKnife: Phaser.GameObjects.Image | null = null;

  // Trunk & Knives
  private trunkRotator!: TrunkRotator;
  private trunkContainer!: Phaser.GameObjects.Container;
  private trunkDisk!: Phaser.GameObjects.Image;
  private embeddedKnives: EmbeddedKnife[] = [];
  private nextKnifeId = 1;

  // AI Bot
  private botController: KnifeThrowerBot | null = null;

  // Visual Effects
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private woodChipEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private roundBannerText!: Phaser.GameObjects.Text;

  // Keyboard controls
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEnter?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyW?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "KnifeThrowerScene" });
  }

  public init(data?: KnifeThrowerInitData): void {
    this.mode = data?.mode ?? "1v1";
    this.difficulty = data?.difficulty ?? "medium";
    this.callbacks = data?.callbacks ?? {};

    this.scores = { orange: 0, blue: 0 };
    this.currentSetIndex = 0;
    this.isRoundOver = false;
    this.isGameOver = false;
    this.isPaused = false;
    this.orangeCanThrow = true;
    this.blueCanThrow = true;
    this.embeddedKnives = [];
    this.nextKnifeId = 1;

    // Get initial set config
    const sets = this.mode === "1v1" ? PVP_TARGET_SETS : BOT_TARGET_SETS[this.difficulty];
    const initialConfig = sets[0];
    this.currentSetConfig = initialConfig;
    this.maxKnivesPerRound = initialConfig.playerKnives;

    this.inventories = {
      orange: this.maxKnivesPerRound,
      blue: this.maxKnivesPerRound,
    };
  }

  public create(): void {
    // 1. Procedural Vector Textures
    this.initProceduralTextures();

    // 2. Court Background & Arena
    this.createArenaCourt();

    // 3. Central Rotating Trunk Container
    this.trunkContainer = this.add.container(TRUNK_CENTER_X, TRUNK_CENTER_Y);
    this.trunkContainer.setDepth(15);
    this.trunkDisk = this.add.image(0, 0, "trunk_wood").setScale(TRUNK_SCALE);
    this.trunkContainer.add(this.trunkDisk);

    // 4. Initialize Rotator & Bot
    this.trunkRotator = new TrunkRotator(this.currentSetConfig.rotationProfile);

    if (this.mode === "bot") {
      this.botController = new KnifeThrowerBot({ difficulty: this.difficulty });
    }

    // 5. Particle Systems
    this.createParticleSystems();

    // 6. Round Result Banner Text
    this.roundBannerText = this.add
      .text(GAME_WIDTH / 2, TRUNK_CENTER_Y, "", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#1c1917",
        backgroundColor: "#fffffffa",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(45);

    // 7. Input Listeners (Split Touch + Keyboard)
    this.setupInputListeners();

    // 8. Initialize Set 0 (spawns default knives, sets inventory, spawns ready knives)
    this.setupTrunkSet(0);

    // 9. Initial Callbacks
    this.callbacks.onScoreChange?.(this.scores);
    this.callbacks.onLifecycleChange?.("playing");

    // 10. Teardown Listeners
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
  }

  public update(_time: number, delta: number): void {
    if (this.isPaused || this.isGameOver) return;

    const deltaSec = delta / 1000;

    // 1. Update Keyboard Input
    this.checkKeyboardInput();

    // 2. Advance Trunk Rotation
    if (!this.isRoundOver) {
      const dTheta = this.trunkRotator.update(deltaSec);
      this.trunkContainer.rotation += dTheta;
    }

    // 3. Update Bot Controller (Blue / Top)
    if (this.mode === "bot" && this.botController && !this.isRoundOver) {
      const embeddedAngles = this.embeddedKnives.map((k) => k.angle);
      const shouldThrow = this.botController.update(
        deltaSec,
        this.trunkContainer.rotation,
        this.trunkRotator.getSpeed(),
        embeddedAngles,
        this.blueCanThrow && this.inventories.blue > 0
      );
      if (shouldThrow) {
        this.throwBlue();
      }
    }

    // 4. Update Flying Knives Physics
    this.updateFlyingKnives(deltaSec);
  }

  /**
   * Initializes procedural vector textures:
   * - "knife_orange": Dagger facing UP with Orange crossguard (Player 1 Bottom)
   * - "knife_blue": Dagger facing DOWN with Blue crossguard (Player 2 Top)
   * - "trunk_wood": Cross-section oak log with tree bark & rings
   * - "clash_spark": Bright spark particle
   * - "wood_chip": Brown splinter particle
   */
  private initProceduralTextures(): void {
    // 1. Orange Knife (Facing UP: Blade on top, Handle on bottom - 4x high-res 48x200)
    if (!this.textures.exists("knife_orange")) {
      const g = this.make.graphics({ x: 0, y: 0 });

      // Steel blade
      g.fillStyle(COLOR_BLADE, 1);
      g.beginPath();
      g.moveTo(24, 0); // Tip
      g.lineTo(48, 48);
      g.lineTo(48, 136);
      g.lineTo(0, 136);
      g.lineTo(0, 48);
      g.closePath();
      g.fillPath();

      // Blade bevel (shadowed right half)
      g.fillStyle(COLOR_BLADE_BEVEL, 0.7);
      g.beginPath();
      g.moveTo(24, 0);
      g.lineTo(48, 48);
      g.lineTo(48, 136);
      g.lineTo(24, 136);
      g.closePath();
      g.fillPath();

      // Orange guard
      g.fillStyle(COLOR_ORANGE, 1);
      g.fillRoundedRect(0, 128, 48, 20, 8);

      // Slate handle
      g.fillStyle(COLOR_HANDLE, 1);
      g.fillRoundedRect(12, 148, 24, 52, 8);

      // Pommel accent
      g.fillStyle(COLOR_ORANGE, 1);
      g.fillRoundedRect(10, 192, 28, 8, 4);

      // Dark crisp outline
      g.lineStyle(4, COLOR_TRUNK_STROKE, 1);
      g.beginPath();
      g.moveTo(24, 0);
      g.lineTo(48, 48);
      g.lineTo(48, 128);
      g.lineTo(48, 148);
      g.lineTo(36, 148);
      g.lineTo(36, 200);
      g.lineTo(12, 200);
      g.lineTo(12, 148);
      g.lineTo(0, 148);
      g.lineTo(0, 128);
      g.lineTo(0, 48);
      g.closePath();
      g.strokePath();

      g.generateTexture("knife_orange", 48, 200);
      g.destroy();
    }

    // 2. Blue Knife (Facing DOWN: Blade on bottom, Handle on top - 4x high-res 48x200)
    if (!this.textures.exists("knife_blue")) {
      const g = this.make.graphics({ x: 0, y: 0 });

      // Steel blade
      g.fillStyle(COLOR_BLADE, 1);
      g.beginPath();
      g.moveTo(24, 200); // Tip pointing DOWN
      g.lineTo(48, 152);
      g.lineTo(48, 64);
      g.lineTo(0, 64);
      g.lineTo(0, 152);
      g.closePath();
      g.fillPath();

      // Blade bevel
      g.fillStyle(COLOR_BLADE_BEVEL, 0.7);
      g.beginPath();
      g.moveTo(24, 200);
      g.lineTo(48, 152);
      g.lineTo(48, 64);
      g.lineTo(24, 64);
      g.closePath();
      g.fillPath();

      // Blue guard
      g.fillStyle(COLOR_BLUE, 1);
      g.fillRoundedRect(0, 52, 48, 20, 8);

      // Slate handle
      g.fillStyle(COLOR_HANDLE, 1);
      g.fillRoundedRect(12, 0, 24, 52, 8);

      // Pommel accent
      g.fillStyle(COLOR_BLUE, 1);
      g.fillRoundedRect(10, 0, 28, 8, 4);

      // Dark crisp outline
      g.lineStyle(4, COLOR_TRUNK_STROKE, 1);
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(36, 0);
      g.lineTo(36, 52);
      g.lineTo(48, 52);
      g.lineTo(48, 72);
      g.lineTo(48, 152);
      g.lineTo(24, 200);
      g.lineTo(0, 152);
      g.lineTo(0, 72);
      g.lineTo(0, 52);
      g.lineTo(12, 52);
      g.closePath();
      g.strokePath();

      g.generateTexture("knife_blue", 48, 200);
      g.destroy();
    }

    // 3. Neutral Pre-embedded Obstacle Knife (Facing UP, slate guard - 4x high-res 48x200)
    if (!this.textures.exists("knife_neutral")) {
      const g = this.make.graphics({ x: 0, y: 0 });

      // Steel blade
      g.fillStyle(COLOR_BLADE, 1);
      g.beginPath();
      g.moveTo(24, 0); // Tip
      g.lineTo(48, 48);
      g.lineTo(48, 136);
      g.lineTo(0, 136);
      g.lineTo(0, 48);
      g.closePath();
      g.fillPath();

      // Blade bevel
      g.fillStyle(COLOR_BLADE_BEVEL, 0.7);
      g.beginPath();
      g.moveTo(24, 0);
      g.lineTo(48, 48);
      g.lineTo(48, 136);
      g.lineTo(24, 136);
      g.closePath();
      g.fillPath();

      // Slate obstacle guard
      g.fillStyle(0x64748b, 1);
      g.fillRoundedRect(0, 128, 48, 20, 8);

      // Dark slate handle
      g.fillStyle(COLOR_HANDLE, 1);
      g.fillRoundedRect(12, 148, 24, 52, 8);

      // Pommel accent
      g.fillStyle(0x475569, 1);
      g.fillRoundedRect(10, 192, 28, 8, 4);

      // Dark outline
      g.lineStyle(4, COLOR_TRUNK_STROKE, 1);
      g.beginPath();
      g.moveTo(24, 0);
      g.lineTo(48, 48);
      g.lineTo(48, 128);
      g.lineTo(48, 148);
      g.lineTo(36, 148);
      g.lineTo(36, 200);
      g.lineTo(12, 200);
      g.lineTo(12, 148);
      g.lineTo(0, 148);
      g.lineTo(0, 128);
      g.lineTo(0, 48);
      g.closePath();
      g.strokePath();

      g.generateTexture("knife_neutral", 48, 200);
      g.destroy();
    }

    // 4. Central Trunk Log Texture (High-Res 4x, radius 304 in 640x640 canvas)
    if (!this.textures.exists("trunk_wood")) {
      const size = 640;
      const r = TRUNK_RADIUS * TEX_SCALE; // 76 * 4 = 304
      const cx = size / 2;
      const cy = size / 2;
      const g = this.make.graphics({ x: 0, y: 0 });

      // Drop shadow
      g.fillStyle(0x000000, 0.14);
      g.fillCircle(cx + 12, cy + 18, r);

      // Bark rim (dark outer bark ring)
      g.fillStyle(COLOR_TRUNK_BARK, 1);
      g.fillCircle(cx, cy, r);

      // Subtle bark notches around outer perimeter
      const notchCount = 32;
      g.lineStyle(6, 0x3d2110, 0.85);
      for (let i = 0; i < notchCount; i++) {
        const theta = (i * Math.PI * 2) / notchCount;
        const outerR = r;
        const innerR = r - (i % 2 === 0 ? 16 : 10);
        g.lineBetween(
          cx + Math.cos(theta) * innerR,
          cy + Math.sin(theta) * innerR,
          cx + Math.cos(theta) * outerR,
          cy + Math.sin(theta) * outerR
        );
      }

      // Oak wood face (warm cut wood surface)
      g.fillStyle(COLOR_TRUNK_WOOD, 1);
      g.fillCircle(cx, cy, r - 20);

      // Concentric growth rings
      g.lineStyle(6, COLOR_TRUNK_RING, 0.65);
      g.strokeCircle(cx, cy, r - 58);
      g.strokeCircle(cx, cy, r - 108);
      g.strokeCircle(cx, cy, r - 162);
      g.strokeCircle(cx, cy, r - 218);

      // Radial wood grain rays
      g.lineStyle(2.5, COLOR_TRUNK_RING, 0.35);
      for (let i = 0; i < 12; i++) {
        const theta = (i * Math.PI * 2) / 12 + 0.2;
        g.lineBetween(
          cx + Math.cos(theta) * 56,
          cy + Math.sin(theta) * 56,
          cx + Math.cos(theta) * (r - 26),
          cy + Math.sin(theta) * (r - 26)
        );
      }

      // Heartwood core
      g.fillStyle(COLOR_TRUNK_CORE, 1);
      g.fillCircle(cx, cy, 48);

      // Core center ring
      g.lineStyle(4, COLOR_TRUNK_STROKE, 0.4);
      g.strokeCircle(cx, cy, 26);

      // Bold perimeter border
      g.lineStyle(TRUNK_STROKE_WIDTH * TEX_SCALE, COLOR_TRUNK_STROKE, 1);
      g.strokeCircle(cx, cy, r);

      g.generateTexture("trunk_wood", size, size);
      g.destroy();
    }

    // 5. Clash Spark Particle
    if (!this.textures.exists("clash_spark")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(COLOR_SPARK, 1);
      g.fillCircle(10, 10, 10);
      g.generateTexture("clash_spark", 20, 20);
      g.destroy();
    }

    // 6. Wood Chip Particle
    if (!this.textures.exists("wood_chip")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(COLOR_WOOD_CHIP, 1);
      g.fillRect(0, 0, 12, 12);
      g.generateTexture("wood_chip", 12, 12);
      g.destroy();
    }
  }

  /**
   * Sets up background and arena markings
   */
  private createArenaCourt(): void {
    const bg = this.add.graphics().setDepth(0);

    // Warm background
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Center dividing line
    bg.lineStyle(2, COLOR_DIVIDER, 1);
    bg.lineBetween(16, TRUNK_CENTER_Y, GAME_WIDTH - 16, TRUNK_CENTER_Y);

    // Subtle arena concentric rings behind trunk
    bg.lineStyle(1.5, COLOR_DIVIDER, 0.9);
    bg.strokeCircle(TRUNK_CENTER_X, TRUNK_CENTER_Y, TRUNK_RADIUS + 26);
    bg.lineStyle(1, COLOR_DIVIDER, 0.45);
    bg.strokeCircle(TRUNK_CENTER_X, TRUNK_CENTER_Y, TRUNK_RADIUS + 50);

    // Player side subtle indicator dots
    bg.fillStyle(COLOR_BLUE, 0.1);
    bg.fillCircle(TRUNK_CENTER_X, 38, 22);

    bg.fillStyle(COLOR_ORANGE, 0.1);
    bg.fillCircle(TRUNK_CENTER_X, GAME_HEIGHT - 38, 22);
  }

  /**
   * Creates Particle Emitters for wood chips and clash sparks
   */
  private createParticleSystems(): void {
    this.sparkEmitter = this.add.particles(0, 0, "clash_spark", {
      speed: { min: 140, max: 380 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 160, max: 320 },
      gravityY: 180,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.sparkEmitter.setDepth(35);

    this.woodChipEmitter = this.add.particles(0, 0, "wood_chip", {
      speed: { min: 80, max: 220 },
      scale: { start: 0.8, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 200, max: 420 },
      gravityY: 260,
      emitting: false,
    });
    this.woodChipEmitter.setDepth(35);
  }

  /**
   * Setup split-screen touch and mouse input
   */
  private setupInputListeners(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused || this.isGameOver || this.isRoundOver) return;

      if (pointer.y > TRUNK_CENTER_Y) {
        // Bottom half: Player 1 (Orange)
        this.throwOrange();
      } else if (pointer.y <= TRUNK_CENTER_Y && this.mode === "1v1") {
        // Top half: Player 2 (Blue) in local 1v1 mode
        this.throwBlue();
      }
    });

    if (this.input.keyboard) {
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    }
  }

  private checkKeyboardInput(): void {
    if (this.isPaused || this.isGameOver || this.isRoundOver) return;

    // Orange controls: Space or KeyS
    if (
      (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
      (this.keyS && Phaser.Input.Keyboard.JustDown(this.keyS))
    ) {
      this.throwOrange();
    }

    // Blue controls: Enter or KeyW (in 1v1 mode)
    if (this.mode === "1v1") {
      if (
        (this.keyEnter && Phaser.Input.Keyboard.JustDown(this.keyEnter)) ||
        (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW))
      ) {
        this.throwBlue();
      }
    }
  }

  /**
   * Spawns ready knife for a player
   */
  private spawnReadyKnife(player: PlayerRole): void {
    if (this.inventories[player] <= 0) return;

    if (player === "orange") {
      if (this.readyOrangeKnife) this.readyOrangeKnife.destroy();
      this.readyOrangeKnife = this.add.image(
        RED_KNIFE_SPAWN_X,
        RED_KNIFE_SPAWN_Y,
        "knife_orange"
      );
      this.readyOrangeKnife.setScale(KNIFE_SCALE);
      this.readyOrangeKnife.setOrigin(0.5, 0);
      this.readyOrangeKnife.setDepth(20);
      this.orangeCanThrow = true;
    } else {
      if (this.readyBlueKnife) this.readyBlueKnife.destroy();
      this.readyBlueKnife = this.add.image(
        BLUE_KNIFE_SPAWN_X,
        BLUE_KNIFE_SPAWN_Y,
        "knife_blue"
      );
      this.readyBlueKnife.setScale(KNIFE_SCALE);
      this.readyBlueKnife.setOrigin(0.5, 1);
      this.readyBlueKnife.setDepth(20);
      this.blueCanThrow = true;
    }
  }

  /**
   * Player 1 (Orange / Bottom) throws knife UPWARD
   */
  public throwOrange(): void {
    if (
      !this.orangeCanThrow ||
      this.flyingOrangeKnife ||
      this.isRoundOver ||
      this.isGameOver ||
      this.inventories.orange <= 0
    ) {
      return;
    }

    this.orangeCanThrow = false;
    this.flyingOrangeKnife = this.readyOrangeKnife;
    this.readyOrangeKnife = null;

    soundManager.play("spinTick1");
  }

  /**
   * Player 2 (Blue / Top) throws knife DOWNWARD
   */
  public throwBlue(): void {
    if (
      !this.blueCanThrow ||
      this.flyingBlueKnife ||
      this.isRoundOver ||
      this.isGameOver ||
      this.inventories.blue <= 0
    ) {
      return;
    }

    this.blueCanThrow = false;
    this.flyingBlueKnife = this.readyBlueKnife;
    this.readyBlueKnife = null;

    soundManager.play("spinTick1");
  }

  /**
   * Advances knife flight physics
   */
  private updateFlyingKnives(deltaSec: number): void {
    // 1. Orange Knife moving UP
    if (this.flyingOrangeKnife) {
      this.flyingOrangeKnife.y -= KNIFE_SPEED * deltaSec;
      if (this.flyingOrangeKnife.y <= RED_KNIFE_DESTINY_Y) {
        this.processContact("orange", this.flyingOrangeKnife);
        this.flyingOrangeKnife = null;
      }
    }

    // 2. Blue Knife moving DOWN
    if (this.flyingBlueKnife) {
      this.flyingBlueKnife.y += KNIFE_SPEED * deltaSec;
      if (this.flyingBlueKnife.y >= BLUE_KNIFE_DESTINY_Y) {
        this.processContact("blue", this.flyingBlueKnife);
        this.flyingBlueKnife = null;
      }
    }
  }

  /**
   * Evaluates knife contact with the central trunk
   */
  private processContact(
    player: PlayerRole,
    knifeSprite: Phaser.GameObjects.Image
  ): void {
    if (this.isRoundOver || this.isGameOver) {
      knifeSprite.destroy();
      return;
    }

    // Calculate contact angle relative to rotating trunk
    const contactAngle = calculateHitAngle(this.trunkContainer.rotation, player);

    // Check clash against ALL existing embedded knives on the trunk
    const existingAngles = this.embeddedKnives.map((k) => k.angle);
    const hasClashed = isAngleClashing(
      contactAngle,
      existingAngles,
      KNIFE_CLASH_ANGLE_THRESHOLD
    );

    if (hasClashed) {
      // CLASH / MISS!
      this.handleKnifeClash(player, knifeSprite);
    } else {
      // SUCCESSFUL EMBED!
      this.handleKnifeEmbed(player, knifeSprite, contactAngle);
    }
  }

  /**
   * Handles successful knife embed into the rotating trunk
   */
  private handleKnifeEmbed(
    player: PlayerRole,
    knifeSprite: Phaser.GameObjects.Image,
    contactAngle: number
  ): void {
    knifeSprite.destroy();

    // Attach embedded knife to the rotating trunk container
    this.attachKnifeToTrunk(player, contactAngle);

    // Decrement player's knife inventory
    this.inventories[player]--;
    this.callbacks.onKnifeInventoryChange?.(this.inventories);

    // Wood chip particle burst
    const hitY =
      player === "orange"
        ? TRUNK_CENTER_Y + TRUNK_RADIUS - 8
        : TRUNK_CENTER_Y - TRUNK_RADIUS + 8;
    this.woodChipEmitter.emitParticleAt(TRUNK_CENTER_X, hitY, 6);

    // Trunk tremble / micro-shake
    this.trembleTrunk(player);

    // Impact thud sound
    soundManager.play("dropBall");

    // Spawn next knife for this player if inventory remains
    if (this.inventories[player] > 0 && !this.isRoundOver) {
      this.time.delayedCall(RESPAWN_COOLDOWN_MS, () => {
        if (!this.isRoundOver && !this.isGameOver) {
          this.spawnReadyKnife(player);
        }
      });
    }

    // Check if BOTH players have exhausted all knives without clashing
    if (this.inventories.orange === 0 && this.inventories.blue === 0) {
      this.handleTrunkFull();
    }
  }

  /**
   * Attaches an embedded knife (player or neutral obstacle) to the rotating trunk container
   */
  public attachKnifeToTrunk(owner: KnifeOwner, angle: number): void {
    const knifeContainer = this.add.container(0, 0);

    const texture =
      owner === "orange"
        ? "knife_orange"
        : owner === "blue"
        ? "knife_blue"
        : "knife_neutral";
    const sprite = this.add.image(0, 0, texture).setScale(KNIFE_SCALE);

    // Anchor so blade penetrates ~10px into the trunk
    if (owner === "blue") {
      sprite.setOrigin(0.5, 0.8);
      knifeContainer.rotation = angle - (Math.PI * 3) / 2;
    } else {
      sprite.setOrigin(0.5, 0.2);
      knifeContainer.rotation = angle - Math.PI / 2;
    }

    const radialDist = TRUNK_RADIUS - 8;
    const localX = Math.cos(angle) * radialDist;
    const localY = Math.sin(angle) * radialDist;

    knifeContainer.setPosition(localX, localY);
    knifeContainer.add(sprite);
    this.trunkContainer.add(knifeContainer);

    this.embeddedKnives.push({
      id: this.nextKnifeId++,
      owner,
      angle,
      container: knifeContainer,
    });
  }

  /**
   * Trunk micro-recoil / tremble
   */
  private trembleTrunk(player: PlayerRole): void {
    const dy = player === "orange" ? -3 : 3;
    this.tweens.add({
      targets: this.trunkContainer,
      y: TRUNK_CENTER_Y + dy,
      duration: 40,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    this.cameras.main.shake(60, 0.004);
  }

  /**
   * Handles knife clash with existing knife (Round Over)
   */
  private handleKnifeClash(
    clashingPlayer: PlayerRole,
    knifeSprite: Phaser.GameObjects.Image
  ): void {
    this.isRoundOver = true;
    const winnerPlayer: PlayerRole = clashingPlayer === "orange" ? "blue" : "orange";

    // Award point to the OPPONENT
    this.scores[winnerPlayer]++;
    this.callbacks.onScoreChange?.(this.scores);
    this.callbacks.onRoundResult?.(winnerPlayer);

    // Sparks at collision contact point
    const contactY =
      clashingPlayer === "orange"
        ? TRUNK_CENTER_Y + TRUNK_RADIUS - 8
        : TRUNK_CENTER_Y - TRUNK_RADIUS + 8;
    this.sparkEmitter.emitParticleAt(TRUNK_CENTER_X, contactY, 18);

    // Deflect colliding knife backwards with tumble spin
    const deflectDir = Math.random() > 0.5 ? 1 : -1;
    const targetY = clashingPlayer === "orange" ? GAME_HEIGHT + 80 : -80;

    this.tweens.add({
      targets: knifeSprite,
      x: TRUNK_CENTER_X + deflectDir * (60 + Math.random() * 40),
      y: targetY,
      rotation: deflectDir * Math.PI * 4,
      duration: 750,
      ease: "Quad.easeIn",
      onComplete: () => knifeSprite.destroy(),
    });

    // Intense camera shake & miss sound
    this.cameras.main.shake(200, 0.016);
    soundManager.play("lose");

    // Check match win condition
    if (this.scores[winnerPlayer] >= WINNING_SCORE) {
      this.handleGameOver(winnerPlayer);
    } else {
      // Show round winner banner and reset for next attempt at current set
      const winnerName = winnerPlayer === "orange" ? "ORANGE SCORES!" : "BLUE SCORES!";
      this.showRoundBanner(winnerName);

      this.time.delayedCall(ROUND_RESET_DELAY_MS, () => {
        if (!this.isGameOver) {
          this.setupTrunkSet(this.currentSetIndex);
        }
      });
    }
  }

  /**
   * Handles case where both players embed all knives safely (Set Cleared!)
   */
  private handleTrunkFull(): void {
    this.isRoundOver = true;
    this.callbacks.onRoundResult?.("tie");

    soundManager.play("victory");
    this.showRoundBanner(`SET ${this.currentSetIndex + 1} CLEARED!`);

    // Shatter trunk into flying shards
    this.shatterTrunk();

    // Advance to next set in progression
    this.time.delayedCall(ROUND_RESET_DELAY_MS + 200, () => {
      if (!this.isGameOver) {
        this.setupTrunkSet(this.currentSetIndex + 1);
      }
    });
  }

  /**
   * Shatters the trunk and detached knives outward
   */
  private shatterTrunk(): void {
    this.trunkDisk.setVisible(false);

    // Detach and explode embedded knives
    for (const item of this.embeddedKnives) {
      const worldPos = new Phaser.Math.Vector2();
      item.container.getWorldTransformMatrix().transformPoint(0, 0, worldPos);

      const vx = (worldPos.x - TRUNK_CENTER_X) * 2.5;
      const vy = (worldPos.y - TRUNK_CENTER_Y) * 2.5;

      const texture =
        item.owner === "orange"
          ? "knife_orange"
          : item.owner === "blue"
          ? "knife_blue"
          : "knife_neutral";
      const detached = this.add.image(worldPos.x, worldPos.y, texture);
      detached.setScale(KNIFE_SCALE);
      detached.setDepth(22);
      detached.rotation = item.container.rotation + this.trunkContainer.rotation;

      this.tweens.add({
        targets: detached,
        x: worldPos.x + vx,
        y: worldPos.y + vy,
        rotation: detached.rotation + (Math.random() - 0.5) * 6,
        alpha: 0,
        duration: 650,
        ease: "Quad.easeIn",
        onComplete: () => detached.destroy(),
      });
    }

    // Wood fragments
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const shard = this.add.image(TRUNK_CENTER_X, TRUNK_CENTER_Y, "wood_chip");
      shard.setDepth(20);
      shard.setScale(2.2);

      const speed = 140 + Math.random() * 100;
      this.tweens.add({
        targets: shard,
        x: TRUNK_CENTER_X + Math.cos(ang) * speed,
        y: TRUNK_CENTER_Y + Math.sin(ang) * speed,
        alpha: 0,
        duration: 550,
        ease: "Quad.easeOut",
        onComplete: () => shard.destroy(),
      });
    }

    this.cameras.main.shake(220, 0.015);
  }

  /**
   * Configures and initializes a target set based on reference level progression
   */
  public setupTrunkSet(setIndex: number): void {
    this.currentSetIndex = setIndex;
    this.isRoundOver = false;

    // Get set config from reference tables
    const sets = this.mode === "1v1" ? PVP_TARGET_SETS : BOT_TARGET_SETS[this.difficulty];
    const config = sets[setIndex % sets.length];
    this.currentSetConfig = config;

    // 1. Clear trunk
    this.trunkContainer.removeAll(true);
    this.embeddedKnives = [];

    // 2. Re-add disk
    this.trunkDisk = this.add.image(0, 0, "trunk_wood").setScale(TRUNK_SCALE);
    this.trunkDisk.setVisible(true);
    this.trunkContainer.add(this.trunkDisk);
    this.trunkContainer.rotation = 0;

    // 3. Pre-embed default obstacle knives matching reference KnifeChoice layout
    for (const knifeIdx of config.defaultKnifeIndices) {
      const angle = DEFAULT_KNIFE_ANGLES[knifeIdx];
      this.attachKnifeToTrunk("neutral", angle);
    }

    // 4. Configure rotation profile
    this.trunkRotator.reset(config.rotationProfile);

    // 5. Replenish inventories for this set
    this.maxKnivesPerRound = config.playerKnives;
    this.inventories = {
      orange: config.playerKnives,
      blue: config.playerKnives,
    };
    this.callbacks.onKnifeInventoryChange?.(this.inventories, this.maxKnivesPerRound);
    this.callbacks.onSetChange?.(this.currentSetIndex);

    // 6. Reset throw states & ready knives
    this.orangeCanThrow = true;
    this.blueCanThrow = true;

    if (this.flyingOrangeKnife) {
      this.flyingOrangeKnife.destroy();
      this.flyingOrangeKnife = null;
    }
    if (this.flyingBlueKnife) {
      this.flyingBlueKnife.destroy();
      this.flyingBlueKnife = null;
    }

    this.spawnReadyKnife("orange");
    this.spawnReadyKnife("blue");

    // 7. Reset bot timer
    this.botController?.reset(this.difficulty);
  }

  /**
   * Displays round banner text
   */
  private showRoundBanner(text: string): void {
    this.roundBannerText.setText(text);
    this.roundBannerText.setAlpha(0);
    this.roundBannerText.setScale(0.8);

    this.tweens.add({
      targets: this.roundBannerText,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.easeOut",
      onComplete: () => {
        this.time.delayedCall(500, () => {
          this.tweens.add({
            targets: this.roundBannerText,
            alpha: 0,
            scale: 0.9,
            duration: 160,
          });
        });
      },
    });
  }

  /**
   * Handles Match Over (5 points reached)
   */
  private handleGameOver(winner: PlayerRole): void {
    this.isGameOver = true;

    if (this.mode === "bot") {
      if (winner === "orange") {
        soundManager.playVictory();
      } else {
        soundManager.playLose();
      }
    } else {
      soundManager.playVictory();
    }

    this.time.delayedCall(GAME_OVER_MODAL_DELAY_MS, () => {
      this.callbacks.onGameOver?.({
        winner,
        score: this.scores,
      });
      this.callbacks.onLifecycleChange?.("finished");
    });
  }

  public restartGame(
    mode: "1v1" | "bot" = this.mode,
    difficulty: "easy" | "medium" | "hard" = this.difficulty
  ): void {
    this.mode = mode;
    this.difficulty = difficulty;
    this.scores = { orange: 0, blue: 0 };
    this.currentSetIndex = 0;
    this.isRoundOver = false;
    this.isGameOver = false;
    this.isPaused = false;

    if (this.flyingOrangeKnife) {
      this.flyingOrangeKnife.destroy();
      this.flyingOrangeKnife = null;
    }
    if (this.flyingBlueKnife) {
      this.flyingBlueKnife.destroy();
      this.flyingBlueKnife = null;
    }

    if (this.readyOrangeKnife) {
      this.readyOrangeKnife.destroy();
      this.readyOrangeKnife = null;
    }
    if (this.readyBlueKnife) {
      this.readyBlueKnife.destroy();
      this.readyBlueKnife = null;
    }

    this.currentSetIndex = 0;
    this.setupTrunkSet(0);
    this.callbacks.onScoreChange?.(this.scores);
    this.callbacks.onLifecycleChange?.("playing");
  }

  public pauseGame(): void {
    this.isPaused = true;
  }

  public resumeGame(): void {
    this.isPaused = false;
  }

  private shutdown(): void {
    this.input.off("pointerdown");
    if (this.readyOrangeKnife) this.readyOrangeKnife.destroy();
    if (this.readyBlueKnife) this.readyBlueKnife.destroy();
    if (this.flyingOrangeKnife) this.flyingOrangeKnife.destroy();
    if (this.flyingBlueKnife) this.flyingBlueKnife.destroy();
    this.embeddedKnives = [];
  }
}
