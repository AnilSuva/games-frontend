import test from "node:test";
import assert from "node:assert/strict";

import {
  GOAL_ROW,
  GRID_SIZE,
  INITIAL_WALLS,
  WALL_GRID_SIZE,
  applyAction,
  canPlaceWall,
  createInitialState,
  getShortestPath,
  getShortestPathLength,
  getValidPawnMoves,
  getValidWallPlacements,
  isEdgeBlocked,
  validateWallPlacement,
} from "../src/games/board/wall-maze/logic/rules.ts";

import {
  evaluateBoard,
  selectBotMove,
} from "../src/games/board/wall-maze/bot/botLogic.ts";

function sortPositions(positions) {
  return [...positions].sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
}

// =========================================================================
// 1. Initial Setup & JSON Serializability
// =========================================================================

test("Initial Setup: 9x9 grid, P1 at (8,4), P2 at (0,4), 10 walls each", () => {
  assert.equal(GRID_SIZE, 9);
  assert.equal(WALL_GRID_SIZE, 8);
  assert.equal(INITIAL_WALLS, 10);
  assert.equal(GOAL_ROW.X, 0);
  assert.equal(GOAL_ROW.O, 8);

  const state = createInitialState("X");
  assert.deepEqual(state.pawns.X, { row: 8, col: 4 });
  assert.deepEqual(state.pawns.O, { row: 0, col: 4 });
  assert.deepEqual(state.walls, []);
  assert.deepEqual(state.wallsLeft, { X: 10, O: 10 });
  assert.equal(state.currentPlayer, "X");
  assert.equal(state.startingPlayer, "X");
  assert.equal(state.status, "playing");
  assert.equal(state.winner, null);
  assert.equal(state.moveCount, 0);
  assert.equal(state.lastAction, null);

  // Round-trip JSON serializable for Phase 2 server reuse
  const roundTrip = JSON.parse(JSON.stringify(state));
  assert.deepEqual(roundTrip, state);

  // Initial shortest path is 8 steps for both players
  assert.equal(getShortestPathLength(state.walls, state.pawns.X, GOAL_ROW.X), 8);
  assert.equal(getShortestPathLength(state.walls, state.pawns.O, GOAL_ROW.O), 8);

  // Initial valid wall placements: 8 * 8 * 2 = 128
  assert.equal(getValidWallPlacements(state).length, 128);
});

// =========================================================================
// 2. Edge Blocking & Orthogonal Moves Blocked by H and V Walls
// =========================================================================

test("Orthogonal Movement & Edge Blocking: horizontal and vertical 2-cell walls", () => {
  const state = createInitialState("X");
  state.pawns.X = { row: 4, col: 4 };
  state.pawns.O = { row: 0, col: 0 };

  // Horizontal wall at (3, 4, "h") blocks (3,4)<->(4,4) AND (3,5)<->(4,5)
  state.walls.push({ row: 3, col: 4, orientation: "h" });
  assert.equal(isEdgeBlocked(state.walls, 4, 4, 3, 4), true);
  assert.equal(isEdgeBlocked(state.walls, 3, 4, 4, 4), true);
  assert.equal(isEdgeBlocked(state.walls, 4, 5, 3, 5), true);
  assert.equal(isEdgeBlocked(state.walls, 4, 3, 3, 3), false);

  // Vertical wall at (4, 3, "v") blocks (4,3)<->(4,4) AND (5,3)<->(5,4)
  state.walls.push({ row: 4, col: 3, orientation: "v" });
  assert.equal(isEdgeBlocked(state.walls, 4, 4, 4, 3), true);
  assert.equal(isEdgeBlocked(state.walls, 5, 4, 5, 3), true);
  assert.equal(isEdgeBlocked(state.walls, 3, 4, 3, 3), false);

  // X at (4,4) is blocked North (by h wall) and West (by v wall), open South & East
  const moves = sortPositions(getValidPawnMoves(state, "X"));
  assert.deepEqual(moves, [
    { row: 4, col: 5 },
    { row: 5, col: 4 },
  ]);
});

// =========================================================================
// 3. Pawn Jump & Diagonal Side-Step Rules
// =========================================================================

