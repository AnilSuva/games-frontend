import {
  GOAL_ROW,
  GRID_SIZE,
  WALL_GRID_SIZE,
  applyAction,
  buildBlockedEdgeMask,
  getOpponent,
  getShortestPath,
  getValidPawnMoves,
  hasWallCollision,
} from "../logic/rules";
import type {
  Player,
  Position,
  Wall,
  WallMazeAction,
  WallMazeState,
  WallOrientation,
  WallPlacement,
} from "../logic/types";

export type BotDifficulty = "easy" | "medium" | "hard";

export const BOT_DELAYS: Record<BotDifficulty, number> = {
  easy: 300,
  medium: 350,
  hard: 380,
};

const WIN_SCORE = 100000;
const THREAT_WIN_SCORE = 95000;
const HARD_SEARCH_DEPTH = 3;
const HARD_TIME_BUDGET_MS = 85;

/**
 * Checks if `player` has an immediate 1-move pawn win (including straight/diagonal jumps).
 */
export function findImmediateWinningMove(
  state: WallMazeState,
  player: Player = state.currentPlayer
): WallMazeAction | null {
  if (state.status !== "playing") return null;
  const moves = getValidPawnMoves(state, player);
  const goalRow = GOAL_ROW[player];
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].row === goalRow) {
      return { type: "MOVE_PAWN", row: moves[i].row, col: moves[i].col };
    }
  }
  return null;
}

function hasImmediateWinInMoves(state: WallMazeState, player: Player): boolean {
  const moves = getValidPawnMoves(state, player);
  const goalRow = GOAL_ROW[player];
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].row === goalRow) return true;
  }
  return false;
}

/**
 * Static board evaluation heuristic from `evaluatingPlayer`'s perspective.
 */
export function evaluateBoard(
  state: WallMazeState,
  evaluatingPlayer: Player,
  depthRemaining = 0
): number {
  if (state.status === "finished") {
    if (state.winner === evaluatingPlayer) return WIN_SCORE + depthRemaining * 100;
    if (state.winner !== null) return -WIN_SCORE - depthRemaining * 100;
    return 0;
  }

  const opp = getOpponent(evaluatingPlayer);

  // 1-ply immediate win/loss threat check at leaves
  if (hasImmediateWinInMoves(state, state.currentPlayer)) {
    return state.currentPlayer === evaluatingPlayer
      ? THREAT_WIN_SCORE + depthRemaining * 50
      : -THREAT_WIN_SCORE - depthRemaining * 50;
  }

  const mask = buildBlockedEdgeMask(state.walls);
  const myDist = bfsDistFromMask(mask, state.pawns[evaluatingPlayer], GOAL_ROW[evaluatingPlayer]);
  const oppDist = bfsDistFromMask(mask, state.pawns[opp], GOAL_ROW[opp]);

  const safeMyDist = myDist ?? 64;
  const safeOppDist = oppDist ?? 64;

  const pathScore = (safeOppDist - safeMyDist) * 12;
  const wallScore = (state.wallsLeft[evaluatingPlayer] - state.wallsLeft[opp]) * 1.5;
  const tempoTieBreaker = state.currentPlayer === evaluatingPlayer ? 2.5 : -2.5;
  const centerBonus = (4 - Math.abs(state.pawns[evaluatingPlayer].col - 4)) * 0.08;

  return pathScore + wallScore + tempoTieBreaker + centerBonus;
}

// Fast local BFS on prebuilt edge mask (same bit layout as rules.ts)
const BIT_UP = 1;
const BIT_DOWN = 2;
const BIT_LEFT = 4;
const BIT_RIGHT = 8;

function bfsDistFromMask(
  mask: Uint8Array,
  start: Position,
  goalRow: number
): number | null {
  if (start.row === goalRow) return 0;

  const totalCells = GRID_SIZE * GRID_SIZE;
  const dist = new Int8Array(totalCells);
  dist.fill(-1);

  const queue = new Int8Array(totalCells);
  let head = 0;
  let tail = 0;

  const startIdx = start.row * GRID_SIZE + start.col;
  dist[startIdx] = 0;
  queue[tail++] = startIdx;

  while (head < tail) {
    const idx = queue[head++];
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const nextDist = dist[idx] + 1;
    const cellMask = mask[idx];

    if (r > 0 && (cellMask & BIT_UP) === 0) {
      const nIdx = idx - GRID_SIZE;
      if (dist[nIdx] === -1) {
        if (r - 1 === goalRow) return nextDist;
        dist[nIdx] = nextDist;
        queue[tail++] = nIdx;
      }
    }
    if (r < GRID_SIZE - 1 && (cellMask & BIT_DOWN) === 0) {
      const nIdx = idx + GRID_SIZE;
      if (dist[nIdx] === -1) {
        if (r + 1 === goalRow) return nextDist;
        dist[nIdx] = nextDist;
        queue[tail++] = nIdx;
      }
    }
    if (c > 0 && (cellMask & BIT_LEFT) === 0) {
      const nIdx = idx - 1;
      if (dist[nIdx] === -1) {
        dist[nIdx] = nextDist;
        queue[tail++] = nIdx;
      }
    }
    if (c < GRID_SIZE - 1 && (cellMask & BIT_RIGHT) === 0) {
      const nIdx = idx + 1;
      if (dist[nIdx] === -1) {
        dist[nIdx] = nextDist;
        queue[tail++] = nIdx;
      }
    }
  }

  return null;
}

