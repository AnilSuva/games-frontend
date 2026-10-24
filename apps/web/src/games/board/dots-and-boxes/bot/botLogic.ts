/**
 * Dots and Boxes Bot Decision Logic
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES - DotsBoxesCPU)
 *
 * Parameters directly extracted from base.apk:
 * - findThreeLinerPercentage: Hard 1.0, Medium/Normal 0.75, Easy 0.50
 * - avoidTwoLinerPercentage: Hard 1.0, Medium/Normal 0.75, Easy 0.20
 * - delayToStartTurn: Hard 1000ms, Medium/Normal 1100ms, Easy 1200ms
 */

import {
  countBoxCompletedEdges,
  getAdjacentBoxesForEdge,
} from "../logic/board";
import { getAvailableEdges } from "../logic/moves";
import type { DotsBoxesState, Edge } from "../logic/types";

export type BotDifficulty = "easy" | "medium" | "hard";

export interface CpuParameters {
  findThreeLinerPercentage: number;
  avoidTwoLinerPercentage: number;
  delayMs: number;
}

export const CPU_DIFFICULTY_PARAMS: Record<BotDifficulty, CpuParameters> = {
  easy: {
    findThreeLinerPercentage: 0.5,
    avoidTwoLinerPercentage: 0.2,
    delayMs: 1200,
  },
  medium: {
    findThreeLinerPercentage: 0.75,
    avoidTwoLinerPercentage: 0.75,
    delayMs: 1100,
  },
  hard: {
    findThreeLinerPercentage: 1.0,
    avoidTwoLinerPercentage: 1.0,
    delayMs: 1000,
  },
};

/**
 * Categorizes an edge based on how many edges each of its adjacent boxes currently has.
 */
export interface EdgeAnalysis {
  edge: Edge;
  completesCount: number; // Number of boxes that drawing this edge will complete (0, 1, or 2)
  createsThreeLinerCount: number; // Number of boxes that currently have 2 lines and would become 3-liners
  isSafe: boolean; // True if drawing this edge does NOT leave any box with 3 lines
}

export function analyzeEdge(state: DotsBoxesState, edge: Edge): EdgeAnalysis {
  const adjacentBoxes = getAdjacentBoxesForEdge(edge, state.config);
  let completesCount = 0;
  let createsThreeLinerCount = 0;

  for (const box of adjacentBoxes) {
    // Only consider boxes not already claimed
    if (state.boxes[box.row][box.col] === null) {
      const drawn = countBoxCompletedEdges(
        box,
        state.horizontalEdges,
        state.verticalEdges
      );
      if (drawn === 3) {
        completesCount++;
      } else if (drawn === 2) {
        createsThreeLinerCount++;
      }
    }
  }

  return {
    edge,
    completesCount,
    createsThreeLinerCount,
    isSafe: createsThreeLinerCount === 0 && completesCount === 0,
  };
}

/**
 * Selects an edge to play according to the reverse-engineered CPU logic from 57_DOTSBOXES:
 * 1. Look for boxes with 3 lines completed (3-liner).
 *    If available, complete with probability `findThreeLinerPercentage`.
 * 2. If not claiming a box, try to avoid playing into a box with 2 lines completed (2-liner avoidance).
 *    With probability `avoidTwoLinerPercentage`, filter to safe edges that won't give away boxes.
 * 3. Fallback: if no safe edges exist, select an edge minimizing giveaways on Hard or random on Easy/Medium.
 */
export function selectBotMove(
  state: DotsBoxesState,
  difficulty: BotDifficulty = "medium",
  random: () => number = Math.random
): Edge | null {
  const availableEdges = getAvailableEdges(state);
  if (availableEdges.length === 0) {
    return null;
  }

  const params = CPU_DIFFICULTY_PARAMS[difficulty];
  const analyzed = availableEdges.map((edge) => analyzeEdge(state, edge));

  // --- Step 1: Find 3-liner (claim completed boxes) ---
  const boxCompletingEdges = analyzed.filter((a) => a.completesCount > 0);

  if (boxCompletingEdges.length > 0) {
    const shouldTake = random() < params.findThreeLinerPercentage;
    if (shouldTake) {
      // Prioritize edges completing 2 boxes at once if any
      const doubleCompletes = boxCompletingEdges.filter(
        (a) => a.completesCount === 2
      );
      if (doubleCompletes.length > 0) {
        const choice =
          doubleCompletes[Math.floor(random() * doubleCompletes.length)];
        return choice.edge;
      }
      const choice =
        boxCompletingEdges[Math.floor(random() * boxCompletingEdges.length)];
      return choice.edge;
    }
  }

  // --- Step 2: Avoid 2-liner (play safe edges) ---
  const safeEdges = analyzed.filter(
    (a) => a.completesCount === 0 && a.createsThreeLinerCount === 0
  );

  if (safeEdges.length > 0) {
    const shouldAvoid = random() < params.avoidTwoLinerPercentage;
    if (shouldAvoid) {
      const choice = safeEdges[Math.floor(random() * safeEdges.length)];
      return choice.edge;
    }
  }

  // --- Step 3: Sacrifice / Fallback moves ---
  // When no safe moves exist (or avoidance roll failed), we must play an edge.
  // On hard difficulty, pick the edge that gives away the fewest 3-liners.
  if (difficulty === "hard") {
    // If completing edges exist and we didn't take them due to roll (which is 0% on hard anyway), take it
    if (boxCompletingEdges.length > 0) {
      return boxCompletingEdges[0].edge;
    }

    // Sort by fewest 3-liners created
    const sorted = [...analyzed].sort(
      (a, b) => a.createsThreeLinerCount - b.createsThreeLinerCount
    );
    const minSacrifice = sorted[0].createsThreeLinerCount;
    const bestCandidates = sorted.filter(
      (a) => a.createsThreeLinerCount === minSacrifice
    );
    const choice =
      bestCandidates[Math.floor(random() * bestCandidates.length)];
    return choice.edge;
  }

  // On easy or medium, pick randomly among available edges
  const choice =
    availableEdges[Math.floor(random() * availableEdges.length)];
  return choice;
}
