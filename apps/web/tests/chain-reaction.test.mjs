import test from "node:test";
import assert from "node:assert/strict";

import {
  COLS,
  ROWS,
  TOTAL_CELLS,
  createEmptyGrid,
  getCriticalMass,
  getNeighbors,
  isValidMove,
  getLegalMoves,
  countOrbs,
  resolveMove,
  createInitialState,
} from "../src/games/board/chain-reaction/logic/rules.ts";

import {
  evaluateBoard,
  selectBotMove,
} from "../src/games/board/chain-reaction/bot/botLogic.ts";

// =========================================================================
// 1. Board Dimensions & Critical Mass
// =========================================================================

test("Board Dimensions: 6 columns x 8 rows (48 cells)", () => {
  assert.equal(COLS, 6);
  assert.equal(ROWS, 8);
  assert.equal(TOTAL_CELLS, 48);

  const grid = createEmptyGrid();
  assert.equal(grid.length, 8);
  assert.equal(grid[0].length, 6);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      assert.equal(grid[r][c].count, 0);
      assert.equal(grid[r][c].owner, null);
    }
  }
});

test("Critical Mass: Corners=2, Edges=3, Interior=4", () => {
  // Corners
  assert.equal(getCriticalMass(0, 0), 2, "Top-left corner");
  assert.equal(getCriticalMass(0, 5), 2, "Top-right corner");
  assert.equal(getCriticalMass(7, 0), 2, "Bottom-left corner");
  assert.equal(getCriticalMass(7, 5), 2, "Bottom-right corner");

  // Edges
  assert.equal(getCriticalMass(0, 2), 3, "Top edge");
  assert.equal(getCriticalMass(7, 3), 3, "Bottom edge");
  assert.equal(getCriticalMass(3, 0), 3, "Left edge");
  assert.equal(getCriticalMass(4, 5), 3, "Right edge");

  // Center / Interior
  assert.equal(getCriticalMass(1, 1), 4, "Interior");
  assert.equal(getCriticalMass(4, 3), 4, "Interior");
  assert.equal(getCriticalMass(6, 4), 4, "Interior");
});

test("Neighbors: orthogonal adjacency within bounds", () => {
  const cornerNeighbors = getNeighbors(0, 0);
  assert.equal(cornerNeighbors.length, 2);
  assert.deepEqual(cornerNeighbors, [
    { row: 1, col: 0 },
    { row: 0, col: 1 },
  ]);

  const edgeNeighbors = getNeighbors(0, 3);
  assert.equal(edgeNeighbors.length, 3);

  const interiorNeighbors = getNeighbors(3, 3);
  assert.equal(interiorNeighbors.length, 4);
});

// =========================================================================
// 2. Move Validation & Legal Moves
// =========================================================================

test("Move Validation: allows empty and friendly cells, rejects opponent cells", () => {
  const state = createInitialState("X");

  // Legal: empty cell
  assert.equal(isValidMove(state, 0, 0), true);
  assert.equal(isValidMove(state, 4, 3), true);

  // Out of bounds
  assert.equal(isValidMove(state, -1, 0), false);
  assert.equal(isValidMove(state, 8, 2), false);
  assert.equal(isValidMove(state, 0, 6), false);

  // Friendly cell
  state.grid[2][2] = { count: 1, owner: "X" };
  assert.equal(isValidMove(state, 2, 2), true);

  // Opponent cell
  state.grid[3][3] = { count: 1, owner: "O" };
  assert.equal(isValidMove(state, 3, 3), false);
});

test("Legal Moves: matches all unoccupied and friendly cells", () => {
  const state = createInitialState("X");
  const initialLegal = getLegalMoves(state);
  assert.equal(initialLegal.length, 48, "All 48 cells initially legal");

  state.grid[1][1] = { count: 1, owner: "O" };
  const afterOPlaced = getLegalMoves(state);
  assert.equal(afterOPlaced.length, 47, "Opponent cell excluded");
});

// =========================================================================
// 3. Cascade Resolution & Wave Mechanics
// =========================================================================

test("Single Orb Placement: no cascade when under critical mass", () => {
  const state = createInitialState("X");
  const { finalState, waves } = resolveMove(state, 0, 0);

  assert.equal(waves.length, 0, "No explosion waves");
  assert.equal(finalState.grid[0][0].count, 1);
  assert.equal(finalState.grid[0][0].owner, "X");
  assert.equal(finalState.currentPlayer, "O", "Turn passes to O");
  assert.equal(finalState.movesPlayed, 1);
  assert.equal(finalState.status, "playing");
});

