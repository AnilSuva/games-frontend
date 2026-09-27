import { checkWinningLine, getAvailableMoves, placeMark } from "../logic/rules";
import type { Board, Player } from "../logic/types";
import { findBestMove } from "./minimax";

export type BotDifficulty = "easy" | "medium" | "hard";

/**
 * Finds if there is an immediate move that results in an instant win for the given player.
 */
function findImmediateWinMove(board: Board, player: Player): number | null {
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
 * - 70% chance: Choose a random legal move.
 * - 30% chance: Choose the optimal Minimax move.
 * This makes the bot beatable by normal human players while maintaining legal play.
 */
function getEasyMove(board: Board, botPlayer: Player): number {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;

  // 70% random, 30% smart
  const shouldPlayRandom = Math.random() < 0.7;
  if (shouldPlayRandom) {
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  return findBestMove(board, botPlayer);
}

/**
 * Medium Difficulty:
 * - 100% takes immediate winning move if available.
 * - 80% blocks immediate opponent winning threat.
 * - Otherwise, 60% chance optimal Minimax, 40% chance random/suboptimal move.
 * Provides a fair, engaging challenge without being unbeatable.
 */
function getMediumMove(board: Board, botPlayer: Player): number {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";

  // 1. If bot can win right now, take it
  const winningMove = findImmediateWinMove(board, botPlayer);
  if (winningMove !== null) {
    return winningMove;
  }

  // 2. 80% chance to block immediate opponent win
  const opponentWinningMove = findImmediateWinMove(board, opponentPlayer);
  if (opponentWinningMove !== null && Math.random() < 0.8) {
    return opponentWinningMove;
  }

  // 3. 60% optimal move, 40% random move
  if (Math.random() < 0.6) {
    return findBestMove(board, botPlayer);
  }

  const randomIndex = Math.floor(Math.random() * availableMoves.length);
  return availableMoves[randomIndex];
}

/**
 * Hard Difficulty:
 * - 100% optimal Minimax play with alpha-beta pruning.
 * - Unbeatable. Will force a win or draw against any player.
 */
function getHardMove(board: Board, botPlayer: Player): number {
  return findBestMove(board, botPlayer);
}

/**
 * Dispatches the move calculation according to the chosen difficulty level.
 */
export function getBotMoveByDifficulty(
  board: Board,
  botPlayer: Player,
  difficulty: BotDifficulty
): number {
  switch (difficulty) {
    case "easy":
      return getEasyMove(board, botPlayer);
    case "medium":
      return getMediumMove(board, botPlayer);
    case "hard":
      return getHardMove(board, botPlayer);
    default:
      return getMediumMove(board, botPlayer);
  }
}
