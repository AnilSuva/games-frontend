import { MAX_PARTICIPANTS } from "../config";
import type { Participant } from "../types";

/**
 * Normalizes a participant name by trimming leading/trailing whitespace
 * and collapsing multiple contiguous spaces into a single space.
 */
export function normalizeParticipantName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Adds a new participant to the list if valid and within limits.
 * Returns null if the name is invalid, the ID is empty, or the maximum participant limit is reached.
 */
export function addParticipant(
  participants: Participant[],
  name: string,
  id: string
): Participant[] | null {
  const normalized = normalizeParticipantName(name);
  if (!normalized || participants.length >= MAX_PARTICIPANTS || !id) {
    return null;
  }
  return [...participants, { id, name: normalized }];
}

/**
 * Removes a participant by their unique ID.
 */
export function removeParticipant(
  participants: Participant[],
  id: string
): Participant[] {
  return participants.filter((participant) => participant.id !== id);
}

/**
 * Clears all participants and returns an empty list.
 */
export function clearParticipants(): Participant[] {
  return [];
}
