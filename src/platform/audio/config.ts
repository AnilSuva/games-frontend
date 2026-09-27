/**
 * Central sound configuration.
 *
 * Change volume of any sound effect using percentage values (0 - 100).
 * The sound system converts these percentages to 0.0 - 1.0 internally.
 */

export interface SoundConfig {
  buttonClick: number;
  dropBall: number;
  tileBreak: number;
}

export const SOUND_CONFIG: SoundConfig = {
  buttonClick: 60,
  dropBall: 70,
  tileBreak: 50,
};

export type SoundEffectName = keyof SoundConfig;

export const SOUND_FILES: Record<SoundEffectName, string> = {
  buttonClick: "/audio/general/button-click.mp3",
  dropBall: "/audio/connect-four/drop-ball.mp3",
  tileBreak: "/audio/brick-blast/tile-break.mp3",
};

/**
 * Converts a 0-100 percentage volume to a 0.0-1.0 float for audio APIs.
 */
export function getSoundVolume(name: SoundEffectName): number {
  const percentage = SOUND_CONFIG[name] ?? 100;
  return Math.max(0, Math.min(100, percentage)) / 100;
}
