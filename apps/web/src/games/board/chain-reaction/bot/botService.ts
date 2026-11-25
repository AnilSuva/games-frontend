import {
  BOT_DELAYS,
  selectBotMove,
  type BotDifficulty,
} from "./botLogic";
import type { ChainReactionState, MoveLocation } from "../logic/types";

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

/**
 * Asynchronously requests the bot's next move with human-paced natural delay and abortability.
 */
export async function requestBotMove(
  state: ChainReactionState,
  options: BotRequestOptions = {}
): Promise<MoveLocation | null> {
  const { difficulty = "medium", signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  const defaultDelay = BOT_DELAYS[difficulty];
  const delayMs = options.delayMs !== undefined ? options.delayMs : defaultDelay;

  // 1. Calculate best move using pure Minimax logic
  const move = selectBotMove(state, difficulty);

  // 2. Wait for natural turn pacing
  if (delayMs > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
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

  return move;
}
