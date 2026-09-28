export type { SoundEffectName, SoundConfig } from "./config";

/**
 * Platform audio service interface definition.
 */
export interface IAudioService {
  playSound: (soundId: string) => void;
  playMusic: (trackId: string, loop?: boolean) => void;
  stopMusic: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

export interface ISoundManager {
  play: (name: import("./config").SoundEffectName) => void;
}
 