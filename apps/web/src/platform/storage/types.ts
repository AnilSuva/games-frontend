/**
 * Common contracts for all game cartridges hosted on the platform.
 */

export interface IAudioService {
  playSound: (soundId: string) => void;
  playMusic: (trackId: string, loop?: boolean) => void;
  stopMusic: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

export interface IStorageService {
  getItem: <T>(key: string, defaultValue: T) => T;
  setItem: <T>(key: string, value: T) => void;
  removeItem: (key: string) => void;
}
