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

/**
 * Determines the optimal move for the bot on the given board state.
 * Returns the cell index (0..8) of the best move.
 */
export function findBestMove(board: Board, botPlayer: Player): number {
  const availableMoves = getAvailableMoves(board);

  // If no moves or invalid state, return -1
  if (availableMoves.length === 0) {
    return -1;
  }

  // Opening move optimization: if the entire board is empty, pick center for instant first move
  if (availableMoves.length === 9) {
    return 4;
  }

  const opponentPlayer: Player = botPlayer === "X" ? "O" : "X";
  let bestScore = -Infinity;
  let bestMove = availableMoves[0];

  for (const move of availableMoves) {
    const nextBoard = placeMark(board, move, botPlayer);
    const score = minimax(nextBoard, false, botPlayer, opponentPlayer, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
