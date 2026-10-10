import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  EMPTY,
  ORANGE_MAN,
  ORANGE_KING,
  BLUE_MAN,
  BLUE_KING,
} from "../src/games/board/checkers/logic/types.ts";
import {
  toRow,
  toCol,
  toIndex,
  isPlayableSquare,
  getValidMoves,
  getValidMovesForSquare,
} from "../src/games/board/checkers/logic/moves.ts";
import {
  createInitialState,
  checkersReducer,
} from "../src/games/board/checkers/logic/reducer.ts";
import {
  evaluateBoard,
  findBestMove,
} from "../src/games/board/checkers/bot/minimax.ts";
import { getBotMoveByDifficulty } from "../src/games/board/checkers/bot/difficulty.ts";
import { requestBotMove } from "../src/games/board/checkers/bot/botService.ts";

function createEmptyBoard() {
  return new Array(64).fill(EMPTY);
}

test("Checkers Initialization: creates correct standard 8x8 starting state", () => {
  const state = createInitialState("orange");
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "orange");
  assert.equal(state.winner, null);
  assert.equal(state.activePiece, null);
  assert.equal(state.moveCount, 0);
  assert.equal(state.orangeCaptures, 0);
  assert.equal(state.blueCaptures, 0);
  assert.equal(state.board.length, 64);

  let blueCount = 0;
  let orangeCount = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = toIndex(r, c);
      const piece = state.board[idx];

      if ((r + c) % 2 === 1) {
        // Playable dark square
        if (r < 3) {
          assert.equal(piece, BLUE_MAN, `Square (${r},${c}) should be BLUE_MAN`);
          blueCount++;
        } else if (r > 4) {
          assert.equal(piece, ORANGE_MAN, `Square (${r},${c}) should be ORANGE_MAN`);
          orangeCount++;
        } else {
          assert.equal(piece, EMPTY, `Square (${r},${c}) in rows 3-4 should be EMPTY`);
        }
      } else {
        // Light square
        assert.equal(piece, EMPTY, `Light square (${r},${c}) must always be EMPTY`);
      }
    }
  }

  assert.equal(blueCount, 12, "Should have 12 initial Blue pieces");
  assert.equal(orangeCount, 12, "Should have 12 initial Orange pieces");
});

test("Checkers Moves: simple valid forward moves alternate turns", () => {
  let state = createInitialState("orange");

  // Initial Orange valid moves from row 5:
  // e.g. from (5, 0) -> (4, 1) or (5, 2) -> (4, 1) or (4, 3), etc.
  const fromOrange = toIndex(5, 0);
  const toOrange = toIndex(4, 1);

  state = checkersReducer(state, { type: "MOVE", from: fromOrange, to: toOrange });
  assert.equal(state.board[fromOrange], EMPTY);
  assert.equal(state.board[toOrange], ORANGE_MAN);
  assert.equal(state.currentPlayer, "blue");
  assert.equal(state.moveCount, 1);
  assert.equal(state.status, "in_progress");

  // Blue replies from (2, 1) -> (3, 0)
  const fromBlue = toIndex(2, 1);
  const toBlue = toIndex(3, 0);

  state = checkersReducer(state, { type: "MOVE", from: fromBlue, to: toBlue });
  assert.equal(state.board[fromBlue], EMPTY);
  assert.equal(state.board[toBlue], BLUE_MAN);
  assert.equal(state.currentPlayer, "orange");
  assert.equal(state.moveCount, 2);
});

test("Checkers Moves: rejects illegal moves and preserves state reference", () => {
  const state = createInitialState("orange");

  // 1. Moving backward with an Orange Man
  const badBackward = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(5, 0),
    to: toIndex(6, 1),
  });
  assert.strictEqual(badBackward, state, "Must reject backward move for Man");

  // 2. Moving opponent piece when it's Orange's turn
  const badOpponent = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(2, 1),
    to: toIndex(3, 0),
  });
  assert.strictEqual(badOpponent, state, "Must reject moving opponent piece");

  // 3. Moving onto a light square
  const badLightSquare = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(5, 0),
    to: toIndex(4, 0),
  });
  assert.strictEqual(badLightSquare, state, "Must reject move to non-diagonal / light square");

  // 4. Moving onto an occupied square
  const badOccupied = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(6, 1),
    to: toIndex(5, 0),
  });
  assert.strictEqual(badOccupied, state, "Must reject move into occupied square");

  // 5. Out of bounds indices
  assert.strictEqual(checkersReducer(state, { type: "MOVE", from: -1, to: 4 }), state);
  assert.strictEqual(checkersReducer(state, { type: "MOVE", from: 40, to: 65 }), state);
});