function applyWallToMask(baseMask: Uint8Array, wall: Wall): Uint8Array {
  const mask = new Uint8Array(baseMask);
  const { row, col, orientation } = wall;
  if (orientation === "h") {
    mask[row * GRID_SIZE + col] |= BIT_DOWN;
    mask[(row + 1) * GRID_SIZE + col] |= BIT_UP;
    mask[row * GRID_SIZE + (col + 1)] |= BIT_DOWN;
    mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_UP;
  } else {
    mask[row * GRID_SIZE + col] |= BIT_RIGHT;
    mask[row * GRID_SIZE + (col + 1)] |= BIT_LEFT;
    mask[(row + 1) * GRID_SIZE + col] |= BIT_RIGHT;
    mask[(row + 1) * GRID_SIZE + (col + 1)] |= BIT_LEFT;
  }
  return mask;
}

function doesWallTouchPath(wall: WallPlacement, path: readonly Position[] | null): boolean {
  if (!path || path.length < 2) return true;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (a.col === b.col) {
      if (wall.orientation === "h") {
        const topR = a.row < b.row ? a.row : b.row;
        if (wall.row === topR && (wall.col === a.col || wall.col === a.col - 1)) {
          return true;
        }
      }
    } else if (a.row === b.row) {
      if (wall.orientation === "v") {
        const leftC = a.col < b.col ? a.col : b.col;
        if (wall.col === leftC && (wall.row === a.row || wall.row === a.row - 1)) {
          return true;
        }
      }
    }
  }
  return false;
}

interface ScoredWallCandidate {
  wall: WallPlacement;
  score: number;
  oppDistAfter: number;
  myDistAfter: number;
}

/**
 * Generates and ranks pruned, legal candidate walls near the opponent's shortest path,
 * opponent's pawn, and nearby wall extensions. Never brute-forces all 128 slots in search.
 */
