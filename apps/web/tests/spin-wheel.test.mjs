import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PARTICIPANTS,
  addParticipant,
  calculateTargetRotation,
  clearParticipants,
  completeSpin,
  createSpinPlan,
  getSegmentAtPointer,
  normalizeParticipantName,
  removeParticipant,
  requestSpin,
  secureRandomIndex,
} from "../src/games/random-royale/spin-wheel/logic/spinWheel.ts";

const participant = (id, name) => ({ id, name });

test("participant add trims whitespace and rejects empty values", () => {
  const first = addParticipant([], "  Asha   Rao ", "one");
  assert.deepEqual(first, [participant("one", "Asha Rao")]);
  assert.equal(normalizeParticipantName(" \t \n "), "");
  assert.equal(addParticipant([], "  ", "empty"), null);
});

test("duplicate names are retained as independent participants", () => {
  const first = addParticipant([], "Sam", "one");
  const second = addParticipant(first, "Sam", "two");
  assert.deepEqual(second, [participant("one", "Sam"), participant("two", "Sam")]);
  assert.deepEqual(removeParticipant(second, "one"), [participant("two", "Sam")]);
});

test("participant limit prevents exceeding 200 entries", () => {
  const full = Array.from({ length: MAX_PARTICIPANTS }, (_, index) => participant(`${index}`, `Name ${index}`));
  assert.equal(addParticipant(full, "One more", "extra"), null);
  assert.equal(full.length, 200);
});

test("clear all returns an empty list", () => {
  assert.deepEqual(clearParticipants(), []);
});

test("random index covers each eligible entry and rejects modulo overflow", () => {
  for (let index = 0; index < 7; index += 1) {
    assert.equal(secureRandomIndex(7, () => index), index);
  }
  const values = [0xffff_ffff, 2];
  assert.equal(secureRandomIndex(3, () => values.shift()), 2);
});

test("winner selection uses participant entries, including identical names", () => {
  const entries = [participant("a", "Alex"), participant("b", "Alex"), participant("c", "Jo")];
  const plan = createSpinPlan(entries, 0, () => 1);
  assert.equal(plan.winner.id, "b");
  assert.equal(plan.winner.name, "Alex");
});

test("no winner is selected for zero participants and one participant remains selectable", () => {
  assert.equal(createSpinPlan([], 0, () => 0), null);
  const only = participant("solo", "Only player");
  assert.equal(createSpinPlan([only], 0, () => 0).winner, only);
});

test("large supported participant lists remain valid", () => {
  const entries = Array.from({ length: MAX_PARTICIPANTS }, (_, index) => participant(`${index}`, `Player ${index}`));
  const plan = createSpinPlan(entries, 0, () => 199);
  assert.equal(plan.winner.id, "199");
  assert.equal(getSegmentAtPointer(plan.targetRotation, entries.length), plan.winnerIndex);
});

test("target rotation lands the selected segment under the pointer", () => {
  for (const count of [1, 2, 3, 7, 100, 200]) {
    for (let index = 0; index < count; index += Math.max(1, Math.floor(count / 9))) {
      const target = calculateTargetRotation(271.25, index, count, 6);
      assert.equal(getSegmentAtPointer(target, count), index);
    }
  }
});

test("spin velocity launches early and then gradually decays to an exact settle", async () => {
  const { createSpinMotion } = await import(
    "../src/games/random-royale/spin-wheel/logic/spinMotion.ts"
  );
  const { SPIN_MOTION_CONFIG } = await import(
    "../src/games/random-royale/spin-wheel/config.ts"
  );
  const duration = 12_000;
  const motion = createSpinMotion(duration);
  const peakTime =
    (SPIN_MOTION_CONFIG.accelerationMs + SPIN_MOTION_CONFIG.peakHoldMs) / duration;
  const positions = Array.from({ length: 101 }, (_, index) => motion.positionAt(index / 100));
  assert.equal(motion.positionAt(0), 0);
  assert.equal(motion.positionAt(1), 1);
  assert.ok(positions.every((position, index) => index === 0 || position >= positions[index - 1]));

  assert.equal(motion.normalizedVelocityAt(0), 0);
  assert.ok(motion.normalizedVelocityAt(0.11) > 0.9);
  assert.equal(motion.normalizedVelocityAt(peakTime), 1);
  assert.ok(motion.normalizedVelocityAt(0.3) < motion.normalizedVelocityAt(peakTime));
  assert.ok(motion.normalizedVelocityAt(0.7) < motion.normalizedVelocityAt(0.3));
  assert.ok(motion.normalizedVelocityAt(0.99) < 0.001);
});

