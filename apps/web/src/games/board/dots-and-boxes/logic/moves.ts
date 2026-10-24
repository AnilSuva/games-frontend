/**
 * Dots and Boxes Move Logic & Rule Resolution
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES)
 */

import {
  edgeToId,
  getAdjacentBoxesForEdge,
  getEdgeOwner,
  isBoxComplete,
  isEdgeInBounds,
  getAllBoardEdges,
} from "./board";
import type {
  BoxCoord,
  DotsBoxesState,
  Edge,
  PlatformPlayer,
} from "./types";

/**
 * Checks whether an edge is already claimed in the game state.
 */
export function isEdgeClaimed(state: DotsBoxesState, edge: Edge): boolean {
  return getEdgeOwner(edge, state.horizontalEdges, state.verticalEdges) !== null;
}

/**
 * Determines whether a player can legally claim the given edge.
 */
export function canClaimEdge(
  state: DotsBoxesState,
  edge: Edge,
  player?: PlatformPlayer
): boolean {
  if (state.status === "completed") {
    return false;
  }
  if (player && state.currentPlayer !== player) {
    return false;
  }
  if (!isEdgeInBounds(edge, state.config)) {
    return false;
  }
  return !isEdgeClaimed(state, edge);
}

export interface MoveResult {
  nextState: DotsBoxesState;
  completedBoxes: BoxCoord[];
  turnKept: boolean;
}

/**
 * Applies a move according to authentic Two Player Games Challenge rules:
 * - Claim the uncompleted edge for the moving player.
 * - Detect newly completed boxes (up to 2 boxes per move).
 * - Award 1 point per completed box to the active player.
 * - If at least one box was completed, the active player keeps their turn!
 * - If no box was completed, turn passes to the opposing player.
 * - When all boxes are claimed, determines the winner or draw.
 */
export function applyMove(
  state: DotsBoxesState,
  edge: Edge,
  player: PlatformPlayer = state.currentPlayer
): DotsBoxesState {
  if (!canClaimEdge(state, edge, player)) {
    return state;
  }

  // Clone grids immutably
  const nextHorizontal = state.horizontalEdges.map((row) => [...row]);
  const nextVertical = state.verticalEdges.map((row) => [...row]);
  const nextBoxes = state.boxes.map((row) => [...row]);
  const nextScores: Record<PlatformPlayer, number> = { ...state.scores };

  // 1. Claim the edge
  if (edge.type === "h") {
    nextHorizontal[edge.row][edge.col] = player;
  } else {
    nextVertical[edge.row][edge.col] = player;
  }

  // 2. Check for newly completed boxes
  const adjacentBoxes = getAdjacentBoxesForEdge(edge, state.config);
  const newlyCompletedBoxes: BoxCoord[] = [];

  for (const box of adjacentBoxes) {
    // Only boxes that weren't completed before
    if (state.boxes[box.row][box.col] === null) {
      if (isBoxComplete(box, nextHorizontal, nextVertical)) {
        nextBoxes[box.row][box.col] = player;
        nextScores[player] += 1;
        newlyCompletedBoxes.push(box);
      }
    }
  }

  // 3. Turn Progression (AUTHENTIC RULE)
  // If player completed at least one box, they KEEP their turn!
  // Otherwise, the turn alternates to the other player.
  let nextPlayer: PlatformPlayer;
  let consecutiveBoxesThisTurn = 0;

  if (newlyCompletedBoxes.length > 0) {
    nextPlayer = player;
    consecutiveBoxesThisTurn =
      state.consecutiveBoxesThisTurn + newlyCompletedBoxes.length;
  } else {
    nextPlayer = player === "orange" ? "blue" : "orange";
    consecutiveBoxesThisTurn = 0;
  }

  // 4. Endgame check
  const totalBoxes = state.config.rows * state.config.cols;
  const totalScored = nextScores.orange + nextScores.blue;
  const isComplete = totalScored >= totalBoxes;

  let winner: PlatformPlayer | "draw" | null = null;
  let status = state.status;

  if (isComplete) {
    status = "completed";
    if (nextScores.orange > nextScores.blue) {
      winner = "orange";
    } else if (nextScores.blue > nextScores.orange) {
      winner = "blue";
    } else {
      winner = "draw";
    }
  } else if (state.status === "waiting") {
    status = "in_progress";
  }

  return {
    config: state.config,
    horizontalEdges: nextHorizontal,
    verticalEdges: nextVertical,
    boxes: nextBoxes,
    scores: nextScores,
    currentPlayer: nextPlayer,
    status,
    winner,
    lastMove: {
      edge,
      edgeId: edgeToId(edge),
      player,
      completedBoxes: newlyCompletedBoxes,
    },
    moveCount: state.moveCount + 1,
    consecutiveBoxesThisTurn,
  };
}

/**
 * Returns all currently uncompleted edges available on the board.
 */
export function getAvailableEdges(state: DotsBoxesState): Edge[] {
  const allEdges = getAllBoardEdges(state.config);
  return allEdges.filter((edge) => !isEdgeClaimed(state, edge));
}