test("Cascade Wave Propagation: corner explosion converts neighbors", () => {
  const state = createInitialState("X");
  // Pre-seed corner (0,0) with 1 orb owned by X (crit=2)
  state.grid[0][0] = { count: 1, owner: "X" };

  // Pre-seed neighbor (0,1) with 2 orbs owned by O (crit=3)
  state.grid[0][1] = { count: 2, owner: "O" };

  // Pre-seed neighbor (0,2) with 1 orb owned by O (crit=3)
  state.grid[0][2] = { count: 1, owner: "O" };

  // X plays on (0,0) -> reaches count 2, explodes into (0,1) and (1,0)
  // (0,1) receives 1 orb -> reaches count 3, explodes into (0,0), (1,1), (0,2)
  const { finalState, waves } = resolveMove(state, 0, 0);

  assert.ok(waves.length >= 2, `Expected at least 2 waves, got ${waves.length}`);

  // Wave 0: (0,0) exploded
  assert.equal(waves[0].explosions[0].fromRow, 0);
  assert.equal(waves[0].explosions[0].fromCol, 0);

  // In Wave 0's resulting board, (0,1) has received an orb and is now owned by X
  assert.equal(waves[0].board[0][1].owner, "X");
  assert.equal(waves[0].board[0][1].count, 3);

  // In Wave 1, (0,1) exploded
  assert.equal(waves[1].explosions[0].fromRow, 0);
  assert.equal(waves[1].explosions[0].fromCol, 1);

  // After wave 1, (0,2) was converted to X
  assert.equal(finalState.grid[0][2].owner, "X");
});

// =========================================================================
// 4. Anti-Infinite-Loop Win Short-Circuit
// =========================================================================

test("Win Short-Circuit: immediate termination when opponent wiped after movesPlayed >= 2", () => {
  const state = createInitialState("X");
  // Simulate that both players have taken at least 1 turn
  state.playerMoves = { X: 1, O: 1 };
  state.movesPlayed = 2;

  // X has corner (0,0) with 1 orb (crit=2)
  state.grid[0][0] = { count: 1, owner: "X" };

  // O has only 1 orb on the entire board at (0,1)
  state.grid[0][1] = { count: 1, owner: "O" };

  // X plays (0,0) -> triggers explosion into (0,1)
  // (0,1) gains +1 orb and ownership converts to X
  // O now has 0 orbs on the board!
  const { finalState, waves } = resolveMove(state, 0, 0);

  assert.equal(waves.length, 1, "Only 1 wave needed to wipe opponent");
  assert.equal(finalState.status, "finished", "Game must be finished");
  assert.equal(finalState.winner, "X", "X must be declared winner");

  const counts = countOrbs(finalState.grid);
  assert.equal(counts.O, 0, "Opponent has 0 orbs");
  assert.ok(counts.X > 0, "Winner has orbs");
});

test("No premature win on first move: opponent having 0 orbs before playing is not a win", () => {
  const state = createInitialState("X");
  const { finalState } = resolveMove(state, 0, 0);

  assert.equal(finalState.status, "playing", "First move cannot declare a win");
  assert.equal(finalState.winner, null);
  assert.equal(finalState.currentPlayer, "O");
});

// =========================================================================
// 5. Bot AI Logic & Minimax
// =========================================================================

test("Bot Evaluation: winning board returns high positive score", () => {
  const state = createInitialState("O");
  state.status = "finished";
  state.winner = "O";

  const evalO = evaluateBoard(state, "O");
  assert.equal(evalO, 100000, "Winner gets +100000");

  const evalX = evaluateBoard(state, "X");
  assert.equal(evalX, -100000, "Loser gets -100000");
});

test("Bot Selects Valid Legal Move across all difficulties", () => {
  const state = createInitialState("O");
  state.grid[0][0] = { count: 1, owner: "X" };
  state.grid[0][1] = { count: 1, owner: "O" };

  const easyMove = selectBotMove(state, "easy");
  assert.ok(easyMove, "Easy bot returned a move");
  assert.ok(isValidMove(state, easyMove.row, easyMove.col), "Easy move is legal");

  const medMove = selectBotMove(state, "medium");
  assert.ok(medMove, "Medium bot returned a move");
  assert.ok(isValidMove(state, medMove.row, medMove.col), "Medium move is legal");

  const hardMove = selectBotMove(state, "hard");
  assert.ok(hardMove, "Hard bot returned a move");
  assert.ok(isValidMove(state, hardMove.row, hardMove.col), "Hard move is legal");
});

test("Hard Bot Takes Immediate Winning Move", () => {
  const state = createInitialState("O");
  state.playerMoves = { X: 1, O: 1 };
  state.movesPlayed = 2;

  // X has only 1 orb at (0,1)
  state.grid[0][1] = { count: 1, owner: "X" };

  // O has 1 orb at corner (0,0) (crit=2)
  state.grid[0][0] = { count: 1, owner: "O" };

  // Playing at (0,0) immediately explodes and wipes X's only orb
  const bestMove = selectBotMove(state, "hard");
  assert.ok(bestMove);
  assert.equal(bestMove.row, 0, "Bot must choose row 0");
  assert.equal(bestMove.col, 0, "Bot must choose col 0 for immediate win");
});
