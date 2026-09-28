import {
  SOUND_CONFIG,
  SOUND_FILES,
  SPIN_TICK_SOUND_NAMES,
  getSoundVolume,
  type SoundConfig,
  type SoundEffectName,
} from "./config";

/**
 * Small, lightweight, reusable sound manager for Next.js, React, and Phaser.
 *
 * Requirements fulfilled:
 * - Single reusable manager across the platform.
 * - Reusable HTML5 Audio pooling for short UI/board game effects (no continuous allocations).
 * - Central volume config where percentages (0-100) are converted to 0.0-1.0 floats.
 * - Unlocks mobile audio on first user gesture.
 * - Integrates with Phaser 3 scenes for arcade gameplay.
 * - Safe for Next.js SSR (guards window / Audio checks).
 */
class SoundManager {
  private poolSize = 3;
  private audioPools: Map<SoundEffectName, HTMLAudioElement[]> = new Map();
  private poolPointers: Map<SoundEffectName, number> = new Map();
  private isUnlocked = false;
  private webAudioContext: AudioContext | null = null;
  private decodedAudioBuffers: Map<SoundEffectName, AudioBuffer> = new Map();
  private decodedSoundPreloads: Map<string, Promise<void>> = new Map();
  private activeSpinTickSources = new Set<AudioBufferSourceNode>();

  constructor() {
    if (typeof window !== "undefined") {
      this.setupUserGestureUnlock();
    }
  }

  /**
   * Initializes or unlocks audio on the first valid user gesture (mobile Safari/Chrome).
   */
  private setupUserGestureUnlock() {
    const unlock = () => {
      if (this.isUnlocked) return;
      this.isUnlocked = true;

      // Prime the button-click pool on user interaction so audio plays with zero latency
      this.warmPool("buttonClick");
      const context = this.webAudioContext;
      if (context?.state === "suspended") {
        void context.resume().catch(() => {
          // An interrupted gesture can leave the context suspended until the next tap.
        });
      }
    };

    // { once: true } ensures each listener auto-removes after firing
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  }

  private warmPool(name: SoundEffectName) {
    if (typeof window === "undefined") return;
    this.getPool(name);
  }

  private getPool(name: SoundEffectName): HTMLAudioElement[] {
    if (typeof window === "undefined") return [];

    let pool = this.audioPools.get(name);
    if (!pool) {
      pool = [];
      const src = SOUND_FILES[name];
      for (let i = 0; i < this.poolSize; i++) {
        const audio = new Audio(src);
        audio.preload = "auto";
        pool.push(audio);
      }
      this.audioPools.set(name, pool);
      this.poolPointers.set(name, 0);
    }
    return pool;
  }

  /**
   * Play a registered sound effect using pooled HTML5 Audio elements.
   * Dynamically converts the 0-100 percentage from SOUND_CONFIG to 0.0-1.0 volume.
   */
  public play(name: SoundEffectName): void {
    if (typeof window === "undefined") return;

    const volume = getSoundVolume(name);
    if (volume <= 0) return;

    const pool = this.getPool(name);
    if (!pool || pool.length === 0) return;

    // Find an idle audio element or round-robin reuse the next one
    let targetAudio: HTMLAudioElement | null = null;
    for (const audio of pool) {
      if (audio.paused || audio.ended) {
        targetAudio = audio;
        break;
      }
    }

    if (!targetAudio) {
      const idx = this.poolPointers.get(name) || 0;
      targetAudio = pool[idx % pool.length];
      this.poolPointers.set(name, idx + 1);
    }

    try {
      targetAudio.muted = false;
      targetAudio.volume = volume;
      targetAudio.currentTime = 0;
      targetAudio.play().catch(() => {
        // Autoplay restrictions or background tab pause caught silently
      });
    } catch {
      // Ignored for non-interactive or background environments
    }
  }

