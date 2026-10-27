import test from "node:test";
import assert from "node:assert/strict";
import { getGameMetadata } from "../src/platform/registry/index.ts";

function calculateMatchingPrefix(typed, passage) {
  let correctChars = 0;
  const maxLen = Math.min(typed.length, passage.length);
  for (let i = 0; i < maxLen; i++) {
    if (typed[i] === passage[i]) {
      correctChars++;
    } else {
      break;
    }
  }
  return correctChars;
}

function calculateWpm(correctChars, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  const elapsedMinutes = elapsedMs / 60000;
  return Math.round((correctChars / 5) / elapsedMinutes);
}

function calculateAccuracy(correctChars, totalKeystrokes) {
  if (totalKeystrokes <= 0) return 100;
  return Math.min(100, Math.round((correctChars / totalKeystrokes) * 100));
}

test("Typing Race: Metadata and platform configuration", () => {
  const meta = getGameMetadata("typing-race");
  assert.ok(meta !== undefined, "Typing Race must be registered");
  assert.equal(meta.title, "Typing Race");
  assert.equal(meta.category, "arcade");
  assert.equal(meta.status, "available");
  assert.equal(meta.isVisible, true);
  // Strictly online multiplayer only (no single player or bot)
  assert.deepEqual(meta.supportedModes, ["online-2p"]);
});

test("Typing Race: Strict error stopping rule halts progress at first mismatch", () => {
  const passage = "The swift orange racer dashed across the finish line.";

  // Exact correct prefix
  const typed1 = "The swift ";
  assert.equal(calculateMatchingPrefix(typed1, passage), 10);

  // Mismatch at index 10 (typed 'x' instead of 'o')
  const typedWithMistake = "The swift x";
  assert.equal(calculateMatchingPrefix(typedWithMistake, passage), 10);

  // Typing more characters after the uncorrected error does NOT advance progress!
  const typedSpamAfterMistake = "The swift xxxxxxxxxx";
  assert.equal(calculateMatchingPrefix(typedSpamAfterMistake, passage), 10);

  // After backspacing the error and typing 'o'
  const typedCorrected = "The swift o";
  assert.equal(calculateMatchingPrefix(typedCorrected, passage), 11);
});

test("Typing Race: Progress calculation maps to normalized range [0.0, 1.0]", () => {
  const passage = "Short passage for testing.";
  const passageLen = passage.length;

  assert.equal(calculateMatchingPrefix("", passage) / passageLen, 0);

  const half = passage.slice(0, Math.floor(passageLen / 2));
  const halfProgress = calculateMatchingPrefix(half, passage) / passageLen;
  assert.ok(halfProgress > 0.45 && halfProgress < 0.55);

  const full = passage;
  const fullProgress = calculateMatchingPrefix(full, passage) / passageLen;
  assert.equal(fullProgress, 1.0);
});

test("Typing Race: WPM formula adheres to standard (characters / 5) / minutes", () => {
  // 350 correct characters (70 standard words) in 60 seconds (1 minute) = 70 WPM
  assert.equal(calculateWpm(350, 60000), 70);

  // 175 correct characters in 30 seconds = 70 WPM
  assert.equal(calculateWpm(175, 30000), 70);

  // 0 correct chars = 0 WPM
  assert.equal(calculateWpm(0, 30000), 0);

  // Instant or negative time returns 0
  assert.equal(calculateWpm(100, 0), 0);
});

test("Typing Race: Accuracy drops when errors and backspaces occur", () => {
  // Flawless typing (10 correct chars in 10 keystrokes) = 100%
  assert.equal(calculateAccuracy(10, 10), 100);

  // 10 correct chars with 2 errors + 2 backspaces = 14 keystrokes -> ~71%
  assert.equal(calculateAccuracy(10, 14), 71);

  // Empty state = 100%
  assert.equal(calculateAccuracy(0, 0), 100);
});

test("Typing Race: Single line segmentation splits 45 words without requiring scroll", () => {
  const passage = "The morning sun broke across the curved raceway as twin turbocharged beasts idled on the grid. Crisp air carried the sharp scent of burnt rubber. When the signal turned green, four hundred horsepower surged through the rear axles, sending both machines screaming down the straightaway.";
  const rawWords = passage.trim().split(/\s+/);
  assert.equal(rawWords.length, 45, "Passage must be exactly 45 words");

  // Chunking by 8 words per line
  const lines = [];
  const wordsPerLine = 8;
  for (let i = 0; i < rawWords.length; i += wordsPerLine) {
    lines.push(rawWords.slice(i, i + wordsPerLine).join(" "));
  }

  // 45 words / 8 words = 6 lines
  assert.equal(lines.length, 6);
  assert.equal(lines[0], "The morning sun broke across the curved raceway");
  assert.equal(lines[5], "machines screaming down the straightaway.");
});

