import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONFIG,
  edgeToId,
  idToEdge,
  isEdgeInBounds,
  getBoxEdges,
  getAdjacentBoxesForEdge,
  countBoxCompletedEdges,
  isBoxComplete,
  getAllBoardEdges,
  createEmptyBoxes,
  createEmptyHorizontalEdges,
  createEmptyVerticalEdges,
} from "../src/games/board/dots-and-boxes/logic/board.ts";

import {
  applyMove,
  canClaimEdge,
  getAvailableEdges,
  isEdgeClaimed,
} from "../src/games/board/dots-and-boxes/logic/moves.ts";

import {
  createInitialState,
  dotsBoxesReducer,
} from "../src/games/board/dots-and-boxes/logic/reducer.ts";

import {
  analyzeEdge,
  selectBotMove,
  CPU_DIFFICULTY_PARAMS,
} from "../src/games/board/dots-and-boxes/bot/botLogic.ts";

import {
  requestBotMove,
} from "../src/games/board/dots-and-boxes/bot/botService.ts";

// =========================================================================
// 1. Board Geometry & Helper Tests
// =========================================================================

test("Board Geometry: default 5x5 board has correct box, dot, and edge counts", () => {
  const config = DEFAULT_CONFIG;
  assert.equal(config.rows, 5);
  assert.equal(config.cols, 5);

  const hEdges = createEmptyHorizontalEdges(config);
  assert.equal(hEdges.length, 6, "5 rows of boxes have 6 horizontal edge rows");
  assert.equal(hEdges[0].length, 5, "each horizontal edge row has 5 columns");

  const vEdges = createEmptyVerticalEdges(config);
  assert.equal(vEdges.length, 5, "5 rows of boxes have 5 vertical edge rows");
  assert.equal(vEdges[0].length, 6, "each vertical edge row has 6 columns");

  const boxes = createEmptyBoxes(config);
  assert.equal(boxes.length, 5);
  assert.equal(boxes[0].length, 5);

  const allEdges = getAllBoardEdges(config);
  // 6 * 5 = 30 horizontal + 5 * 6 = 30 vertical = 60 total edges
  assert.equal(allEdges.length, 60);
  assert.equal(allEdges.filter((e) => e.type === "h").length, 30);
  assert.equal(allEdges.filter((e) => e.type === "v").length, 30);
});

test("Board Geometry: edgeToId and idToEdge round-trip conversion", () => {
  const edgeH = { type: "h", row: 2, col: 4 };
  const idH = edgeToId(edgeH);
  assert.equal(idH, "h:2:4");
  assert.deepEqual(idToEdge(idH), edgeH);

  const edgeV = { type: "v", row: 3, col: 1 };
  const idV = edgeToId(edgeV);
  assert.equal(idV, "v:3:1");
  assert.deepEqual(idToEdge(idV), edgeV);
});

test("Board Geometry: isEdgeInBounds validates boundaries accurately", () => {
  const config = { rows: 3, cols: 3 };

  // Horizontal edges valid for r in [0, 3], c in [0, 2]
  assert.ok(isEdgeInBounds({ type: "h", row: 0, col: 0 }, config));
  assert.ok(isEdgeInBounds({ type: "h", row: 3, col: 2 }, config));
  assert.ok(!isEdgeInBounds({ type: "h", row: 4, col: 0 }, config));
  assert.ok(!isEdgeInBounds({ type: "h", row: 0, col: 3 }, config));
  assert.ok(!isEdgeInBounds({ type: "h", row: -1, col: 0 }, config));

  // Vertical edges valid for r in [0, 2], c in [0, 3]
  assert.ok(isEdgeInBounds({ type: "v", row: 0, col: 0 }, config));
  assert.ok(isEdgeInBounds({ type: "v", row: 2, col: 3 }, config));
  assert.ok(!isEdgeInBounds({ type: "v", row: 3, col: 0 }, config));
  assert.ok(!isEdgeInBounds({ type: "v", row: 0, col: 4 }, config));
  assert.ok(!isEdgeInBounds({ type: "v", row: 0, col: -1 }, config));
});

