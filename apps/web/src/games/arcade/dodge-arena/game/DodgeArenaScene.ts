import Phaser from "phaser";
import {
  ARENA_BOTTOM,
  ARENA_HEIGHT,
  ARENA_LEFT,
  ARENA_RIGHT,
  ARENA_TOP,
  ARENA_WIDTH,
  COLOR_ARENA_BORDER,
  COLOR_ARENA_FLOOR,
  COLOR_ARENA_GRID,
  COLOR_BG,
  COLOR_BLUE,
  COLOR_HAZARD_ACTIVE,
  COLOR_HAZARD_AMBER,
  COLOR_HAZARD_WARNING,
  COLOR_ORANGE,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_RADIUS,
} from "../config/balance";
import { DodgeArenaBotController } from "../bot/botController";
import { getLaserSegments } from "../logic/hazards";
import { DodgeArenaSimulation } from "../logic/simulation";
import type {
  BotDifficulty,
  DodgePlayerColor,
  GameMode,
  PlayerInput,
  PlayerSimState,
} from "../logic/types";
import { dodgeAudio } from "./audio";

export interface DodgeArenaCallbacks {
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (winner: DodgePlayerColor | "draw") => void;
  onLivesUpdate?: (lives: { orange: number; blue: number }) => void;
  onWaveUpdate?: (wave: number) => void;
}

export interface OnlineDodgeCallbacks {
  sendInput?: (dx: number, dy: number, seq: number) => void;
  sendGameEvent?: (event: string, data?: unknown) => void;
  myRole?: DodgePlayerColor;
  isHost?: boolean;
}

export interface SceneInitData {
  mode: GameMode;
  difficulty?: BotDifficulty;
  callbacks: DodgeArenaCallbacks;
  localPlayerRole?: DodgePlayerColor;
  isHost?: boolean;
  online?: OnlineDodgeCallbacks;
  seed?: number;
}

export class DodgeArenaScene extends Phaser.Scene {
  private mode: GameMode = "1v1";
  private difficulty: BotDifficulty = "medium";
  private callbacks!: DodgeArenaCallbacks;
  private localPlayerRole: DodgePlayerColor = "orange";
  private isHost = true;
  private onlineConfig: OnlineDodgeCallbacks | null = null;

  // Simulation & Bot
  public simulation!: DodgeArenaSimulation;
  private botController: DodgeArenaBotController | null = null;

  // Keyboard inputs
  private orangeKeyInput: PlayerInput = { dx: 0, dy: 0 };
  private blueKeyInput: PlayerInput = { dx: 0, dy: 0 };

  // Mouse inputs (Click or Click-and-Hold steering)
  private orangeMouseInput: PlayerInput = { dx: 0, dy: 0 };
  private blueMouseInput: PlayerInput = { dx: 0, dy: 0 };
  private isPointerDown = false;
  private currentPointerPos = { x: 0, y: 0 };
  private activePointerType: "mouse" | "touch" = "mouse";

  // Touch inputs (Virtual joystick)
  private orangeTouchInput: PlayerInput = { dx: 0, dy: 0 };
  private blueTouchInput: PlayerInput = { dx: 0, dy: 0 };
  private orangePointerId: number | null = null;
  private bluePointerId: number | null = null;
  private orangeTouchOrigin: { x: number; y: number } | null = null;
  private blueTouchOrigin: { x: number; y: number } | null = null;

  // Remote network input (Online mode)
  private remoteInput: PlayerInput = { dx: 0, dy: 0 };

  // Keyboard keys
  private keysWASD!: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private keysArrows!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Visual Graphics layers
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private hazardGraphics!: Phaser.GameObjects.Graphics;
  private playerGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private touchControlsGraphics!: Phaser.GameObjects.Graphics;

