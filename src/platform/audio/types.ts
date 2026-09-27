/**
 * Platform audio service interface definition.
 * Concrete implementations (Web Audio API or Howler) will plug in here.
 */

export interface IAudioService {
  playSound: (soundId: string) => void;
  playMusic: (trackId: string, loop?: boolean) => void;
  stopMusic: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}
