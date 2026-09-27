import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyBoard,
  createInitialColumnCounts,
  getAvailableColumns,
  getLandingRow,
  incrementColumnCount,
  isBoardFull,
  isColumnFull,
  isValidColumn,
  placeDisc,
} from "../src/games/board/connect-four/logic/rules.ts";
import {
  createInitialState,
  connectFourReducer,
} from "../src/games/board/connect-four/logic/reducer.ts";
import { findBestMove } from "../src/games/board/connect-four/bot/minimax.ts";
import { getBotMoveByDifficulty } from "../src/games/board/connect-four/bot/difficulty.ts";
import { requestBotMove } from "../src/games/board/connect-four/bot/botService.ts";

test("Initialization: creates correct starting state", () => {
  const state = createInitialState();
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "R");
  assert.equal(state.winner, null);
  assert.equal(state.winningLine, null);
  assert.equal(state.moveCount, 0);
  assert.deepEqual(state.columnCounts, [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(state.board.length, 42);
  assert.ok(state.board.every((cell) => cell === null));
});

test("Rules: rejects invalid columns", () => {
  assert.ok(!isValidColumn(-1));
  assert.ok(!isValidColumn(7));
  assert.ok(isValidColumn(0));
  assert.ok(isValidColumn(6));
});

test("Rules: landing row is lowest empty row from bottom", () => {
  const counts = [0, 2, 6, 3, 0, 0, 0];
  assert.equal(getLandingRow(counts, 0), 5);
  assert.equal(getLandingRow(counts, 1), 3);
  assert.equal(getLandingRow(counts, 2), -1);
  assert.equal(getLandingRow(counts, 3), 2);
});

test("Rules: disc placement and column count increment", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  const nextBoard = placeDisc(board, 5, 3, "R");
  const nextCounts = incrementColumnCount(counts, 3);
  assert.equal(nextBoard[5 * 7 + 3], "R");
  assert.deepEqual(nextCounts, [0, 0, 0, 1, 0, 0, 0]);
});

test("Moves: accepts valid drop and alternates turns", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  assert.equal(state.board[5 * 7 + 3], "R");
  assert.equal(state.currentPlayer, "Y");
  assert.equal(state.moveCount, 1);
  assert.equal(state.status, "in_progress");

  state = connectFourReducer(state, { type: "DROP", column: 3 });
  assert.equal(state.board[4 * 7 + 3], "Y");
  assert.equal(state.currentPlayer, "R");
  assert.equal(state.moveCount, 2);
});

test("Moves: rejects full column", () => {
  let state = createInitialState();
  for (let i = 0; i < 6; i++) {
    state = connectFourReducer(state, { type: "DROP", column: 0 });
  }
  assert.equal(state.columnCounts[0], 6);
  assert.ok(isColumnFull(state.columnCounts, 0));
  const unchanged = connectFourReducer(state, { type: "DROP", column: 0 });
  assert.strictEqual(unchanged, state);
});

test("Moves: rejects out-of-range column", () => {
  const state = createInitialState();
  assert.strictEqual(connectFourReducer(state, { type: "DROP", column: -1 }), state);
  assert.strictEqual(connectFourReducer(state, { type: "DROP", column: 7 }), state);
});

test("Moves: rejects moves after game over", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });

  assert.equal(state.status, "won");
  const afterGameOver = connectFourReducer(state, { type: "DROP", column: 2 });
  assert.strictEqual(afterGameOver, state);
});

test("Wins: horizontal win bottom row", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });

  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");
  assert.deepEqual(state.winningLine.line, [35, 36, 37, 38]);
  assert.equal(state.winningLine.direction, "horizontal");
});

test("Wins: vertical win in column 3", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });

  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");
  assert.deepEqual(state.winningLine.line, [17, 24, 31, 38]);
  assert.equal(state.winningLine.direction, "vertical");
});

test("Wins: diagonal down-right win", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 5 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });

  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");
  assert.deepEqual(state.winningLine.line, [16, 24, 32, 40]);
  assert.equal(state.winningLine.direction, "diagonal-down");
});

test("Wins: diagonal up-right win", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 2 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });
  state = connectFourReducer(state, { type: "DROP", column: 4 });

  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");
  assert.deepEqual(state.winningLine.line, [18, 24, 30, 36]);
  assert.equal(state.winningLine.direction, "diagonal-up");
});

test("Draw: full board produces draw", () => {
  let state = createInitialState();
  const moves = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 1, 0, 3, 2, 5, 4, 0, 6, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6];

  for (const col of moves) {
    if (state.status !== "in_progress") break;
    state = connectFourReducer(state, { type: "DROP", column: col });
  }

  assert.equal(state.status, "draw");
  assert.equal(state.moveCount, 42);
  assert.equal(state.winner, null);
});

