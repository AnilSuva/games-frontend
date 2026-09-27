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

// New Difficulty-Level Tests
test("Bot Difficulty: Hard mode is 100% optimal and takes immediate winning moves", () => {
  const board = [
    "O", "O", null,
    "X", "X", null,
    null, null, null
  ];
  const move = getBotMoveByDifficulty(board, "O", "hard");
  assert.equal(move, 2, "Hard bot must always seize immediate win");
});

test("Bot Difficulty: Medium mode takes immediate winning moves", () => {
  const board = [
    "O", "O", null,
    "X", "X", null,
    null, null, null
  ];
  const move = getBotMoveByDifficulty(board, "O", "medium");
  assert.equal(move, 2, "Medium bot must seize immediate win");
});

test("Bot Difficulty: Easy mode always produces legal moves", () => {
  const board = [
    "X", "O", null,
    null, "X", null,
    null, null, null
  ];

  for (let i = 0; i < 20; i++) {
    const move = getBotMoveByDifficulty(board, "O", "easy");
    assert.ok(isValidMove(board, move), `Easy move ${move} must always be a legal empty cell`);
  }
});

test("Bot Difficulty: Easy mode can make suboptimal choices", () => {
  // In this board, cell 2 is the ONLY optimal block against X's win:
  // X X .
  // O . .
  // . . .
  const board = [
    "X", "X", null,
    "O", null, null,
    null, null, null
  ];

  let madeSuboptimalChoice = false;
  // Over 30 trials, with 70% random chance, Easy will pick a move other than 2
  for (let i = 0; i < 30; i++) {
    const move = getBotMoveByDifficulty(board, "O", "easy");
    assert.ok(isValidMove(board, move));
    if (move !== 2) {
      madeSuboptimalChoice = true;
      break;
    }
  }

  assert.ok(madeSuboptimalChoice, "Easy bot should be beatable and occasionally miss optimal blocks");
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
