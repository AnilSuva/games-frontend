import test from "node:test";
import assert from "node:assert/strict";
import {
  peekStartingPlayer,
  consumeStartingPlayer,
  advanceStartingPlayer,
  resetStartingPlayer,
} from "../src/games/common/startingPlayer.ts";

test("Starting Player: defaults to Orange for first match", () => {
  resetStartingPlayer("test-game-1");
  assert.equal(peekStartingPlayer("test-game-1"), "orange");
  const first = consumeStartingPlayer("test-game-1");
  assert.equal(first, "orange");
});

test("Starting Player: alternates Orange -> Blue -> Orange indefinitely", () => {
  resetStartingPlayer("test-game-2");
  assert.equal(consumeStartingPlayer("test-game-2"), "orange");
  assert.equal(consumeStartingPlayer("test-game-2"), "blue");
  assert.equal(consumeStartingPlayer("test-game-2"), "orange");
  assert.equal(consumeStartingPlayer("test-game-2"), "blue");
  assert.equal(consumeStartingPlayer("test-game-2"), "orange");
});

test("Starting Player: maintains completely independent sequences per game", () => {
  resetStartingPlayer("tic-tac-toe");
  resetStartingPlayer("connect-four");
  resetStartingPlayer("brick-blast");

  assert.equal(consumeStartingPlayer("tic-tac-toe"), "orange");
  assert.equal(consumeStartingPlayer("tic-tac-toe"), "blue");

  // Other games remain on initial Orange
  assert.equal(peekStartingPlayer("connect-four"), "orange");
  assert.equal(peekStartingPlayer("brick-blast"), "orange");

  assert.equal(consumeStartingPlayer("connect-four"), "orange");
  assert.equal(consumeStartingPlayer("brick-blast"), "orange");

  // Tic-tac-toe continues its own rotation
  assert.equal(consumeStartingPlayer("tic-tac-toe"), "orange");
});

test("Starting Player: advanceStartingPlayer rotates and returns new starter", () => {
  resetStartingPlayer("test-game-advance");
  assert.equal(advanceStartingPlayer("test-game-advance"), "blue");
  assert.equal(advanceStartingPlayer("test-game-advance"), "orange");
});
