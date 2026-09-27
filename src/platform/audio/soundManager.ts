import {
  SOUND_CONFIG,
  SOUND_FILES,
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

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

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
      targetAudio.volume = volume;
      targetAudio.currentTime = 0;
      targetAudio.play().catch(() => {
        // Autoplay restrictions or background tab pause caught silently
      });
    } catch {
      // Ignored for non-interactive or background environments
    }
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
