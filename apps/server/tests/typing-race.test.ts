import test from "node:test";
import assert from "node:assert/strict";
import { TypingRaceAdapter } from "../src/games/typing-race/TypingRaceAdapter.js";

test("Typing Race Adapter: Pure unit tests for rules, progress validation, and lifecycle", async (t) => {
  const adapter = new TypingRaceAdapter();

  await t.test("Initial state creation: maps host to orange, guest to blue, assigns shared ~45 words passage", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.playerRoles["host-1"], "orange");
    assert.equal(state.playerRoles["guest-2"], "blue");
    assert.ok(state.passageText.length > 150, "Passage should be substantial");
    assert.ok(state.wordCount >= 40 && state.wordCount <= 50, "Word count should be ~45 words");
    assert.equal(state.players.orange.progress, 0);
    assert.equal(state.players.blue.progress, 0);
    assert.equal(state.winner, null);
  });

  await t.test("Action validation: rejects non-participants and malformed inputs", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Outsider rejected
    const outsiderRes = adapter.validateAction(
      state,
      { type: "INPUT", input: "progress", data: { text: "hello" } },
      "outsider-3"
    );
    assert.equal(outsiderRes.valid, false);

    // Malformed input rejected
    const malformedRes = adapter.validateAction(
      state,
      { type: "INPUT", input: "unknown" as any, data: { text: "test" } },
      "host-1"
    );
    assert.equal(malformedRes.valid, false);
  });

  await t.test("Correct typing advances progress proportionally", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const prefix = state.passageText.slice(0, 15);
    const actionRes = adapter.applyAction(
      state,
      { type: "INPUT", input: "progress", data: { text: prefix, totalKeystrokes: 15 } },
      "host-1"
    );

    const orangeStats = actionRes.nextState.players.orange;
    assert.equal(orangeStats.correctChars, 15);
    assert.equal(orangeStats.progress, 15 / state.passageText.length);
    assert.equal(orangeStats.errorCount, 0);
    assert.equal(orangeStats.accuracy, 100);
    assert.equal(actionRes.nextState.winner, null);
  });

  await t.test("Mandatory error correction: progress halts at first mismatch and resumes after backspace", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Correct: first 10 characters
    const correct10 = state.passageText.slice(0, 10);
    // User types 10 correct, then typos next 3 characters: "xyz"
    const withTypo = correct10 + "xyz";

    const typoRes = adapter.applyAction(
      state,
      { type: "INPUT", input: "progress", data: { text: withTypo, totalKeystrokes: 13 } },
      "host-1"
    );

    // Progress MUST be strictly clamped to the 10 correct characters
    assert.equal(typoRes.nextState.players.orange.correctChars, 10);
    assert.equal(typoRes.nextState.players.orange.totalTypedChars, 13);
    assert.equal(typoRes.nextState.players.orange.errorCount, 3);
    assert.equal(typoRes.nextState.players.orange.progress, 10 / state.passageText.length);

    // User backspaces the 3 errors and continues with next 5 correct characters
    const corrected20 = state.passageText.slice(0, 20);
    const correctedRes = adapter.applyAction(
      typoRes.nextState,
      { type: "INPUT", input: "progress", data: { text: corrected20, totalKeystrokes: 23 } },
      "host-1"
    );

    assert.equal(correctedRes.nextState.players.orange.correctChars, 20);
    assert.equal(correctedRes.nextState.players.orange.progress, 20 / state.passageText.length);
  });

  await t.test("Completion and winner determination: first to 100% correct wins", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Set race start
    state = {
      ...state,
      raceStartAt: Date.now() - 30000, // 30 seconds ago
    };

    // Blue types full passage correctly
    const winRes = adapter.applyAction(
      state,
      { type: "INPUT", input: "progress", data: { text: state.passageText, totalKeystrokes: state.passageText.length } },
      "guest-2"
    );

    assert.equal(winRes.nextState.status, "won");
    assert.equal(winRes.nextState.winner, "blue");
    assert.equal(winRes.nextState.players.blue.isFinished, true);
    assert.equal(winRes.nextState.players.blue.progress, 1);
    assert.ok(winRes.nextState.players.blue.wpm > 0);
    assert.equal(winRes.nextState.players.blue.accuracy, 100);

    // Orange tries to finish after: winner remains blue
    const orangeFinish = adapter.applyAction(
      winRes.nextState,
      { type: "INPUT", input: "progress", data: { text: state.passageText, totalKeystrokes: state.passageText.length } },
      "host-1"
    );

    assert.equal(orangeFinish.nextState.winner, "blue");
  });

  await t.test("Ready handshake and synchronized countdown timing", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Host ready
    const res1 = adapter.applyAction(state, { type: "EVENT", event: "player_ready" }, "host-1");
    assert.deepEqual(res1.nextState.readyPlayers, ["host-1"]);
    assert.equal(res1.nextState.countdownStartAt, null);

    // Guest ready -> triggers countdown timing
    const res2 = adapter.applyAction(res1.nextState, { type: "EVENT", event: "player_ready" }, "guest-2");
    assert.deepEqual(res2.nextState.readyPlayers, ["host-1", "guest-2"]);
    assert.ok(res2.nextState.countdownStartAt! > 0);
    assert.ok(res2.nextState.raceStartAt! > res2.nextState.countdownStartAt!);
  });

  await t.test("Rematch negotiation: assigns a fresh passage and resets progress", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const originalPassageId = state.passageId;
    state = {
      ...state,
      status: "won",
      winner: "orange",
      players: {
        orange: { ...state.players.orange, progress: 1, isFinished: true },
        blue: { ...state.players.blue, progress: 0.8 },
      },
    };

    // First rematch request
    const r1 = adapter.applyAction(state, { type: "REMATCH" }, "host-1");
    assert.equal(r1.nextState.status, "won");
    assert.deepEqual(r1.nextState.rematchRequests, ["host-1"]);

    // Second rematch request
    const r2 = adapter.applyAction(r1.nextState, { type: "REMATCH" }, "guest-2");
    assert.equal(r2.nextState.status, "in_progress");
    assert.equal(r2.nextState.winner, null);
    assert.equal(r2.nextState.players.orange.progress, 0);
    assert.equal(r2.nextState.players.blue.progress, 0);
    assert.deepEqual(r2.nextState.readyPlayers, []);
    assert.notEqual(r2.nextState.passageId, originalPassageId, "Rematch should assign fresh passage");
  });

  await t.test("Disconnect grace period and forfeit resolution", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const graceExpiresAt = Date.now() + 30000;
    const disconnected = adapter.handlePlayerDisconnect(state, "guest-2", graceExpiresAt);
    assert.equal(disconnected.disconnectGraceExpiresAt, graceExpiresAt);

    // Reconnection clears pause
    const reconnected = adapter.handlePlayerReconnect(disconnected, "guest-2");
    assert.equal(reconnected.disconnectGraceExpiresAt, null);

    // Forfeit awards win to remaining player
    const forfeit = adapter.handleForfeit(disconnected, "guest-2", ["host-1"]);
    assert.equal(forfeit.isCompleted, true);
    assert.equal(forfeit.nextState.status, "won");
    assert.equal(forfeit.nextState.winner, "orange");
    assert.equal(forfeit.nextState.resultReason, "disconnect_forfeit");
  });
});