test("Reset: reinitializes game to clean starting state", () => {
  let state = createInitialState();
  state = connectFourReducer(state, { type: "DROP", column: 0 });
  state = connectFourReducer(state, { type: "DROP", column: 1 });
  assert.equal(state.moveCount, 2);

  state = connectFourReducer(state, { type: "RESET" });
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "R");
  assert.equal(state.moveCount, 0);
  assert.deepEqual(state.columnCounts, [0, 0, 0, 0, 0, 0, 0]);
  assert.ok(state.board.every((cell) => cell === null));
});

test("Bot: only returns valid, available column indices", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  const bestMove = findBestMove(board, counts, "R", 6);
  assert.ok(bestMove >= 0 && bestMove <= 6);

  const occupied = [0, 0, 0, 0, 0, 0, 0];
  const occupiedBoard = createEmptyBoard();
  for (let c = 0; c < 6; c++) {
    occupied[c] = 6;
    for (let r = 0; r < 6; r++) {
      occupiedBoard[r * 7 + c] = "R";
    }
  }
  occupied[6] = 0;
  const fullBoardMove = findBestMove(occupiedBoard, occupied, "R", 6);
  assert.equal(fullBoardMove, 6);
});

test("Bot: takes immediate winning move", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  board[5 * 7 + 0] = "R";
  counts[0] = 1;
  board[4 * 7 + 0] = "R";
  counts[0] = 2;
  board[5 * 7 + 1] = "Y";
  counts[1] = 1;
  board[4 * 7 + 1] = "Y";
  counts[1] = 2;
  board[3 * 7 + 0] = "R";
  counts[0] = 3;

  const bestMove = findBestMove(board, counts, "R", 6);
  assert.equal(bestMove, 0);
});

test("Bot: blocks opponent's immediate winning threat", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  board[5 * 7 + 0] = "Y";
  counts[0] = 1;
  board[4 * 7 + 0] = "Y";
  counts[0] = 2;
  board[3 * 7 + 0] = "Y";
  counts[0] = 3;
  board[5 * 7 + 1] = "R";
  counts[1] = 1;

  const bestMove = findBestMove(board, counts, "R", 6);
  assert.equal(bestMove, 0);
});

test("Bot Difficulty: easy always produces legal moves", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  board[5 * 7 + 0] = "R";
  counts[0] = 1;
  board[4 * 7 + 0] = "Y";
  counts[0] = 2;

  for (let i = 0; i < 20; i++) {
    const move = getBotMoveByDifficulty(board, counts, "R", "easy");
    assert.ok(move >= 0 && move <= 6 && counts[move] < 6, `Easy move ${move} must be legal`);
  }
});

test("Bot Difficulty: medium takes immediate winning moves and blocks threats", () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  board[5 * 7 + 0] = "R";
  counts[0] = 1;
  board[4 * 7 + 0] = "R";
  counts[0] = 2;
  board[3 * 7 + 0] = "R";
  counts[0] = 3;
  board[5 * 7 + 1] = "Y";
  counts[1] = 1;

  const winMove = getBotMoveByDifficulty(board, counts, "R", "medium");
  assert.equal(winMove, 0);

  // Test threat blocking for medium
  const blockBoard = createEmptyBoard();
  const blockCounts = createInitialColumnCounts();
  blockBoard[5 * 7 + 4] = "Y";
  blockCounts[4] = 1;
  blockBoard[4 * 7 + 4] = "Y";
  blockCounts[4] = 2;
  blockBoard[3 * 7 + 4] = "Y";
  blockCounts[4] = 3;
  blockBoard[5 * 7 + 2] = "R";
  blockCounts[2] = 1;

  const blockMove = getBotMoveByDifficulty(blockBoard, blockCounts, "R", "medium");
  assert.equal(blockMove, 4);
});

test("Bot Difficulty: all difficulties make legal moves and complete sample turns quickly", () => {
  const difficulties = ["easy", "medium", "hard"];
  for (const diff of difficulties) {
    let state = createInitialState();
    for (let step = 0; step < 8; step++) {
      const current = state.currentPlayer;
      const move = getBotMoveByDifficulty(state.board, state.columnCounts, current, diff);
      assert.ok(move >= 0 && state.columnCounts[move] < 6, `${diff} move ${move} must be legal`);
      state = connectFourReducer(state, { type: "DROP", column: move });
    }
  }
});

test("Bot Service: supports AbortSignal cancellation", async () => {
  const board = createEmptyBoard();
  const counts = createInitialColumnCounts();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => requestBotMove(board, counts, "Y", { difficulty: "medium", delayMs: 10, signal: controller.signal }),
    { name: "AbortError" }
  );
});

test("Rules: getAvailableColumns excludes full columns", () => {
  const counts = [6, 3, 6, 0, 6, 2, 6];
  const available = getAvailableColumns(counts);
  assert.deepEqual(available, [1, 3, 5]);
});

test("Rules: isBoardFull detects full board", () => {
  const counts = [6, 6, 6, 6, 6, 6, 6];
  assert.ok(isBoardFull(counts));
  const partial = [0, 3, 6, 0, 0, 0, 0];
  assert.ok(!isBoardFull(partial));
});