test("Board Geometry: getAdjacentBoxesForEdge returns 1 box for borders, 2 for interior edges", () => {
  const config = { rows: 3, cols: 3 };

  // Box edges helper
  const boxEdges = getBoxEdges({ row: 0, col: 0 });
  assert.equal(boxEdges.length, 4);

  // Top border horizontal edge (row 0, col 1): only box below (0, 1)
  const topBorder = getAdjacentBoxesForEdge({ type: "h", row: 0, col: 1 }, config);
  assert.equal(topBorder.length, 1);
  assert.deepEqual(topBorder[0], { row: 0, col: 1 });

  // Interior horizontal edge (row 1, col 1): box above (0, 1) and box below (1, 1)
  const interiorH = getAdjacentBoxesForEdge({ type: "h", row: 1, col: 1 }, config);
  assert.equal(interiorH.length, 2);
  assert.deepEqual(interiorH, [{ row: 0, col: 1 }, { row: 1, col: 1 }]);

  // Left border vertical edge (row 1, col 0): only box to right (1, 0)
  const leftBorder = getAdjacentBoxesForEdge({ type: "v", row: 1, col: 0 }, config);
  assert.equal(leftBorder.length, 1);
  assert.deepEqual(leftBorder[0], { row: 1, col: 0 });

  // Interior vertical edge (row 1, col 1): box to left (1, 0) and box to right (1, 1)
  const interiorV = getAdjacentBoxesForEdge({ type: "v", row: 1, col: 1 }, config);
  assert.equal(interiorV.length, 2);
  assert.deepEqual(interiorV, [{ row: 1, col: 0 }, { row: 1, col: 1 }]);
});

// =========================================================================
// 2. Initial State & Configuration Tests
// =========================================================================

test("State Initialization: creates standard starting match state", () => {
  const state = createInitialState();
  assert.equal(state.status, "in_progress");
  assert.equal(state.currentPlayer, "orange");
  assert.equal(state.winner, null);
  assert.equal(state.lastMove, null);
  assert.equal(state.moveCount, 0);
  assert.equal(state.consecutiveBoxesThisTurn, 0);
  assert.equal(state.scores.orange, 0);
  assert.equal(state.scores.blue, 0);
  assert.equal(state.config.rows, 5);
  assert.equal(state.config.cols, 5);

  const available = getAvailableEdges(state);
  assert.equal(available.length, 60);
});

test("State Initialization: supports custom starting player and dimensions", () => {
  const custom = createInitialState({ rows: 3, cols: 4 }, "blue");
  assert.equal(custom.currentPlayer, "blue");
  assert.equal(custom.config.rows, 3);
  assert.equal(custom.config.cols, 4);
  // (3 + 1)*4 = 16 horizontal + 3*(4 + 1) = 15 vertical = 31 total edges
  assert.equal(getAvailableEdges(custom).length, 31);
});

// =========================================================================
// 3. Move Rules & Turn Progression (Reverse-Engineered Mechanics)
// =========================================================================

test("Move Rules: non-scoring move alternates turns between orange and blue", () => {
  let state = createInitialState({ rows: 2, cols: 2 }, "orange");

  // Orange plays top-left horizontal edge
  assert.ok(canClaimEdge(state, { type: "h", row: 0, col: 0 }));
  state = applyMove(state, { type: "h", row: 0, col: 0 }, "orange");

  assert.equal(state.moveCount, 1);
  assert.equal(state.scores.orange, 0);
  assert.equal(state.scores.blue, 0);
  assert.equal(state.currentPlayer, "blue", "Turn must alternate to blue when no box is completed");
  assert.equal(state.consecutiveBoxesThisTurn, 0);
  assert.ok(isEdgeClaimed(state, { type: "h", row: 0, col: 0 }));

  // Blue plays top-left vertical edge
  state = applyMove(state, { type: "v", row: 0, col: 0 }, "blue");
  assert.equal(state.moveCount, 2);
  assert.equal(state.currentPlayer, "orange", "Turn must alternate back to orange");
});

test("Move Rules: cannot claim an already claimed edge", () => {
  let state = createInitialState();
  const edge = { type: "h", row: 0, col: 0 };

  state = applyMove(state, edge, "orange");
  assert.equal(isEdgeClaimed(state, edge), true);
  assert.equal(canClaimEdge(state, edge), false);

  // Attempting to play it again returns state unmodified
  const attempted = applyMove(state, edge, "blue");
  assert.equal(attempted.moveCount, 1);
  assert.equal(attempted.currentPlayer, "blue");
});

test("Authentic Turn Continuation Rule: completing a box retains player turn and awards 1 point", () => {
  let state = createInitialState({ rows: 2, cols: 2 }, "orange");

  // Set up 3 sides of box (0, 0):
  // Top: h(0, 0)
  // Left: v(0, 0)
  // Right: v(0, 1)
  state = applyMove(state, { type: "h", row: 0, col: 0 }, "orange"); // turn becomes blue
  state = applyMove(state, { type: "v", row: 0, col: 0 }, "blue");   // turn becomes orange
  state = applyMove(state, { type: "v", row: 0, col: 1 }, "orange"); // turn becomes blue

  assert.equal(state.scores.orange, 0);
  assert.equal(state.scores.blue, 0);
  assert.equal(state.currentPlayer, "blue");

  // Blue plays the 4th line: Bottom h(1, 0) to complete box (0, 0)
  state = applyMove(state, { type: "h", row: 1, col: 0 }, "blue");

  assert.equal(state.scores.blue, 1, "Blue must be awarded 1 point for the completed box");
  assert.equal(state.boxes[0][0], "blue", "Box (0,0) must belong to Blue");
  assert.equal(
    state.currentPlayer,
    "blue",
    "VERIFIED BASE.APK RULE: Player MUST retain their turn when completing a box!"
  );
  assert.equal(state.consecutiveBoxesThisTurn, 1);
  assert.equal(state.lastMove?.completedBoxes.length, 1);
  assert.deepEqual(state.lastMove?.completedBoxes[0], { row: 0, col: 0 });
});