test("a spin cannot start twice and the selected participant is the completion result", () => {
  const entries = [participant("a", "One"), participant("b", "Two")];
  const plan = requestSpin(false, entries, 0, () => 1);
  assert.ok(plan);
  assert.equal(requestSpin(true, entries, 0, () => 0), null);
  assert.equal(completeSpin(plan), entries[1]);
});

test("repeated spins recalculate a matching target from the prior landing", () => {
  const entries = [participant("a", "One"), participant("b", "Two"), participant("c", "Three")];
  let rotation = 0;

  for (let spin = 0; spin < 4; spin += 1) {
    const plan = createSpinPlan(entries, rotation, () => 0);
    assert.ok(plan);
    assert.equal(getSegmentAtPointer(plan.targetRotation, entries.length), plan.winnerIndex);
    assert.equal(completeSpin(plan), entries[plan.winnerIndex]);
    rotation = plan.targetRotation;
  }
});

test("segment boundary crossings use each participant count and never duplicate a final crossing", async () => {
  const { countSegmentBoundaryCrossings } = await import(
    "../src/games/random-royale/spin-wheel/logic/boundaryCrossings.ts"
  );

  assert.equal(countSegmentBoundaryCrossings(12, 80, 4), 0);
  assert.equal(countSegmentBoundaryCrossings(45, 90, 4), 1);
  assert.equal(countSegmentBoundaryCrossings(45, 360 + 45, 4), 4);

  for (const count of [1, 2, 3, 200]) {
    const segmentAngle = 360 / count;
    assert.equal(countSegmentBoundaryCrossings(0, segmentAngle, count), 1);
  }

  const lastCrossedFrame = countSegmentBoundaryCrossings(89, 90, 4);
  assert.equal(lastCrossedFrame, 1);
  assert.equal(countSegmentBoundaryCrossings(90, 90, 4), 0);
});

test("spin tick sequence cycles 1 through 7 and a new spin starts at 1", async () => {
  const { nextSpinTickNumber } = await import(
    "../src/games/random-royale/spin-wheel/logic/boundaryCrossings.ts"
  );
  const collectSequence = () => {
    const sequence = [];
    let tick = 1;
    for (let index = 0; index < 9; index += 1) {
      sequence.push(tick);
      tick = nextSpinTickNumber(tick);
    }
    return sequence;
  };

  assert.deepEqual(collectSequence(), [1, 2, 3, 4, 5, 6, 7, 1, 2]);
  assert.equal(collectSequence()[0], 1);
});

test("random selection rejects invalid participant counts", () => {
  assert.throws(() => secureRandomIndex(0, () => 0), RangeError);
  assert.throws(() => secureRandomIndex(MAX_PARTICIPANTS + 1, () => 0), RangeError);
});

test("rotation normalization handles angles across multiple rotations and negatives", async () => {
  const { normalizeDegrees } = await import("../src/games/random-royale/spin-wheel/logic/wheelGeometry.ts");
  assert.equal(normalizeDegrees(0), 0);
  assert.equal(normalizeDegrees(360), 0);
  assert.equal(normalizeDegrees(720), 0);
  assert.equal(normalizeDegrees(-90), 270);
  assert.equal(normalizeDegrees(450), 90);
  assert.equal(normalizeDegrees(-720), 0);
  assert.equal(normalizeDegrees(180), 180);
});

