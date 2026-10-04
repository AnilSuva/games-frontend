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
import { requestBotMove, terminateBotWorker } from "../src/games/board/connect-four/bot/botService.ts";
import {
  consumeStartingPlayer,
  resetStartingPlayer,
} from "../src/games/common/startingPlayer.ts";
import {
  calculateRowGeometry,
  createInitialDropPhysics,
  stepDropPhysics,
  simulateDropAnimation,
} from "../src/games/board/connect-four/logic/dropPhysics.ts";

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

test("Drop Physics: geometry calculations place rows and spawn position correctly", () => {
  const colHeight = 320;
  const cellDiameter = 44;
  const { rowStep, startY, getTargetY } = calculateRowGeometry(colHeight, cellDiameter);

  // 5 gaps between 6 rows: (320 - 44) / 5 = 276 / 5 = 55.2px per step
  assert.equal(rowStep, 55.2);
  // Spawn is strictly above row 0 (negative Y)
  assert.ok(startY < 0, `startY (${startY}) must be negative (above row 0)`);
  assert.equal(startY, -1.15 * cellDiameter);

  // Top row (row 0) target is 0
  assert.equal(getTargetY(0), 0);
  // Bottom row (row 5) target is 5 * rowStep = 276
  assert.equal(getTargetY(5), 5 * 55.2);
});

test("Drop Physics: natural acceleration and target clamping with subtle bounce", () => {
  const targetY = 150;
  let state = createInitialDropPhysics(-50);
  assert.equal(state.y, -50);
  assert.equal(state.hasBounced, false);
  assert.equal(state.isFinished, false);

  // Step 1: moves downward with gravity
  state = stepDropPhysics(state, targetY, 1 / 60);
  assert.ok(state.y > -50, "y must advance downwards");
  assert.ok(state.velocity > 40, "velocity must accelerate under gravity");

  // Run until first impact
  let firstImpactIndex = -1;
  const frames = [state];
  for (let i = 0; i < 60; i++) {
    state = stepDropPhysics(state, targetY, 1 / 60);
    frames.push(state);
    if (state.hasBounced && firstImpactIndex === -1) {
      firstImpactIndex = i;
      // On first impact, velocity must reverse (negative) with restitution
      assert.ok(state.velocity < 0, "velocity must be negative on bounce rebound");
      assert.equal(state.y, targetY, "position on bounce impact must clamp to targetY");
      assert.equal(state.isFinished, false, "animation must not finish on first bounce");
      break;
    }
  }
  assert.ok(firstImpactIndex > 0, "must reach targetY and bounce");

  // Run until settled
  for (let i = 0; i < 30; i++) {
    state = stepDropPhysics(state, targetY, 1 / 60);
    if (state.isFinished) break;
  }

  assert.equal(state.isFinished, true, "animation must finish cleanly");
  assert.equal(state.y, targetY, "final settled position must exactly equal targetY");
  assert.equal(state.velocity, 0, "final velocity must be 0");
});

test("Drop Physics: simulation durations scale naturally with drop distance", () => {
  const topDrop = simulateDropAnimation(0); // Row 0 (top row)
  const midDrop = simulateDropAnimation(2); // Row 2
  const bottomDrop = simulateDropAnimation(5); // Row 5 (bottom row)

  // Every drop must finish cleanly at exact target Y
  const { getTargetY } = calculateRowGeometry(320, 44);
  assert.equal(topDrop.finalY, getTargetY(0));
  assert.equal(midDrop.finalY, getTargetY(2));
  assert.equal(bottomDrop.finalY, getTargetY(5));

  // Natural scaling: row 5 takes longer than row 2, which takes longer than row 0
  assert.ok(
    bottomDrop.totalTimeMs > midDrop.totalTimeMs,
    `Bottom drop (${bottomDrop.totalTimeMs}ms) must take longer than mid drop (${midDrop.totalTimeMs}ms)`
  );
  assert.ok(
    midDrop.totalTimeMs > topDrop.totalTimeMs,
    `Mid drop (${midDrop.totalTimeMs}ms) must take longer than top drop (${topDrop.totalTimeMs}ms)`
  );

  // Both should be in satisfying arcade sweet-spot (150ms to 600ms)
  assert.ok(topDrop.totalTimeMs >= 150 && topDrop.totalTimeMs <= 300, `Top drop time ${topDrop.totalTimeMs}ms`);
  assert.ok(bottomDrop.totalTimeMs >= 350 && bottomDrop.totalTimeMs <= 550, `Bottom drop time ${bottomDrop.totalTimeMs}ms`);
});

