import Phaser from "phaser";
import {
  BALL_RADIUS,
  COLOR_AIM_DOT,
  COLOR_AIM_LINE,
  COLOR_AIM_POWER_HIGH,
  COLOR_AIM_POWER_LOW,
  COLOR_AIM_POWER_MID,
  COLOR_AIM_PREVIEW_REBOUND,
  COLOR_BLUE_BALL,
  COLOR_BLUE_BALL_SPECULAR,
  COLOR_BUMPER_AMBER,
  COLOR_BUMPER_CHROME,
  COLOR_BUMPER_CYAN,
  COLOR_BUMPER_GLOW,
  COLOR_BUMPER_ORANGE,
  COLOR_CUP_BOTTOM,
  COLOR_CUP_RIM,
  COLOR_CUP_SHADOW,
  COLOR_FAIRWAY_A,
  COLOR_FAIRWAY_B,
  COLOR_FLAG_POLE,
  COLOR_FLAG_POLE_SHADOW,
  COLOR_FLAG_RED,
  COLOR_GREEN_PUTTING,
  COLOR_ORANGE_BALL,
  COLOR_ORANGE_BALL_SPECULAR,
  COLOR_ROUGH_DARK,
  COLOR_ROUGH_LIGHT,
  COLOR_SAND_DEEP,
  COLOR_SAND_GRAIN,
  COLOR_SAND_LIGHT,
  COLOR_SAND_LIP,
  COLOR_WALL_METAL_CORNER,
  COLOR_WALL_SHADOW,
  COLOR_WALL_WOOD_BASE,
  COLOR_WALL_WOOD_RAIL,
  COLOR_WALL_WOOD_TOP,
  COLOR_WATER_DEEP,
  COLOR_WATER_FOAM,
  COLOR_WATER_MID,
  COLOR_WATER_SHORE,
  COLOR_WATER_SURFACE,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_STROKES_PER_HOLE,
} from "../config/constants";
import { COURSES } from "./courses";
import { simulateShot, vecNormalize } from "./physics";
import { MiniGolfBotController } from "./botController";
import type {
  BotDifficulty,
  MiniGolfCallbacks,
  MiniGolfGameMode,
  MiniGolfPlayer,
  MiniGolfScoreCard,
  PhysicsEvent,
  PlayerHoleState,
  SceneInitData,
  SimulationResult,
  TrajectoryPoint,
  Vector2,
} from "./types";

export class MiniGolfScene extends Phaser.Scene {
  private callbacks!: MiniGolfCallbacks;
  private mode: MiniGolfGameMode = "1v1";
  private botDifficulty: BotDifficulty = "medium";
  private localPlayerRole: MiniGolfPlayer = "orange";

  private currentHoleIndex = 0;
  private startingPlayer: MiniGolfPlayer = "orange";
  private currentPlayer: MiniGolfPlayer = "orange";
  private isShotInProgress = false;

  private holeScores: MiniGolfScoreCard = {
    orange: [],
    blue: [],
  };

  private holeState!: {
    orange: PlayerHoleState;
    blue: PlayerHoleState;
  };

  // Graphics containers
  private courseGraphics!: Phaser.GameObjects.Graphics;
  private dynamicGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private movingObstacleGraphics!: Phaser.GameObjects.Graphics;

  // Ball representations
  private orangeBallContainer!: Phaser.GameObjects.Container;
  private blueBallContainer!: Phaser.GameObjects.Container;
  private orangeBallShadow!: Phaser.GameObjects.Arc;
  private blueBallShadow!: Phaser.GameObjects.Arc;
  private orangeBallGfx!: Phaser.GameObjects.Arc;
  private blueBallGfx!: Phaser.GameObjects.Arc;

  // Aiming state
  private isAiming = false;
  private aimStartPos: Vector2 = { x: 0, y: 0 };
  private currentAimVector: Vector2 = { x: 0, y: -1 };
  private currentAimPower = 0;

  // Animation offsets & flags
  private animTimer = 0;
  private hitBumperId: string | null = null;
  private bumperFlashTimer = 0;

  constructor() {
    super({ key: "MiniGolfScene" });
  }

  public init(data: SceneInitData): void {
    this.mode = data.mode ?? "1v1";
    this.botDifficulty = data.botDifficulty ?? "medium";
    this.callbacks = data.callbacks ?? {};
    this.localPlayerRole = data.localPlayerRole ?? "orange";
    this.currentHoleIndex = 0;
    this.startingPlayer = "orange";
    this.currentPlayer = "orange";
    this.isShotInProgress = false;
    this.holeScores = { orange: [], blue: [] };
  }

