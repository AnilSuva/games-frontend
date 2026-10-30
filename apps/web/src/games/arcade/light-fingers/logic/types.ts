import type { BotDifficulty } from "../config/constants";

export type PlayerId = "orange" | "blue";
export type LightFingersMode = "1v1" | "bot";

export type ItemKind = "coin" | "banknote" | "torn_piece";

export interface TouchGrab {
  playerId: PlayerId;
  touchId: number;
  offsetX: number;
  offsetY: number;
}

export interface MoneyItem {
  id: string;
  kind: ItemKind;
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  width: number;
  height: number;
  radius: number;
  grabbedBy: TouchGrab[];
  half?: "top" | "bottom" | null;
  spawnTime: number;
}

export interface TouchClaw {
  touchId: number;
  playerId: PlayerId;
  x: number;
  y: number;
  originX: number;
  originY: number;
  angle: number;
  isGrabbing: boolean;
  targetItemId: string | null;
  active: boolean;
}

export interface ScoreState {
  orange: number;
  blue: number;
}

export type GameEventKind =
  | "item_spawned"
  | "item_grabbed"
  | "item_released"
  | "coin_collected"
  | "banknote_collected"
  | "banknote_ripped"
  | "game_won";

export interface GameEvent {
  kind: GameEventKind;
  playerId?: PlayerId;
  x?: number;
  y?: number;
  value?: number;
  itemId?: string;
}

export interface LightFingersState {
  status: "playing" | "finished";
  winner: PlayerId | "draw" | null;
  score: ScoreState;
  items: MoneyItem[];
  claws: TouchClaw[];
  spawnTimer: number;
  nextItemId: number;
  mode: LightFingersMode;
  difficulty: BotDifficulty;
  recentEvents: GameEvent[];
}

export type LightFingersAction =
  | {
      type: "START_GAME";
      mode: LightFingersMode;
      difficulty: BotDifficulty;
    }
  | {
      type: "TICK";
      dt: number; // in seconds
    }
  | {
      type: "POINTER_DOWN";
      playerId: PlayerId;
      touchId: number;
      x: number;
      y: number;
    }
  | {
      type: "POINTER_MOVE";
      playerId: PlayerId;
      touchId: number;
      x: number;
      y: number;
    }
  | {
      type: "POINTER_UP";
      playerId: PlayerId;
      touchId: number;
    }
  | {
      type: "RESTART_GAME";
    };
