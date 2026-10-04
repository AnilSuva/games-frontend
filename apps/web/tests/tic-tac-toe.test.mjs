import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidMove,
} from "../src/games/board/tic-tac-toe/logic/rules.ts";
import {
  createInitialState,
  ticTacToeReducer,
} from "../src/games/board/tic-tac-toe/logic/reducer.ts";
import { findBestMove } from "../src/games/board/tic-tac-toe/bot/minimax.ts";
import { getBotMoveByDifficulty } from "../src/games/board/tic-tac-toe/bot/difficulty.ts";
import { requestBotMove } from "../src/games/board/tic-tac-toe/bot/botService.ts";
import {
  consumeStartingPlayer,
  resetStartingPlayer,
} from "../src/games/common/startingPlayer.ts";

test("Initialization: creates correct starting state", () => {
  const state = createInitialState();
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.winner, null);
  assert.equal(state.winningLine, null);
  assert.equal(state.moveCount, 0);
  assert.deepEqual(state.board, [null, null, null, null, null, null, null, null, null]);
});

test("Moves: accepts valid move and alternates turns", () => {
  let state = createInitialState();

  // Move 1: X plays center (4)
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 });
  assert.equal(state.board[4], "X");
  assert.equal(state.currentPlayer, "O");
  assert.equal(state.moveCount, 1);
  assert.equal(state.status, "in_progress");

  // Move 2: O plays top-left (0)
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 });
  assert.equal(state.board[0], "O");
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.moveCount, 2);
  assert.equal(state.status, "in_progress");
});

test("Moves: rejects moves into occupied cells", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 });

  // Attempt to play on already occupied cell 4
  const unchangedState = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 });
  assert.strictEqual(unchangedState, state, "Reducer must return exact same state reference on invalid move");
  assert.equal(state.currentPlayer, "O");
  assert.equal(state.moveCount, 1);
});

test("Moves: rejects out of bound indices", () => {
  const state = createInitialState();
  assert.strictEqual(ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: -1 }), state);
  assert.strictEqual(ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 9 }), state);
});

test("Moves: rejects moves after game is over", () => {
  // Setup winning state for X
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 3 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // X wins (top row)

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");

  // Attempting move after win must be rejected
  const afterGameOver = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 8 });
  assert.strictEqual(afterGameOver, state);
  assert.equal(afterGameOver.board[8], null);
});

// All 8 Winning Combinations
test("Wins: Top Row horizontal win [0, 1, 2]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 3 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [0, 1, 2]);
  assert.equal(state.winningLine.direction, "horizontal");
});

test("Wins: Middle Row horizontal win [3, 4, 5]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 3 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 5 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [3, 4, 5]);
  assert.equal(state.winningLine.direction, "horizontal");
});

test("Wins: Bottom Row horizontal win [6, 7, 8]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 6 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 7 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 8 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [6, 7, 8]);
  assert.equal(state.winningLine.direction, "horizontal");
});

test("Wins: Left Column vertical win [0, 3, 6]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 3 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 6 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [0, 3, 6]);
  assert.equal(state.winningLine.direction, "vertical");
});

test("Wins: Middle Column vertical win [1, 4, 7]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 7 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [1, 4, 7]);
  assert.equal(state.winningLine.direction, "vertical");
});

test("Wins: Right Column vertical win [2, 5, 8]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 5 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 8 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [2, 5, 8]);
  assert.equal(state.winningLine.direction, "vertical");
});

test("Wins: Main Diagonal win [0, 4, 8]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 8 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [0, 4, 8]);
  assert.equal(state.winningLine.direction, "diagonal");
});

test("Wins: Anti-Diagonal win [2, 4, 6]", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 6 }); // X wins

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winningLine.line, [2, 4, 6]);
  assert.equal(state.winningLine.direction, "diagonal");
});

