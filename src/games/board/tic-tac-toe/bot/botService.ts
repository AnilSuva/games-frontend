import { getBotMoveByDifficulty, type BotDifficulty } from "./difficulty";
import type { Board, Player } from "../logic/types";

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

/**
 * Asynchronous Bot service interface.
 * Connects the UI to difficulty-tiered move selection while supporting:
 * - Natural humanized delay
 * - AbortSignal cancellation
 * - Easy / Medium / Hard difficulty levels
 */
export async function requestBotMove(
  board: Board,
  botPlayer: Player,
  options: BotRequestOptions = {}
): Promise<number> {
  const { difficulty = "medium", delayMs = 300, signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  // 1. Calculate move via designated difficulty algorithm
  const bestMove = getBotMoveByDifficulty(board, botPlayer, difficulty);

  // 2. Wait for humanized delay if requested
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

export type { BotDifficulty } from "./difficulty";