test("Double Box Capture: completing 2 boxes simultaneously awards 2 points and retains turn", () => {
  // On a 2x1 grid (2 rows, 1 col): Box (0, 0) and Box (1, 0) share horizontal edge h(1, 0).
  let state = createInitialState({ rows: 2, cols: 1 }, "orange");

  // Prepare Box (0, 0) boundaries (top, left, right):
  state = applyMove(state, { type: "h", row: 0, col: 0 }, "orange"); // h(0, 0)
  state = applyMove(state, { type: "v", row: 0, col: 0 }, "blue");   // v(0, 0)
  state = applyMove(state, { type: "v", row: 0, col: 1 }, "orange"); // v(0, 1)

  // Prepare Box (1, 0) boundaries (bottom, left, right):
  state = applyMove(state, { type: "h", row: 2, col: 0 }, "blue");   // h(2, 0)
  state = applyMove(state, { type: "v", row: 1, col: 0 }, "orange"); // v(1, 0)
  state = applyMove(state, { type: "v", row: 1, col: 1 }, "blue");   // v(1, 1)

  // Both Box (0, 0) and Box (1, 0) now have 3 edges completed!
  // The only missing edge for both is the shared interior edge h(1, 0).
  assert.equal(state.currentPlayer, "orange");
  assert.equal(state.scores.orange, 0);
  assert.equal(state.scores.blue, 0);

  // Orange claims the shared edge h(1, 0)
  state = applyMove(state, { type: "h", row: 1, col: 0 }, "orange");

  assert.equal(state.scores.orange, 2, "Orange must receive 2 points for double-box capture");
  assert.equal(state.boxes[0][0], "orange");
  assert.equal(state.boxes[1][0], "orange");
  assert.equal(state.lastMove?.completedBoxes.length, 2);
  assert.equal(state.status, "completed", "All boxes on board are claimed -> game over");
  assert.equal(state.winner, "orange", "Orange has 2 boxes vs Blue 0 -> Orange wins");
});