test("Face-to-face Straight Jump: jumps over opponent when behind is open (no diagonals)", () => {
  const state = createInitialState("X");
  state.pawns.X = { row: 5, col: 4 };
  state.pawns.O = { row: 4, col: 4 };

  const moves = sortPositions(getValidPawnMoves(state, "X"));
  assert.deepEqual(
    moves,
    sortPositions([
      { row: 3, col: 4 }, // straight jump over O
      { row: 6, col: 4 },
      { row: 5, col: 3 },
      { row: 5, col: 5 },
    ])
  );

  // Also test horizontal straight jump
  const horizState = createInitialState("O");
  horizState.pawns.O = { row: 4, col: 3 };
  horizState.pawns.X = { row: 4, col: 4 };
  const horizMoves = sortPositions(getValidPawnMoves(horizState, "O"));
  assert.deepEqual(
    horizMoves,
    sortPositions([
      { row: 4, col: 5 }, // straight jump East over X
      { row: 4, col: 2 },
      { row: 3, col: 3 },
      { row: 5, col: 3 },
    ])
  );
});

test("Diagonal Side-Step: allowed ONLY when straight jump is blocked by wall or board edge", () => {
  // Case A: Wall directly behind opponent pawn
  const wallBehindState = createInitialState("X");
  wallBehindState.pawns.X = { row: 5, col: 4 };
  wallBehindState.pawns.O = { row: 4, col: 4 };
  wallBehindState.walls.push({ row: 3, col: 4, orientation: "h" }); // blocks (4,4)<->(3,4)

  const wallBehindMoves = sortPositions(getValidPawnMoves(wallBehindState, "X"));
  assert.deepEqual(
    wallBehindMoves,
    sortPositions([
      { row: 4, col: 3 }, // diagonal NW
      { row: 4, col: 5 }, // diagonal NE
      { row: 6, col: 4 },
      { row: 5, col: 3 },
      { row: 5, col: 5 },
    ])
  );

  // Case B: Wall behind opponent AND vertical side wall blocking left diagonal (4,3)
  wallBehindState.walls.push({ row: 4, col: 3, orientation: "v" });
  const sideBlockedMoves = sortPositions(getValidPawnMoves(wallBehindState, "X"));
  assert.deepEqual(
    sideBlockedMoves,
    sortPositions([
      { row: 4, col: 5 }, // only NE diagonal remains open
      { row: 6, col: 4 },
      { row: 5, col: 5 }, // note (5,3) also blocked by vertical wall at (4,3,"v")
    ])
  );

  // Case C: Board edge behind opponent pawn (O at row 0, X at row 1)
  const edgeBehindState = createInitialState("X");
  edgeBehindState.pawns.X = { row: 1, col: 4 };
  edgeBehindState.pawns.O = { row: 0, col: 4 };

  const edgeBehindMoves = sortPositions(getValidPawnMoves(edgeBehindState, "X"));
  assert.deepEqual(
    edgeBehindMoves,
    sortPositions([
      { row: 0, col: 3 }, // diagonal NW (winning!)
      { row: 0, col: 5 }, // diagonal NE (winning!)
      { row: 2, col: 4 },
      { row: 1, col: 3 },
      { row: 1, col: 5 },
    ])
  );
});

// =========================================================================
// 4. Wall Overlap, Crossing, Bounds & Inventory Validation
// =========================================================================

test("Wall Validation: rejects overlap, intersection crossing, out-of-bounds, and zero inventory", () => {
  const state = createInitialState("X");
  state.walls.push({ row: 3, col: 4, orientation: "h" });

  // Same slot horizontal overlap
  assert.equal(canPlaceWall(state, 3, 4, "h"), false);
  assert.equal(validateWallPlacement(state, 3, 4, "h").reason, "overlap");

  // Half-overlap left and right along same row
  assert.equal(canPlaceWall(state, 3, 3, "h"), false);
  assert.equal(validateWallPlacement(state, 3, 3, "h").reason, "overlap");
  assert.equal(canPlaceWall(state, 3, 5, "h"), false);
  assert.equal(validateWallPlacement(state, 3, 5, "h").reason, "overlap");

  // Touching end-to-end without overlapping (col +/- 2) is legal
  assert.equal(canPlaceWall(state, 3, 2, "h"), true);
  assert.equal(canPlaceWall(state, 3, 6, "h"), true);

  // Exact crossing with perpendicular vertical wall at (3, 4) is illegal
  assert.equal(canPlaceWall(state, 3, 4, "v"), false);
  assert.equal(validateWallPlacement(state, 3, 4, "v").reason, "crossing");

  // Perpendicular T-junction adjacent to endpoint (e.g., (3, 3, "v") or (3, 5, "v")) is legal
  assert.equal(canPlaceWall(state, 3, 3, "v"), true);
  assert.equal(canPlaceWall(state, 3, 5, "v"), true);

  // Vertical overlap test
  const vState = createInitialState("X");
  vState.walls.push({ row: 4, col: 2, orientation: "v" });
  assert.equal(canPlaceWall(vState, 3, 2, "v"), false);
  assert.equal(canPlaceWall(vState, 4, 2, "v"), false);
  assert.equal(canPlaceWall(vState, 5, 2, "v"), false);
  assert.equal(canPlaceWall(vState, 4, 2, "h"), false);
  assert.equal(canPlaceWall(vState, 2, 2, "v"), true);
  assert.equal(canPlaceWall(vState, 6, 2, "v"), true);

  // Out of bounds
  assert.equal(canPlaceWall(state, -1, 0, "h"), false);
  assert.equal(canPlaceWall(state, 8, 0, "h"), false);
  assert.equal(canPlaceWall(state, 0, 8, "v"), false);

  // Zero walls left
  state.wallsLeft.X = 0;
  assert.equal(canPlaceWall(state, 1, 1, "h"), false);
  assert.equal(validateWallPlacement(state, 1, 1, "h").reason, "no_walls_left");
});

