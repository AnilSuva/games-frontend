export type MiniGolfPlayer = "orange" | "blue";

export type MiniGolfGameMode = "1v1" | "vs-bot" | "online";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface Vector2 {
  x: number;
  y: number;
}

export interface WallSegment {
  p1: Vector2;
  p2: Vector2;
  restitution?: number;
  friction?: number;
}

export interface BumperDef {
  id: string;
  x: number;
  y: number;
  radius: number;
  restitution: number;
}

export interface SurfaceZone {
  id: string;
  type: "sand" | "rough" | "water";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MovingObstacleDef {
  id: string;
  type: "horizontal" | "vertical";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
  speed: number;
  periodMs: number;
}

export interface CourseDef {
  id: string;
  name: string;
  par: number;
  width: number;
  height: number;
  startPositions: {
    orange: Vector2;
    blue: Vector2;
  };
  hole: {
    x: number;
    y: number;
    radius: number;
    captureRadius: number;
    maxCaptureSpeed: number;
    lipOutSpeed: number;
  };
  walls: WallSegment[];
  bumpers: BumperDef[];
  surfaces: SurfaceZone[];
  movingObstacles: MovingObstacleDef[];
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

export interface PhysicsEvent {
  type: "wall_bounce" | "bumper_hit" | "water_hazard" | "hole_sink" | "lip_out";
  x: number;
  y: number;
  step: number;
  extra?: unknown;
}

export interface SimulationResult {
  trajectory: TrajectoryPoint[];
  finalPosition: Vector2;
  sunk: boolean;
  waterHazard: boolean;
  events: PhysicsEvent[];
  settled: boolean;
  totalSteps: number;
}

export interface PlayerHoleState {
  strokes: number;
  finished: boolean;
  ballPosition: Vector2;
  lastSafePosition: Vector2;
}

export interface MiniGolfScoreCard {
  orange: number[];
  blue: number[];
}

export interface MiniGolfCallbacks {
  onScoreUpdate?: (scores: MiniGolfScoreCard) => void;
  onTurnChange?: (player: MiniGolfPlayer | null) => void;
  onHoleChange?: (holeIndex: number) => void;
  onGameOver?: (result: {
    winner: MiniGolfPlayer | "draw";
    scores: MiniGolfScoreCard;
    totalOrange: number;
    totalBlue: number;
  }) => void;
  onShotIntent?: (shot: { aim: Vector2; power: number }) => void;
  onAudioPlay?: (
    sound:
      | "hit"
      | "swing"
      | "bounce"
      | "bumper"
      | "water"
      | "sink"
      | "lipout"
      | "holeComplete"
      | "scorecard"
      | "victory"
      | "defeat"
  ) => void;
}

export interface SceneInitData {
  mode: MiniGolfGameMode;
  botDifficulty?: BotDifficulty;
  callbacks: MiniGolfCallbacks;
  localPlayerRole?: MiniGolfPlayer;
}
