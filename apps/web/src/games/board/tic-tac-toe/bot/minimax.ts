import { checkWinningLine, getAvailableMoves, isBoardFull, placeMark } from "../logic/rules";
import type { Board, Player } from "../logic/types";

/**
 * Evaluates the terminal score of a board configuration.
 * Positive score for bot win, negative for opponent win, zero for draw.
 */
function evaluateTerminalScore(
  board: Board,
  botPlayer: Player,
  depth: number
): number | null {
  const win = checkWinningLine(board);
  if (win) {
    const winner = board[win.line[0]];
    return winner === botPlayer ? 10 - depth : depth - 10;
  }
  if (isBoardFull(board)) {
    return 0;
  }
  return null;
}

/**
 * Minimax algorithm with depth penalty to choose fastest wins and delay losses.
 */
function minimax(
  board: Board,
  isMaximizing: boolean,
  botPlayer: Player,
  opponentPlayer: Player,
  depth: number,
  alpha: number = -Infinity,
  beta: number = Infinity
): number {
  const terminalScore = evaluateTerminalScore(board, botPlayer, depth);
  if (terminalScore !== null) {
    return terminalScore;
  }

  const availableMoves = getAvailableMoves(board);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of availableMoves) {
      const nextBoard = placeMark(board, move, botPlayer);
      const evaluation = minimax(
        nextBoard,
        false,
        botPlayer,
        opponentPlayer,
        depth + 1,
        alpha,
        beta
      );
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of availableMoves) {
      const nextBoard = placeMark(board, move, opponentPlayer);
      const evaluation = minimax(
        nextBoard,
        true,
        botPlayer,
        opponentPlayer,
        depth + 1,
        alpha,
        beta
      );
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    return minEval;
  }
}

export interface ScoredMove {
  move: number;
  score: number;
}

/**
 * Positional weight for tie-breaking moves of equal Minimax value:
 * Center (4) > Corners (0, 2, 6, 8) > Edges (1, 3, 5, 7).
 */
function getPositionalBonus(move: number): number {
  if (move === 4) return 0.2;
  if (move === 0 || move === 2 || move === 6 || move === 8) return 0.1;
  return 0;
}

/**
 * Evaluates and ranks all legal moves for the bot using Minimax search.
 * Returns an array of ScoredMove objects sorted from best to worst.
 */
export function scoreAllMoves(board: Board, botPlayer: Player): ScoredMove[] {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) {
    return [];
  }

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";
  const scored: ScoredMove[] = [];

  for (const move of availableMoves) {
    const nextBoard = placeMark(board, move, botPlayer);
    const score = minimax(nextBoard, false, botPlayer, opponentPlayer, 0);
    scored.push({ move, score });
  }

  // Sort descending by Minimax score; use positional heuristic as secondary tie-breaker
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return getPositionalBonus(b.move) - getPositionalBonus(a.move);
  });

  return scored;
}

/**
 * Determines the optimal move for the bot on the given board state.
 * Returns the cell index (0..8) of the best move.
 */
export function findBestMove(board: Board, botPlayer: Player): number {
  const ranked = scoreAllMoves(board, botPlayer);
  if (ranked.length === 0) {
    return -1;
  }
  return ranked[0].move;
}
