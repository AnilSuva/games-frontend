import {
  ARENA_BOTTOM,
  ARENA_LEFT,
  ARENA_RIGHT,
  ARENA_TOP,
  BLUE_SPAWN,
  INITIAL_LIVES,
  INVULNERABILITY_DURATION_MS,
  ORANGE_SPAWN,
  PLAYER_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
} from "../config/balance";
import {
  checkHazardCollision,
  createBouncingHazard,
  createFallingStrike,
  createSweepingLaser,
  getCurrentWaveConfig,
  updateHazard,
} from "./hazards";
import { SeededPRNG } from "./prng";
import type {
  ArenaSimState,
  PlayerInput,
  PlayerSimState,
  SimulationEvent,
} from "./types";

export class DodgeArenaSimulation {
  public state: ArenaSimState;
  private prng: SeededPRNG;
  private timeSinceLastHazardSpawnMs = 0;
  private timeSinceLastLaserMs = 9999;
  private hazardCounter = 0;

  constructor(seed: number = 12345) {
    this.prng = new SeededPRNG(seed);
    this.state = this.createInitialState(seed);
    this.timeSinceLastHazardSpawnMs = 1700; // First hazard spawns within ~300ms of match start
    this.timeSinceLastLaserMs = 9999;
  }

  public createInitialState(seed: number): ArenaSimState {
    const orange: PlayerSimState = {
      color: "orange",
      x: ORANGE_SPAWN.x,
      y: ORANGE_SPAWN.y,
      vx: 0,
      vy: 0,
      facingAngle: -Math.PI / 2, // Facing up
      lives: INITIAL_LIVES,
      isAlive: true,
      isInvulnerable: false,
      invulnerableTimeRemainingMs: 0,
    };

    const blue: PlayerSimState = {
      color: "blue",
      x: BLUE_SPAWN.x,
      y: BLUE_SPAWN.y,
      vx: 0,
      vy: 0,
      facingAngle: Math.PI / 2, // Facing down
      lives: INITIAL_LIVES,
      isAlive: true,
      isInvulnerable: false,
      invulnerableTimeRemainingMs: 0,
    };

    return {
      matchTimeMs: 0,
      wave: 1,
      players: {
        orange,
        blue,
      },
      hazards: [],
      isGameOver: false,
      winner: null,
      seed,
    };
  }

  /**
   * Resets simulation for a new match with an optional new seed.
   */
  public reset(seed: number = Math.floor(Math.random() * 1000000)): void {
    this.prng = new SeededPRNG(seed);
    this.state = this.createInitialState(seed);
    this.timeSinceLastHazardSpawnMs = 1700; // First hazard spawns within ~300ms of match start
    this.timeSinceLastLaserMs = 9999;
    this.hazardCounter = 0;
  }