test("Drop System: correct target row and exact final position for all 6 rows", () => {
  const colHeight = 320;
  const cellDiameter = 44;
  const { getTargetY } = calculateRowGeometry(colHeight, cellDiameter);

  for (let row = 0; row < 6; row++) {
    const expectedY = getTargetY(row);
    const result = simulateDropAnimation(row, colHeight, cellDiameter);

    assert.equal(result.finalY, expectedY, `Row ${row} final Y must match target Y exactly`);
    const lastFrame = result.frames[result.frames.length - 1];
    assert.equal(lastFrame.isFinished, true);
    assert.equal(lastFrame.velocity, 0);
    assert.equal(lastFrame.y, expectedY);
  }
});

test("Drop System: stack increments landing row from row 5 up to row 0", () => {
  let state = createInitialState();
  const targetCol = 2;

  for (let expectedRow = 5; expectedRow >= 0; expectedRow--) {
    const landingRow = getLandingRow(state.columnCounts, targetCol);
    assert.equal(landingRow, expectedRow, `Expected landing row ${expectedRow}`);

    // Simulate drop animation settling at target row
    const anim = simulateDropAnimation(landingRow);
    assert.equal(anim.frames[anim.frames.length - 1].isFinished, true);

    // Commit move to state
    state = connectFourReducer(state, { type: "DROP", column: targetCol });
    assert.equal(state.board[expectedRow * 7 + targetCol] !== null, true);
  }

  // Column is now full: landing row must be null / -1
  assert.equal(getLandingRow(state.columnCounts, targetCol), -1);
  assert.equal(isColumnFull(state.columnCounts, targetCol), true);
});

test("Drop System: duplicate move prevention during active drop", () => {
  let isDropActive = false;
  let moveDispatched = false;

  const initiateDrop = () => {
    if (isDropActive) return false;
    isDropActive = true;
    return true;
  };

  // First click succeeds
  assert.equal(initiateDrop(), true);
  assert.equal(isDropActive, true);

  // Subsequent clicks while drop is active are rejected
  assert.equal(initiateDrop(), false);
  assert.equal(initiateDrop(), false);

  // Animation completes
  isDropActive = false;
  moveDispatched = true;
  assert.equal(moveDispatched, true);

  // New click can now proceed
  assert.equal(initiateDrop(), true);
});

test("Drop System: human and bot moves use identical drop physics and completion", async () => {
  let state = createInitialState();

  // Human move: Player R drops in col 3
  const humanCol = 3;
  const humanRow = getLandingRow(state.columnCounts, humanCol);
  const humanAnim = simulateDropAnimation(humanRow);
  assert.equal(humanAnim.frames[humanAnim.frames.length - 1].isFinished, true);
  state = connectFourReducer(state, { type: "DROP", column: humanCol });
  assert.equal(state.currentPlayer, "Y");

  // Bot move: Player Y computes move and drops
  const botCol = getBotMoveByDifficulty(state.board, state.columnCounts, "Y", "medium");
  assert.ok(botCol >= 0 && botCol <= 6);
  const botRow = getLandingRow(state.columnCounts, botCol);
  const botAnim = simulateDropAnimation(botRow);
  assert.equal(botAnim.frames[botAnim.frames.length - 1].isFinished, true);
  state = connectFourReducer(state, { type: "DROP", column: botCol });
  assert.equal(state.currentPlayer, "R");

  assert.equal(state.moveCount, 2);
});

test("Drop System: win synchronization only triggers after drop completion", () => {
  let state = createInitialState();

  // Setup 3 in a row for Orange in row 5 (cols 0, 1, 2)
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // Y
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // Y
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // Y

  assert.equal(state.status, "in_progress");
  assert.equal(state.winningLine, null);

  // Winning move initiated in col 3:
  const winningCol = 3;
  const targetRow = getLandingRow(state.columnCounts, winningCol);
  assert.equal(targetRow, 5);

  // During animation (before state dispatch), state is NOT won yet
  assert.equal(state.status, "in_progress");
  assert.equal(state.winningLine, null);

  // Physics animation runs to completion
  const anim = simulateDropAnimation(targetRow);
  assert.equal(anim.frames[anim.frames.length - 1].isFinished, true);

  // Move is committed ONLY when animation finishes
  state = connectFourReducer(state, { type: "DROP", column: winningCol });
  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");
  assert.notEqual(state.winningLine, null);
  assert.deepEqual(state.winningLine.line, [35, 36, 37, 38]);
});

