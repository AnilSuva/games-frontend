import type { ChainReactionState, MoveLocation, Player } from "../logic/types";
import {
  COLS,
  ROWS,
  countOrbs,
  countCells,
  getCriticalMass,
  getLegalMoves,
  getNeighbors,
  resolveMove,
} from "../logic/rules";

export type BotDifficulty = "easy" | "medium" | "hard";

export const BOT_DELAYS: Record<BotDifficulty, number> = {
  easy: 400,
  medium: 450,
  hard: 500,
};

/**
 * Static board evaluation heuristic from `player`'s perspective.
 */
export function evaluateBoard(state: ChainReactionState, player: Player): number {
  if (state.status === "finished") {
    if (state.winner === player) return 100000;
    if (state.winner !== null) return -100000;
    return 0;
  }

  const opponent: Player = player === "X" ? "O" : "X";
  const orbCounts = countOrbs(state.grid);
  const cellCounts = countCells(state.grid);

  let score =
    (orbCounts[player] - orbCounts[opponent]) * 10 +
    (cellCounts[player] - cellCounts[opponent]) * 8;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (!cell.owner) continue;

      const crit = getCriticalMass(r, c);
      const isCorner = crit === 2;
      const isEdge = crit === 3;
      const isNearCrit = cell.count === crit - 1;
      const multiplier = cell.owner === player ? 1 : -1;

      if (isCorner) score += multiplier * 20;
      else if (isEdge) score += multiplier * 8;

      if (isNearCrit) score += multiplier * 14;

      // Penalize cells threatened by neighboring enemy near-critical cells
      const neighbors = getNeighbors(r, c);
      for (const n of neighbors) {
        const nCell = state.grid[n.row][n.col];
        if (nCell.owner && nCell.owner !== cell.owner) {
          const nCrit = getCriticalMass(n.row, n.col);
          if (nCell.count === nCrit - 1) {
            score -= multiplier * 22;
          }
        }
      }
    }
  }

  return score;
}

interface RankedMove {
  move: MoveLocation;
  score: number;
  isImmediateWin?: boolean;
}

/**
 * Pre-ranks and sorts moves to optimize Alpha-Beta cutoff efficiency.
 */
function rankMoves(
  state: ChainReactionState,
  legalMoves: MoveLocation[],
  player: Player
): RankedMove[] {
  const opponent: Player = player === "X" ? "O" : "X";
  const preOppOrbs = countOrbs(state.grid)[opponent];

  return legalMoves
    .map((move) => {
      const { finalState } = resolveMove(state, move.row, move.col);

      if (finalState.status === "finished" && finalState.winner === player) {
        return { move, score: 999999, isImmediateWin: true };
      }

      const crit = getCriticalMass(move.row, move.col);
      const cell = state.grid[move.row][move.col];
      const isCorner = crit === 2;
      const isEdge = crit === 3;
      const willExplode = cell.count + 1 >= crit;

      let staticScore = 0;
      if (willExplode) staticScore += 300;
      if (isCorner) staticScore += 180;
      else if (isEdge) staticScore += 80;

      // Reward capturing enemy orbs
      const postOppOrbs = countOrbs(finalState.grid)[opponent];
      const captured = preOppOrbs - postOppOrbs;
      if (captured > 0) {
        staticScore += captured * 50;
      }

      // Check if neighboring cells are enemy near-critical cells
      const neighbors = getNeighbors(move.row, move.col);
      for (const n of neighbors) {
        const nCell = state.grid[n.row][n.col];
        if (nCell.owner === opponent) {
          const nCrit = getCriticalMass(n.row, n.col);
          if (nCell.count === nCrit - 1) {
            // Placing next to an enemy ready to explode is dangerous unless we exploded
            if (!willExplode) {
              staticScore -= 120;
            } else {
              staticScore += 100;
            }
          }
        }
      }

      return { move, score: staticScore };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Minimax with Alpha-Beta Pruning.
 */
function minimax(
  state: ChainReactionState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  evaluatingPlayer: Player
): number {
  if (depth === 0 || state.status === "finished") {
    return evaluateBoard(state, evaluatingPlayer);
  }

  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) {
    return evaluateBoard(state, evaluatingPlayer);
  }

  const activePlayer = state.currentPlayer;
  const ranked = rankMoves(state, legalMoves, activePlayer);

  // If immediate win exists at this node, evaluate directly
  if (ranked[0]?.isImmediateWin) {
    return isMaximizing ? 100000 : -100000;
  }

  // Candidate pruning to guarantee < 150ms execution
  const candidateLimit = depth >= 3 ? 12 : depth === 2 ? 8 : 6;
  const candidates = ranked.slice(0, candidateLimit);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const { move } of candidates) {
      const { finalState } = resolveMove(state, move.row, move.col);
      const evalValue = minimax(finalState, depth - 1, alpha, beta, false, evaluatingPlayer);
      maxEval = Math.max(maxEval, evalValue);
      alpha = Math.max(alpha, evalValue);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = +Infinity;
    for (const { move } of candidates) {
      const { finalState } = resolveMove(state, move.row, move.col);
      const evalValue = minimax(finalState, depth - 1, alpha, beta, true, evaluatingPlayer);
      minEval = Math.min(minEval, evalValue);
      beta = Math.min(beta, evalValue);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Selects the best move for the bot according to the selected difficulty tier.
 */
export function selectBotMove(
  state: ChainReactionState,
  difficulty: BotDifficulty = "medium"
): MoveLocation | null {
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) return null;

  const botPlayer = state.currentPlayer;
  const ranked = rankMoves(state, legalMoves, botPlayer);

  // If there's an immediate winning move, always take it on Medium & Hard
  if (difficulty !== "easy" && ranked[0]?.isImmediateWin) {
    return ranked[0].move;
  }

  if (difficulty === "easy") {
    // 35% chance to pick completely random move
    if (Math.random() < 0.35) {
      const randomIndex = Math.floor(Math.random() * legalMoves.length);
      return legalMoves[randomIndex];
    }
    // 65% chance to pick from top ranked with light jitter
    const topSlice = ranked.slice(0, Math.min(6, ranked.length));
    const jittered = topSlice.map((rm) => ({
      ...rm,
      score: rm.score + (Math.random() * 80 - 40),
    }));
    jittered.sort((a, b) => b.score - a.score);
    return jittered[0].move;
  }

  if (difficulty === "medium") {
    // Depth-2 Minimax with top 8 candidates
    const candidates = ranked.slice(0, Math.min(8, ranked.length));
    let bestMove = candidates[0].move;
    let bestScore = -Infinity;

    for (const { move } of candidates) {
      const { finalState } = resolveMove(state, move.row, move.col);
      const score = minimax(finalState, 1, -Infinity, Infinity, false, botPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // Hard: Depth-3 Alpha-Beta Minimax with aggressive pruning and move ordering
  const candidates = ranked.slice(0, Math.min(12, ranked.length));
  let bestMove = candidates[0].move;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const { move } of candidates) {
    const { finalState } = resolveMove(state, move.row, move.col);
    const score = minimax(finalState, 2, alpha, beta, false, botPlayer);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
  }

  return bestMove;
}