  /**
   * Advances the simulation by dt seconds with given player movement inputs.
   */
  public step(
    dt: number,
    orangeInput?: PlayerInput,
    blueInput?: PlayerInput
  ): SimulationEvent[] {
    const events: SimulationEvent[] = [];

    if (this.state.isGameOver) {
      return events;
    }

    const dtMs = dt * 1000;
    this.state.matchTimeMs += dtMs;
    this.timeSinceLastHazardSpawnMs += dtMs;
    this.timeSinceLastLaserMs += dtMs;

    // 1. Advance Wave
    const waveConfig = getCurrentWaveConfig(this.state.matchTimeMs);
    if (waveConfig.waveNumber !== this.state.wave) {
      this.state.wave = waveConfig.waveNumber;
      events.push({
        type: "wave_advanced",
        data: { wave: this.state.wave, name: waveConfig.name },
      });
    }

    // 2. Update Players (Movement, Boundary Clamping, Invulnerability)
    this.updatePlayer(this.state.players.orange, orangeInput, dt);
    this.updatePlayer(this.state.players.blue, blueInput, dt);

    // 3. Spawn New Hazards According to Wave Config
    if (
      this.timeSinceLastHazardSpawnMs >= waveConfig.hazardIntervalMs &&
      this.state.hazards.length < waveConfig.maxSimultaneousHazards
    ) {
      this.timeSinceLastHazardSpawnMs = 0;
      const spawnedHazard = this.spawnHazard(waveConfig);
      if (spawnedHazard) {
        this.state.hazards.push(spawnedHazard);
        events.push({
          type: "hazard_spawned",
          data: { hazard: spawnedHazard },
        });
      }
    }

    // 4. Update Hazards & Trigger Activation Events
    for (const h of this.state.hazards) {
      const prevPhase = h.phase;
      updateHazard(h, dt);
      if (prevPhase === "warning" && h.phase === "active") {
        events.push({
          type: "hazard_activated",
          data: { hazard: h },
        });
      }
    }

    // 5. Collision Detection
    const orangeHit = this.checkCollisionsForPlayer(this.state.players.orange);
    const blueHit = this.checkCollisionsForPlayer(this.state.players.blue);

    if (orangeHit) {
      events.push({
        type: "player_hit",
        data: { player: "orange", lives: this.state.players.orange.lives },
      });
      if (!this.state.players.orange.isAlive) {
        events.push({
          type: "player_eliminated",
          data: { player: "orange" },
        });
      }
    }

    if (blueHit) {
      events.push({
        type: "player_hit",
        data: { player: "blue", lives: this.state.players.blue.lives },
      });
      if (!this.state.players.blue.isAlive) {
        events.push({
          type: "player_eliminated",
          data: { player: "blue" },
        });
      }
    }

    // 6. Check Game Over & Determine Winner
    const orangeAlive = this.state.players.orange.isAlive;
    const blueAlive = this.state.players.blue.isAlive;

    if (!orangeAlive && !blueAlive) {
      this.state.isGameOver = true;
      this.state.winner = "draw";
      events.push({
        type: "game_over",
        data: { winner: "draw", matchTimeMs: this.state.matchTimeMs },
      });
    } else if (!orangeAlive) {
      this.state.isGameOver = true;
      this.state.winner = "blue";
      events.push({
        type: "game_over",
        data: { winner: "blue", matchTimeMs: this.state.matchTimeMs },
      });
    } else if (!blueAlive) {
      this.state.isGameOver = true;
      this.state.winner = "orange";
      events.push({
        type: "game_over",
        data: { winner: "orange", matchTimeMs: this.state.matchTimeMs },
      });
    }

    // 7. Cleanup Expired Hazards
    this.state.hazards = this.state.hazards.filter((h) => h.phase !== "expired");

    return events;
  }

  private updatePlayer(
    player: PlayerSimState,
    input: PlayerInput | undefined,
    dt: number
  ): void {
    if (!player.isAlive) {
      player.vx = 0;
      player.vy = 0;
      return;
    }

    // Invulnerability decay
    if (player.isInvulnerable) {
      player.invulnerableTimeRemainingMs -= dt * 1000;
      if (player.invulnerableTimeRemainingMs <= 0) {
        player.isInvulnerable = false;
        player.invulnerableTimeRemainingMs = 0;
      }
    }

    // Normalize directional input
    let inX = input?.dx ?? 0;
    let inY = input?.dy ?? 0;
    const mag = Math.hypot(inX, inY);
    if (mag > 1) {
      inX /= mag;
      inY /= mag;
    }

    const targetVx = inX * PLAYER_MAX_SPEED;
    const targetVy = inY * PLAYER_MAX_SPEED;

    // Smooth Acceleration & Deceleration
    if (inX !== 0 || inY !== 0) {
      // Accelerate towards target velocity
      const accel = PLAYER_ACCELERATION * dt;
      player.vx = this.approach(player.vx, targetVx, accel);
      player.vy = this.approach(player.vy, targetVy, accel);
      player.facingAngle = Math.atan2(player.vy, player.vx);
    } else {
      // Responsive Deceleration
      const decel = PLAYER_DECELERATION * dt;
      player.vx = this.approach(player.vx, 0, decel);
      player.vy = this.approach(player.vy, 0, decel);
    }

    // Apply Velocity
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Strict Arena Boundary Clamping
    const r = PLAYER_RADIUS;
    if (player.x - r < ARENA_LEFT) {
      player.x = ARENA_LEFT + r;
      player.vx = 0;
    } else if (player.x + r > ARENA_RIGHT) {
      player.x = ARENA_RIGHT - r;
      player.vx = 0;
    }

    if (player.y - r < ARENA_TOP) {
      player.y = ARENA_TOP + r;
      player.vy = 0;
    } else if (player.y + r > ARENA_BOTTOM) {
      player.y = ARENA_BOTTOM - r;
      player.vy = 0;
    }
  }

