import { checkWinningLine, getAvailableMoves, placeMark } from "../logic/rules";
import type { Board, Player } from "../logic/types";
import { findBestMove, scoreAllMoves } from "./minimax";

export type BotDifficulty = "easy" | "medium" | "hard";

export type RNG = () => number;

/**
 * Finds if there is an immediate move that results in an instant win for the given player.
 */
export function findImmediateWinMove(board: Board, player: Player): number | null {
  const availableMoves = getAvailableMoves(board);
  for (const move of availableMoves) {
    const nextBoard = placeMark(board, move, player);
    if (checkWinningLine(nextBoard)) {
      return move;
    }
  }
  return null;
}

/**
 * Easy Difficulty:
 * - Casual, relaxed opponent.
 * - 50% chance to take an immediate winning move.
 * - 30% chance to block an immediate opponent threat (misses 70% of threats).
 * - Otherwise:
 *   - 75% chance: random legal move.
 *   - 25% chance: optimal Minimax move.
 */
export function getEasyMove(board: Board, botPlayer: Player, rng: RNG = Math.random): number {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";

  // 1. 50% chance to take immediate win
  const winningMove = findImmediateWinMove(board, botPlayer);
  if (winningMove !== null && rng() < 0.5) {
    return winningMove;
  }

  // 2. 30% chance to block immediate opponent win
  const opponentWinningMove = findImmediateWinMove(board, opponentPlayer);
  if (opponentWinningMove !== null && rng() < 0.3) {
    return opponentWinningMove;
  }

  // 3. 75% random legal move, 25% smart move
  if (rng() < 0.75) {
    const randomIndex = Math.floor(rng() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  return findBestMove(board, botPlayer);
}

/**
 * Medium Difficulty:
 * - Competent, solid opponent beatable by a good human.
 * - 100% takes immediate winning moves.
 * - 80% blocks immediate opponent winning threats.
 * - Otherwise:
 *   - 65% chance: plays optimal Minimax move.
 *   - 35% chance: plays a secondary candidate move or positional move.
 */
export function getMediumMove(board: Board, botPlayer: Player, rng: RNG = Math.random): number {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";

  // 1. 100% take immediate winning move
  const winningMove = findImmediateWinMove(board, botPlayer);
  if (winningMove !== null) {
    return winningMove;
  }

  // 2. 80% chance to block immediate opponent threat
  const opponentWinningMove = findImmediateWinMove(board, opponentPlayer);
  if (opponentWinningMove !== null) {
    if (rng() < 0.8) {
      return opponentWinningMove;
    }
  }

  // 3. Move selection: 65% optimal, 35% secondary candidate
  const ranked = scoreAllMoves(board, botPlayer);
  if (ranked.length <= 1 || rng() < 0.65) {
    return ranked[0].move;
  }

  // Pick secondary move (excluding moves where opponent wins immediately on next turn)
  const safeMoves = ranked.slice(1).filter((m) => {
    const nextBoard = placeMark(board, m.move, botPlayer);
    return findImmediateWinMove(nextBoard, opponentPlayer) === null;
  });

  if (safeMoves.length > 0) {
    const pick = Math.floor(rng() * safeMoves.length);
    return safeMoves[pick].move;
  }

  return ranked[0].move;
}

/**
 * Hard Difficulty:
 * - Genuinely difficult, tactical opponent, but NOT mathematically unbeatable.
 * - 100% takes immediate wins.
 * - 100% blocks immediate threats.
 * - Non-immediate moves:
 *   - Ranks all available moves using Minimax.
 *   - Groups candidate moves into top-tier (optimal score) and safe second-tier.
 *   - Safe second-tier moves are NOT blunders (opponent cannot instantly win on next turn).
 *   - ~80% chance: selects from top-tier moves.
 *   - ~20% chance: selects from safe second-tier moves.
 *   - This allows a skilled human to build strategic forks and win, while Hard never makes silly blunders.
 */
export function getHardMove(board: Board, botPlayer: Player, rng: RNG = Math.random): number {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";

  // 1. 100% take immediate win if available
  const winningMove = findImmediateWinMove(board, botPlayer);
  if (winningMove !== null) {
    return winningMove;
  }

  // 2. 100% block immediate opponent winning threat
  const opponentWinningMove = findImmediateWinMove(board, opponentPlayer);
  if (opponentWinningMove !== null) {
    return opponentWinningMove;
  }

  // 3. Minimax ranking with controlled strategic imperfection
  const ranked = scoreAllMoves(board, botPlayer);
  if (ranked.length <= 1) {
    return ranked[0].move;
  }

  const bestScore = ranked[0].score;
  const topMoves = ranked.filter((m) => m.score === bestScore);
  const secondaryMoves = ranked.filter((m) => m.score < bestScore);

  // If bot already has a winning line forced (bestScore > 0), always execute the winning line
  if (bestScore > 0) {
    return topMoves[0].move;
  }

  // Find non-blunder secondary moves (where opponent cannot immediately win on next turn)
  const safeSecondaryMoves = secondaryMoves.filter((m) => {
    const nextBoard = placeMark(board, m.move, botPlayer);
    return findImmediateWinMove(nextBoard, opponentPlayer) === null;
  });

  // 80% optimal move, 20% safe second-tier move (if available)
  if (safeSecondaryMoves.length > 0 && rng() < 0.2) {
    const chosenIndex = Math.floor(rng() * safeSecondaryMoves.length);
    return safeSecondaryMoves[chosenIndex].move;
  }

  // Otherwise play best move (with positional preference)
  return topMoves[0].move;
}

/**
 * Dispatches move calculation according to the chosen difficulty level.
 */
export function getBotMoveByDifficulty(
  board: Board,
  botPlayer: Player,
  difficulty: BotDifficulty,
  rng: RNG = Math.random
): number {
  switch (difficulty) {
    case "easy":
      return getEasyMove(board, botPlayer, rng);
    case "medium":
      return getMediumMove(board, botPlayer, rng);
    case "hard":
      return getHardMove(board, botPlayer, rng);
    default:
      return getMediumMove(board, botPlayer, rng);
  }
}