test("segment geometry calculates correct center angles and valid SVG paths", async () => {
  const { getSegmentCenterAngle, getWheelSegmentPath } = await import(
    "../src/games/random-royale/spin-wheel/logic/wheelGeometry.ts"
  );
  // 4 participants -> 90 deg each, center angles start at top (-90): -45, 45, 135, 225
  assert.equal(getSegmentCenterAngle(0, 4), -45);
  assert.equal(getSegmentCenterAngle(1, 4), 45);
  assert.equal(getSegmentCenterAngle(2, 4), 135);
  assert.equal(getSegmentCenterAngle(3, 4), 225);

  // SVG path generation
  const path = getWheelSegmentPath(0, 4);
  assert.ok(path.startsWith("M 250 250"));
  assert.ok(path.includes("A 240 240"));
  assert.ok(path.endsWith("Z"));

  // Edge cases: 0 or 1 participant returns empty path
  assert.equal(getWheelSegmentPath(0, 0), "");
  assert.equal(getWheelSegmentPath(0, 1), "");
  assert.equal(getSegmentCenterAngle(0, 0), 0);
});

test("winner selection pure module selects winner correctly", async () => {
  const { selectRandomWinner } = await import(
    "../src/games/random-royale/spin-wheel/logic/winnerSelection.ts"
  );
  const list = [participant("id-1", "Alice"), participant("id-2", "Bob"), participant("id-3", "Charlie")];
  const result = selectRandomWinner(list, () => 2);
  assert.equal(result?.winner.id, "id-3");
  assert.equal(result?.winner.name, "Charlie");
  assert.equal(result?.winnerIndex, 2);
  assert.equal(selectRandomWinner([], () => 0), null);
});

test("peak angular velocity scales by 3x while preserving duration and motion curve", async () => {
  const {
    PEAK_SPEED_MULTIPLIER,
    MIN_SPIN_TURNS,
    EXTRA_SPIN_TURNS,
    calculatePeakAngularVelocity,
  } = await import("../src/games/random-royale/spin-wheel/config.ts");

  assert.equal(PEAK_SPEED_MULTIPLIER, 3);
  assert.equal(MIN_SPIN_TURNS, 15);
  assert.equal(EXTRA_SPIN_TURNS, 9);

  // Previous average (6 turns): ~347 deg/s
  const previousAvgSpeed = calculatePeakAngularVelocity(6, 12000);
  assert.ok(previousAvgSpeed > 340 && previousAvgSpeed < 355);

  // New average (18 turns): ~1041 deg/s (exactly 3x previous average)
  const newAvgSpeed = calculatePeakAngularVelocity(18, 12000);
  assert.ok(newAvgSpeed > 1030 && newAvgSpeed < 1050);

  const ratio = newAvgSpeed / previousAvgSpeed;
  assert.ok(Math.abs(ratio - 3.0) < 0.01, `Expected ratio ~3.0, got ${ratio}`);
});

test("high-speed multi-boundary crossings are accurately counted without missing or duplicates", async () => {
  const { countSegmentBoundaryCrossings, nextSpinTickNumber } = await import(
    "../src/games/random-royale/spin-wheel/logic/boundaryCrossings.ts"
  );

  // At ~1040 deg/s with 60 FPS (~16.6ms), wheel rotates ~17.3 deg per frame
  // With 200 participants (1.8 deg per segment): ~9 to 10 crossings in a single frame
  const crossings = countSegmentBoundaryCrossings(0, 17.3, 200);
  assert.equal(crossings, 9);

  // Simulating consecutive high-speed frames: total crossings must equal overall angle / segment angle
  let totalCrossings = 0;
  let prevAngle = 0;
  let tick = 1;
  const tickSequence = [];

  for (let frame = 1; frame <= 10; frame += 1) {
    const currAngle = frame * 17.3;
    const frameCrossings = countSegmentBoundaryCrossings(prevAngle, currAngle, 200);
    totalCrossings += frameCrossings;
    for (let c = 0; c < frameCrossings; c += 1) {
      tickSequence.push(tick);
      tick = nextSpinTickNumber(tick);
    }
    prevAngle = currAngle;
  }

  // 173 degrees / 1.8 degrees = 96.11 => exactly 96 boundaries crossed across all 10 frames
  assert.equal(totalCrossings, 96);
  assert.equal(tickSequence.length, 96);
  // Verify strict sequence cycling 1..7
  for (let i = 0; i < tickSequence.length; i += 1) {
    assert.equal(tickSequence[i], (i % 7) + 1);
  }
});


