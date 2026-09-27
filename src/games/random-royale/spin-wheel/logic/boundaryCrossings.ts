/** Counts forward segment boundaries crossed between two cumulative wheel angles. */
export function countSegmentBoundaryCrossings(
  previousRotation: number,
  currentRotation: number,
  participantCount: number
): number {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new RangeError("Participant count must be a positive integer.");
  }
  if (!Number.isFinite(previousRotation) || !Number.isFinite(currentRotation)) {
    throw new RangeError("Wheel rotations must be finite numbers.");
  }
  if (currentRotation <= previousRotation) return 0;

  const segmentAngle = 360 / participantCount;
  const previousBoundary = Math.floor(previousRotation / segmentAngle);
  const currentBoundary = Math.floor(currentRotation / segmentAngle);
  return Math.max(0, currentBoundary - previousBoundary);
}

/** Returns the next tick number in the repeating 1–7 sound sequence. */
export function nextSpinTickNumber(current: number): number {
  if (!Number.isInteger(current) || current < 1 || current > 7) {
    throw new RangeError("Spin tick number must be between 1 and 7.");
  }
  return (current % 7) + 1;
}
