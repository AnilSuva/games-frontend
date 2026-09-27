import type { IAudioService } from "@/platform/audio/types";
import type { IStorageService } from "@/platform/storage/types";

export type GameMode = "local-2p" | "pvp-bot" | "online-2p";

export interface GameResult {
  winner?: string | "draw" | null;
  score?: number;
  details?: Record<string, unknown>;
}

export interface IGameController {
  pause?: () => void;
  resume?: () => void;
  restart: () => void;
  destroy?: () => void;
}

export type GameLifecycle = "pre-game" | "configuration" | "playing" | "finished";

export interface GameHostProps {
  mode: GameMode;
  audio?: IAudioService;
  storage?: IStorageService;
  onGameOver: (result: GameResult) => void;
  onScoreUpdate?: (score: number) => void;
  onReady: (controller: IGameController) => void;
  onLifecycleChange?: (state: GameLifecycle) => void;
  onTurnChange?: (player: "X" | "O" | null) => void;
}

