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
  spinTick: number;
  victory: number;
  lose: number;
  checkersSlide: number;
  golfSwing: number;
  golfHit: number;
  golfWall: number;
  golfBumper: number;
  golfWater: number;
  golfSink: number;
  golfRollGrass: number;
  golfRollSand: number;
  golfHoleComplete: number;
  golfScorecard: number;
  golfVictory: number;
  golfDefeat: number;
}

export const SOUND_CONFIG: SoundConfig = {
  buttonClick: 60,
  dropBall: 70,
  tileBreak: 50,
  spinTick: 60,
  victory: 70,
  lose: 65,
  checkersSlide: 65,
  golfSwing: 65,
  golfHit: 75,
  golfWall: 60,
  golfBumper: 70,
  golfWater: 75,
  golfSink: 85,
  golfRollGrass: 35,
  golfRollSand: 40,
  golfHoleComplete: 70,
  golfScorecard: 60,
  golfVictory: 75,
  golfDefeat: 75,
};

export type SpinTickSoundName = `spinTick${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type SoundEffectName = Exclude<keyof SoundConfig, "spinTick"> | SpinTickSoundName;

export const SPIN_TICK_SOUND_NAMES: readonly SpinTickSoundName[] = [
  "spinTick1",
  "spinTick2",
  "spinTick3",
  "spinTick4",
  "spinTick5",
  "spinTick6",
  "spinTick7",
];

export const SOUND_FILES: Record<SoundEffectName, string> = {
  buttonClick: "/audio/general/button-click.mp3",
  dropBall: "/audio/connect-four/drop-ball.mp3",
  tileBreak: "/audio/brick-blast/tile-break.mp3",
  checkersSlide: "/audio/chekers/chekers-slider.mp3",
  victory: "/audio/general/victory.mp3",
  lose: "/audio/general/lose.mp3",
  golfSwing: "/audio/mini-golf-duel/club-swing.wav",
  golfHit: "/audio/mini-golf-duel/ball-hit.wav",
  golfWall: "/audio/mini-golf-duel/wall-impact.wav",
  golfBumper: "/audio/mini-golf-duel/bumper-impact.ogg",
  golfWater: "/audio/mini-golf-duel/water-splash.wav",
  golfSink: "/audio/mini-golf-duel/hole-sink.wav",
  golfRollGrass: "/audio/mini-golf-duel/ball-roll-grass.ogg",
  golfRollSand: "/audio/mini-golf-duel/ball-roll-sand.ogg",
  golfHoleComplete: "/audio/mini-golf-duel/hole-complete.wav",
  golfScorecard: "/audio/mini-golf-duel/scorecard-transition.wav",
  golfVictory: "/audio/mini-golf-duel/match-victory.ogg",
  golfDefeat: "/audio/mini-golf-duel/match-defeat.ogg",
  spinTick1: "/audio/spin-wheel/spin-1.mp3",
  spinTick2: "/audio/spin-wheel/spin-2.mp3",
  spinTick3: "/audio/spin-wheel/spin-3.mp3",
  spinTick4: "/audio/spin-wheel/spin-4.mp3",
  spinTick5: "/audio/spin-wheel/spin-5.mp3",
  spinTick6: "/audio/spin-wheel/spin-6.mp3",
  spinTick7: "/audio/spin-wheel/spin-7.mp3",
};

/**
 * Converts a 0-100 percentage volume to a 0.0-1.0 float for audio APIs.
 */
export function getSoundVolume(name: SoundEffectName): number {
  const volumeKey = name.startsWith("spinTick")
    ? "spinTick"
    : (name as Exclude<keyof SoundConfig, "spinTick">);
  const percentage = SOUND_CONFIG[volumeKey] ?? 100;
  return Math.max(0, Math.min(100, percentage)) / 100;
}
