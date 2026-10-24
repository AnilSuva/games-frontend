/**
 * Dots and Boxes Asynchronous Bot Service
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES)
 */

import {
  CPU_DIFFICULTY_PARAMS,
  selectBotMove,
  type BotDifficulty,
} from "./botLogic";
import type { DotsBoxesState, Edge } from "../logic/types";

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

/**
 * Asynchronously requests the bot's next edge move with authentic timing and abortability.
 */
export async function requestBotMove(
  state: DotsBoxesState,
  options: BotRequestOptions = {}
): Promise<Edge | null> {
  const { difficulty = "medium", signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  // Authentic delay from base.apk: Hard 1.0s, Medium 1.1s, Easy 1.2s
  const defaultDelay = CPU_DIFFICULTY_PARAMS[difficulty].delayMs;
  const delayMs = options.delayMs !== undefined ? options.delayMs : defaultDelay;

  // 1. Calculate best edge according to reverse-engineered CPU probabilities
  const move = selectBotMove(state, difficulty);

  // 2. Wait for natural turn delay
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

export type { BotDifficulty };