  private getWebAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.webAudioContext) return this.webAudioContext;

    const ContextConstructor = window.AudioContext || (
      window as Window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;
    if (!ContextConstructor) return null;

    try {
      this.webAudioContext = new ContextConstructor();
      return this.webAudioContext;
    } catch {
      return null;
    }
  }

  private preloadDecodedSounds(
    cacheKey: string,
    names: readonly SoundEffectName[]
  ): Promise<void> {
    const existingPreload = this.decodedSoundPreloads.get(cacheKey);
    if (existingPreload) return existingPreload;

    const context = this.getWebAudioContext();
    if (!context || typeof window === "undefined") {
      return Promise.resolve();
    }

    const preload = Promise.all(
      names.map(async (name) => {
        if (this.decodedAudioBuffers.has(name)) return;
        const response = await fetch(SOUND_FILES[name]);
        if (!response.ok) throw new Error(`Unable to load ${name}.`);
        const audioData = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(audioData);
        this.decodedAudioBuffers.set(name, buffer);
      })
    ).then(() => undefined).catch(() => undefined);
    this.decodedSoundPreloads.set(cacheKey, preload);
    return preload;
  }

  /** Fetches and decodes all wheel ticks once, before any boundary can be reached. */
  public preloadSpinTicks(): Promise<void> {
    return this.preloadDecodedSounds("spin-ticks", SPIN_TICK_SOUND_NAMES);
  }

  /** Fetches and decodes match result sounds before a match can finish. */
  public preloadResultSounds(): Promise<void> {
    return this.preloadDecodedSounds("match-results", ["victory", "lose"]);
  }

  /** Resumes preloaded match-result audio during a user gesture that starts a match. */
  public prepareResultSounds(): void {
    const context = this.getWebAudioContext();
    void this.preloadResultSounds();
    if (context?.state === "suspended") {
      void context.resume().catch(() => {
        // Browsers can reject a resume after an interrupted user gesture.
      });
    }
  }

  /** Resumes the preloaded Web Audio context inside the user's Spin gesture. */
  public prepareSpinTicks(): Promise<void> {
    const context = this.getWebAudioContext();
    const preload = this.preloadSpinTicks();
    const resume = context?.state === "suspended"
      ? context.resume().catch(() => undefined)
      : Promise.resolve();
    return Promise.all([preload, resume]).then(() => undefined);
  }

  /** Stops pooled wheel ticks when a spin is cancelled or restarted. */
  public stopSpinTicks(): void {
    for (const source of this.activeSpinTickSources) {
      try {
        source.stop();
      } catch {
        // A source may already have reached the end of its small buffer.
      }
    }
    this.activeSpinTickSources.clear();
  }

  public playSpinTick(tickNumber: number, timeOffsetSec = 0): void {
    if (!Number.isInteger(tickNumber) || tickNumber < 1 || tickNumber > SPIN_TICK_SOUND_NAMES.length) {
      return;
    }

    const name = SPIN_TICK_SOUND_NAMES[tickNumber - 1];
    this.playDecodedSound(name, this.activeSpinTickSources, timeOffsetSec);
  }

  private playDecodedSound(
    name: SoundEffectName,
    activeSources?: Set<AudioBufferSourceNode>,
    timeOffsetSec = 0
  ): boolean {
    const context = this.webAudioContext;
    const buffer = this.decodedAudioBuffers.get(name);
    if (!context || context.state !== "running" || !buffer) return false;

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      const startTime = context.currentTime + Math.max(0, timeOffsetSec);
      gain.gain.setValueAtTime(getSoundVolume(name), startTime);
      source.connect(gain).connect(context.destination);
      if (activeSources) {
        activeSources.add(source);
        source.onended = () => activeSources.delete(source);
      }
      source.start(startTime);
      return true;
    } catch {
      return false;
    }
  }

  public playVictory(): void {
    if (!this.playDecodedSound("victory")) this.play("victory");
  }

  public playLose(): void {
    if (!this.playDecodedSound("lose")) this.play("lose");
  }

  // ─── Phaser 3 Integration Helpers ──────────────────────────────────────────

  /**
   * Preload an audio asset in Phaser if not already present in Phaser cache.
   */
  public preloadPhaser(scene: Phaser.Scene, name: SoundEffectName): void {
    if (!scene || !scene.load) return;
    const url = SOUND_FILES[name];
    if (!scene.cache.audio.has(name)) {
      scene.load.audio(name, url);
    }
  }

  /**
   * Instantiate a Phaser BaseSound configured with the central volume setting.
   */
  public addPhaserSound(
    scene: Phaser.Scene,
    name: SoundEffectName
  ): Phaser.Sound.BaseSound | null {
    if (!scene || !scene.sound) return null;
    try {
      const volume = getSoundVolume(name);
      return scene.sound.add(name, { volume });
    } catch {
      return null;
    }
  }
}

export const soundManager = new SoundManager();

export {
  SOUND_CONFIG,
  SOUND_FILES,
  getSoundVolume,
  type SoundConfig,
  type SoundEffectName,
};