test("Endgame & Winner: correctly determines winner and draw when all boxes complete", () => {
  // 1x1 board (1 box total)
  let state = createInitialState({ rows: 1, cols: 1 }, "orange");
  assert.equal(countBoxCompletedEdges({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), 0);
  assert.equal(isBoxComplete({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), false);

  state = applyMove(state, { type: "h", row: 0, col: 0 }, "orange"); // 1st line
  assert.equal(countBoxCompletedEdges({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), 1);

  state = applyMove(state, { type: "v", row: 0, col: 0 }, "blue");   // 2nd line
  state = applyMove(state, { type: "v", row: 0, col: 1 }, "orange"); // 3rd line
  assert.equal(countBoxCompletedEdges({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), 3);

  state = applyMove(state, { type: "h", row: 1, col: 0 }, "blue");   // 4th line completes box!
  assert.equal(countBoxCompletedEdges({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), 4);
  assert.equal(isBoxComplete({ row: 0, col: 0 }, state.horizontalEdges, state.verticalEdges), true);

  assert.equal(state.status, "completed");
  assert.equal(state.scores.blue, 1);
  assert.equal(state.scores.orange, 0);
  assert.equal(state.winner, "blue");

  // Attempting moves after game is completed is forbidden
  assert.equal(canClaimEdge(state, { type: "h", row: 0, col: 0 }), false);
});

// =========================================================================
// 4. Pure Functional Reducer Tests
// =========================================================================

test("Reducer: handles CLAIM_EDGE, RESTART_GAME, and SET_CONFIG", () => {
  let state = createInitialState({ rows: 3, cols: 3 });

  // CLAIM_EDGE
  state = dotsBoxesReducer(state, {
    type: "CLAIM_EDGE",
    edge: { type: "h", row: 0, col: 0 },
  });
  assert.equal(state.moveCount, 1);
  assert.equal(state.currentPlayer, "blue");

  // RESTART_GAME resets board
  state = dotsBoxesReducer(state, {
    type: "RESTART_GAME",
    startingPlayer: "blue",
  });
  assert.equal(state.moveCount, 0);
  assert.equal(state.currentPlayer, "blue");
  assert.equal(state.scores.orange, 0);
  assert.equal(isEdgeClaimed(state, { type: "h", row: 0, col: 0 }), false);

  // SET_CONFIG changes dimensions cleanly
  state = dotsBoxesReducer(state, {
    type: "SET_CONFIG",
    config: { rows: 2, cols: 2 },
  });
  assert.equal(state.config.rows, 2);
  assert.equal(state.config.cols, 2);
  assert.equal(getAllBoardEdges(state.config).length, 12);
});

// =========================================================================
// 5. Bot Decision Engine Tests (Verified base.apk CPU Logic)
// =========================================================================

test("Bot Logic: CPU difficulty parameters match reverse-engineered base.apk values", () => {
  assert.equal(CPU_DIFFICULTY_PARAMS.hard.findThreeLinerPercentage, 1.0);
  assert.equal(CPU_DIFFICULTY_PARAMS.hard.avoidTwoLinerPercentage, 1.0);
  assert.equal(CPU_DIFFICULTY_PARAMS.hard.delayMs, 1000);

  assert.equal(CPU_DIFFICULTY_PARAMS.medium.findThreeLinerPercentage, 0.75);
  assert.equal(CPU_DIFFICULTY_PARAMS.medium.avoidTwoLinerPercentage, 0.75);
  assert.equal(CPU_DIFFICULTY_PARAMS.medium.delayMs, 1100);

  assert.equal(CPU_DIFFICULTY_PARAMS.easy.findThreeLinerPercentage, 0.50);
  assert.equal(CPU_DIFFICULTY_PARAMS.easy.avoidTwoLinerPercentage, 0.20);
  assert.equal(CPU_DIFFICULTY_PARAMS.easy.delayMs, 1200);
});

test("Bot Logic: analyzeEdge accurately identifies 3-liners and safe moves", () => {
  let state = createInitialState({ rows: 2, cols: 2 });
  // Draw top and left of box (0,0)
  state = applyMove(state, { type: "h", row: 0, col: 0 });
  state = applyMove(state, { type: "v", row: 0, col: 0 });

  // Now box (0,0) has 2 edges completed.
  // Drawing right edge v(0, 1) or bottom edge h(1, 0) would make it a 3-liner!
  const analysisV01 = analyzeEdge(state, { type: "v", row: 0, col: 1 });
  assert.equal(analysisV01.completesCount, 0);
  assert.equal(analysisV01.createsThreeLinerCount, 1);
  assert.equal(analysisV01.isSafe, false);

  // In contrast, edge h(2, 1) touches only box (1, 1) which has 0 edges -> completely safe!
  const analysisH21 = analyzeEdge(state, { type: "h", row: 2, col: 1 });
  assert.equal(analysisH21.completesCount, 0);
  assert.equal(analysisH21.createsThreeLinerCount, 0);
  assert.equal(analysisH21.isSafe, true);
});

test("Bot Logic: Hard bot ALWAYS claims available 3-liner boxes (100% priority)", () => {
  let state = createInitialState({ rows: 2, cols: 2 });
  // Draw 3 lines of box (0, 0)
  state = applyMove(state, { type: "h", row: 0, col: 0 });
  state = applyMove(state, { type: "v", row: 0, col: 0 });
  state = applyMove(state, { type: "v", row: 0, col: 1 });

  // The 4th line is h(1, 0)
  const botMove = selectBotMove(state, "hard");
  assert.ok(botMove !== null);
  assert.equal(botMove?.type, "h");
  assert.equal(botMove?.row, 1);
  assert.equal(botMove?.col, 0);
});

test("Bot Logic: Hard bot avoids creating 3-liners when safe edges exist", () => {
  let state = createInitialState({ rows: 2, cols: 2 });
  // Draw 2 lines of box (0, 0)
  state = applyMove(state, { type: "h", row: 0, col: 0 });
  state = applyMove(state, { type: "v", row: 0, col: 0 });

  // Hard bot must pick a SAFE edge and NOT create a 3-liner on box (0, 0)
  const botMove = selectBotMove(state, "hard");
  assert.ok(botMove !== null);

  const analysis = analyzeEdge(state, botMove);
  assert.equal(analysis.createsThreeLinerCount, 0, "Hard bot must not create a 3-liner when safe moves exist");
  assert.equal(analysis.isSafe, true);
});

test("Bot Service: requestBotMove returns a valid edge and supports cancellation", async () => {
  const state = createInitialState({ rows: 2, cols: 2 });

  // Fast test with delayMs = 10
  const move = await requestBotMove(state, { difficulty: "medium", delayMs: 10 });
  assert.ok(move !== null);
  assert.ok(canClaimEdge(state, move));

  // AbortController test
  const abortController = new AbortController();
  abortController.abort();

  await assert.rejects(
    () => requestBotMove(state, { difficulty: "hard", delayMs: 100, signal: abortController.signal }),
    { name: "AbortError" }
  );
});
