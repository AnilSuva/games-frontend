import { MAX_PARTICIPANTS } from "../config";
import type { Participant } from "../types";

/**
 * Generates a cryptographically strong pseudo-random 32-bit unsigned integer.
 */
export function secureUint32(): number {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0];
}

/**
 * Rejection sampling maps secure 32-bit values to indices without modulo bias.
 * Ensures an evenly distributed, cryptographically fair selection across all participants.
 */
export function secureRandomIndex(
  count: number,
  nextUint32: () => number = secureUint32
): number {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTICIPANTS) {
    throw new RangeError(`Participant count must be between 1 and ${MAX_PARTICIPANTS}.`);
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % count);

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const value = nextUint32();
    if (Number.isInteger(value) && value >= 0 && value < range && value < limit) {
      return value % count;
    }
  }

  throw new Error("The random source did not return a usable value.");
}

/**
 * Selects a random winner from the list of participants using secure rejection sampling.
 * Returns null if the participant list is empty.
 */
export function selectRandomWinner(
  participants: Participant[],
  nextUint32: () => number = secureUint32
): { winner: Participant; winnerIndex: number } | null {
  if (participants.length === 0) return null;
  const winnerIndex = secureRandomIndex(participants.length, nextUint32);
  return {
    winner: participants[winnerIndex],
    winnerIndex,
  };
}