test("Checkers Forced Jump: strictly enforces forced capture", () => {
  // Setup board:
  // Orange piece at (4, 3) (index 35) can jump Blue piece at (3, 2) (index 26) landing on (2, 1) (index 17).
  // Another Orange piece at (5, 6) (index 46) has a normal simple move to (4, 5) or (4, 7).
  const board = createEmptyBoard();
  board[toIndex(4, 3)] = ORANGE_MAN;
  board[toIndex(3, 2)] = BLUE_MAN;
  board[toIndex(5, 6)] = ORANGE_MAN;

  const state = {
    board,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 0,
    lastMove: null,
  };

  const validMoves = getValidMoves(state);
  // Must return ONLY the jump move! Simple moves from (5, 6) must NOT be present!
  assert.equal(validMoves.length, 1);
  assert.equal(validMoves[0].from, toIndex(4, 3));
  assert.equal(validMoves[0].to, toIndex(2, 1));
  assert.equal(validMoves[0].isJump, true);
  assert.equal(validMoves[0].jumpedIndex, toIndex(3, 2));

  // Attempting the non-jump move from (5, 6) must be REJECTED by reducer
  const rejectedState = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(5, 6),
    to: toIndex(4, 5),
  });
  assert.strictEqual(rejectedState, state, "Reducer must reject simple move when jump is available");

  // Executing the forced jump must succeed:
  const nextState = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(4, 3),
    to: toIndex(2, 1),
  });
  assert.equal(nextState.board[toIndex(4, 3)], EMPTY);
  assert.equal(nextState.board[toIndex(3, 2)], EMPTY, "Captured blue piece must be removed");
  assert.equal(nextState.board[toIndex(2, 1)], ORANGE_MAN, "Orange man landed on (2, 1)");
  assert.equal(nextState.orangeCaptures, 1);
  assert.equal(nextState.currentPlayer, "blue", "Turn passes to blue since no multi-jump");
});

test("Checkers Forced Multi-Jump: enforces successive jumps by the same piece", () => {
  // Setup board for double jump:
  // Orange man at (5, 2) (index 42)
  // Blue man at (4, 3) (index 35) -> landing at (3, 4) (index 28)
  // Blue man at (2, 5) (index 21) -> landing at (1, 6) (index 14)
  // Third Orange man at (6, 1) with normal moves
  const board = createEmptyBoard();
  const orangeStart = toIndex(5, 2);
  const firstBlue = toIndex(4, 3);
  const firstLand = toIndex(3, 4);
  const secondBlue = toIndex(2, 5);
  const secondLand = toIndex(1, 6);
  const otherOrange = toIndex(6, 1);

  board[orangeStart] = ORANGE_MAN;
  board[firstBlue] = BLUE_MAN;
  board[secondBlue] = BLUE_MAN;
  board[otherOrange] = ORANGE_MAN;

  let state = {
    board,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 0,
    lastMove: null,
  };

  // Step 1: Execute first jump
  state = checkersReducer(state, { type: "MOVE", from: orangeStart, to: firstLand });

  // Assert multi-jump state:
  assert.equal(state.currentPlayer, "orange", "Player turn must NOT change during multi-jump");
  assert.equal(state.activePiece, firstLand, "activePiece must be set to landing square");
  assert.equal(state.orangeCaptures, 1);
  assert.equal(state.board[firstBlue], EMPTY, "First blue piece removed");
  assert.equal(state.board[firstLand], ORANGE_MAN);

  // Available moves must ONLY be the next jump from activePiece
  const validMidMoves = getValidMoves(state);
  assert.equal(validMidMoves.length, 1);
  assert.equal(validMidMoves[0].from, firstLand);
  assert.equal(validMidMoves[0].to, secondLand);

  // Attempting to move other piece must be rejected
  const illegalMove = checkersReducer(state, {
    type: "MOVE",
    from: otherOrange,
    to: toIndex(5, 0),
  });
  assert.strictEqual(illegalMove, state, "Cannot move other piece while multi-jump is active");

  // Step 2: Execute second jump
  state = checkersReducer(state, { type: "MOVE", from: firstLand, to: secondLand });

  // Assert completion of multi-jump:
  assert.equal(state.activePiece, null, "activePiece cleared when no further jumps");
  assert.equal(state.orangeCaptures, 2);
  assert.equal(state.board[secondBlue], EMPTY, "Second blue piece removed");
  assert.equal(state.board[secondLand], ORANGE_MAN);
  assert.equal(state.currentPlayer, "blue", "Turn passes to opponent when sequence finishes");
});