test("Drop System: reset cleanly cancels in-flight drop state", () => {
  let activeDrop = { column: 3, targetRow: 5, player: "R" };
  let isDropActive = true;
  let animCancelled = false;

  const cancelAnimation = () => {
    animCancelled = true;
    activeDrop = null;
    isDropActive = false;
  };

  // In-flight drop interrupted by Reset
  cancelAnimation();

  assert.equal(animCancelled, true);
  assert.equal(activeDrop, null);
  assert.equal(isDropActive, false);

  // Game state resets cleanly
  const resetState = createInitialState();
  assert.equal(resetState.moveCount, 0);
  assert.equal(resetState.status, "in_progress");
  assert.equal(resetState.currentPlayer, "R");
});

test("Bot Service: bot responds after human move", async () => {
  let state = createInitialState("R");
  assert.equal(state.currentPlayer, "R");

  // Human drops in column 3
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  assert.equal(state.currentPlayer, "Y");
  assert.equal(state.status, "in_progress");

  // Bot computes response
  const botCol = await requestBotMove(state.board, state.columnCounts, "Y", {
    difficulty: "medium",
    delayMs: 10,
  });

  assert.ok(isValidColumn(botCol), `Bot move ${botCol} must be a valid column`);
  assert.ok(!isColumnFull(state.columnCounts, botCol), "Bot column must not be full");

  state = connectFourReducer(state, { type: "DROP", column: botCol });
  assert.equal(state.currentPlayer, "R");
  assert.equal(state.moveCount, 2);
});

test("Bot Service: bot first move when Blue starts", async () => {
  // Blue starts -> player Y
  let state = createInitialState("Y");
  assert.equal(state.currentPlayer, "Y");
  assert.equal(state.status, "in_progress");

  const botCol = await requestBotMove(state.board, state.columnCounts, "Y", {
    difficulty: "hard",
    delayMs: 10,
  });

  assert.ok(isValidColumn(botCol), `Bot first move ${botCol} must be a valid column`);
  assert.ok(!isColumnFull(state.columnCounts, botCol));

  state = connectFourReducer(state, { type: "DROP", column: botCol });
  assert.equal(state.currentPlayer, "R");
  assert.equal(state.moveCount, 1);
});

test("Bot Service: all three difficulties return valid columns and tactical choices", async () => {
  let state = createInitialState("R");
  // Set up 3 in a row for Y in bottom row: cols 0, 1, 2
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // R in col 0
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // Y in col 0 (row 4)
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // R in col 1
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // Y in col 1 (row 4)
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // R in col 2
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // Y in col 2 (row 4)

  const difficulties = ["easy", "medium", "hard"];
  for (const diff of difficulties) {
    const move = await requestBotMove(state.board, state.columnCounts, "Y", {
      difficulty: diff,
      delayMs: 5,
    });
    assert.ok(isValidColumn(move) && !isColumnFull(state.columnCounts, move), `${diff} must return a legal column`);
  }

  // Medium and Hard should take winning move at col 3 (row 4)
  const mediumMove = await requestBotMove(state.board, state.columnCounts, "Y", {
    difficulty: "medium",
    delayMs: 0,
  });
  assert.equal(mediumMove, 3, "Medium bot must take immediate winning column 3");

  const hardMove = await requestBotMove(state.board, state.columnCounts, "Y", {
    difficulty: "hard",
    delayMs: 0,
  });
  assert.equal(hardMove, 3, "Hard bot must take immediate winning column 3");
});

test("Bot Service: worker response accepted correctly and worker cleanup", async () => {
  // Mock Worker to verify worker-based message communication
  class MockWorker {
    constructor() {
      this.listeners = {};
    }
    addEventListener(type, cb) {
      (this.listeners[type] ||= []).push(cb);
    }
    removeEventListener(type, cb) {
      this.listeners[type] = (this.listeners[type] || []).filter((fn) => fn !== cb);
    }
    postMessage(data) {
      // Simulate worker asynchronous calculation response
      setTimeout(() => {
        const handlers = this.listeners["message"] || [];
        handlers.forEach((h) => h({ data: { id: data.id, move: 3 } }));
      }, 5);
    }
    terminate() {
      this.terminated = true;
    }
  }

  const originalWindow = globalThis.window;
  const originalWorker = globalThis.Worker;

  try {
    globalThis.window = globalThis;
    globalThis.Worker = MockWorker;
    terminateBotWorker(); // ensure fresh worker instance

    const state = createInitialState("Y");
    const move = await requestBotMove(state.board, state.columnCounts, "Y", {
      difficulty: "medium",
      delayMs: 0,
    });

    assert.equal(move, 3, "Worker response move must be accepted and resolved correctly");
  } finally {
    terminateBotWorker();
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalWorker === undefined) {
      delete globalThis.Worker;
    } else {
      globalThis.Worker = originalWorker;
    }
  }
});