  private approach(current: number, target: number, maxDelta: number): number {
    if (current < target) {
      return Math.min(current + maxDelta, target);
    }
    return Math.max(current - maxDelta, target);
  }

  private spawnHazard(waveConfig: import("../config/balance").WaveConfig) {
    this.hazardCounter++;
    const id = `hazard-${this.hazardCounter}`;
    const alivePlayers = Object.values(this.state.players).filter((p) => p.isAlive);

    // Fairness rule: prevent simultaneous lasers and enforce cooldown
    const hasActiveLaser = this.state.hazards.some(
      (h) => h.type === "sweeping-laser" && h.phase !== "expired"
    );
    const canSpawnLaser = !hasActiveLaser && this.timeSinceLastLaserMs >= 3000;

    // Hazard type distribution based on wave
    const roll = this.prng.next();
    if (waveConfig.waveNumber === 1) {
      // Wave 1: 70% falling strike, 30% bouncer (warmup without lasers)
      if (roll < 0.7) {
        return createFallingStrike(id, this.prng, waveConfig.strikeWarningMs, alivePlayers, this.state.hazards);
      } else {
        return createBouncingHazard(id, this.prng, waveConfig.bouncerSpeed);
      }
    } else if (waveConfig.waveNumber === 2) {
      // Wave 2: 50% falling strike, 25% sweeping laser (if eligible), 25% bouncer
      if (roll < 0.25 && canSpawnLaser) {
        this.timeSinceLastLaserMs = 0;
        return createSweepingLaser(
          id,
          this.prng,
          waveConfig.laserWarningMs ?? waveConfig.strikeWarningMs,
          waveConfig.laserSweepSpeed,
          waveConfig.laserSafeGapSize ?? 104,
          alivePlayers
        );
      } else if (roll < 0.75) {
        return createFallingStrike(id, this.prng, waveConfig.strikeWarningMs, alivePlayers, this.state.hazards);
      } else {
        return createBouncingHazard(id, this.prng, waveConfig.bouncerSpeed);
      }
    } else {
      // Wave 3+: 35% laser (if eligible), 35% strike, 30% bouncer
      if (roll < 0.35 && canSpawnLaser) {
        this.timeSinceLastLaserMs = 0;
        return createSweepingLaser(
          id,
          this.prng,
          waveConfig.laserWarningMs ?? waveConfig.strikeWarningMs,
          waveConfig.laserSweepSpeed,
          waveConfig.laserSafeGapSize ?? 96,
          alivePlayers
        );
      } else if (roll < 0.7) {
        return createFallingStrike(id, this.prng, waveConfig.strikeWarningMs, alivePlayers, this.state.hazards);
      } else {
        return createBouncingHazard(id, this.prng, waveConfig.bouncerSpeed);
      }
    }
  }

  private checkCollisionsForPlayer(player: PlayerSimState): boolean {
    if (!player.isAlive || player.isInvulnerable) {
      return false;
    }

    for (const hazard of this.state.hazards) {
      if (checkHazardCollision(hazard, player)) {
        player.lives -= 1;
        player.isInvulnerable = true;
        player.invulnerableTimeRemainingMs = INVULNERABILITY_DURATION_MS;

        if (player.lives <= 0) {
          player.lives = 0;
          player.isAlive = false;
        }
        return true;
      }
    }

    return false;
  }
}