test("Draw: Full board without a winning line produces draw", () => {
  // Classic draw match sequence
  const moves = [0, 1, 2, 5, 3, 6, 4, 8, 7];
  let state = createInitialState();
  for (const m of moves) {
    state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: m });
  }

  assert.equal(state.status, "draw");
  assert.equal(state.winner, null);
  assert.equal(state.winningLine, null);
  assert.equal(state.moveCount, 9);
});

test("Reset: Reinitializes game to clean starting state", () => {
  let state = createInitialState();
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 });
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 });
  assert.equal(state.moveCount, 2);

  state = ticTacToeReducer(state, { type: "RESET" });
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.moveCount, 0);
  assert.deepEqual(state.board, [null, null, null, null, null, null, null, null, null]);
});

// Bot Verification & Difficulties
test("Bot: Only returns valid, available cell indices", () => {
  const board = [
    "X", "O", "X",
    "X", null, "O",
    "O", "X", "O"
  ];
  const bestMove = findBestMove(board, "X");
  assert.equal(bestMove, 4, "Must select the only remaining cell 4");
});

test("Bot: Takes immediate winning move for itself", () => {
  const board = [
    "O", "O", null,
    "X", "X", null,
    null, null, null
  ];
  const bestMove = findBestMove(board, "O");
  assert.equal(bestMove, 2, "Bot must seize the immediate win on cell 2");
});

test("Bot: Blocks opponent's immediate winning threat", () => {
  const board = [
    "X", "X", null,
    "O", null, null,
    null, null, null
  ];
  const bestMove = findBestMove(board, "O");
  assert.equal(bestMove, 2, "Bot must block X's winning move at cell 2");
});

test("Bot: Two optimal Minimax bots playing each other always result in a draw", () => {
  let state = createInitialState();
  while (state.status === "in_progress") {
    const move = findBestMove(state.board, state.currentPlayer);
    assert.ok(isValidMove(state.board, move), `Move ${move} must be valid`);
    state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: move });
  }

  assert.equal(state.status, "draw", "Optimal play against optimal play in Tic-Tac-Toe is a guaranteed draw");
  assert.equal(state.winner, null);
});

// Difficulty-Level Tests
test("Bot Difficulty: Hard mode always seizes immediate winning moves", () => {
  const board = [
    "O", "O", null,
    "X", "X", null,
    null, null, null
  ];
  // Even with any RNG value, Hard must seize immediate win
  const move1 = getBotMoveByDifficulty(board, "O", "hard", () => 0.0);
  const move2 = getBotMoveByDifficulty(board, "O", "hard", () => 0.99);
  assert.equal(move1, 2, "Hard bot must always seize immediate win (rng=0)");
  assert.equal(move2, 2, "Hard bot must always seize immediate win (rng=0.99)");
});

test("Bot Difficulty: Hard mode always blocks immediate opponent threats", () => {
  const board = [
    "X", "X", null,
    "O", null, null,
    null, null, null
  ];
  // Even with any RNG value, Hard must block opponent's immediate winning threat at 2
  const move1 = getBotMoveByDifficulty(board, "O", "hard", () => 0.0);
  const move2 = getBotMoveByDifficulty(board, "O", "hard", () => 0.99);
  assert.equal(move1, 2, "Hard bot must always block immediate win (rng=0)");
  assert.equal(move2, 2, "Hard bot must always block immediate win (rng=0.99)");
});

test("Bot Difficulty: Hard mode usually selects optimal move but can select safe second-tier move", () => {
  // Opening board: X played in top-left (0)
  // X . .
  // . . .
  // . . .
  const board = [
    "X", null, null,
    null, null, null,
    null, null, null
  ];

  // When rng() >= 0.2, Hard selects optimal move (center 4)
  const optimalMove = getBotMoveByDifficulty(board, "O", "hard", () => 0.5);
  assert.equal(optimalMove, 4, "Optimal defense to corner opening is center (4)");

  // When rng() < 0.2, Hard is capable of choosing a safe second-tier move
  const nonOptimalMove = getBotMoveByDifficulty(board, "O", "hard", () => 0.05);
  assert.ok(isValidMove(board, nonOptimalMove), "Second-tier move must be legal");
  assert.notEqual(nonOptimalMove, 0, "Cannot play occupied cell");
});