  // Visual Effects state
  private playerTrails: {
    orange: Array<{ x: number; y: number; alpha: number }>;
    blue: Array<{ x: number; y: number; alpha: number }>;
  } = { orange: [], blue: [] };
  private trailSpawnTimer = 0;

  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    radius: number;
    alpha: number;
    maxLife: number;
    currentLife: number;
  }> = [];

  private shockwaves: Array<{
    x: number;
    y: number;
    currentRadius: number;
    maxRadius: number;
    color: number;
    alpha: number;
    lineWidth: number;
  }> = [];

  private damageFlashTimers: { orange: number; blue: number } = { orange: 0, blue: 0 };
  private waveBanner: { wave: number; timer: number; duration: number } | null = null;
  private waveText: Phaser.GameObjects.Text | null = null;

  // Online network sequence & input rate throttle
  private inputSequence = 0;
  private lastSentInput: { dx: number; dy: number } = { dx: 0, dy: 0 };
  private lastInputSendTime = 0;

  // State flags
  private isPaused = false;
  public isMatchStarted = false;

  constructor() {
    super({ key: "DodgeArenaScene" });
  }

  public init(data: SceneInitData): void {
    this.mode = data.mode ?? "1v1";
    this.difficulty = data.difficulty ?? "medium";
    this.callbacks = data.callbacks ?? {};
    this.localPlayerRole = data.localPlayerRole ?? "orange";
    this.isHost = data.isHost ?? true;
    this.onlineConfig = data.online ?? null;

    const seed = data.seed ?? Math.floor(Math.random() * 1000000);
    this.simulation = new DodgeArenaSimulation(seed);

    if (this.mode === "bot") {
      this.botController = new DodgeArenaBotController("blue", this.difficulty);
    } else {
      this.botController = null;
    }

    this.isPaused = false;
    this.isMatchStarted = false;
    this.orangeKeyInput = { dx: 0, dy: 0 };
    this.blueKeyInput = { dx: 0, dy: 0 };
    this.orangeMouseInput = { dx: 0, dy: 0 };
    this.blueMouseInput = { dx: 0, dy: 0 };
    this.orangeTouchInput = { dx: 0, dy: 0 };
    this.blueTouchInput = { dx: 0, dy: 0 };
    this.remoteInput = { dx: 0, dy: 0 };
    this.isPointerDown = false;
    this.particles = [];
    this.shockwaves = [];
    this.playerTrails = { orange: [], blue: [] };
    this.damageFlashTimers = { orange: 0, blue: 0 };
    this.waveBanner = null;
  }

  public create(): void {
    // 1. Setup Graphics Layers
    this.arenaGraphics = this.add.graphics().setDepth(0);
    this.hazardGraphics = this.add.graphics().setDepth(10);
    this.playerGraphics = this.add.graphics().setDepth(20);
    this.fxGraphics = this.add.graphics().setDepth(25);
    this.touchControlsGraphics = this.add.graphics().setDepth(30);

    // Wave announcement banner text
    this.waveText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        fontFamily: "monospace, system-ui, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#fbbf24",
        stroke: "#0f172a",
        strokeThickness: 5,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: "#f59e0b",
          blur: 16,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(26)
      .setVisible(false);

    // 2. Render Arena Geometry
    this.drawArena();

    // 3. Setup Input Handlers (Keyboard, Mouse, Touch)
    this.setupInputHandlers();

    // 4. Handle Canvas Resize Events
    this.scale.on("resize", () => {
      this.drawArena();
    });

    // Notify initial state
    this.callbacks.onLivesUpdate?.({
      orange: this.simulation.state.players.orange.lives,
      blue: this.simulation.state.players.blue.lives,
    });
    this.callbacks.onWaveUpdate?.(this.simulation.state.wave);

    // Initial render of players
    this.drawPlayers();
  }

  public startMatch(): void {
    this.isMatchStarted = true;
    this.isPaused = false;
  }

  public pauseGame(): void {
    this.isPaused = true;
  }

  public resumeGame(): void {
    this.isPaused = false;
  }

  public restartGame(mode?: GameMode, difficulty?: BotDifficulty, seed?: number): void {
    if (mode) this.mode = mode;
    if (difficulty) {
      this.difficulty = difficulty;
      this.botController?.setDifficulty(difficulty);
    }

    this.simulation.reset(seed ?? Math.floor(Math.random() * 1000000));
    this.botController?.reset();

    this.orangeKeyInput = { dx: 0, dy: 0 };
    this.blueKeyInput = { dx: 0, dy: 0 };
    this.orangeMouseInput = { dx: 0, dy: 0 };
    this.blueMouseInput = { dx: 0, dy: 0 };
    this.orangeTouchInput = { dx: 0, dy: 0 };
    this.blueTouchInput = { dx: 0, dy: 0 };
    this.remoteInput = { dx: 0, dy: 0 };
    this.orangePointerId = null;
    this.bluePointerId = null;
    this.orangeTouchOrigin = null;
    this.blueTouchOrigin = null;
    this.isPointerDown = false;
    this.particles = [];
    this.shockwaves = [];
    this.playerTrails = { orange: [], blue: [] };
    this.damageFlashTimers = { orange: 0, blue: 0 };
    this.waveBanner = null;
    this.waveText?.setVisible(false);

    this.isPaused = false;
    this.isMatchStarted = true;

    this.callbacks.onLivesUpdate?.({
      orange: this.simulation.state.players.orange.lives,
      blue: this.simulation.state.players.blue.lives,
    });
    this.callbacks.onWaveUpdate?.(this.simulation.state.wave);
  }

  public update(_time: number, delta: number): void {
    if (this.isPaused || !this.isMatchStarted) {
      this.drawPlayers();
      return;
    }

    const dt = Math.min(delta / 1000, 0.05); // Clamp dt to prevent tunneling on lag spike

    // 1. Poll Desktop Keyboard
    this.pollKeyboard();

    // 2. Poll Mouse Click & Hold Steering
    if (this.isPointerDown && this.activePointerType === "mouse") {
      this.updateMouseSteering(this.currentPointerPos.x, this.currentPointerPos.y);
    }

    // 3. Resolve Inputs for Orange and Blue
    const orangeInput: PlayerInput = {
      dx:
        this.orangeKeyInput.dx !== 0
          ? this.orangeKeyInput.dx
          : this.orangeTouchInput.dx !== 0
          ? this.orangeTouchInput.dx
          : this.orangeMouseInput.dx,
      dy:
        this.orangeKeyInput.dy !== 0
          ? this.orangeKeyInput.dy
          : this.orangeTouchInput.dy !== 0
          ? this.orangeTouchInput.dy
          : this.orangeMouseInput.dy,
    };

    const blueInputLocal: PlayerInput = {
      dx:
        this.blueKeyInput.dx !== 0
          ? this.blueKeyInput.dx
          : this.blueTouchInput.dx !== 0
          ? this.blueTouchInput.dx
          : this.blueMouseInput.dx,
      dy:
        this.blueKeyInput.dy !== 0
          ? this.blueKeyInput.dy
          : this.blueTouchInput.dy !== 0
          ? this.blueTouchInput.dy
          : this.blueMouseInput.dy,
    };

    let finalOrangeInput: PlayerInput;
    let finalBlueInput: PlayerInput;

    if (this.mode === "1v1") {
      finalOrangeInput = orangeInput;
      finalBlueInput = blueInputLocal;
    } else if (this.mode === "bot") {
      finalOrangeInput = orangeInput;
      finalBlueInput = this.botController?.update(this.simulation.state, dt) ?? { dx: 0, dy: 0 };
    } else {
      // Online mode: Local player controls their assigned character
      const localInput: PlayerInput =
        this.localPlayerRole === "orange" ? orangeInput : blueInputLocal;

      if (this.localPlayerRole === "orange") {
        finalOrangeInput = localInput;
        finalBlueInput = this.remoteInput;
      } else {
        finalOrangeInput = this.remoteInput;
        finalBlueInput = localInput;
      }

      // Send local input across network if changed or throttled
      this.sendOnlineInput(localInput, _time);
    }

    // 4. Step pure simulation
    const events = this.simulation.step(dt, finalOrangeInput, finalBlueInput);

    // 5. Handle Simulation Events (Audio & Callbacks)
    for (const ev of events) {
      if (ev.type === "player_hit") {
        dodgeAudio.playHit();
        this.cameras.main.shake(160, 0.008);
        const playerRole = ev.data.player as DodgePlayerColor;
        this.damageFlashTimers[playerRole] = 0.18;
        const hitPlayer = this.simulation.state.players[playerRole];
        if (hitPlayer) {
          this.spawnHitEffects(hitPlayer.x, hitPlayer.y, playerRole);
        }
        this.callbacks.onLivesUpdate?.({
          orange: this.simulation.state.players.orange.lives,
          blue: this.simulation.state.players.blue.lives,
        });
      } else if (ev.type === "player_eliminated") {
        dodgeAudio.playEliminated();
        this.cameras.main.shake(300, 0.015);
        const playerRole = ev.data.player as DodgePlayerColor;
        const elimPlayer = this.simulation.state.players[playerRole];
        if (elimPlayer) {
          this.spawnEliminationEffects(elimPlayer.x, elimPlayer.y, playerRole);
        }
      } else if (ev.type === "hazard_spawned") {
        dodgeAudio.playWarning();
      } else if (ev.type === "hazard_activated") {
        dodgeAudio.playImpact();
      } else if (ev.type === "wave_advanced") {
        const wave = ev.data.wave as number;
        this.waveBanner = { wave, timer: 1.4, duration: 1.4 };
        this.callbacks.onWaveUpdate?.(wave);
      } else if (ev.type === "game_over") {
        const winner = ev.data.winner as DodgePlayerColor | "draw";
        if (winner === "draw") {
          dodgeAudio.playDefeat();
        } else if (this.mode === "online") {
          if (winner === this.localPlayerRole) {
            dodgeAudio.playVictory();
          } else {
            dodgeAudio.playDefeat();
          }
        } else if (this.mode === "bot") {
          if (winner === "orange") {
            dodgeAudio.playVictory();
          } else {
            dodgeAudio.playDefeat();
          }
        } else {
          dodgeAudio.playVictory();
        }
        this.callbacks.onGameOver?.(winner);
      }
    }

    // 6. Update Visual Effects & Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.currentLife -= dt;
      if (p.currentLife <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.alpha = Math.max(0, p.currentLife / p.maxLife);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.currentRadius += (sw.maxRadius - sw.currentRadius) * (dt * 12);
      sw.alpha -= dt * 2.5;
      if (sw.alpha <= 0 || sw.currentRadius >= sw.maxRadius - 1) {
        this.shockwaves.splice(i, 1);
      }
    }

    if (this.damageFlashTimers.orange > 0) {
      this.damageFlashTimers.orange -= dt;
    }
    if (this.damageFlashTimers.blue > 0) {
      this.damageFlashTimers.blue -= dt;
    }

    this.trailSpawnTimer += dt;
    if (this.trailSpawnTimer >= 0.04) {
      this.trailSpawnTimer = 0;
      const o = this.simulation.state.players.orange;
      if (o.isAlive && Math.hypot(o.vx, o.vy) > 20) {
        this.playerTrails.orange.push({ x: o.x, y: o.y, alpha: 0.4 });
        if (this.playerTrails.orange.length > 5) {
          this.playerTrails.orange.shift();
        }
      }
      const b = this.simulation.state.players.blue;
      if (b.isAlive && Math.hypot(b.vx, b.vy) > 20) {
        this.playerTrails.blue.push({ x: b.x, y: b.y, alpha: 0.4 });
        if (this.playerTrails.blue.length > 5) {
          this.playerTrails.blue.shift();
        }
      }
    }

    for (const trail of this.playerTrails.orange) {
      trail.alpha -= dt * 2.5;
    }
    this.playerTrails.orange = this.playerTrails.orange.filter((t) => t.alpha > 0);

    for (const trail of this.playerTrails.blue) {
      trail.alpha -= dt * 2.5;
    }
    this.playerTrails.blue = this.playerTrails.blue.filter((t) => t.alpha > 0);

    if (this.waveBanner) {
      this.waveBanner.timer -= dt;
      if (this.waveBanner.timer <= 0) {
        this.waveBanner = null;
        this.waveText?.setVisible(false);
      } else {
        const alpha = Math.sin((this.waveBanner.timer / this.waveBanner.duration) * Math.PI);
        this.waveText?.setText(`WAVE ${this.waveBanner.wave}`);
        this.waveText?.setAlpha(alpha);
        this.waveText?.setScale(1.0 + (1 - alpha) * 0.12);
        this.waveText?.setVisible(true);
      }
    }

    // 7. Render Updated Frame
    this.drawHazards();
    this.drawPlayers();
    this.drawFX();
    this.drawTouchControls();
  }

  public applyRemoteInput(role: DodgePlayerColor, input: PlayerInput): void {
    if (this.mode !== "online") return;
    this.remoteInput = input;
  }

  private sendOnlineInput(input: PlayerInput, now: number): void {
    if (!this.onlineConfig?.sendInput) return;

    const hasChanged =
      Math.abs(input.dx - this.lastSentInput.dx) > 0.05 ||
      Math.abs(input.dy - this.lastSentInput.dy) > 0.05;

    const timeSinceLast = now - this.lastInputSendTime;

    if (hasChanged || timeSinceLast >= 50) {
      this.inputSequence++;
      this.lastSentInput = { dx: input.dx, dy: input.dy };
      this.lastInputSendTime = now;
      this.onlineConfig.sendInput(input.dx, input.dy, this.inputSequence);
    }
  }

  private pollKeyboard(): void {
    // Orange WASD
    let odx = 0;
    let ody = 0;
    if (this.keysWASD) {
      if (this.keysWASD.w.isDown) ody -= 1;
      if (this.keysWASD.s.isDown) ody += 1;
      if (this.keysWASD.a.isDown) odx -= 1;
      if (this.keysWASD.d.isDown) odx += 1;
    }
    this.orangeKeyInput = { dx: odx, dy: ody };

    // Blue Arrow keys
    let bdx = 0;
    let bdy = 0;
    if (this.keysArrows) {
      if (this.keysArrows.up.isDown) bdy -= 1;
      if (this.keysArrows.down.isDown) bdy += 1;
      if (this.keysArrows.left.isDown) bdx -= 1;
      if (this.keysArrows.right.isDown) bdx += 1;
    }
    this.blueKeyInput = { dx: bdx, dy: bdy };
  }

  private updateMouseSteering(px: number, py: number): void {
    const clampedX = Phaser.Math.Clamp(px, ARENA_LEFT + PLAYER_RADIUS, ARENA_RIGHT - PLAYER_RADIUS);
    const clampedY = Phaser.Math.Clamp(py, ARENA_TOP + PLAYER_RADIUS, ARENA_BOTTOM - PLAYER_RADIUS);

    if (this.mode === "1v1") {
      // Split arena: bottom half steers Orange, top half steers Blue
      if (py > GAME_HEIGHT / 2) {
        const orange = this.simulation.state.players.orange;
        if (orange.isAlive) {
          const dx = clampedX - orange.x;
          const dy = clampedY - orange.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            const speed = Math.min(1.0, dist / 40);
            this.orangeMouseInput = { dx: (dx / dist) * speed, dy: (dy / dist) * speed };
          } else {
            this.orangeMouseInput = { dx: 0, dy: 0 };
          }
        }
      } else {
        const blue = this.simulation.state.players.blue;
        if (blue.isAlive) {
          const dx = clampedX - blue.x;
          const dy = clampedY - blue.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            const speed = Math.min(1.0, dist / 40);
            this.blueMouseInput = { dx: (dx / dist) * speed, dy: (dy / dist) * speed };
          } else {
            this.blueMouseInput = { dx: 0, dy: 0 };
          }
        }
      }
    } else if (this.mode === "bot") {
      // Human controls Orange
      const orange = this.simulation.state.players.orange;
      if (orange.isAlive) {
        const dx = clampedX - orange.x;
        const dy = clampedY - orange.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          const speed = Math.min(1.0, dist / 40);
          this.orangeMouseInput = { dx: (dx / dist) * speed, dy: (dy / dist) * speed };
        } else {
          this.orangeMouseInput = { dx: 0, dy: 0 };
        }
      }
    } else {
      // Online mode: controls assigned role
      const targetRole = this.localPlayerRole;
      const target = this.simulation.state.players[targetRole];
      if (target && target.isAlive) {
        const dx = clampedX - target.x;
        const dy = clampedY - target.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          const speed = Math.min(1.0, dist / 40);
          const input = { dx: (dx / dist) * speed, dy: (dy / dist) * speed };
          if (targetRole === "orange") {
            this.orangeMouseInput = input;
          } else {
            this.blueMouseInput = input;
          }
        } else {
          if (targetRole === "orange") {
            this.orangeMouseInput = { dx: 0, dy: 0 };
          } else {
            this.blueMouseInput = { dx: 0, dy: 0 };
          }
        }
      }
    }
  }

  private setupInputHandlers(): void {
    // 1. Keyboard
    if (this.input.keyboard) {
      this.keysWASD = {
        w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.keysArrows = this.input.keyboard.createCursorKeys();
    }

    // 2. Mouse & Multi-touch Pointers
    const maxRadius = 45;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.activePointerType = pointer.wasTouch ? "touch" : "mouse";
      this.currentPointerPos = { x: pointer.x, y: pointer.y };

      if (this.activePointerType === "touch") {
        if (this.mode === "1v1") {
          if (pointer.y > GAME_HEIGHT / 2 && this.orangePointerId === null) {
            this.orangePointerId = pointer.id;
            this.orangeTouchOrigin = { x: pointer.x, y: pointer.y };
            this.orangeTouchInput = { dx: 0, dy: 0 };
          } else if (pointer.y <= GAME_HEIGHT / 2 && this.bluePointerId === null) {
            this.bluePointerId = pointer.id;
            this.blueTouchOrigin = { x: pointer.x, y: pointer.y };
            this.blueTouchInput = { dx: 0, dy: 0 };
          }
        } else {
          if (this.orangePointerId === null) {
            this.orangePointerId = pointer.id;
            this.orangeTouchOrigin = { x: pointer.x, y: pointer.y };
            this.orangeTouchInput = { dx: 0, dy: 0 };
          }
        }
      } else {
        this.isPointerDown = true;
        this.updateMouseSteering(pointer.x, pointer.y);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.currentPointerPos = { x: pointer.x, y: pointer.y };

      if (pointer.wasTouch) {
        if (pointer.id === this.orangePointerId && this.orangeTouchOrigin) {
          const deltaX = pointer.x - this.orangeTouchOrigin.x;
          const deltaY = pointer.y - this.orangeTouchOrigin.y;
          const dist = Math.hypot(deltaX, deltaY);
          if (dist > 6) {
            const clampedDist = Math.min(dist, maxRadius);
            this.orangeTouchInput = {
              dx: (deltaX / dist) * (clampedDist / maxRadius),
              dy: (deltaY / dist) * (clampedDist / maxRadius),
            };
          } else {
            this.orangeTouchInput = { dx: 0, dy: 0 };
          }
        } else if (pointer.id === this.bluePointerId && this.blueTouchOrigin) {
          const deltaX = pointer.x - this.blueTouchOrigin.x;
          const deltaY = pointer.y - this.blueTouchOrigin.y;
          const dist = Math.hypot(deltaX, deltaY);
          if (dist > 6) {
            const clampedDist = Math.min(dist, maxRadius);
            this.blueTouchInput = {
              dx: (deltaX / dist) * (clampedDist / maxRadius),
              dy: (deltaY / dist) * (clampedDist / maxRadius),
            };
          } else {
            this.blueTouchInput = { dx: 0, dy: 0 };
          }
        }
      } else if (this.isPointerDown) {
        this.updateMouseSteering(pointer.x, pointer.y);
      }
    });

    const endPointer = (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.orangePointerId) {
          this.orangePointerId = null;
          this.orangeTouchOrigin = null;
          this.orangeTouchInput = { dx: 0, dy: 0 };
        }
        if (pointer.id === this.bluePointerId) {
          this.bluePointerId = null;
          this.blueTouchOrigin = null;
          this.blueTouchInput = { dx: 0, dy: 0 };
        }
      } else {
        this.isPointerDown = false;
        this.orangeMouseInput = { dx: 0, dy: 0 };
        this.blueMouseInput = { dx: 0, dy: 0 };
      }
    };

    this.input.on("pointerup", endPointer);
    this.input.on("pointerupoutside", endPointer);
    this.input.on("pointercancel", endPointer);
  }

  private spawnHitEffects(x: number, y: number, role: DodgePlayerColor): void {
    const color = role === "orange" ? COLOR_ORANGE : COLOR_BLUE;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
      const speed = 70 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? color : 0xffffff,
        radius: 2 + Math.random() * 2,
        alpha: 1,
        maxLife: 0.35,
        currentLife: 0.35,
      });
    }

    this.shockwaves.push({
      x,
      y,
      currentRadius: PLAYER_RADIUS,
      maxRadius: PLAYER_RADIUS + 22,
      color: 0xffffff,
      alpha: 0.9,
      lineWidth: 2.5,
    });
  }

  private spawnEliminationEffects(x: number, y: number, role: DodgePlayerColor): void {
    const color = role === "orange" ? COLOR_ORANGE : COLOR_BLUE;
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.4;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? color : 0xffffff,
        radius: 2.5 + Math.random() * 2.5,
        alpha: 1,
        maxLife: 0.65,
        currentLife: 0.65,
      });
    }

    this.shockwaves.push({
      x,
      y,
      currentRadius: PLAYER_RADIUS,
      maxRadius: PLAYER_RADIUS + 48,
      color,
      alpha: 1.0,
      lineWidth: 3.5,
    });
  }

  private drawFX(): void {
    this.fxGraphics.clear();

    // 1. Draw Hit & Elimination Shockwaves
    for (const sw of this.shockwaves) {
      this.fxGraphics.lineStyle(sw.lineWidth, sw.color, sw.alpha);
      this.fxGraphics.strokeCircle(sw.x, sw.y, sw.currentRadius);
    }

    // 2. Draw Spark & Burst Particles
    for (const p of this.particles) {
      this.fxGraphics.fillStyle(p.color, p.alpha);
      this.fxGraphics.fillCircle(p.x, p.y, p.radius);
    }

    // 3. Draw In-Arena Wave Announcement Pill Banner
    if (this.waveBanner) {
      const alpha = Math.sin((this.waveBanner.timer / this.waveBanner.duration) * Math.PI);
      const bannerW = 210;
      const bannerH = 52;
      const bx = GAME_WIDTH / 2 - bannerW / 2;
      const by = GAME_HEIGHT / 2 - bannerH / 2;

      this.fxGraphics.fillStyle(0x0f172a, alpha * 0.92);
      this.fxGraphics.fillRoundedRect(bx, by, bannerW, bannerH, 16);

      this.fxGraphics.lineStyle(2, 0xf59e0b, alpha * 0.95);
      this.fxGraphics.strokeRoundedRect(bx, by, bannerW, bannerH, 16);
    }
  }

  private drawArena(): void {
    this.arenaGraphics.clear();

    // Background Canvas
    this.arenaGraphics.fillStyle(COLOR_BG, 1);
    this.arenaGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Arena Floor
    this.arenaGraphics.fillStyle(COLOR_ARENA_FLOOR, 1);
    this.arenaGraphics.fillRoundedRect(ARENA_LEFT, ARENA_TOP, ARENA_WIDTH, ARENA_HEIGHT, 16);

    // Subtle Tactical Grid Lines
    this.arenaGraphics.lineStyle(1, COLOR_ARENA_GRID, 0.45);
    const gridSize = 48;
    for (let x = ARENA_LEFT + gridSize; x < ARENA_RIGHT; x += gridSize) {
      this.arenaGraphics.beginPath();
      this.arenaGraphics.moveTo(x, ARENA_TOP);
      this.arenaGraphics.lineTo(x, ARENA_BOTTOM);
      this.arenaGraphics.strokePath();
    }
    for (let y = ARENA_TOP + gridSize; y < ARENA_BOTTOM; y += gridSize) {
      this.arenaGraphics.beginPath();
      this.arenaGraphics.moveTo(ARENA_LEFT, y);
      this.arenaGraphics.lineTo(ARENA_RIGHT, y);
      this.arenaGraphics.strokePath();
    }

    // 1v1 Split-screen dividing centerline
    if (this.mode === "1v1") {
      this.arenaGraphics.lineStyle(1.5, 0x334155, 0.55);
      const centerY = GAME_HEIGHT / 2;
      for (let x = ARENA_LEFT + 14; x < ARENA_RIGHT - 14; x += 22) {
        this.arenaGraphics.beginPath();
        this.arenaGraphics.moveTo(x, centerY);
        this.arenaGraphics.lineTo(x + 11, centerY);
        this.arenaGraphics.strokePath();
      }

      // Center tactical diamond
      const cx = GAME_WIDTH / 2;
      this.arenaGraphics.lineStyle(1.5, 0x64748b, 0.7);
      this.arenaGraphics.beginPath();
      this.arenaGraphics.moveTo(cx, centerY - 6);
      this.arenaGraphics.lineTo(cx + 6, centerY);
      this.arenaGraphics.lineTo(cx, centerY + 6);
      this.arenaGraphics.lineTo(cx - 6, centerY);
      this.arenaGraphics.closePath();
      this.arenaGraphics.strokePath();
    }

    // Outer Boundary Glow & Border
    this.arenaGraphics.lineStyle(4, 0x1e293b, 0.75);
    this.arenaGraphics.strokeRoundedRect(ARENA_LEFT - 1, ARENA_TOP - 1, ARENA_WIDTH + 2, ARENA_HEIGHT + 2, 17);

    this.arenaGraphics.lineStyle(3, COLOR_ARENA_BORDER, 0.95);
    this.arenaGraphics.strokeRoundedRect(ARENA_LEFT, ARENA_TOP, ARENA_WIDTH, ARENA_HEIGHT, 16);

    // Inner Perimeter Safety Border
    this.arenaGraphics.lineStyle(1, 0x334155, 0.45);
    this.arenaGraphics.strokeRoundedRect(
      ARENA_LEFT + 6,
      ARENA_TOP + 6,
      ARENA_WIDTH - 12,
      ARENA_HEIGHT - 12,
      12
    );

    // Corner Tactical Brackets
    const bracketSize = 16;
    this.arenaGraphics.lineStyle(2, 0x94a3b8, 0.75);
    // Top-Left
    this.arenaGraphics.lineBetween(ARENA_LEFT + 8, ARENA_TOP + 8, ARENA_LEFT + 8 + bracketSize, ARENA_TOP + 8);
    this.arenaGraphics.lineBetween(ARENA_LEFT + 8, ARENA_TOP + 8, ARENA_LEFT + 8, ARENA_TOP + 8 + bracketSize);
    // Top-Right
    this.arenaGraphics.lineBetween(ARENA_RIGHT - 8, ARENA_TOP + 8, ARENA_RIGHT - 8 - bracketSize, ARENA_TOP + 8);
    this.arenaGraphics.lineBetween(ARENA_RIGHT - 8, ARENA_TOP + 8, ARENA_RIGHT - 8, ARENA_TOP + 8 + bracketSize);
    // Bottom-Left
    this.arenaGraphics.lineBetween(ARENA_LEFT + 8, ARENA_BOTTOM - 8, ARENA_LEFT + 8 + bracketSize, ARENA_BOTTOM - 8);
    this.arenaGraphics.lineBetween(ARENA_LEFT + 8, ARENA_BOTTOM - 8, ARENA_LEFT + 8, ARENA_BOTTOM - 8 - bracketSize);
    // Bottom-Right
    this.arenaGraphics.lineBetween(ARENA_RIGHT - 8, ARENA_BOTTOM - 8, ARENA_RIGHT - 8 - bracketSize, ARENA_BOTTOM - 8);
    this.arenaGraphics.lineBetween(ARENA_RIGHT - 8, ARENA_BOTTOM - 8, ARENA_RIGHT - 8, ARENA_BOTTOM - 8 - bracketSize);
  }

  private drawHazards(): void {
    this.hazardGraphics.clear();

    for (const h of this.simulation.state.hazards) {
      if (h.phase === "expired") continue;

      if (h.type === "falling-strike") {
        this.renderFallingStrike(h);
      } else if (h.type === "sweeping-laser") {
        this.renderSweepingLaser(h);
      } else if (h.type === "bouncing-hazard") {
        this.renderBouncingHazard(h);
      }
    }
  }

  private renderFallingStrike(h: import("../logic/types").FallingStrikeHazard): void {
    if (h.phase === "warning") {
      const progress = h.elapsedMs / h.warningDurationMs; // 0.0 -> 1.0

      // Outer Danger Circle with pulsing opacity
      const pulseAlpha = 0.25 + 0.25 * Math.sin(progress * Math.PI * 4);
      this.hazardGraphics.fillStyle(COLOR_HAZARD_WARNING, pulseAlpha);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius);

      // Warning perimeter ring
      this.hazardGraphics.lineStyle(2.5, COLOR_HAZARD_WARNING, 0.9);
      this.hazardGraphics.strokeCircle(h.x, h.y, h.radius);

      // Inner contracting timing reticle (precise visual countdown to impact)
      const contractRadius = Math.max(3, h.radius * (1 - progress));
      this.hazardGraphics.lineStyle(2, COLOR_HAZARD_AMBER, 0.95);
      this.hazardGraphics.strokeCircle(h.x, h.y, contractRadius);

      // Center crosshair
      this.hazardGraphics.lineStyle(1.5, COLOR_HAZARD_AMBER, 0.85);
      this.hazardGraphics.lineBetween(h.x - h.radius * 0.35, h.y, h.x + h.radius * 0.35, h.y);
      this.hazardGraphics.lineBetween(h.x, h.y - h.radius * 0.35, h.x, h.y + h.radius * 0.35);

      // Warning center pulse dot
      this.hazardGraphics.fillStyle(0xfbbf24, 0.95);
      this.hazardGraphics.fillCircle(h.x, h.y, 3.5);
    } else if (h.phase === "active") {
      // Active Impact Strike
      const progress = h.elapsedMs / h.activeDurationMs; // 0.0 -> 1.0
      const alpha = Math.max(0, 1 - progress);

      // Blazing blast epicenter
      this.hazardGraphics.fillStyle(COLOR_HAZARD_ACTIVE, alpha * 0.85);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius);

      // Expanding Shockwave Ring
      const currentRadius = h.radius + progress * 28;
      this.hazardGraphics.lineStyle(4, 0xffffff, alpha);
      this.hazardGraphics.strokeCircle(h.x, h.y, currentRadius);

      // Bright Core
      this.hazardGraphics.fillStyle(0xffffff, alpha);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius * 0.38);
    }
  }

  private renderSweepingLaser(h: import("../logic/types").SweepingLaserHazard): void {
    const segments = getLaserSegments(h);
    const gaps = h.safeGaps ?? [];

    if (h.phase === "warning") {
      const progress = h.elapsedMs / h.warningDurationMs;
      const alpha = 0.35 + 0.35 * Math.sin(progress * Math.PI * 6);

      // 1. Draw danger corridor for solid segments across start to target coords
      if (h.orientation === "horizontal") {
        const topY = Math.min(h.startY, h.targetCoord);
        const height = Math.abs(h.targetCoord - h.startY);

        // Danger areas (solid beam columns)
        const warningSegments = getLaserSegments(h, h.startY);
        this.hazardGraphics.fillStyle(COLOR_HAZARD_AMBER, 0.08);
        for (const seg of warningSegments) {
          const segWidth = seg.x2 - seg.x1;
          this.hazardGraphics.fillRect(seg.x1, topY, segWidth, height);
        }

        // Safe Gap Corridors: clearly highlight the safe green columns!
        for (const gap of gaps) {
          const gapWidth = gap.end - gap.start;
          this.hazardGraphics.fillStyle(0x10b981, 0.12);
          this.hazardGraphics.fillRect(gap.start, topY, gapWidth, height);

          // Safe passage borders
          this.hazardGraphics.lineStyle(1.5, 0x10b981, 0.65);
          this.hazardGraphics.lineBetween(gap.start, topY, gap.start, topY + height);
          this.hazardGraphics.lineBetween(gap.end, topY, gap.end, topY + height);

          // Green safety chevrons inside safe gap indicating passage
          const chevronY = h.direction === 1 ? h.startY + 20 : h.startY - 20;
          const chevronX = gap.start + gapWidth / 2;
          this.hazardGraphics.lineStyle(2, 0x34d399, 0.85);
          this.hazardGraphics.lineBetween(chevronX - 8, chevronY, chevronX, chevronY + h.direction * 7);
          this.hazardGraphics.lineBetween(chevronX + 8, chevronY, chevronX, chevronY + h.direction * 7);
        }

        // Directional sweep arrows in danger zones
        const arrowY = h.direction === 1 ? h.startY + 18 : h.startY - 18;
        this.hazardGraphics.lineStyle(2, COLOR_HAZARD_AMBER, 0.7);
        this.hazardGraphics.lineBetween(ARENA_LEFT + 25, arrowY, ARENA_LEFT + 35, arrowY + h.direction * 8);
        this.hazardGraphics.lineBetween(ARENA_LEFT + 45, arrowY, ARENA_LEFT + 35, arrowY + h.direction * 8);
        this.hazardGraphics.lineBetween(ARENA_RIGHT - 45, arrowY, ARENA_RIGHT - 35, arrowY + h.direction * 8);
        this.hazardGraphics.lineBetween(ARENA_RIGHT - 25, arrowY, ARENA_RIGHT - 35, arrowY + h.direction * 8);
      } else {
        const leftX = Math.min(h.startX, h.targetCoord);
        const width = Math.abs(h.targetCoord - h.startX);

        // Danger areas (solid beam rows)
        const warningSegments = getLaserSegments(h, h.startX);
        this.hazardGraphics.fillStyle(COLOR_HAZARD_AMBER, 0.08);
        for (const seg of warningSegments) {
          const segHeight = seg.y2 - seg.y1;
          this.hazardGraphics.fillRect(leftX, seg.y1, width, segHeight);
        }

        // Safe Gap Corridors: clearly highlight the safe green rows!
        for (const gap of gaps) {
          const gapHeight = gap.end - gap.start;
          this.hazardGraphics.fillStyle(0x10b981, 0.12);
          this.hazardGraphics.fillRect(leftX, gap.start, width, gapHeight);

          // Safe passage borders
          this.hazardGraphics.lineStyle(1.5, 0x10b981, 0.65);
          this.hazardGraphics.lineBetween(leftX, gap.start, leftX + width, gap.start);
          this.hazardGraphics.lineBetween(leftX, gap.end, leftX + width, gap.end);

          // Green safety chevrons inside safe gap
          const chevronX = h.direction === 1 ? h.startX + 20 : h.startX - 20;
          const chevronY = gap.start + gapHeight / 2;
          this.hazardGraphics.lineStyle(2, 0x34d399, 0.85);
          this.hazardGraphics.lineBetween(chevronX, chevronY - 8, chevronX + h.direction * 7, chevronY);
          this.hazardGraphics.lineBetween(chevronX, chevronY + 8, chevronX + h.direction * 7, chevronY);
        }
      }

      // 2. Draw warning beam line only on solid segments
      const warningSegments = getLaserSegments(h, h.orientation === "horizontal" ? h.startY : h.startX);
      for (const seg of warningSegments) {
        this.hazardGraphics.lineStyle(h.beamWidth, COLOR_HAZARD_AMBER, alpha * 0.45);
        this.hazardGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

        this.hazardGraphics.lineStyle(2, 0xffffff, 0.9);
        this.hazardGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

        // Node flares at segment endpoints
        this.hazardGraphics.fillStyle(COLOR_HAZARD_AMBER, 0.8);
        this.hazardGraphics.fillCircle(seg.x1, seg.y1, 4);
        this.hazardGraphics.fillCircle(seg.x2, seg.y2, 4);
      }
    } else if (h.phase === "active") {
      // Draw active laser beam strictly on solid segments
      for (const seg of segments) {
        // Outer glow
        this.hazardGraphics.lineStyle(h.beamWidth + 8, COLOR_HAZARD_ACTIVE, 0.35);
        this.hazardGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

        // Crimson beam body
        this.hazardGraphics.lineStyle(h.beamWidth, COLOR_HAZARD_ACTIVE, 0.92);
        this.hazardGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

        // Intense pure white core
        this.hazardGraphics.lineStyle(h.beamWidth * 0.4, 0xffffff, 1.0);
        this.hazardGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

        // Radiant energy emitter caps at gap edges & walls
        this.hazardGraphics.fillStyle(0xffffff, 0.95);
        this.hazardGraphics.fillCircle(seg.x1, seg.y1, h.beamWidth * 0.5);
        this.hazardGraphics.fillCircle(seg.x2, seg.y2, h.beamWidth * 0.5);
      }

      // Inside safe gaps: draw subtle emerald gate brackets so players clearly see the safe zone opening
      for (const gap of gaps) {
        if (h.orientation === "horizontal") {
          const cy = h.currentCoord;
          this.hazardGraphics.lineStyle(2, 0x10b981, 0.8);
          // Left bracket
          this.hazardGraphics.lineBetween(gap.start, cy - 8, gap.start, cy + 8);
          this.hazardGraphics.lineBetween(gap.start, cy, gap.start + 6, cy);
          // Right bracket
          this.hazardGraphics.lineBetween(gap.end, cy - 8, gap.end, cy + 8);
          this.hazardGraphics.lineBetween(gap.end, cy, gap.end - 6, cy);
        } else {
          const cx = h.currentCoord;
          this.hazardGraphics.lineStyle(2, 0x10b981, 0.8);
          // Top bracket
          this.hazardGraphics.lineBetween(cx - 8, gap.start, cx + 8, gap.start);
          this.hazardGraphics.lineBetween(cx, gap.start, cx, gap.start + 6);
          // Bottom bracket
          this.hazardGraphics.lineBetween(cx - 8, gap.end, cx + 8, gap.end);
          this.hazardGraphics.lineBetween(cx, gap.end, cx, gap.end - 6);
        }
      }
    }
  }

  private renderBouncingHazard(h: import("../logic/types").BouncingHazard): void {
    if (h.phase === "warning") {
      // Entry warning marker at arena edge
      const pulse = 0.5 + 0.5 * Math.sin(h.elapsedMs * 0.02);
      this.hazardGraphics.fillStyle(COLOR_HAZARD_AMBER, pulse * 0.85);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius);

      this.hazardGraphics.lineStyle(2, 0xffffff, 0.9);
      this.hazardGraphics.strokeCircle(h.x, h.y, h.radius + 4);

      // Direction indicator arrow pointing into arena
      const speed = Math.hypot(h.vx, h.vy) || 1;
      const arrowX = h.x + (h.vx / speed) * 18;
      const arrowY = h.y + (h.vy / speed) * 18;
      this.hazardGraphics.lineStyle(2.5, 0xfef08a, 0.95);
      this.hazardGraphics.lineBetween(h.x, h.y, arrowX, arrowY);
    } else if (h.phase === "active") {
      // Active Bouncing Orb
      const speed = Math.hypot(h.vx, h.vy) || 1;

      // Trailing motion particles
      this.hazardGraphics.fillStyle(0xf59e0b, 0.4);
      this.hazardGraphics.fillCircle(h.x - (h.vx / speed) * 10, h.y - (h.vy / speed) * 10, h.radius * 0.7);
      this.hazardGraphics.fillStyle(0xf59e0b, 0.25);
      this.hazardGraphics.fillCircle(h.x - (h.vx / speed) * 18, h.y - (h.vy / speed) * 18, h.radius * 0.5);
      this.hazardGraphics.fillStyle(0xf59e0b, 0.12);
      this.hazardGraphics.fillCircle(h.x - (h.vx / speed) * 26, h.y - (h.vy / speed) * 26, h.radius * 0.3);

      // Energy Body
      this.hazardGraphics.fillStyle(0xd97706, 0.95);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius);

      this.hazardGraphics.lineStyle(2.5, 0xfef08a, 0.95);
      this.hazardGraphics.strokeCircle(h.x, h.y, h.radius);

      // Inner Core
      this.hazardGraphics.fillStyle(0xffffff, 0.95);
      this.hazardGraphics.fillCircle(h.x, h.y, h.radius * 0.42);
    }
  }

  private drawPlayers(): void {
    this.playerGraphics.clear();

    // 1. Draw Player Movement Trails (Behind player bodies)
    for (const pt of this.playerTrails.orange) {
      this.playerGraphics.fillStyle(COLOR_ORANGE, pt.alpha * 0.35);
      this.playerGraphics.fillCircle(pt.x, pt.y, PLAYER_RADIUS * 0.75);
      this.playerGraphics.fillStyle(0xffffff, pt.alpha * 0.2);
      this.playerGraphics.fillCircle(pt.x, pt.y, PLAYER_RADIUS * 0.35);
    }
    for (const pt of this.playerTrails.blue) {
      this.playerGraphics.fillStyle(COLOR_BLUE, pt.alpha * 0.35);
      this.playerGraphics.fillCircle(pt.x, pt.y, PLAYER_RADIUS * 0.75);
      this.playerGraphics.fillStyle(0xffffff, pt.alpha * 0.2);
      this.playerGraphics.fillCircle(pt.x, pt.y, PLAYER_RADIUS * 0.35);
    }

    // 2. Draw Player Characters
    this.renderPlayer(this.simulation.state.players.orange);
    this.renderPlayer(this.simulation.state.players.blue);
  }

  private renderPlayer(p: PlayerSimState): void {
    if (!p.isAlive) {
      // Defeated cross marker
      this.playerGraphics.lineStyle(2, 0x64748b, 0.45);
      this.playerGraphics.strokeCircle(p.x, p.y, PLAYER_RADIUS);
      this.playerGraphics.lineBetween(p.x - 8, p.y - 8, p.x + 8, p.y + 8);
      this.playerGraphics.lineBetween(p.x + 8, p.y - 8, p.x - 8, p.y + 8);
      return;
    }

    const isOrange = p.color === "orange";
    const primaryColor = isOrange ? COLOR_ORANGE : COLOR_BLUE;
    const accentColor = isOrange ? 0xfdba74 : 0x93c5fd;
    const isFlashing = this.damageFlashTimers[p.color] > 0;

    // Invulnerability Flashing & Shield Bubble
    let alpha = 1.0;
    if (p.isInvulnerable) {
      alpha = Math.floor(p.invulnerableTimeRemainingMs / 70) % 2 === 0 ? 0.35 : 0.95;

      const pulseRadius = PLAYER_RADIUS + 5 + Math.sin(p.invulnerableTimeRemainingMs * 0.015) * 2;
      this.playerGraphics.lineStyle(2.5, accentColor, 0.85);
      this.playerGraphics.strokeCircle(p.x, p.y, pulseRadius);

      this.playerGraphics.fillStyle(accentColor, 0.12);
      this.playerGraphics.fillCircle(p.x, p.y, pulseRadius);
    }

    // Soft Ambient Glow Halo
    this.playerGraphics.fillStyle(primaryColor, 0.18 * alpha);
    this.playerGraphics.fillCircle(p.x, p.y, PLAYER_RADIUS + 4);

    // Player Body (flashes pure white on hit)
    const bodyColor = isFlashing ? 0xffffff : primaryColor;
    this.playerGraphics.fillStyle(bodyColor, alpha);
    this.playerGraphics.fillCircle(p.x, p.y, PLAYER_RADIUS);

    // Subtle Inner Highlight Crescent
    if (!isFlashing) {
      this.playerGraphics.fillStyle(accentColor, alpha * 0.45);
      this.playerGraphics.fillCircle(p.x - 3, p.y - 3, PLAYER_RADIUS * 0.65);
    }

    // Crisp Rim Outline
    this.playerGraphics.lineStyle(2, 0xffffff, alpha * 0.95);
    this.playerGraphics.strokeCircle(p.x, p.y, PLAYER_RADIUS);

    // Directional Facing Visor / Eyes
    const eyeDist = PLAYER_RADIUS * 0.45;
    const eyeX = p.x + Math.cos(p.facingAngle) * eyeDist;
    const eyeY = p.y + Math.sin(p.facingAngle) * eyeDist;

    this.playerGraphics.fillStyle(0xffffff, alpha);
    this.playerGraphics.fillCircle(eyeX, eyeY, 4.5);

    this.playerGraphics.fillStyle(0x0f172a, alpha);
    this.playerGraphics.fillCircle(
      eyeX + Math.cos(p.facingAngle) * 1.5,
      eyeY + Math.sin(p.facingAngle) * 1.5,
      2.2
    );
  }

  private drawTouchControls(): void {
    this.touchControlsGraphics.clear();

    if (this.orangeTouchOrigin) {
      this.renderVirtualStick(
        this.orangeTouchOrigin.x,
        this.orangeTouchOrigin.y,
        this.orangeTouchInput.dx,
        this.orangeTouchInput.dy,
        COLOR_ORANGE
      );
    }

    if (this.blueTouchOrigin) {
      this.renderVirtualStick(
        this.blueTouchOrigin.x,
        this.blueTouchOrigin.y,
        this.blueTouchInput.dx,
        this.blueTouchInput.dy,
        COLOR_BLUE
      );
    }
  }

  private renderVirtualStick(
    originX: number,
    originY: number,
    dx: number,
    dy: number,
    color: number
  ): void {
    const maxRadius = 45;

    // Base ring
    this.touchControlsGraphics.lineStyle(2, color, 0.4);
    this.touchControlsGraphics.strokeCircle(originX, originY, maxRadius);

    this.touchControlsGraphics.fillStyle(color, 0.08);
    this.touchControlsGraphics.fillCircle(originX, originY, maxRadius);

    // Thumb stick knob
    const knobX = originX + dx * maxRadius;
    const knobY = originY + dy * maxRadius;

    this.touchControlsGraphics.fillStyle(color, 0.7);
    this.touchControlsGraphics.fillCircle(knobX, knobY, 18);

    this.touchControlsGraphics.lineStyle(2, 0xffffff, 0.9);
    this.touchControlsGraphics.strokeCircle(knobX, knobY, 18);
  }
}