test("Checkers King Promotion: crowning ends turn immediately even if jump backwards exists", () => {
  // Scenario:
  // Orange Man at (2, 3) jumps Blue Man at (1, 4) landing on (0, 5) - Row 0 is King Row!
  // At (0, 5), if it were a King in the middle of a turn, having a Blue Man at (1, 6) with empty (2, 7)
  // would allow a backward jump.
  // BUT the rule states: When a Man reaches the king row, it becomes a King and the turn ends immediately.
  const board = createEmptyBoard();
  const orangeMan = toIndex(2, 3);
  const jumpedBlue = toIndex(1, 4);
  const kingRowLand = toIndex(0, 5);
  const backwardBlue = toIndex(1, 6);

  board[orangeMan] = ORANGE_MAN;
  board[jumpedBlue] = BLUE_MAN;
  board[backwardBlue] = BLUE_MAN;
  // (2, 7) is empty, which would allow backward jump if turn continued

  // Give Blue an extra piece elsewhere so Blue has a valid piece to play on their turn
  board[toIndex(5, 0)] = BLUE_MAN;

  let state = {
    board,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 0,
    lastMove: null,
  };

  state = checkersReducer(state, { type: "MOVE", from: orangeMan, to: kingRowLand });

  // Promoted to King:
  assert.equal(state.board[kingRowLand], ORANGE_KING, "Piece must be crowned ORANGE_KING");
  assert.equal(state.board[jumpedBlue], EMPTY, "Captured piece removed");
  assert.equal(state.orangeCaptures, 1);

  // Turn MUST end immediately:
  assert.equal(state.activePiece, null, "activePiece must be null (turn ended)");
  assert.equal(state.currentPlayer, "blue", "Turn must pass to Blue immediately upon kinging");
});

test("Checkers Kings: can move and jump diagonally backwards and forwards", () => {
  const board = createEmptyBoard();
  const kingSquare = toIndex(4, 3);
  board[kingSquare] = ORANGE_KING;

  // Blue men surround the King in different quadrants:
  // Forward-left: (3, 2), land at (2, 1)
  // Backward-right: (5, 4), land at (6, 5)
  board[toIndex(3, 2)] = BLUE_MAN;
  board[toIndex(5, 4)] = BLUE_MAN;

  const state = {
    board,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 0,
    lastMove: null,
  };

  const validMoves = getValidMoves(state);
  // King can jump forward-left AND backward-right!
  assert.equal(validMoves.length, 2, "King should have 2 jump options (forward and backward)");

  const backwardJump = validMoves.find((m) => m.to === toIndex(6, 5));
  assert.ok(backwardJump, "King must have backward jump to (6, 5)");
  assert.equal(backwardJump.isJump, true);
  assert.equal(backwardJump.jumpedIndex, toIndex(5, 4));

  // Execute backward jump:
  const nextState = checkersReducer(state, {
    type: "MOVE",
    from: kingSquare,
    to: toIndex(6, 5),
  });
  assert.equal(nextState.board[kingSquare], EMPTY);
  assert.equal(nextState.board[toIndex(5, 4)], EMPTY, "Jumped piece removed");
  assert.equal(nextState.board[toIndex(6, 5)], ORANGE_KING);
  assert.equal(nextState.orangeCaptures, 1);
});