test("Bot Difficulty: Hard mode avoids immediate blunder moves", () => {
  // Board where O has to choose between safe moves vs letting X win on next turn
  // X . .
  // . O .
  // . . X
  const board = [
    "X", null, null,
    null, "O", null,
    null, null, "X"
  ];
  // Cells 1, 3, 5, 7 are side moves that prevent corners.
  const move = getBotMoveByDifficulty(board, "O", "hard");
  assert.ok(isValidMove(board, move));
});

test("Bot Difficulty: Medium mode takes immediate wins and blocks most threats", () => {
  const winBoard = [
    "O", "O", null,
    "X", "X", null,
    null, null, null
  ];
  const winMove = getBotMoveByDifficulty(winBoard, "O", "medium");
  assert.equal(winMove, 2, "Medium bot must seize immediate win");

  const threatBoard = [
    "X", "X", null,
    null, "O", null,
    null, null, null
  ];
  // With rng < 0.8, Medium blocks
  const blockedMove = getBotMoveByDifficulty(threatBoard, "O", "medium", () => 0.3);
  assert.equal(blockedMove, 2, "Medium blocks threat when rng < 0.8");
});

test("Bot Difficulty: Easy mode always produces legal moves and is intentionally imperfect", () => {
  const board = [
    "X", "O", null,
    null, "X", null,
    null, null, null
  ];

  for (let i = 0; i < 20; i++) {
    const move = getBotMoveByDifficulty(board, "O", "easy");
    assert.ok(isValidMove(board, move), `Easy move ${move} must always be a legal empty cell`);
  }

  // Easy frequently misses threats
  const threatBoard = [
    "X", "X", null,
    "O", null, null,
    null, null, null
  ];
  let missedThreat = false;
  for (let i = 0; i < 20; i++) {
    const move = getBotMoveByDifficulty(threatBoard, "O", "easy");
    assert.ok(isValidMove(threatBoard, move));
    if (move !== 2) {
      missedThreat = true;
      break;
    }
  }
  assert.ok(missedThreat, "Easy bot should frequently miss blocking immediate threats");
});

test("Bot Difficulty: All difficulties complete matches legally without infinite loops", () => {
  const difficulties = ["easy", "medium", "hard"];

  for (const diff of difficulties) {
    let state = createInitialState();
    let steps = 0;
    while (state.status === "in_progress" && steps < 10) {
      const move = getBotMoveByDifficulty(state.board, state.currentPlayer, diff);
      assert.ok(isValidMove(state.board, move), `${diff} move must be legal`);
      state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: move });
      steps++;
    }
    assert.ok(state.status === "won" || state.status === "draw", `${diff} game must terminate in win or draw`);
  }
});

test("Bot Service: bot responds after human move", async () => {
  let state = createInitialState("X");
  assert.equal(state.currentPlayer, "X");

  // Human plays cell 4
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 });
  assert.equal(state.currentPlayer, "O");
  assert.equal(state.status, "in_progress");

  // Bot calculates move
  const botMove = await requestBotMove(state.board, "O", { difficulty: "medium", delayMs: 10 });
  assert.ok(botMove >= 0 && botMove <= 8, `Bot move ${botMove} must be within board bounds`);
  assert.notEqual(botMove, 4, "Bot must not play already occupied cell");

  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: botMove });
  assert.equal(state.board[botMove], "O");
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.moveCount, 2);
});

test("Bot Service: bot first move when Blue starts", async () => {
  // Blue starts -> player O
  let state = createInitialState("O");
  assert.equal(state.currentPlayer, "O");
  assert.equal(state.status, "in_progress");

  const botMove = await requestBotMove(state.board, "O", { difficulty: "hard", delayMs: 10 });
  assert.ok(botMove >= 0 && botMove <= 8, `Bot first move ${botMove} must be valid cell`);

  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: botMove });
  assert.equal(state.board[botMove], "O");
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.moveCount, 1);
});

