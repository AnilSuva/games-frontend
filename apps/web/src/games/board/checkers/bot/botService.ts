/**
 * Asynchronous Bot service interface for Checkers.
 * Supports:
 * - Natural humanized move delay
 * - AbortSignal cancellation
 * - Easy / Medium / Hard difficulty tiers
 */

import type { CheckersMove, CheckersState, PlatformPlayer } from "../logic/types";
import { getBotMoveByDifficulty, type BotDifficulty } from "./difficulty";

export type { BotDifficulty };

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

export async function requestBotMove(
  state: CheckersState,
  botPlayer: PlatformPlayer = state.currentPlayer,
  options: BotRequestOptions = {}
): Promise<CheckersMove | null> {
  const { difficulty = "medium", delayMs = 300, signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  // Calculate move via designated difficulty algorithm
  const bestMove = getBotMoveByDifficulty(state, botPlayer, difficulty);

  // Humanized delay
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

  return bestMove;
}