// =========================================================================
// 5. BFS Anti-Seal-Off Rule & Winding Detour Allowance
// =========================================================================

test("BFS Anti-Seal-Off: rejects wall trapping either player, allows winding detours", () => {
  // Trap O in top-center pocket (0,4)
  const state = createInitialState("X");
  state.walls.push(
    { row: 0, col: 3, orientation: "v" }, // blocks left of (0,4) and (1,4)
    { row: 0, col: 4, orientation: "v" }  // blocks right of (0,4) and (1,4)
  );
  // Adding horizontal wall at (1,3,"h") or (1,4,"h") seals O's last exit downward!
  const sealAttempt = validateWallPlacement(state, 1, 3, "h");
  assert.equal(sealAttempt.valid, false);
  assert.equal(sealAttempt.reason, "blocks_path");
  assert.equal(canPlaceWall(state, 1, 4, "h"), false);

  // Trap X in bottom-left 2-cell dead end {(8,0), (7,0)}
  const trapX = createInitialState("O");
  trapX.pawns.X = { row: 8, col: 0 };
  trapX.walls.push({ row: 7, col: 0, orientation: "v" }); // blocks (8,0)<->(8,1) and (7,0)<->(7,1)
  // Horizontal wall at (6,0,"h") blocks (7,0)<->(6,0), sealing X's only exit without crossing!
  assert.equal(canPlaceWall(trapX, 6, 0, "h"), false);
  assert.equal(validateWallPlacement(trapX, 6, 0, "h").reason, "blocks_path");

  // Long winding detour: walling almost all across row 4 leaving a single gap on col 8
  const detourState = createInitialState("X");
  detourState.walls.push(
    { row: 4, col: 0, orientation: "h" },
    { row: 4, col: 2, orientation: "h" },
    { row: 4, col: 4, orientation: "h" }
  );
  // Adding (4, 6, "h") leaves ONLY column 8 open (cols 0..7 blocked) — must be ALLOWED!
  assert.equal(canPlaceWall(detourState, 4, 6, "h"), true);
  const afterDetour = applyAction(detourState, {
    type: "PLACE_WALL",
    row: 4,
    col: 6,
    orientation: "h",
  });
  const pathX = getShortestPath(afterDetour.walls, afterDetour.pawns.X, GOAL_ROW.X);
  assert.ok(pathX !== null);
  assert.equal(getShortestPathLength(afterDetour.walls, afterDetour.pawns.X, GOAL_ROW.X), 12);
});

// =========================================================================
// 6. State Transitions, Immutability & Win Detection
// =========================================================================

test("Win Detection & Immutability: detects win on row 0 (X) and row 8 (O)", () => {
  // X wins by reaching row 0
  const stateX = createInitialState("X");
  stateX.pawns.X = { row: 1, col: 4 };
  stateX.pawns.O = { row: 0, col: 0 };
  const nextX = applyAction(stateX, { type: "MOVE_PAWN", row: 0, col: 4 });

  assert.equal(stateX.status, "playing", "Original state remains immutable");
  assert.equal(nextX.status, "finished");
  assert.equal(nextX.winner, "X");
  assert.equal(nextX.moveCount, 1);
  assert.deepEqual(nextX.lastAction, { type: "MOVE_PAWN", row: 0, col: 4 });

  // Further moves after game over are ignored
  const afterWin = applyAction(nextX, { type: "MOVE_PAWN", row: 1, col: 4 });
  assert.equal(afterWin, nextX);

  // X also wins via diagonal side-step onto row 0 when O sits at (0, 4)
  const diagWinState = createInitialState("X");
  diagWinState.pawns.X = { row: 1, col: 4 };
  diagWinState.pawns.O = { row: 0, col: 4 };
  const afterDiagWin = applyAction(diagWinState, { type: "MOVE_PAWN", row: 0, col: 3 });
  assert.equal(afterDiagWin.status, "finished");
  assert.equal(afterDiagWin.winner, "X");

  // O wins via straight jump over X onto row 8
  const stateO = createInitialState("O");
  stateO.pawns.O = { row: 6, col: 3 };
  stateO.pawns.X = { row: 7, col: 3 };
  const nextO = applyAction(stateO, { type: "MOVE_PAWN", row: 8, col: 3 });

  assert.equal(nextO.status, "finished");
  assert.equal(nextO.winner, "O");
  assert.deepEqual(nextO.pawns.O, { row: 8, col: 3 });
});

