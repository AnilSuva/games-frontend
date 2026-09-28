import { getAvailableColumns } from "../logic/rules";
import { findBestMove } from "./minimax";
import type { Board, Player } from "../logic/types";

export type BotDifficulty = "easy" | "medium" | "hard";

function getEasyMove(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player
): number {
  const available = getAvailableColumns(columnCounts);
  if (available.length === 0) return -1;

  // Easy is intentionally beatable: 70% random/imperfect, 30% shallow search
  if (Math.random() < 0.70) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Shallow depth 1 search (evaluates only immediate positional score, may miss deeper tactics)
  return findBestMove(board, columnCounts, botPlayer, 1);
}

function getMediumMove(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player
): number {
  const available = getAvailableColumns(columnCounts);
  if (available.length === 0) return -1;

  // Medium is competent: respects tactical safety (depth 4 search includes immediate win and threat blocks)
  return findBestMove(board, columnCounts, botPlayer, 4);
}

function getHardMove(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player
): number {
  const available = getAvailableColumns(columnCounts);
  if (available.length === 0) return -1;

  // Hard is the strongest tactical engine: searches 6 plies deep with alpha-beta pruning and center preference
  return findBestMove(board, columnCounts, botPlayer, 6);
}

export function getBotMoveByDifficulty(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player,
  difficulty: BotDifficulty
): number {
  switch (difficulty) {
    case "easy":
      return getEasyMove(board, columnCounts, botPlayer);
    case "medium":
      return getMediumMove(board, columnCounts, botPlayer);
    case "hard":
      return getHardMove(board, columnCounts, botPlayer);
    default:
      return getMediumMove(board, columnCounts, botPlayer);
  }
}