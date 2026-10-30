/**
 * Light Fingers - Verified Configuration Constants
 * Reverse engineered from base.apk (JindoBlu: 9_RUBASOLDI / Light Fingers)
 */

export const VIRTUAL_WIDTH = 600;
export const VIRTUAL_HEIGHT = 800;

export const WINNING_SCORE = 15; // punti = 15

export const MAX_ITEMS_ON_TABLE = 5; // moneteInGioco = 5

export const SPAWN_INTERVAL_MIN = 1.2; // seconds
export const SPAWN_INTERVAL_MAX = 2.4; // seconds

export const BANKNOTE_SPAWN_CHANCE = 0.3; // 30% banknotes, 70% coins

export const PLAYFIELD_MIN_X = 65;
export const PLAYFIELD_MAX_X = 535;
export const PLAYFIELD_MIN_Y = 160;
export const PLAYFIELD_MAX_Y = 640;

export const VAULT_TOP_Y = 90; // Blue safe boundary
export const VAULT_BOTTOM_Y = 710; // Orange safe boundary
export const VAULT_MIN_X = 70;
export const VAULT_MAX_X = 530;
export const VAULT_MOUTH_MIN_X = 110;
export const VAULT_MOUTH_MAX_X = 490;

export const COIN_RADIUS = 26;
export const COIN_HIT_RADIUS = 50;
export const COIN_VALUE = 1;

export const BANKNOTE_WIDTH = 92;
export const BANKNOTE_HEIGHT = 48;
export const BANKNOTE_HIT_RADIUS = 65;
export const BANKNOTE_VALUE = 3;

export const TORN_PIECE_WIDTH = 46;
export const TORN_PIECE_HEIGHT = 48;
export const TORN_PIECE_VALUE = 1;

export const TEAR_DISTANCE_THRESHOLD = 95; // distance between opposite pulling fingers to rip banknote
export const TEAR_FLING_VELOCITY = 600; // potenzaGravita = 700 scaled to canvas

export const INERTIA_FRICTION = 0.95; // damping when released
export const BOUNCE_RESTITUTION = 0.65; // restitution when hitting lateral rails

// Bot difficulty settings verified from reference
export const BOT_CONFIG = {
  easy: {
    maxClaws: 3, // rampiniMassimiEasyModeCPU = 3
    reactionDelayMin: 1.2, // intervalloTempoReazioneEasyCPU (1.2s - 2.5s)
    reactionDelayMax: 2.5,
    dragSpeed: 380, // pixels per second
  },
  medium: {
    maxClaws: 5, // rampiniMassimiMediumModeCPU = 5
    reactionDelayMin: 0.7, // intervalloTempoReazioneMediumCPU (0.7s - 1.5s)
    reactionDelayMax: 1.5,
    dragSpeed: 520,
  },
  hard: {
    maxClaws: 5, // rampiniMassimiHardModeCPU = 5
    reactionDelayMin: 0.45, // intervalloTempoReazioneHardCPU (0.45s - 1.1s)
    reactionDelayMax: 1.1,
    dragSpeed: 680,
  },
} as const;

export type BotDifficulty = keyof typeof BOT_CONFIG;
