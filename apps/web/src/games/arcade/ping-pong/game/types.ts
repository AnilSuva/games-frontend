import type { PlatformPlayer } from "@/games/common/startingPlayer";

export interface Paddle {
  player: PlatformPlayer;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  faceRadius: number;
  handleWidth: number;
  handleHeight: number;
  graphics: Phaser.GameObjects.Graphics;
  shadowGraphics: Phaser.GameObjects.Graphics;
  history?: Array<{ x: number; y: number; time: number }>;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  zHeight: number;
  zPhase: "paddle_to_bounce" | "bounce_to_paddle";
  startY: number;
  targetBounceY: number;
  targetPaddleY: number;
  trailLength: number;
  active: boolean;
  graphics: Phaser.GameObjects.Graphics;
  shadowGraphics: Phaser.GameObjects.Graphics;
  trailGraphics?: Phaser.GameObjects.Graphics;
  targetX?: number;
  targetY?: number;
  isHardDirectHit?: boolean;
}

export interface BounceRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  graphics: Phaser.GameObjects.Graphics;
}

export interface PingPongScore {
  orange: number;
  blue: number;
  host?: number;
  guest?: number;
}

export interface PingPongCallbacks {
  onScoreUpdate?: (score: number) => void;
  onScoresChange?: (scores: PingPongScore) => void;
  onScoreChange?: (hostScore: number, guestScore: number) => void;
  onGameOver?: (result: { winner: PlatformPlayer; score: number }) => void;
  onLifecycleChange?: (status: "playing" | "paused" | "finished") => void;
}

export interface BallSyncPayload {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  zHeight: number;
  scoreOrange: number;
  scoreBlue: number;
  lastBounceAt?: number;
}

export interface OnlineNetworkingCallbacks {
  sendInput?: (input: string, data?: unknown) => void;
  sendGameEvent?: (event: string, data?: unknown) => void;
  sendBallSync?: (data: BallSyncPayload) => void;
  myRole?: PlatformPlayer;
  myPlayerId?: string;
  isHost?: boolean;
}

export interface SceneInitData {
  callbacks?: PingPongCallbacks;
  mode?: "1v1" | "vs-bot" | "online";
  difficulty?: "easy" | "medium" | "hard";
  localPlayerRole?: PlatformPlayer;
  isHost?: boolean;
  online?: OnlineNetworkingCallbacks;
  onScoreChange?: (hostScore: number, guestScore: number) => void;
  onGameOver?: (result: { winner: PlatformPlayer; score: number }) => void;
}