  public create(): void {
    this.courseGraphics = this.add.graphics();
    this.movingObstacleGraphics = this.add.graphics();
    this.dynamicGraphics = this.add.graphics();
    this.aimGraphics = this.add.graphics();

    this.createBallObjects();
    this.initHole(this.currentHoleIndex);

    // Setup input listeners for drag aiming
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);

    this.callbacks.onTurnChange?.(this.currentPlayer);
    this.callbacks.onHoleChange?.(this.currentHoleIndex);
    this.callbacks.onScoreUpdate?.(this.holeScores);

    this.checkBotTurn();
  }

  private createBallObjects(): void {
    // Orange Ball Container with 3D gradient illusion & drop shadow
    this.orangeBallContainer = this.add.container(0, 0);
    this.orangeBallShadow = this.add.arc(2, 3, BALL_RADIUS, 0, 360, false, 0x000000, 0.4);
    this.orangeBallGfx = this.add.arc(0, 0, BALL_RADIUS, 0, 360, false, COLOR_ORANGE_BALL);
    const orangeSpecular = this.add.arc(
      -2,
      -2,
      BALL_RADIUS * 0.45,
      0,
      360,
      false,
      COLOR_ORANGE_BALL_SPECULAR,
      0.9
    );
    const orangeGlint = this.add.arc(-3, -3, 1.2, 0, 360, false, 0xffffff, 0.95);
    this.orangeBallContainer.add([
      this.orangeBallShadow,
      this.orangeBallGfx,
      orangeSpecular,
      orangeGlint,
    ]);
    this.orangeBallContainer.setDepth(20);

    // Blue Ball Container with 3D gradient illusion & drop shadow
    this.blueBallContainer = this.add.container(0, 0);
    this.blueBallShadow = this.add.arc(2, 3, BALL_RADIUS, 0, 360, false, 0x000000, 0.4);
    this.blueBallGfx = this.add.arc(0, 0, BALL_RADIUS, 0, 360, false, COLOR_BLUE_BALL);
    const blueSpecular = this.add.arc(
      -2,
      -2,
      BALL_RADIUS * 0.45,
      0,
      360,
      false,
      COLOR_BLUE_BALL_SPECULAR,
      0.9
    );
    const blueGlint = this.add.arc(-3, -3, 1.2, 0, 360, false, 0xffffff, 0.95);
    this.blueBallContainer.add([
      this.blueBallShadow,
      this.blueBallGfx,
      blueSpecular,
      blueGlint,
    ]);
    this.blueBallContainer.setDepth(20);
  }

  private initHole(holeIndex: number): void {
    this.currentHoleIndex = holeIndex;
    const course = COURSES[this.currentHoleIndex];

    this.holeState = {
      orange: {
        strokes: 0,
        finished: false,
        ballPosition: { ...course.startPositions.orange },
        lastSafePosition: { ...course.startPositions.orange },
      },
      blue: {
        strokes: 0,
        finished: false,
        ballPosition: { ...course.startPositions.blue },
        lastSafePosition: { ...course.startPositions.blue },
      },
    };

    // Reset ball positions & visibility
    this.orangeBallContainer.setPosition(
      course.startPositions.orange.x,
      course.startPositions.orange.y
    );
    this.orangeBallContainer.setScale(1);
    this.orangeBallContainer.setAlpha(1);

    this.blueBallContainer.setPosition(
      course.startPositions.blue.x,
      course.startPositions.blue.y
    );
    this.blueBallContainer.setScale(1);
    this.blueBallContainer.setAlpha(1);

    this.renderCourseStatic();
    this.callbacks.onHoleChange?.(this.currentHoleIndex);
  }

  private renderCourseStatic(): void {
    const course = COURSES[this.currentHoleIndex];
    this.courseGraphics.clear();

    // 1. Surrounding Deep Rough Grass Background
    this.courseGraphics.fillStyle(COLOR_ROUGH_DARK, 1);
    this.courseGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle natural lawn thatch specks in rough
    this.courseGraphics.fillStyle(COLOR_ROUGH_LIGHT, 0.4);
    for (let i = 0; i < 40; i++) {
      const rx = 10 + ((i * 37) % (GAME_WIDTH - 20));
      const ry = 10 + ((i * 59) % (GAME_HEIGHT - 20));
      this.courseGraphics.fillRect(rx, ry, 3, 2);
    }

    // 2. Fairway Base with Elegant Rounded Border
    this.courseGraphics.fillStyle(COLOR_FAIRWAY_A, 1);
    this.courseGraphics.fillRoundedRect(22, 22, GAME_WIDTH - 44, GAME_HEIGHT - 44, 18);

    // Alternating Two-Tone Fairway Mowing Stripes
    this.courseGraphics.fillStyle(COLOR_FAIRWAY_B, 0.4);
    for (let y = 26; y < GAME_HEIGHT - 30; y += 32) {
      this.courseGraphics.fillRect(24, y, GAME_WIDTH - 48, 16);
    }

    // Putting Green Halo around the Cup
    const hole = course.hole;
    this.courseGraphics.fillStyle(COLOR_GREEN_PUTTING, 0.6);
    this.courseGraphics.fillCircle(hole.x, hole.y, 48);
    this.courseGraphics.fillStyle(COLOR_GREEN_PUTTING, 0.3);
    this.courseGraphics.fillCircle(hole.x, hole.y, 65);

    // Tee-off pads for Orange and Blue
    const spO = course.startPositions.orange;
    const spB = course.startPositions.blue;
    this.courseGraphics.fillStyle(0x000000, 0.2);
    this.courseGraphics.fillCircle(spO.x, spO.y + 1, 12);
    this.courseGraphics.fillCircle(spB.x, spB.y + 1, 12);
    this.courseGraphics.fillStyle(0x27272a, 0.85);
    this.courseGraphics.fillCircle(spO.x, spO.y, 11);
    this.courseGraphics.fillCircle(spB.x, spB.y, 11);
    this.courseGraphics.lineStyle(1.5, COLOR_ORANGE_BALL, 0.8);
    this.courseGraphics.strokeCircle(spO.x, spO.y, 11);
    this.courseGraphics.lineStyle(1.5, COLOR_BLUE_BALL, 0.8);
    this.courseGraphics.strokeCircle(spB.x, spB.y, 11);

    // 3. Sand Bunkers with Natural Lip & Grain Texture
    for (const surface of course.surfaces) {
      if (surface.type === "sand") {
        // Deep shadow under bunker lip
        this.courseGraphics.fillStyle(COLOR_SAND_LIP, 0.9);
        this.courseGraphics.fillRoundedRect(
          surface.x - 2,
          surface.y - 2,
          surface.width + 4,
          surface.height + 4,
          14
        );

        // Golden soft bunker sand
        this.courseGraphics.fillStyle(COLOR_SAND_LIGHT, 1);
        this.courseGraphics.fillRoundedRect(
          surface.x,
          surface.y,
          surface.width,
          surface.height,
          12
        );

        // Shaded sand inner basin
        this.courseGraphics.fillStyle(COLOR_SAND_DEEP, 0.45);
        this.courseGraphics.fillRoundedRect(
          surface.x + 4,
          surface.y + 4,
          surface.width - 8,
          surface.height - 8,
          8
        );

        // Raked Sand Ripple Lines
        this.courseGraphics.lineStyle(1, COLOR_SAND_GRAIN, 0.35);
        for (let sy = surface.y + 12; sy < surface.y + surface.height - 8; sy += 12) {
          this.courseGraphics.beginPath();
          this.courseGraphics.moveTo(surface.x + 8, sy);
          this.courseGraphics.lineTo(surface.x + surface.width - 8, sy);
          this.courseGraphics.strokePath();
        }
      } else if (surface.type === "water") {
        // Water shore embankment
        this.courseGraphics.fillStyle(COLOR_WATER_SHORE, 1);
        this.courseGraphics.fillRoundedRect(
          surface.x - 3,
          surface.y - 3,
          surface.width + 6,
          surface.height + 6,
          12
        );

        // Deep blue lake water
        this.courseGraphics.fillStyle(COLOR_WATER_DEEP, 1);
        this.courseGraphics.fillRoundedRect(
          surface.x,
          surface.y,
          surface.width,
          surface.height,
          10
        );

        // Aqua mid-depth surface
        this.courseGraphics.fillStyle(COLOR_WATER_MID, 0.85);
        this.courseGraphics.fillRoundedRect(
          surface.x + 3,
          surface.y + 3,
          surface.width - 6,
          surface.height - 6,
          8
        );

        // Foam edge rim
        this.courseGraphics.lineStyle(1.5, COLOR_WATER_FOAM, 0.4);
        this.courseGraphics.strokeRoundedRect(
          surface.x + 1,
          surface.y + 1,
          surface.width - 2,
          surface.height - 2,
          9
        );
      }
    }

    // Course 3 Special: Fairway Bridge Planks across the water
    if (this.currentHoleIndex === 2) {
      const bridgeX = 140;
      const bridgeY = 270;
      const bridgeW = 100;
      const bridgeH = 110;

      // Bridge timber floor
      this.courseGraphics.fillStyle(0x78350f, 1);
      this.courseGraphics.fillRect(bridgeX, bridgeY, bridgeW, bridgeH);

      // Wood planks
      this.courseGraphics.lineStyle(1.5, 0x451a03, 0.8);
      for (let py = bridgeY + 10; py < bridgeY + bridgeH; py += 14) {
        this.courseGraphics.beginPath();
        this.courseGraphics.moveTo(bridgeX, py);
        this.courseGraphics.lineTo(bridgeX + bridgeW, py);
        this.courseGraphics.strokePath();
      }

      // Bridge side railings
      this.courseGraphics.fillStyle(0x92400e, 1);
      this.courseGraphics.fillRect(bridgeX - 4, bridgeY, 6, bridgeH);
      this.courseGraphics.fillRect(bridgeX + bridgeW - 2, bridgeY, 6, bridgeH);
      this.courseGraphics.lineStyle(1, 0xfde68a, 0.4);
      this.courseGraphics.strokeRect(bridgeX - 4, bridgeY, 6, bridgeH);
      this.courseGraphics.strokeRect(bridgeX + bridgeW - 2, bridgeY, 6, bridgeH);
    }

    // 4. Boundary Walls with 3D Timber Depth & Fasteners
    // Wall drop shadow
    this.courseGraphics.lineStyle(9, COLOR_WALL_SHADOW, 0.35);
    for (const wall of course.walls) {
      this.courseGraphics.beginPath();
      this.courseGraphics.moveTo(wall.p1.x + 2, wall.p1.y + 3);
      this.courseGraphics.lineTo(wall.p2.x + 2, wall.p2.y + 3);
      this.courseGraphics.strokePath();
    }

    // Deep timber base
    this.courseGraphics.lineStyle(7.5, COLOR_WALL_WOOD_BASE, 1);
    for (const wall of course.walls) {
      this.courseGraphics.beginPath();
      this.courseGraphics.moveTo(wall.p1.x, wall.p1.y);
      this.courseGraphics.lineTo(wall.p2.x, wall.p2.y);
      this.courseGraphics.strokePath();
    }

    // Polished wood top rail
    this.courseGraphics.lineStyle(4, COLOR_WALL_WOOD_TOP, 1);
    for (const wall of course.walls) {
      this.courseGraphics.beginPath();
      this.courseGraphics.moveTo(wall.p1.x, wall.p1.y);
      this.courseGraphics.lineTo(wall.p2.x, wall.p2.y);
      this.courseGraphics.strokePath();
    }

    // Subtle edge highlight
    this.courseGraphics.lineStyle(1.2, COLOR_WALL_WOOD_RAIL, 0.85);
    for (const wall of course.walls) {
      this.courseGraphics.beginPath();
      this.courseGraphics.moveTo(wall.p1.x, wall.p1.y);
      this.courseGraphics.lineTo(wall.p2.x, wall.p2.y);
      this.courseGraphics.strokePath();
    }

    // Metal bracket corner fasteners
    for (const wall of course.walls) {
      this.courseGraphics.fillStyle(COLOR_WALL_METAL_CORNER, 0.9);
      this.courseGraphics.fillCircle(wall.p1.x, wall.p1.y, 2.5);
      this.courseGraphics.fillCircle(wall.p2.x, wall.p2.y, 2.5);
    }

    // 5. Arcade Bumpers with Metallic Chrome Rims & Pulsing Rings
    for (const b of course.bumpers) {
      const isAmber = b.id === "b2";
      const mainColor = isAmber ? COLOR_BUMPER_AMBER : COLOR_BUMPER_ORANGE;
      const ringColor = isAmber ? COLOR_BUMPER_CYAN : COLOR_BUMPER_GLOW;

      // Outer glow aura
      this.courseGraphics.fillStyle(ringColor, 0.3);
      this.courseGraphics.fillCircle(b.x, b.y, b.radius + 5);

      // Chrome rim
      this.courseGraphics.fillStyle(COLOR_BUMPER_CHROME, 1);
      this.courseGraphics.fillCircle(b.x, b.y, b.radius + 1.5);

      // Core bumper surface
      this.courseGraphics.fillStyle(mainColor, 1);
      this.courseGraphics.fillCircle(b.x, b.y, b.radius);

      // Inner neon ring
      this.courseGraphics.lineStyle(2, 0xffffff, 0.85);
      this.courseGraphics.strokeCircle(b.x, b.y, b.radius * 0.65);

      // Center chrome jewel
      this.courseGraphics.fillStyle(0xffffff, 0.95);
      this.courseGraphics.fillCircle(
        b.x - b.radius * 0.25,
        b.y - b.radius * 0.25,
        b.radius * 0.28
      );
    }

    // 6. Realistic 3D Golf Cup & Flagstick
    // Ground cup shadow
    this.courseGraphics.fillStyle(COLOR_CUP_SHADOW, 0.5);
    this.courseGraphics.fillCircle(hole.x, hole.y + 1.5, hole.radius + 1);

    // Deep black cylinder interior
    this.courseGraphics.fillStyle(COLOR_CUP_BOTTOM, 1);
    this.courseGraphics.fillCircle(hole.x, hole.y, hole.radius);

    // White metal cup rim
    this.courseGraphics.lineStyle(1.8, COLOR_CUP_RIM, 0.95);
    this.courseGraphics.strokeCircle(hole.x, hole.y, hole.radius);

    // Inner pin socket
    this.courseGraphics.fillStyle(0x000000, 1);
    this.courseGraphics.fillCircle(hole.x, hole.y, 3.5);
  }

  public update(_time: number, delta: number): void {
    const course = COURSES[this.currentHoleIndex];
    this.animTimer += delta * 0.001;

    this.dynamicGraphics.clear();
    this.movingObstacleGraphics.clear();

    // 1. Animated Multilayer Water Undulations
    for (const surface of course.surfaces) {
      if (surface.type === "water") {
        const cx = surface.x + surface.width / 2;
        const cy = surface.y + surface.height / 2;
        const r1 = 14 + Math.sin(this.animTimer * 2.5) * 5;
        const r2 = 30 + Math.cos(this.animTimer * 2.0) * 7;

        this.dynamicGraphics.lineStyle(1.5, COLOR_WATER_SURFACE, 0.4);
        this.dynamicGraphics.strokeCircle(cx - 15, cy, r1);
        this.dynamicGraphics.lineStyle(1.2, COLOR_WATER_SURFACE, 0.25);
        this.dynamicGraphics.strokeCircle(cx + 15, cy, r2);
      }
    }

    // 2. Animated Flagstick & Fluttering Pennant
    const hole = course.hole;
    const poleHeight = 26;
    const waveOffset = Math.sin(this.animTimer * 6) * 3;

    // Pole cast shadow
    this.dynamicGraphics.lineStyle(2, COLOR_FLAG_POLE_SHADOW, 0.35);
    this.dynamicGraphics.beginPath();
    this.dynamicGraphics.moveTo(hole.x, hole.y);
    this.dynamicGraphics.lineTo(hole.x + 14, hole.y + 7);
    this.dynamicGraphics.strokePath();

    // White pole
    this.dynamicGraphics.lineStyle(2, COLOR_FLAG_POLE, 1);
    this.dynamicGraphics.beginPath();
    this.dynamicGraphics.moveTo(hole.x, hole.y);
    this.dynamicGraphics.lineTo(hole.x, hole.y - poleHeight);
    this.dynamicGraphics.strokePath();

    // Brass finial ball atop pole
    this.dynamicGraphics.fillStyle(0xfde047, 1);
    this.dynamicGraphics.fillCircle(hole.x, hole.y - poleHeight, 2.5);

    // Fluttering triangular golf flag
    this.dynamicGraphics.fillStyle(COLOR_FLAG_RED, 1);
    this.dynamicGraphics.fillTriangle(
      hole.x,
      hole.y - poleHeight,
      hole.x + 14 + waveOffset,
      hole.y - poleHeight + 7,
      hole.x,
      hole.y - poleHeight + 14
    );

    // 3. Moving Sweeper Obstacle (Course 3)
    for (const obs of course.movingObstacles) {
      const phase = (((this.animTimer * 1000) % obs.periodMs) / obs.periodMs) * 2 * Math.PI;
      const alpha = 0.5 + 0.5 * Math.sin(phase);
      const obsX = obs.startX + alpha * (obs.endX - obs.startX);
      const obsY = obs.startY + alpha * (obs.endY - obs.startY);

      // Sweeper arm drop shadow
      this.movingObstacleGraphics.fillStyle(0x000000, 0.3);
      this.movingObstacleGraphics.fillRoundedRect(
        obsX - obs.width / 2 + 3,
        obsY - obs.height / 2 + 4,
        obs.width,
        obs.height,
        5
      );

      // Metallic warning body
      this.movingObstacleGraphics.fillStyle(0xd97706, 1);
      this.movingObstacleGraphics.fillRoundedRect(
        obsX - obs.width / 2,
        obsY - obs.height / 2,
        obs.width,
        obs.height,
        5
      );
      this.movingObstacleGraphics.lineStyle(2, 0x78350f, 1);
      this.movingObstacleGraphics.strokeRoundedRect(
        obsX - obs.width / 2,
        obsY - obs.height / 2,
        obs.width,
        obs.height,
        5
      );

      // Diagonal hazard stripes
      this.movingObstacleGraphics.fillStyle(0xfef08a, 0.9);
      this.movingObstacleGraphics.fillRect(obsX - 10, obsY - obs.height / 2 + 2, 5, obs.height - 4);
      this.movingObstacleGraphics.fillRect(obsX + 4, obsY - obs.height / 2 + 2, 5, obs.height - 4);
    }

    // 4. Bumper Flash upon impact
    if (this.hitBumperId && this.bumperFlashTimer > 0) {
      this.bumperFlashTimer -= delta;
      const b = course.bumpers.find((item) => item.id === this.hitBumperId);
      if (b) {
        this.dynamicGraphics.fillStyle(0xffffff, 0.7);
        this.dynamicGraphics.fillCircle(b.x, b.y, b.radius + 6);
      }
      if (this.bumperFlashTimer <= 0) {
        this.hitBumperId = null;
      }
    }

    // 5. Render active aim guide & trajectory preview
    this.renderAimGuide();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isShotInProgress) return;

    if (this.mode === "vs-bot" && this.currentPlayer === "blue") return;
    if (this.mode === "online" && this.currentPlayer !== this.localPlayerRole) return;

    const currentBall =
      this.currentPlayer === "orange"
        ? this.holeState.orange
        : this.holeState.blue;

    if (currentBall.finished) return;

    // Check click/touch proximity to active ball
    const dist = Math.hypot(
      pointer.x - currentBall.ballPosition.x,
      pointer.y - currentBall.ballPosition.y
    );
    if (dist < 60) {
      this.isAiming = true;
      this.aimStartPos = { ...currentBall.ballPosition };
      this.currentAimVector = { x: 0, y: -1 };
      this.currentAimPower = 0;
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isAiming) return;

    // Slingshot control: dragging backward aims and powers forward!
    const dragDx = this.aimStartPos.x - pointer.x;
    const dragDy = this.aimStartPos.y - pointer.y;
    const dragLen = Math.hypot(dragDx, dragDy);

    if (dragLen > 4) {
      this.currentAimVector = { x: dragDx / dragLen, y: dragDy / dragLen };
      // 100px drag equals 100% full power
      this.currentAimPower = Math.min(1.0, dragLen / 100);
    } else {
      this.currentAimPower = 0;
    }
  }

  private handlePointerUp(): void {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.aimGraphics.clear();

    if (this.currentAimPower < 0.05) {
      // Small tap: cancel without shooting
      return;
    }

    if (this.mode === "online") {
      // In online mode, send intent to server!
      this.callbacks.onShotIntent?.({
        aim: { ...this.currentAimVector },
        power: this.currentAimPower,
      });
      return;
    }

    // Local / Bot mode
    this.executePlayerShot(this.currentPlayer, this.currentAimVector, this.currentAimPower);
  }

  private renderAimGuide(): void {
    this.aimGraphics.clear();
    if (!this.isAiming || this.currentAimPower < 0.04) return;

    const currentBall =
      this.currentPlayer === "orange"
        ? this.holeState.orange
        : this.holeState.blue;

    const bx = currentBall.ballPosition.x;
    const by = currentBall.ballPosition.y;
    const course = COURSES[this.currentHoleIndex];

    // 1. Run a lightweight deterministic physics preview (first 45 steps)
    const previewSim = simulateShot(
      course,
      { x: bx, y: by },
      this.currentAimVector,
      this.currentAimPower,
      Date.now()
    );

    const traj = previewSim.trajectory.slice(0, 14);

    // 2. Render Trajectory Path with Dotted Guide & First Rebound
    let hasBounced = false;
    for (let i = 1; i < traj.length; i++) {
      const pt = traj[i];
      const prev = traj[i - 1];

      // Detect reflection in preview
      const dot = (pt.vx ?? 0) * (prev.vx ?? 0) + (pt.vy ?? 0) * (prev.vy ?? 0);
      if (dot < 0) hasBounced = true;

      const dotColor = hasBounced ? COLOR_AIM_PREVIEW_REBOUND : COLOR_AIM_DOT;
      const alpha = 0.85 - (i / traj.length) * 0.5;
      const radius = 2.2 - (i / traj.length) * 0.8;

      this.aimGraphics.fillStyle(dotColor, alpha);
      this.aimGraphics.fillCircle(pt.x, pt.y, Math.max(1.2, radius));
    }

    // 3. Arrow Tip on immediate launch vector
    const launchDist = 22 + this.currentAimPower * 25;
    const arrowX = bx + this.currentAimVector.x * launchDist;
    const arrowY = by + this.currentAimVector.y * launchDist;
    const norm = vecNormalize(this.currentAimVector);
    const perpX = -norm.y;
    const perpY = norm.x;

    this.aimGraphics.fillStyle(COLOR_AIM_LINE, 0.95);
    this.aimGraphics.fillTriangle(
      arrowX,
      arrowY,
      arrowX - norm.x * 7 + perpX * 4,
      arrowY - norm.y * 7 + perpY * 4,
      arrowX - norm.x * 7 - perpX * 4,
      arrowY - norm.y * 7 - perpY * 4
    );

    // 4. Circular Power Arc surrounding the ball
    const meterRadius = BALL_RADIUS + 7;
    const powerPct = this.currentAimPower;
    let meterColor = COLOR_AIM_POWER_LOW;
    if (powerPct > 0.7) meterColor = COLOR_AIM_POWER_HIGH;
    else if (powerPct > 0.4) meterColor = COLOR_AIM_POWER_MID;

    this.aimGraphics.lineStyle(3.5, meterColor, 0.9);
    this.aimGraphics.beginPath();
    const startAngle = Math.atan2(this.currentAimVector.y, this.currentAimVector.x) - Math.PI / 2;
    const endAngle = startAngle + powerPct * Math.PI * 2;
    this.aimGraphics.arc(bx, by, meterRadius, startAngle, endAngle, false);
    this.aimGraphics.strokePath();
  }

  public executePlayerShot(
    player: MiniGolfPlayer,
    aim: Vector2,
    power: number
  ): void {
    if (this.isShotInProgress) return;
    this.isShotInProgress = true;

    const course = COURSES[this.currentHoleIndex];
    const playerHole = this.holeState[player];

    // Trigger swing swoosh & ball strike sound
    this.callbacks.onAudioPlay?.("swing");
    this.callbacks.onAudioPlay?.("hit");

    const sim = simulateShot(course, playerHole.ballPosition, aim, power, Date.now());

    this.animateShot(player, sim, () => {
      playerHole.strokes += 1;

      if (sim.waterHazard) {
        playerHole.strokes += 1; // +1 penalty stroke
        playerHole.ballPosition = { ...playerHole.lastSafePosition };
        this.showWaterHazardBanner();
        this.callbacks.onAudioPlay?.("water");
      } else {
        playerHole.ballPosition = { ...sim.finalPosition };
        playerHole.lastSafePosition = { ...sim.finalPosition };
      }

      if (sim.sunk) {
        playerHole.finished = true;
        this.callbacks.onAudioPlay?.("sink");
      } else if (playerHole.strokes >= MAX_STROKES_PER_HOLE) {
        playerHole.finished = true;
      }

      this.callbacks.onScoreUpdate?.(this.holeScores);

      const otherPlayer: MiniGolfPlayer = player === "orange" ? "blue" : "orange";
      const otherHole = this.holeState[otherPlayer];

      if (playerHole.finished && otherHole.finished) {
        // Record hole completion
        this.callbacks.onAudioPlay?.("holeComplete");
        this.holeScores.orange.push(this.holeState.orange.strokes);
        this.holeScores.blue.push(this.holeState.blue.strokes);
        this.callbacks.onScoreUpdate?.(this.holeScores);

        if (this.currentHoleIndex < COURSES.length - 1) {
          // Transition to next hole
          this.time.delayedCall(1300, () => {
            this.callbacks.onAudioPlay?.("scorecard");
            const nextHoleIndex = this.currentHoleIndex + 1;
            this.currentPlayer = nextHoleIndex % 2 === 0 ? "orange" : "blue";
            this.initHole(nextHoleIndex);
            this.isShotInProgress = false;
            this.callbacks.onTurnChange?.(this.currentPlayer);
            this.checkBotTurn();
          });
        } else {
          // Match Complete!
          this.time.delayedCall(1100, () => {
            const orangeTotal = this.holeScores.orange.reduce((a, b) => a + b, 0);
            const blueTotal = this.holeScores.blue.reduce((a, b) => a + b, 0);
            let winner: MiniGolfPlayer | "draw" = "draw";
            if (orangeTotal < blueTotal) winner = "orange";
            else if (blueTotal < orangeTotal) winner = "blue";

            this.callbacks.onGameOver?.({
              winner,
              scores: this.holeScores,
              totalOrange: orangeTotal,
              totalBlue: blueTotal,
            });
          });
        }
      } else {
        // Hole continues
        if (!otherHole.finished) {
          this.currentPlayer = otherPlayer;
        } else {
          this.currentPlayer = player;
        }
        this.isShotInProgress = false;
        this.callbacks.onTurnChange?.(this.currentPlayer);
        this.checkBotTurn();
      }
    });
  }

  private animateShot(
    player: MiniGolfPlayer,
    sim: SimulationResult,
    onComplete: () => void
  ): void {
    const ballContainer =
      player === "orange" ? this.orangeBallContainer : this.blueBallContainer;

    const traj = sim.trajectory;
    if (traj.length <= 1) {
      ballContainer.setPosition(sim.finalPosition.x, sim.finalPosition.y);
      onComplete();
      return;
    }

    let currentIndex = 0;

    // Schedule audio events along trajectory
    for (const ev of sim.events) {
      if (ev.type === "wall_bounce") {
        this.time.delayedCall(ev.step * (1000 / 120), () => {
          this.callbacks.onAudioPlay?.("bounce");
        });
      } else if (ev.type === "bumper_hit") {
        this.time.delayedCall(ev.step * (1000 / 120), () => {
          this.callbacks.onAudioPlay?.("bumper");
          this.hitBumperId = ((ev.extra as Record<string, unknown> | undefined)?.bumperId as string) ?? null;
          this.bumperFlashTimer = 160;
        });
      }
    }

    const timer = this.time.addEvent({
      delay: 1000 / 40, // 40Hz trajectory playback
      repeat: traj.length - 1,
      callback: () => {
        if (currentIndex < traj.length) {
          const pt = traj[currentIndex];
          ballContainer.setPosition(pt.x, pt.y);
          currentIndex++;
        }

        if (currentIndex >= traj.length) {
          timer.remove();
          if (sim.sunk) {
            // Sinking spiral into hole center
            this.tweens.add({
              targets: ballContainer,
              scale: 0.1,
              alpha: 0,
              duration: 350,
              ease: "Cubic.easeIn",
              onComplete: () => {
                onComplete();
              },
            });
          } else {
            ballContainer.setPosition(sim.finalPosition.x, sim.finalPosition.y);
            onComplete();
          }
        }
      },
    });
  }

  private checkBotTurn(): void {
    if (this.mode !== "vs-bot" || this.currentPlayer !== "blue" || this.isShotInProgress) {
      return;
    }

    const botHole = this.holeState.blue;
    if (botHole.finished) return;

    const course = COURSES[this.currentHoleIndex];

    // Realistic human hesitation before aiming
    this.time.delayedCall(650, () => {
      if (this.currentPlayer !== "blue" || this.isShotInProgress) return;

      const decision = MiniGolfBotController.calculateShot(
        course,
        botHole.ballPosition,
        this.botDifficulty
      );

      // Brief aim preview display for bot
      this.isAiming = true;
      this.aimStartPos = { ...botHole.ballPosition };
      this.currentAimVector = decision.aim;
      this.currentAimPower = decision.power;

      this.time.delayedCall(550, () => {
        this.isAiming = false;
        this.aimGraphics.clear();
        this.executePlayerShot("blue", decision.aim, decision.power);
      });
    });
  }

  private showWaterHazardBanner(): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, "WATER HAZARD! +1 PENALTY", {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#0369a1",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.tweens.add({
      targets: banner,
      y: GAME_HEIGHT / 2 - 55,
      alpha: 0,
      duration: 1600,
      ease: "Cubic.easeOut",
      onComplete: () => {
        banner.destroy();
      },
    });
  }

  public playAuthoritativeShot(
    player: MiniGolfPlayer,
    trajectory: TrajectoryPoint[],
    events: PhysicsEvent[],
    finalPosition: Vector2,
    sunk: boolean,
    waterHazard: boolean,
    onComplete?: () => void
  ): void {
    this.isShotInProgress = true;
    this.callbacks.onAudioPlay?.("swing");
    this.callbacks.onAudioPlay?.("hit");

    const sim: SimulationResult = {
      trajectory,
      events,
      finalPosition,
      sunk,
      waterHazard,
      settled: true,
      totalSteps: trajectory.length,
    };

    this.animateShot(player, sim, () => {
      this.isShotInProgress = false;
      if (waterHazard) {
        this.showWaterHazardBanner();
        this.callbacks.onAudioPlay?.("water");
      }
      if (sunk) {
        this.callbacks.onAudioPlay?.("sink");
      }
      onComplete?.();
    });
  }

  public syncAuthoritativeState(
    holeIndex: number,
    currentPlayer: MiniGolfPlayer,
    orangePos: Vector2,
    bluePos: Vector2,
    orangeFinished: boolean,
    blueFinished: boolean
  ): void {
    if (this.currentHoleIndex !== holeIndex) {
      this.initHole(holeIndex);
    }

    this.currentPlayer = currentPlayer;
    this.holeState.orange.ballPosition = { ...orangePos };
    this.holeState.orange.finished = orangeFinished;
    this.holeState.blue.ballPosition = { ...bluePos };
    this.holeState.blue.finished = blueFinished;

    if (!this.isShotInProgress) {
      this.orangeBallContainer.setPosition(orangePos.x, orangePos.y);
      this.orangeBallContainer.setAlpha(orangeFinished ? 0 : 1);
      this.blueBallContainer.setPosition(bluePos.x, bluePos.y);
      this.blueBallContainer.setAlpha(blueFinished ? 0 : 1);
    }
  }

  public restartMatch(): void {
    this.currentHoleIndex = 0;
    this.startingPlayer = "orange";
    this.currentPlayer = "orange";
    this.isShotInProgress = false;
    this.holeScores = { orange: [], blue: [] };
    this.initHole(0);
    this.callbacks.onTurnChange?.(this.currentPlayer);
    this.callbacks.onScoreUpdate?.(this.holeScores);
    this.checkBotTurn();
  }
}
