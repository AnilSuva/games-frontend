import { EXTRA_SPIN_TURNS, MAX_PARTICIPANTS, MIN_SPIN_TURNS } from "../config";
import type { Participant, SpinPlan } from "../types";
import { normalizeDegrees } from "./wheelGeometry";
import { secureRandomIndex, secureUint32, selectRandomWinner } from "./winnerSelection";

/**
 * Returns the cumulative wheel rotation in degrees that centers the winning segment
 * directly under the top pointer (at 0° / 360°), adding full rotations for spin drama.
 */
export function calculateTargetRotation(
  currentRotation: number,
  winnerIndex: number,
  participantCount: number,
  fullTurns: number
): number {
  if (
    !Number.isInteger(participantCount) ||
    participantCount < 1 ||
    participantCount > MAX_PARTICIPANTS
  ) {
    throw new RangeError("Invalid participant count.");
  }
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= participantCount) {
    throw new RangeError("Invalid winner index.");
  }
  if (!Number.isInteger(fullTurns) || fullTurns < 1) {
    throw new RangeError("At least one full rotation is required.");
  }

  const segmentSize = 360 / participantCount;
  const winnerCenter = (winnerIndex + 0.5) * segmentSize;
  const desiredRotation = normalizeDegrees(360 - winnerCenter);
  const rotationOffset = normalizeDegrees(desiredRotation - normalizeDegrees(currentRotation));
  return currentRotation + fullTurns * 360 + rotationOffset;
}

/**
 * Determines which segment index is currently positioned under the top pointer
 * given the wheel's current rotation in degrees.
 */
export function getSegmentAtPointer(rotation: number, participantCount: number): number {
  if (
    !Number.isInteger(participantCount) ||
    participantCount < 1 ||
    participantCount > MAX_PARTICIPANTS
  ) {
    throw new RangeError("Invalid participant count.");
  }
  const pointerAngle = normalizeDegrees(360 - normalizeDegrees(rotation));
  return Math.floor(pointerAngle / (360 / participantCount)) % participantCount;
}

/**
 * Creates a complete spin plan by selecting an unbiased random winner
 * and calculating the necessary landing rotation.
 */
export function createSpinPlan(
  participants: Participant[],
  currentRotation: number,
  randomUint32: () => number = secureUint32
): SpinPlan | null {
  const selection = selectRandomWinner(participants, randomUint32);
  if (!selection) return null;

  const fullTurns = MIN_SPIN_TURNS + secureRandomIndex(EXTRA_SPIN_TURNS, randomUint32);
  const targetRotation = calculateTargetRotation(
    currentRotation,
    selection.winnerIndex,
    participants.length,
    fullTurns
  );

  return {
    winner: selection.winner,
    winnerIndex: selection.winnerIndex,
    targetRotation,
  };
}

/**
 * Validates spin state and generates a new spin plan if a spin is permitted.
 */
export function requestSpin(
  isSpinning: boolean,
  participants: Participant[],
  currentRotation: number,
  randomUint32: () => number = secureUint32
): SpinPlan | null {
  return isSpinning ? null : createSpinPlan(participants, currentRotation, randomUint32);
}

/**
 * Extracts the winning participant upon spin completion.
 */
export function completeSpin(plan: SpinPlan | null): Participant | null {
  return plan?.winner ?? null;
}
