export type MiniGolfPlayer = "orange" | "blue";

export type MiniGolfStatus = "waiting" | "in_progress" | "won" | "draw";

export type MiniGolfResultReason =
  | "score"
  | "disconnect_forfeit"
  | "timeout";

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
  speed: number; // oscillations per second or period in ms
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

export interface MiniGolfGameState {
  currentHoleIndex: number;
  startingPlayer: MiniGolfPlayer;
  currentPlayer: MiniGolfPlayer;
  status: MiniGolfStatus;
  winner: MiniGolfPlayer | "draw" | null;
  resultReason?: MiniGolfResultReason;
  playerRoles: Record<string, MiniGolfPlayer>; // playerId -> "orange" | "blue"
  rematchRequests: string[];
  maxStrokesPerHole: number;
  // Hole-by-hole scores: [hole0, hole1, hole2]
  holeScores: {
    orange: number[];
    blue: number[];
  };
  // Current active hole runtime state
  holeState: {
    orange: PlayerHoleState;
    blue: PlayerHoleState;
  };
  // Last shot resolution for animations
  lastShot?: {
    playerId: string;
    playerRole: MiniGolfPlayer;
    aim: Vector2;
    power: number;
    trajectory: TrajectoryPoint[];
    events: PhysicsEvent[];
    sunk: boolean;
    waterHazard: boolean;
    finalPosition: Vector2;
    strokes: number;
  } | null;
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  turnExpiresAt?: number | null;
}

export type MiniGolfAction =
  | {
      type: "SHOT";
      aim: Vector2;
      power: number;
      seq?: number;
    }
  | {
      type: "MOVE";
      shot?: {
        dx: number;
        dy: number;
        power: number;
      };
      // fallback compatibility if sent as move
      aim?: Vector2;
      power?: number;
    }
  | {
      type: "INPUT";
      input: string;
      data?: unknown;
    }
  | {
      type: "REMATCH";
    };