test("Checkers Win Condition: player wins when opponent has no remaining pieces", () => {
  const board = createEmptyBoard();
  board[toIndex(2, 3)] = ORANGE_MAN;
  board[toIndex(1, 2)] = BLUE_MAN; // Last blue piece

  let state = {
    board,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 11,
    blueCaptures: 0,
    moveCount: 20,
    lastMove: null,
  };

  state = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(2, 3),
    to: toIndex(0, 1),
  });

  assert.equal(state.board[toIndex(1, 2)], EMPTY);
  assert.equal(state.status, "won", "Game status must be won");
  assert.equal(state.winner, "orange", "Orange must be declared winner");
});

test("Checkers Win Condition: player wins when opponent is blocked with no legal moves", () => {
  // Stalemate / Trapped scenario:
  // Blue has 1 piece trapped at (0, 7) (index 7).
  // Orange piece at (1, 6) blocks simple move.
  // Orange piece at (2, 5) blocks jumping!
  // Blue has 0 moves.
  const board = createEmptyBoard();
  board[toIndex(0, 7)] = BLUE_MAN;
  board[toIndex(1, 6)] = ORANGE_MAN;
  board[toIndex(2, 5)] = ORANGE_MAN;
  // Orange has another piece at (7, 0)
  board[toIndex(7, 0)] = ORANGE_MAN;

  const state = {
    board,
    currentPlayer: "blue",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 15,
    lastMove: null,
  };

  const validMoves = getValidMoves(state);
  assert.equal(validMoves.length, 0, "Blue has no valid moves");

  // When reducer checks win condition after Orange's previous move:
  // Pre-state: Orange piece moves from (3, 4) to (2, 5), completely blocking Blue!
  const preBoard = createEmptyBoard();
  preBoard[toIndex(0, 7)] = BLUE_MAN;
  preBoard[toIndex(1, 6)] = ORANGE_MAN;
  preBoard[toIndex(3, 4)] = ORANGE_MAN; // will move to (2, 5)

  let preState = {
    board: preBoard,
    currentPlayer: "orange",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 14,
    lastMove: null,
  };

  const trapState = checkersReducer(preState, {
    type: "MOVE",
    from: toIndex(3, 4),
    to: toIndex(2, 5),
  });

  assert.equal(trapState.status, "won", "Must declare win when opponent is blocked");
  assert.equal(trapState.winner, "orange", "Orange wins because Blue is blocked");
});

test("Checkers RESET: re-initializes match with optional starting player", () => {
  let state = createInitialState("orange");
  state = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(5, 0),
    to: toIndex(4, 1),
  });
  assert.equal(state.moveCount, 1);

  const resetState = checkersReducer(state, {
    type: "RESET",
    startingPlayer: "blue",
  });
  assert.equal(resetState.moveCount, 0);
  assert.equal(resetState.currentPlayer, "blue");
  assert.equal(resetState.status, "in_progress");
  assert.equal(resetState.winner, null);
  assert.equal(resetState.activePiece, null);
  assert.equal(resetState.board.length, 64);
});

test("Checkers Helpers: coordinate conversions and playable square identification", () => {
  assert.equal(toRow(0), 0);
  assert.equal(toCol(0), 0);
  assert.equal(toRow(63), 7);
  assert.equal(toCol(63), 7);

  assert.equal(isPlayableSquare(0, 0), false, "(0,0) is light square");
  assert.equal(isPlayableSquare(0, 1), true, "(0,1) is dark square");
  assert.equal(isPlayableSquare(7, 7), false, "(7,7) is light square");
  assert.equal(isPlayableSquare(7, 6), true, "(7,6) is dark square");
  assert.equal(isPlayableSquare(-1, 0), false, "out of bounds row");
  assert.equal(isPlayableSquare(0, 8), false, "out of bounds col");
});

test("Checkers Helpers: getValidMovesForSquare filters moves for clicked square", () => {
  const state = createInitialState("orange");
  const movesFrom0 = getValidMovesForSquare(state, toIndex(5, 0));
  assert.equal(movesFrom0.length, 1);
  assert.equal(movesFrom0[0].to, toIndex(4, 1));

  const movesFromEmpty = getValidMovesForSquare(state, toIndex(4, 0));
  assert.equal(movesFromEmpty.length, 0);
});