function getCandidateWalls(
  state: WallMazeState,
  activePlayer: Player,
  maxCandidates: number
): ScoredWallCandidate[] {
  if (state.wallsLeft[activePlayer] <= 0) return [];

  const opp = getOpponent(activePlayer);
  const myPos = state.pawns[activePlayer];
  const oppPos = state.pawns[opp];

  const myPath = getShortestPath(state.walls, myPos, GOAL_ROW[activePlayer]);
  const oppPath = getShortestPath(state.walls, oppPos, GOAL_ROW[opp]);
  if (!myPath || !oppPath) return [];

  const baseMyDist = myPath.length - 1;
  const baseOppDist = oppPath.length - 1;
  const oppThreatensImmediateWin = hasImmediateWinInMoves(state, opp);

  const seen = new Uint8Array(WALL_GRID_SIZE * WALL_GRID_SIZE * 2);
  const rawCandidates: WallPlacement[] = [];

  const addSlot = (row: number, col: number, orientation: WallOrientation) => {
    if (row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE) return;
    const idx = (row * WALL_GRID_SIZE + col) * 2 + (orientation === "v" ? 1 : 0);
    if (seen[idx]) return;
    seen[idx] = 1;
    rawCandidates.push({ row, col, orientation });
  };

  // 1. Walls directly cutting edges along opponent's shortest path
  for (let i = 0; i < oppPath.length - 1; i++) {
    const a = oppPath[i];
    const b = oppPath[i + 1];
    if (a.col === b.col) {
      const topR = a.row < b.row ? a.row : b.row;
      addSlot(topR, a.col, "h");
      addSlot(topR, a.col - 1, "h");
    } else {
      const leftC = a.col < b.col ? a.col : b.col;
      addSlot(a.row, leftC, "v");
      addSlot(a.row - 1, leftC, "v");
    }
  }

  // 2. Walls around opponent's immediate position (captures jump/side-step traps)
  for (let dr = -1; dr <= 0; dr++) {
    for (let dc = -1; dc <= 0; dc++) {
      addSlot(oppPos.row + dr, oppPos.col + dc, "h");
      addSlot(oppPos.row + dr, oppPos.col + dc, "v");
    }
  }

  // 3. Extensions / bridges off existing walls near the opponent's path
  for (let i = 0; i < state.walls.length; i++) {
    const w = state.walls[i];
    if (Math.abs(w.row - oppPos.row) > 3 && Math.abs(w.col - oppPos.col) > 3) {
      continue;
    }
    if (w.orientation === "h") {
      addSlot(w.row, w.col - 2, "h");
      addSlot(w.row, w.col + 2, "h");
      addSlot(w.row, w.col - 1, "v");
      addSlot(w.row, w.col + 1, "v");
      addSlot(w.row - 1, w.col - 1, "v");
      addSlot(w.row - 1, w.col + 1, "v");
    } else {
      addSlot(w.row - 2, w.col, "v");
      addSlot(w.row + 2, w.col, "v");
      addSlot(w.row - 1, w.col, "h");
      addSlot(w.row + 1, w.col, "h");
      addSlot(w.row - 1, w.col - 1, "h");
      addSlot(w.row + 1, w.col - 1, "h");
    }
  }

  const baseMask = buildBlockedEdgeMask(state.walls);
  const scored: ScoredWallCandidate[] = [];

  for (let i = 0; i < rawCandidates.length; i++) {
    const cand = rawCandidates[i];
    if (hasWallCollision(state.walls, cand.row, cand.col, cand.orientation) !== null) {
      continue;
    }

    const touchesMy = doesWallTouchPath(cand, myPath);
    const touchesOpp = doesWallTouchPath(cand, oppPath);

    let myDistAfter = baseMyDist;
    let oppDistAfter = baseOppDist;

    if (touchesMy || touchesOpp) {
      const nextMask = applyWallToMask(baseMask, cand);
      if (touchesMy) {
        const d = bfsDistFromMask(nextMask, myPos, GOAL_ROW[activePlayer]);
        if (d === null) continue; // Illegal: seals off active player
        myDistAfter = d;
      }
      if (touchesOpp) {
        const d = bfsDistFromMask(nextMask, oppPos, GOAL_ROW[opp]);
        if (d === null) continue; // Illegal: seals off opponent
        oppDistAfter = d;
      }
    }

    const oppGain = oppDistAfter - baseOppDist;
    const myLoss = myDistAfter - baseMyDist;
    let score = (oppGain - myLoss) * 12;

    // Bonus for blocking an opponent's immediate 1-move win
    if (oppThreatensImmediateWin && oppDistAfter > 1) {
      score += 5000;
    }

    // Slight preference for walls close to the opponent's next step
    const nextOppCell = oppPath[1] ?? oppPos;
    const prox = Math.abs(cand.row - nextOppCell.row) + Math.abs(cand.col - nextOppCell.col);
    score += Math.max(0, 3 - prox) * 0.4;

    scored.push({
      wall: cand,
      score,
      oppDistAfter,
      myDistAfter,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCandidates);
}

/**
 * Orders legal actions (pawn moves + pruned candidate walls) for search efficiency.
 */
function getOrderedActions(
  state: WallMazeState,
  activePlayer: Player,
  maxWalls: number
): WallMazeAction[] {
  const mask = buildBlockedEdgeMask(state.walls);
  const goalRow = GOAL_ROW[activePlayer];
  const pawnMoves = getValidPawnMoves(state, activePlayer);

  const rankedPawns = pawnMoves
    .map((m) => {
      const d = bfsDistFromMask(mask, m, goalRow) ?? 64;
      return {
        action: { type: "MOVE_PAWN", row: m.row, col: m.col } as WallMazeAction,
        dist: d,
        centerBias: Math.abs(m.col - 4),
      };
    })
    .sort((a, b) => (a.dist !== b.dist ? a.dist - b.dist : a.centerBias - b.centerBias));

  const actions: WallMazeAction[] = rankedPawns.map((p) => p.action);

  if (state.wallsLeft[activePlayer] > 0 && maxWalls > 0) {
    const walls = getCandidateWalls(state, activePlayer, maxWalls);
    const bestPawnDist = rankedPawns[0]?.dist ?? 64;
    const baseOppDist =
      bfsDistFromMask(mask, state.pawns[getOpponent(activePlayer)], GOAL_ROW[getOpponent(activePlayer)]) ?? 64;

    // Interleave walls before pawn moves if a wall offers strong net gain or emergency defense
    const topDefenseOrGain: WallMazeAction[] = [];
    const regularWalls: WallMazeAction[] = [];

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const wallAction: WallMazeAction = {
        type: "PLACE_WALL",
        row: w.wall.row,
        col: w.wall.col,
        orientation: w.wall.orientation,
      };
      if (w.score >= 24 || (baseOppDist <= 2 && w.oppDistAfter > baseOppDist && bestPawnDist > 0)) {
        topDefenseOrGain.push(wallAction);
      } else {
        regularWalls.push(wallAction);
      }
    }

    return [...topDefenseOrGain, ...actions, ...regularWalls];
  }

  return actions;
}

// =========================================================================
// Difficulty 1: Easy Bot
// =========================================================================

function selectEasyMove(state: WallMazeState): WallMazeAction | null {
  const botPlayer = state.currentPlayer;
  const opp = getOpponent(botPlayer);
  const pawnMoves = getValidPawnMoves(state, botPlayer);
  if (pawnMoves.length === 0) return null;

  // Always take an immediate 1-move win
  const immediateWin = findImmediateWinningMove(state, botPlayer);
  if (immediateWin) return immediateWin;

  const mask = buildBlockedEdgeMask(state.walls);
  const goalRow = GOAL_ROW[botPlayer];

  const scoredMoves = pawnMoves
    .map((m) => ({
      move: m,
      dist: bfsDistFromMask(mask, m, goalRow) ?? 64,
    }))
    .sort((a, b) => a.dist - b.dist);

  // ~75% of the time: follow BFS shortest path
  if (Math.random() < 0.75) {
    const bestDist = scoredMoves[0].dist;
    const tiedBest = scoredMoves.filter((s) => s.dist === bestDist);
    const chosen = tiedBest[Math.floor(Math.random() * tiedBest.length)].move;
    return { type: "MOVE_PAWN", row: chosen.row, col: chosen.col };
  }

  // ~25% of the time: drop a random legal wall near opponent OR make a suboptimal move
  if (state.wallsLeft[botPlayer] > 0 && Math.random() < 0.55) {
    const candidates = getCandidateWalls(state, botPlayer, 16);
    const oppPos = state.pawns[opp];
    const nearOpp = candidates.filter(
      (c) =>
        Math.abs(c.wall.row - oppPos.row) <= 2 &&
        Math.abs(c.wall.col - oppPos.col) <= 2
    );
    const pool = nearOpp.length > 0 ? nearOpp : candidates;
    if (pool.length > 0) {
      const picked = pool[Math.floor(Math.random() * pool.length)].wall;
      return {
        type: "PLACE_WALL",
        row: picked.row,
        col: picked.col,
        orientation: picked.orientation,
      };
    }
  }

  // Fallback: non-optimal legal move if one exists, otherwise random legal move
  const subOptimal = scoredMoves.slice(1);
  const pool = subOptimal.length > 0 ? subOptimal : scoredMoves;
  const picked = pool[Math.floor(Math.random() * pool.length)].move;
  return { type: "MOVE_PAWN", row: picked.row, col: picked.col };
}

// =========================================================================
// Difficulty 2: Medium Bot
// =========================================================================

function selectMediumMove(state: WallMazeState): WallMazeAction | null {
  const botPlayer = state.currentPlayer;
  const opp = getOpponent(botPlayer);

  // Immediately take a 1-move win
  const immediateWin = findImmediateWinningMove(state, botPlayer);
  if (immediateWin) return immediateWin;

  const pawnMoves = getValidPawnMoves(state, botPlayer);
  if (pawnMoves.length === 0) return null;

  const mask = buildBlockedEdgeMask(state.walls);
  const oppDist = bfsDistFromMask(mask, state.pawns[opp], GOAL_ROW[opp]) ?? 64;
  const myWalls = state.wallsLeft[botPlayer];
  const oppWalls = state.wallsLeft[opp];
  const oppCanWinInOne = hasImmediateWinInMoves(state, opp);

  let bestAction: WallMazeAction = {
    type: "MOVE_PAWN",
    row: pawnMoves[0].row,
    col: pawnMoves[0].col,
  };
  let bestScore = -Infinity;

  // Evaluate all legal pawn moves
  for (let i = 0; i < pawnMoves.length; i++) {
    const m = pawnMoves[i];
    const nextMyDist = bfsDistFromMask(mask, m, GOAL_ROW[botPlayer]) ?? 64;
    const wallReserveBonus = (myWalls - oppWalls) * 1.5;
    let score = (oppDist - nextMyDist) * 10 + wallReserveBonus + Math.random() * 0.25;

    if (oppCanWinInOne) {
      const nextState = applyAction(state, { type: "MOVE_PAWN", row: m.row, col: m.col });
      if (hasImmediateWinInMoves(nextState, opp)) {
        score -= 5000;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestAction = { type: "MOVE_PAWN", row: m.row, col: m.col };
    }
  }

  // Evaluate candidate walls near the opponent's shortest path
  if (myWalls > 0) {
    const candidateWalls = getCandidateWalls(state, botPlayer, 18);
    for (let i = 0; i < candidateWalls.length; i++) {
      const cw = candidateWalls[i];
      const wallReserveBonus = ((myWalls - 1) - oppWalls) * 1.5;
      let score =
        (cw.oppDistAfter - cw.myDistAfter) * 10 + wallReserveBonus + Math.random() * 0.25;

      if (oppCanWinInOne) {
        const nextState = applyAction(state, {
          type: "PLACE_WALL",
          row: cw.wall.row,
          col: cw.wall.col,
          orientation: cw.wall.orientation,
        });
        if (!hasImmediateWinInMoves(nextState, opp)) {
          score += 5000;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          type: "PLACE_WALL",
          row: cw.wall.row,
          col: cw.wall.col,
          orientation: cw.wall.orientation,
        };
      }
    }
  }

  return bestAction;
}

// =========================================================================
// Difficulty 3: Hard Bot (Alpha-Beta with Pruned Wall Candidates)
// =========================================================================

interface SearchContext {
  evaluatingPlayer: Player;
  deadlineMs: number;
  nodesVisited: number;
  aborted: boolean;
}

function alphaBeta(
  state: WallMazeState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  ctx: SearchContext
): number {
  ctx.nodesVisited++;
  if ((ctx.nodesVisited & 31) === 0 && Date.now() >= ctx.deadlineMs) {
    ctx.aborted = true;
    return evaluateBoard(state, ctx.evaluatingPlayer, depth);
  }

  if (depth === 0 || state.status === "finished") {
    return evaluateBoard(state, ctx.evaluatingPlayer, depth);
  }

  const activePlayer = state.currentPlayer;
  const immediateWin = findImmediateWinningMove(state, activePlayer);
  if (immediateWin) {
    return activePlayer === ctx.evaluatingPlayer
      ? WIN_SCORE + depth * 100
      : -WIN_SCORE - depth * 100;
  }

  const maxWalls = depth >= 2 ? 6 : 5;
  const actions = getOrderedActions(state, activePlayer, maxWalls);
  if (actions.length === 0) {
    return evaluateBoard(state, ctx.evaluatingPlayer, depth);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < actions.length; i++) {
      const nextState = applyAction(state, actions[i]);
      const val = alphaBeta(nextState, depth - 1, alpha, beta, false, ctx);
      if (val > maxEval) maxEval = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha || ctx.aborted) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (let i = 0; i < actions.length; i++) {
    const nextState = applyAction(state, actions[i]);
    const val = alphaBeta(nextState, depth - 1, alpha, beta, true, ctx);
    if (val < minEval) minEval = val;
    if (val < beta) beta = val;
    if (beta <= alpha || ctx.aborted) break;
  }
  return minEval;
}

function selectHardMove(state: WallMazeState): WallMazeAction | null {
  const botPlayer = state.currentPlayer;

  // 1. Always take an immediate 1-move win
  const immediateWin = findImmediateWinningMove(state, botPlayer);
  if (immediateWin) return immediateWin;

  const actions = getOrderedActions(state, botPlayer, 12);
  if (actions.length === 0) return null;

  const ctx: SearchContext = {
    evaluatingPlayer: botPlayer,
    deadlineMs: Date.now() + HARD_TIME_BUDGET_MS,
    nodesVisited: 0,
    aborted: false,
  };

  let bestAction = actions[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (let i = 0; i < actions.length; i++) {
    const nextState = applyAction(state, actions[i]);
    const score = alphaBeta(
      nextState,
      HARD_SEARCH_DEPTH - 1,
      alpha,
      beta,
      false,
      ctx
    );

    if (score > bestScore) {
      bestScore = score;
      bestAction = actions[i];
    }
    if (score > alpha) alpha = score;
    if (ctx.aborted) break;
  }

  return bestAction;
}

/**
 * Selects a legal move for the active player at the chosen difficulty tier.
 */
export function selectBotMove(
  state: WallMazeState,
  difficulty: BotDifficulty = "medium"
): WallMazeAction | null {
  if (state.status !== "playing") return null;

  if (difficulty === "easy") {
    return selectEasyMove(state);
  }
  if (difficulty === "medium") {
    return selectMediumMove(state);
  }
  return selectHardMove(state);
}
