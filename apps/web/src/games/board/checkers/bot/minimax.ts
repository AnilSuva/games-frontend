/**
 * Minimax algorithm with Alpha-Beta Pruning for Checkers (Draughts).
 * Pure deterministic AI evaluation with zero React or DOM dependencies.
 */

import {
  BLUE_MAN,
  EMPTY,
  ORANGE_MAN,
  type CheckersMove,
  type CheckersState,
  type Piece,
  type PlatformPlayer,
} from "../logic/types";
import { getPiecePlayer, getValidMoves } from "../logic/moves";
import { checkersReducer } from "../logic/reducer";

/**
 * Heuristic evaluation function for a Checkers board state.
 *
 * Base values:
 * - Man = 100
 * - King = 300
 *
 * Positional bonuses:
 * - Center squares: +15 bonus for central control.
 * - Flanking center squares: +8 bonus.
 * - Back row protection: +20 bonus for maintaining defensive pieces on home row (harder to king).
 * - Advancement bonus: +4 per row advanced toward king row.
 */
export function evaluateBoard(
  board: readonly Piece[],
  botPlayer: PlatformPlayer
): number {
  let score = 0;

  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (piece === EMPTY) continue;

    const row = Math.floor(i / 8);
    const col = i % 8;
    const isBotPiece = getPiecePlayer(piece) === botPlayer;
    let pieceScore = 0;

    if (piece === ORANGE_MAN || piece === BLUE_MAN) {
      pieceScore += 100; // Base Man value

      if (piece === ORANGE_MAN) {
        // Orange advances upwards (decreasing row)
        pieceScore += (7 - row) * 4;
        if (row === 7) pieceScore += 20; // Back row defensive anchor
      } else {
        // Blue advances downwards (increasing row)
        pieceScore += row * 4;
        if (row === 0) pieceScore += 20; // Back row defensive anchor
      }
    } else {
      pieceScore += 300; // Base King value
    }

    // Center square positional bonus
    if ((row === 3 || row === 4) && (col === 2 || col === 3 || col === 4 || col === 5)) {
      pieceScore += 15;
    } else if ((row === 2 || row === 5) && col >= 2 && col <= 5) {
      pieceScore += 8;
    }

    score += isBotPiece ? pieceScore : -pieceScore;
  }

  return score;
}

/**
 * Minimax recursive search with Alpha-Beta pruning.
 * Seamlessly traverses multi-jump chains by keeping turn when `activePiece !== null`.
 */
export function minimax(
  state: CheckersState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  botPlayer: PlatformPlayer
): number {
  // Terminal state evaluation
  if (state.status === "won") {
    if (state.winner === botPlayer) {
      return 100000 + depth;
    }
    return -100000 - depth;
  }

  if (state.status === "draw") {
    return 0;
  }

  if (depth <= 0) {
    return evaluateBoard(state.board, botPlayer);
  }

  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) {
    // Current player has no moves (stalemate/loss)
    const opponent: PlatformPlayer =
      state.currentPlayer === "orange" ? "blue" : "orange";
    return opponent === botPlayer ? 100000 + depth : -100000 - depth;
  }

  // Move ordering: jumps first to maximize alpha-beta pruning cutoffs
  validMoves.sort((a, b) => (b.isJump ? 1 : 0) - (a.isJump ? 1 : 0));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of validMoves) {
      const nextState = checkersReducer(state, {
        type: "MOVE",
        from: move.from,
        to: move.to,
      });

      const sameTurn =
        nextState.currentPlayer === state.currentPlayer &&
        nextState.status === "in_progress";

      const evaluation = minimax(
        nextState,
        sameTurn ? depth : depth - 1,
        alpha,
        beta,
        sameTurn ? isMaximizing : !isMaximizing,
        botPlayer
      );

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // Beta cutoff
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of validMoves) {
      const nextState = checkersReducer(state, {
        type: "MOVE",
        from: move.from,
        to: move.to,
      });

      const sameTurn =
        nextState.currentPlayer === state.currentPlayer &&
        nextState.status === "in_progress";

      const evaluation = minimax(
        nextState,
        sameTurn ? depth : depth - 1,
        alpha,
        beta,
        sameTurn ? isMaximizing : !isMaximizing,
        botPlayer
      );

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // Alpha cutoff
      }
    }
    return minEval;
  }
}

/**
 * Searches and returns the optimal move for `botPlayer` using alpha-beta minimax.
 */
export function findBestMove(
  state: CheckersState,
  botPlayer: PlatformPlayer = state.currentPlayer,
  depth: number = 4
): CheckersMove | null {
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;
  if (validMoves.length === 1) return validMoves[0];

  // Prioritize captures
  validMoves.sort((a, b) => (b.isJump ? 1 : 0) - (a.isJump ? 1 : 0));

  let bestMove: CheckersMove = validMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of validMoves) {
    const nextState = checkersReducer(state, {
      type: "MOVE",
      from: move.from,
      to: move.to,
    });

    const sameTurn =
      nextState.currentPlayer === state.currentPlayer &&
      nextState.status === "in_progress";

    const score = minimax(
      nextState,
      sameTurn ? depth : depth - 1,
      alpha,
      beta,
      sameTurn ? true : false,
      botPlayer
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, bestScore);
  }

  return bestMove;
}