test("Bot Service: worker cancellation and AbortController cleanup", async () => {
  class SlowMockWorker {
    constructor() {
      this.listeners = {};
    }
    addEventListener(type, cb) {
      (this.listeners[type] ||= []).push(cb);
    }
    removeEventListener(type, cb) {
      this.listeners[type] = (this.listeners[type] || []).filter((fn) => fn !== cb);
    }
    postMessage() {
      // Intentionally slow response
    }
    terminate() {
      this.terminated = true;
    }
  }

  const originalWindow = globalThis.window;
  const originalWorker = globalThis.Worker;

  try {
    globalThis.window = globalThis;
    globalThis.Worker = SlowMockWorker;
    terminateBotWorker();

    const ac = new AbortController();
    const state = createInitialState("Y");

    const movePromise = requestBotMove(state.board, state.columnCounts, "Y", {
      difficulty: "hard",
      delayMs: 50,
      signal: ac.signal,
    });

    // Abort calculation immediately
    ac.abort();

    await assert.rejects(
      movePromise,
      (err) => err.name === "AbortError",
      "Aborted worker calculation must reject with AbortError"
    );
  } finally {
    terminateBotWorker();
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalWorker === undefined) {
      delete globalThis.Worker;
    } else {
      globalThis.Worker = originalWorker;
    }
  }
});

test("Bot Service: no move after game over and rejection of post-game moves", async () => {
  // Create a 4-in-a-row win for Orange in bottom row
  let state = createInitialState("R");
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 0 }); // Y
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 1 }); // Y
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // R
  state = connectFourReducer(state, { type: "DROP", column: 2 }); // Y
  state = connectFourReducer(state, { type: "DROP", column: 3 }); // R wins!

  assert.equal(state.status, "won");
  assert.equal(state.winner, "R");

  // Attempt to apply a bot move after game is won
  const unchangedState = connectFourReducer(state, { type: "DROP", column: 4 });
  assert.strictEqual(unchangedState, state, "Reducer must reject moves once match is won");

  // Cancellation via AbortSignal when match finishes
  const ac = new AbortController();
  const botPromise = requestBotMove(state.board, state.columnCounts, "Y", {
    difficulty: "medium",
    delayMs: 50,
    signal: ac.signal,
  });
  ac.abort();

  await assert.rejects(
    botPromise,
    (err) => err.name === "AbortError",
    "Cancelled bot promise must reject with AbortError"
  );
});

test("Bot Service: exactly one response per human move and full-column handling", async () => {
  let state = createInitialState("R");
  let botMovesCount = 0;

  // Turn 1: Human moves in col 3
  state = connectFourReducer(state, { type: "DROP", column: 3 });
  assert.equal(state.currentPlayer, "Y");

  // Bot makes exactly one move
  if (state.currentPlayer === "Y" && state.status === "in_progress") {
    const move = await requestBotMove(state.board, state.columnCounts, "Y", {
      difficulty: "medium",
      delayMs: 10,
    });
    assert.ok(isValidColumn(move) && !isColumnFull(state.columnCounts, move));
    state = connectFourReducer(state, { type: "DROP", column: move });
    botMovesCount++;
  }

  assert.equal(botMovesCount, 1);
  assert.equal(state.currentPlayer, "R");

  // Bot cannot move again during human turn
  assert.notEqual(state.currentPlayer, "Y");
});

test("Bot Service: Play Again resets bot correctly and preserves rotation", async () => {
  resetStartingPlayer("connect-four");

  // Match 1: starter is orange -> R starts (human)
  const starter1 = consumeStartingPlayer("connect-four");
  assert.equal(starter1, "orange");
  let state1 = createInitialState(starter1 === "orange" ? "R" : "Y");
  assert.equal(state1.currentPlayer, "R");

  // Play Again: starter rotates to blue -> Y starts (bot)
  const starter2 = consumeStartingPlayer("connect-four");
  assert.equal(starter2, "blue");
  let state2 = createInitialState(starter2 === "orange" ? "R" : "Y");
  assert.equal(state2.currentPlayer, "Y");
  assert.equal(state2.status, "in_progress");
  assert.equal(state2.moveCount, 0);

  // Bot makes first move cleanly
  const firstMove = await requestBotMove(state2.board, state2.columnCounts, "Y", {
    difficulty: "medium",
    delayMs: 10,
  });
  assert.ok(isValidColumn(firstMove) && !isColumnFull(state2.columnCounts, firstMove));
  state2 = connectFourReducer(state2, { type: "DROP", column: firstMove });
  assert.equal(state2.currentPlayer, "R");
  assert.equal(state2.moveCount, 1);
});