test("Bot Service: all three difficulties return legal moves", async () => {
  const difficulties = ["easy", "medium", "hard"];
  const testBoard = [
    "X", "X", null,
    "O", null, null,
    null, null, null,
  ];

  for (const diff of difficulties) {
    const move = await requestBotMove(testBoard, "O", { difficulty: diff, delayMs: 5 });
    assert.ok(isValidMove(testBoard, move), `Difficulty ${diff} must return a legal move`);
  }

  // Hard must block threat at cell 2
  const hardMove = await requestBotMove(testBoard, "O", { difficulty: "hard", delayMs: 0 });
  assert.equal(hardMove, 2, "Hard bot must block immediate winning threat at cell 2");
});

test("Bot Service: no move after game over and cancellation on match finish", async () => {
  // X wins on top row
  let state = createInitialState("X");
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 0 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 3 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 1 }); // X
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 }); // O
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 2 }); // X wins!

  assert.equal(state.status, "won");
  assert.equal(state.winner, "X");

  // Attempt to apply a bot move to reducer after game over
  const unchangedState = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 5 });
  assert.strictEqual(unchangedState, state, "Reducer must reject any moves once game is over");

  // In-flight bot calculation aborted with AbortController
  const ac = new AbortController();
  const botPromise = requestBotMove(state.board, "O", { difficulty: "medium", delayMs: 50, signal: ac.signal });
  ac.abort();

  await assert.rejects(
    botPromise,
    (err) => err.name === "AbortError",
    "Aborted bot calculation must reject with AbortError"
  );
});

test("Bot Service: exactly one response per human move and no duplicate moves", async () => {
  let state = createInitialState("X");
  let botMovesCount = 0;

  // Turn 1: Human moves
  state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: 4 });
  assert.equal(state.currentPlayer, "O");

  // Bot makes exactly one move
  if (state.currentPlayer === "O" && state.status === "in_progress") {
    const move = await requestBotMove(state.board, "O", { difficulty: "medium", delayMs: 10 });
    state = ticTacToeReducer(state, { type: "MAKE_MOVE", cellIndex: move });
    botMovesCount++;
  }
  assert.equal(botMovesCount, 1);
  assert.equal(state.currentPlayer, "X");

  // Attempting second bot move without human move fails condition
  assert.notEqual(state.currentPlayer, "O");
});

test("Bot Service: Play Again resets bot correctly and rotates starting player", async () => {
  resetStartingPlayer("tic-tac-toe");

  // Match 1: starter is orange -> X starts (human)
  const starter1 = consumeStartingPlayer("tic-tac-toe");
  assert.equal(starter1, "orange");
  let state1 = createInitialState(starter1 === "orange" ? "X" : "O");
  assert.equal(state1.currentPlayer, "X");

  // Simulate human move then game end
  state1 = ticTacToeReducer(state1, { type: "MAKE_MOVE", cellIndex: 0 });

  // Play Again: starter rotates to blue -> O starts (bot)
  const starter2 = consumeStartingPlayer("tic-tac-toe");
  assert.equal(starter2, "blue");
  let state2 = createInitialState(starter2 === "orange" ? "X" : "O");
  assert.equal(state2.currentPlayer, "O");
  assert.equal(state2.status, "in_progress");
  assert.equal(state2.moveCount, 0);

  // Bot immediately plays first move
  const firstMove = await requestBotMove(state2.board, "O", { difficulty: "medium", delayMs: 10 });
  state2 = ticTacToeReducer(state2, { type: "MAKE_MOVE", cellIndex: firstMove });
  assert.equal(state2.currentPlayer, "X");
  assert.equal(state2.moveCount, 1);
});

