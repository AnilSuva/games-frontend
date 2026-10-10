/**
 * Difficulty-tiered move selection for Checkers bot.
 */

import type { CheckersMove, CheckersState, PlatformPlayer } from "../logic/types";
import { getValidMoves } from "../logic/moves";
import { findBestMove } from "./minimax";

export type BotDifficulty = "easy" | "medium" | "hard";

/**
 * Returns a move selected according to the requested difficulty tier:
 * - Easy: 70% random legal move, 30% shallow search (Depth 1).
 * - Medium: Depth 3 Minimax search.
 * - Hard: Depth 5 Minimax search with Alpha-Beta pruning.
 */
export function getBotMoveByDifficulty(
  state: CheckersState,
  botPlayer: PlatformPlayer = state.currentPlayer,
  difficulty: BotDifficulty = "medium",
  rng: () => number = Math.random
): CheckersMove | null {
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;
  if (validMoves.length === 1) return validMoves[0];

  switch (difficulty) {
    case "easy": {
      if (rng() < 0.7) {
        const randomIndex = Math.floor(rng() * validMoves.length);
        return validMoves[randomIndex];
      }
      return findBestMove(state, botPlayer, 1);
    }
    case "medium": {
      return findBestMove(state, botPlayer, 3);
    }
    case "hard": {
      return findBestMove(state, botPlayer, 5);
    }
  }
}
