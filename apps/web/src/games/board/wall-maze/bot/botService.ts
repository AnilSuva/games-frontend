import {
  BOT_DELAYS,
  selectBotMove,
  type BotDifficulty,
} from "./botLogic";
import type { WallMazeAction, WallMazeState } from "../logic/types";

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

/**
 * Asynchronously computes the bot's next action with natural turn pacing and cancellation.
 */
export async function requestBotMove(
  state: WallMazeState,
  options: BotRequestOptions = {}
): Promise<WallMazeAction | null> {
  const { difficulty = "medium", signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  const startMs = Date.now();
  const action = selectBotMove(state, difficulty);
  const elapsedMs = Date.now() - startMs;

  const targetDelay =
    options.delayMs !== undefined ? options.delayMs : BOT_DELAYS[difficulty];
  const remainingDelay = Math.max(0, targetDelay - elapsedMs);

  if (remainingDelay > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, remainingDelay);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Bot calculation aborted", "AbortError"));
          },
          { once: true }
        );
      }
    });
  }

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  return action;
}
