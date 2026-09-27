import {
  getWinningLineAt,
  getAvailableColumns,
} from "../logic/rules";
import type { Board, CellValue, Player } from "../logic/types";
import { COLUMNS, ROWS, WIN_LENGTH } from "../logic/types";

const COLUMN_ORDER: readonly number[] = [3, 2, 4, 1, 5, 0, 6];
const WIN_SCORE = 100000;
const WEIGHTS = [0, 1, 10, 100, 1000];

const WINDOWS: readonly (readonly number[])[] = (() => {
  const windows: number[][] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLUMNS - WIN_LENGTH; c++) {
      windows.push([r * COLUMNS + c, r * COLUMNS + c + 1, r * COLUMNS + c + 2, r * COLUMNS + c + 3]);
    }
  }

  for (let c = 0; c < COLUMNS; c++) {
    for (let r = 0; r <= ROWS - WIN_LENGTH; r++) {
      windows.push([r * COLUMNS + c, (r + 1) * COLUMNS + c, (r + 2) * COLUMNS + c, (r + 3) * COLUMNS + c]);
    }
  }

  for (let r = 0; r <= ROWS - WIN_LENGTH; r++) {
    for (let c = 0; c <= COLUMNS - WIN_LENGTH; c++) {
      windows.push([r * COLUMNS + c, (r + 1) * COLUMNS + (c + 1), (r + 2) * COLUMNS + (c + 2), (r + 3) * COLUMNS + (c + 3)]);
    }
  }

  for (let r = WIN_LENGTH - 1; r < ROWS; r++) {
    for (let c = 0; c <= COLUMNS - WIN_LENGTH; c++) {
      windows.push([r * COLUMNS + c, (r - 1) * COLUMNS + (c + 1), (r - 2) * COLUMNS + (c + 2), (r - 3) * COLUMNS + (c + 3)]);
    }
  }

  return windows;
})();

function evaluateBoard(board: readonly CellValue[], botPlayer: Player): number {
  const opponent: Player = botPlayer === "R" ? "Y" : "R";
  let score = 0;

  for (let i = 0; i < WINDOWS.length; i++) {
    const w = WINDOWS[i];
    let botCount = 0;
    let oppCount = 0;

    const v0 = board[w[0]];
    if (v0 === botPlayer) botCount++;
    else if (v0 !== null) oppCount++;

    const v1 = board[w[1]];
    if (v1 === botPlayer) botCount++;
    else if (v1 !== null) oppCount++;

    const v2 = board[w[2]];
    if (v2 === botPlayer) botCount++;
    else if (v2 !== null) oppCount++;

    const v3 = board[w[3]];
    if (v3 === botPlayer) botCount++;
    else if (v3 !== null) oppCount++;

    if (botCount > 0 && oppCount === 0) {
      score += WEIGHTS[botCount];
    } else if (oppCount > 0 && botCount === 0) {
      score -= WEIGHTS[oppCount];
    }
  }

  // Center column positional weight (column 3 has highest tactical connectivity)
  for (let r = 0; r < ROWS; r++) {
    const val = board[r * COLUMNS + 3];
    if (val === botPlayer) score += 4;
    else if (val === opponent) score -= 4;
  }

  return score;
}

function search(
  board: CellValue[],
  columnCounts: number[],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  botPlayer: Player,
  opponentPlayer: Player
): number {
  if (depth === 0) {
    return evaluateBoard(board, botPlayer);
  }

  let hasMoves = false;
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] < ROWS) {
      hasMoves = true;
      break;
    }
  }
  if (!hasMoves) return 0;

  const currentPlayer = isMaximizing ? botPlayer : opponentPlayer;

  if (isMaximizing) {
    let best = -Infinity;
    for (const col of COLUMN_ORDER) {
      if (columnCounts[col] >= ROWS) continue;
      const row = ROWS - 1 - columnCounts[col];
      board[row * COLUMNS + col] = currentPlayer;
      columnCounts[col]++;

      const win = getWinningLineAt(board, row, col, currentPlayer);
      let val: number;
      if (win) {
        val = WIN_SCORE + depth;
      } else {
        val = search(board, columnCounts, depth - 1, alpha, beta, false, botPlayer, opponentPlayer);
      }

      board[row * COLUMNS + col] = null;
      columnCounts[col]--;

      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const col of COLUMN_ORDER) {
    if (columnCounts[col] >= ROWS) continue;
    const row = ROWS - 1 - columnCounts[col];
    board[row * COLUMNS + col] = currentPlayer;
    columnCounts[col]++;

    const win = getWinningLineAt(board, row, col, currentPlayer);
    let val: number;
    if (win) {
      val = -WIN_SCORE - depth;
    } else {
      val = search(board, columnCounts, depth - 1, alpha, beta, true, botPlayer, opponentPlayer);
    }

    board[row * COLUMNS + col] = null;
    columnCounts[col]--;

    if (val < best) best = val;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

export function findImmediateWinColumn(
  board: CellValue[],
  columnCounts: number[],
  player: Player
): number | null {
  for (const col of COLUMN_ORDER) {
    if (columnCounts[col] >= ROWS) continue;
    const row = ROWS - 1 - columnCounts[col];
    board[row * COLUMNS + col] = player;
    const win = getWinningLineAt(board, row, col, player);
    board[row * COLUMNS + col] = null;
    if (win) return col;
  }
  return null;
}

export function findBestMove(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player,
  maxDepth: number
): number {
  let hasMoves = false;
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] < ROWS) {
      hasMoves = true;
      break;
    }
  }
  if (!hasMoves) return -1;

  let isEmpty = true;
  for (let c = 0; c < COLUMNS; c++) {
    if (columnCounts[c] > 0) {
      isEmpty = false;
      break;
    }
  }
  if (isEmpty) return 3;

  const mutableBoard = [...board] as CellValue[];
  const mutableCounts = [...columnCounts] as number[];
  const opponent: Player = botPlayer === "R" ? "Y" : "R";

  // 1. Immediate winning move for the bot
  for (const col of COLUMN_ORDER) {
    if (columnCounts[col] >= ROWS) continue;
    const row = ROWS - 1 - columnCounts[col];
    mutableBoard[row * COLUMNS + col] = botPlayer;
    const win = getWinningLineAt(mutableBoard, row, col, botPlayer);
    mutableBoard[row * COLUMNS + col] = null;
    if (win) return col;
  }

  // 2. Immediate threat block against opponent winning on next turn
  for (const col of COLUMN_ORDER) {
    if (columnCounts[col] >= ROWS) continue;
    const row = ROWS - 1 - columnCounts[col];
    mutableBoard[row * COLUMNS + col] = opponent;
    const win = getWinningLineAt(mutableBoard, row, col, opponent);
    mutableBoard[row * COLUMNS + col] = null;
    if (win) return col;
  }

  let bestScore = -Infinity;
  let bestCol = -1;

  for (const col of COLUMN_ORDER) {
    if (columnCounts[col] >= ROWS) continue;

    const row = ROWS - 1 - mutableCounts[col];
    mutableBoard[row * COLUMNS + col] = botPlayer;
    mutableCounts[col]++;

    const val = search(mutableBoard, mutableCounts, maxDepth - 1, -Infinity, Infinity, false, botPlayer, opponent);

    mutableBoard[row * COLUMNS + col] = null;
    mutableCounts[col]--;

    if (val > bestScore) {
      bestScore = val;
      bestCol = col;
    }
  }

  return bestCol !== -1 ? bestCol : getAvailableColumns(columnCounts)[0] ?? -1;
}