test("Checkers Blue King Promotion: crowning on row 7 promotes to BLUE_KING and ends turn", () => {
  const board = createEmptyBoard();
  board[toIndex(5, 2)] = BLUE_MAN;
  board[toIndex(6, 3)] = ORANGE_MAN;
  board[toIndex(1, 0)] = ORANGE_MAN; // Give orange a piece elsewhere

  const state = {
    board,
    currentPlayer: "blue",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 10,
    lastMove: null,
  };

  const nextState = checkersReducer(state, {
    type: "MOVE",
    from: toIndex(5, 2),
    to: toIndex(7, 4),
  });

  assert.equal(nextState.board[toIndex(7, 4)], BLUE_KING, "Must crown BLUE_KING");
  assert.equal(nextState.board[toIndex(6, 3)], EMPTY, "Captured orange piece removed");
  assert.equal(nextState.blueCaptures, 1);
  assert.equal(nextState.currentPlayer, "orange", "Turn ends and passes to orange");
  assert.equal(nextState.activePiece, null);
});

test("Checkers Bot Heuristics: evaluateBoard awards material and positional advantages", () => {
  const board = createEmptyBoard();
  // Orange has a King in center, Blue has a Man on edge
  board[toIndex(4, 3)] = ORANGE_KING; // 300 + 15 (center)
  board[toIndex(1, 0)] = BLUE_MAN;    // 100 + 4

  const evalForOrange = evaluateBoard(board, "orange");
  const evalForBlue = evaluateBoard(board, "blue");

  assert.ok(evalForOrange > 0, "Evaluation should favor Orange");
  assert.ok(evalForBlue < 0, "Evaluation should be negative for Blue");
  assert.equal(evalForOrange, -evalForBlue, "Evaluation must be symmetric zero-sum");
});

test("Checkers Bot Minimax: findBestMove selects tactical winning move", () => {
  // Scenario: Blue has a free jump available that captures an Orange piece
  const board = createEmptyBoard();
  board[toIndex(2, 3)] = BLUE_MAN;
  board[toIndex(3, 4)] = ORANGE_MAN;
  board[toIndex(1, 0)] = BLUE_MAN; // Extra blue piece with simple move

  const state = {
    board,
    currentPlayer: "blue",
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 5,
    lastMove: null,
  };

  const bestMove = findBestMove(state, "blue", 3);
  assert.ok(bestMove !== null);
  assert.equal(bestMove.from, toIndex(2, 3));
  assert.equal(bestMove.to, toIndex(4, 5));
  assert.equal(bestMove.isJump, true);
});

test("Checkers Bot Difficulty: easy, medium, and hard tiers return legal moves", () => {
  const state = createInitialState("orange");

  const easyMove = getBotMoveByDifficulty(state, "orange", "easy", () => 0.1);
  assert.ok(easyMove !== null);
  const validMoves = getValidMoves(state);
  assert.ok(validMoves.some((m) => m.from === easyMove.from && m.to === easyMove.to));

  const mediumMove = getBotMoveByDifficulty(state, "orange", "medium");
  assert.ok(mediumMove !== null);
  assert.ok(validMoves.some((m) => m.from === mediumMove.from && m.to === mediumMove.to));

  const hardMove = getBotMoveByDifficulty(state, "orange", "hard");
  assert.ok(hardMove !== null);
  assert.ok(validMoves.some((m) => m.from === hardMove.from && m.to === hardMove.to));
});

test("Checkers Bot Service: requestBotMove returns move with delay and abort support", async () => {
  const state = createInitialState("orange");

  // 1. Normal resolution with small delay
  const move = await requestBotMove(state, "orange", {
    difficulty: "easy",
    delayMs: 20,
  });
  assert.ok(move !== null);
  assert.equal(typeof move.from, "number");
  assert.equal(typeof move.to, "number");

  // 2. Immediate abort cancellation
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    requestBotMove(state, "orange", {
      difficulty: "medium",
      delayMs: 50,
      signal: controller.signal,
    }),
    { name: "AbortError" }
  );
});
