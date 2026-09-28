import test from "node:test";
import assert from "node:assert/strict";
import {
  createResultSoundGuard,
  getResultSound,
} from "../src/games/common/resultSound.ts";

const GAME_CASES = [
  { name: "Tic-Tac-Toe", humanPlayer: "X", botPlayer: "O" },
  { name: "Connect Four", humanPlayer: "R", botPlayer: "Y" },
  { name: "Brick Blast", humanPlayer: "orange", botPlayer: "blue" },
];

for (const { name, humanPlayer, botPlayer } of GAME_CASES) {
  test(`${name} selects result audio from the human perspective`, () => {
    assert.equal(getResultSound({ mode: "1v1", winner: humanPlayer, humanPlayer }), "victory");
    assert.equal(getResultSound({ mode: "1v1", winner: botPlayer, humanPlayer }), "victory");
    assert.equal(getResultSound({ mode: "1v1", winner: "draw", humanPlayer }), null);
    assert.equal(getResultSound({ mode: "vs-bot", winner: humanPlayer, humanPlayer }), "victory");
    assert.equal(getResultSound({ mode: "vs-bot", winner: botPlayer, humanPlayer }), "lose");
    assert.equal(getResultSound({ mode: "vs-bot", winner: "draw", humanPlayer }), null);
  });
}

test("a result sound plays once and reset permits the next match result", () => {
  const guard = createResultSoundGuard();
  assert.equal(guard.claim("victory"), "victory");
  assert.equal(guard.claim("victory"), null);
  assert.equal(guard.claim("lose"), null);
  guard.reset();
  assert.equal(guard.claim("lose"), "lose");
});
