/**
 * Star Catcher (Astronavi) Type Definitions
 */

export type PlayerRole = "orange" | "blue";
export type GameMode = "1v1" | "bot";
export type BotDifficulty = "easy" | "medium" | "hard";

export interface StarCatcherScore {
  orange: number;
  blue: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface ShipState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  thrusting: boolean;
}

export interface StarState {
  x: number;
  y: number;
  active: boolean;
  scale: number;
}

export interface BlackHoleState {
  x: number;
  y: number;
  active: boolean;
  scale: number;
}

export interface AsteroidState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
}

export interface StarCatcherCallbacks {
  onScoreUpdate: (scores: StarCatcherScore) => void;
  onStarCollected: (collector: PlayerRole, newScores: StarCatcherScore) => void;
  onGameOver: (winner: PlayerRole, finalScores: StarCatcherScore) => void;
}

export interface StarCatcherInitData {
  mode: GameMode;
  difficulty: BotDifficulty;
  callbacks: StarCatcherCallbacks;
}

export interface JoystickInput {
  active: boolean;
  angle: number; // Angle in radians
  intensity: number; // 0 to 1
}