// =========================================================================
// 7. BFS-Powered Bot AI Tests (Easy, Medium, Hard)
// =========================================================================

function assertLegalAction(state, action) {
  assert.ok(action !== null, "Bot must return an action");
  if (action.type === "MOVE_PAWN") {
    const valid = getValidPawnMoves(state, state.currentPlayer);
    assert.ok(
      valid.some((m) => m.row === action.row && m.col === action.col),
      `Bot pawn move (${action.row},${action.col}) must be legal`
    );
  } else {
    assert.equal(action.type, "PLACE_WALL");
    assert.ok(
      canPlaceWall(state, action.row, action.col, action.orientation),
      `Bot wall (${action.row},${action.col},${action.orientation}) must be legal`
    );
  }
}

test("Bot AI: returns valid legal moves across easy, medium, and hard within <120ms", () => {
  const state = createInitialState("O");
  state.walls.push(
    { row: 2, col: 3, orientation: "h" },
    { row: 5, col: 4, orientation: "h" }
  );
  state.pawns.O = { row: 2, col: 4 };
  state.pawns.X = { row: 6, col: 4 };
  state.wallsLeft = { X: 9, O: 9 };

  for (let i = 0; i < 6; i++) {
    assertLegalAction(state, selectBotMove(state, "easy"));
  }
  assertLegalAction(state, selectBotMove(state, "medium"));

  const t0 = performance.now();
  const hardAction = selectBotMove(state, "hard");
  const elapsed = performance.now() - t0;
  assertLegalAction(state, hardAction);
  assert.ok(elapsed < 120, `Hard bot took ${elapsed.toFixed(1)}ms, must be < 120ms`);
});

test("Bot AI: immediately takes 1-move winning step on all difficulty tiers", () => {
  const winState = createInitialState("O");
  winState.pawns.O = { row: 7, col: 4 };
  winState.pawns.X = { row: 2, col: 4 };

  for (const diff of ["easy", "medium", "hard"]) {
    const action = selectBotMove(winState, diff);
    assert.deepEqual(action, { type: "MOVE_PAWN", row: 8, col: 4 });
  }

  // Also test winning by straight jump onto goal row
  const jumpWinState = createInitialState("O");
  jumpWinState.pawns.O = { row: 6, col: 4 };
  jumpWinState.pawns.X = { row: 7, col: 4 };
  for (const diff of ["easy", "medium", "hard"]) {
    const action = selectBotMove(jumpWinState, diff);
    assert.deepEqual(action, { type: "MOVE_PAWN", row: 8, col: 4 });
  }
});

test("Bot AI (Hard): blocks 1-move opponent win when possible and evaluates wins accurately", () => {
  const threatState = createInitialState("O");
  threatState.pawns.X = { row: 1, col: 4 }; // X threatens immediate win at (0,4)
  threatState.pawns.O = { row: 3, col: 4 }; // O cannot win in 1 move
  threatState.wallsLeft = { X: 5, O: 5 };

  const t0 = performance.now();
  const action = selectBotMove(threatState, "hard");
  const elapsed = performance.now() - t0;

  assert.ok(action !== null);
  assert.equal(action.type, "PLACE_WALL", "Hard bot must place a wall to block X's 1-move win");
  assertLegalAction(threatState, action);

  const afterBot = applyAction(threatState, action);
  const xImmediateWinAfter = getValidPawnMoves(afterBot, "X").some((m) => m.row === 0);
  assert.equal(xImmediateWinAfter, false, "Bot's wall must prevent X's 1-move win");
  assert.ok(elapsed < 120, `Hard bot defense took ${elapsed.toFixed(1)}ms, expected < 120ms`);

  // Evaluate board sanity check
  const finished = applyAction(
    { ...createInitialState("X"), pawns: { X: { row: 1, col: 4 }, O: { row: 0, col: 0 } } },
    { type: "MOVE_PAWN", row: 0, col: 4 }
  );
  assert.ok(evaluateBoard(finished, "X") >= 100000);
  assert.ok(evaluateBoard(finished, "O") <= -100000);
});
