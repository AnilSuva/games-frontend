import test from "node:test";
import assert from "node:assert/strict";
import { PingPongAdapter } from "../src/games/ping-pong/PingPongAdapter.js";
import type { PingPongGameState } from "../src/games/ping-pong/types.js";

test("Ping Pong Adapter: Pure unit tests for game logic, authority, scoring, and forfeits", async (t) => {
  const adapter = new PingPongAdapter();

  await t.test("Initial state creation: maps host to orange and guest to blue", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.playerRoles["host-1"], "orange");
    assert.equal(state.playerRoles["guest-2"], "blue");
    assert.equal(state.scores.orange, 0);
    assert.equal(state.scores.blue, 0);
    assert.equal(state.winner, null);
  });

  await t.test("Action validation: enforces host-authoritative ball_sync", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Host can send ball_sync
    const hostSyncValid = adapter.validateAction(
      state,
      {
        type: "EVENT",
        event: "ball_sync",
        data: { x: 220, y: 320, vx: 0, vy: 300, spin: 0, zHeight: 0.5, scoreOrange: 0, scoreBlue: 0 },
      },
      "host-1"
    );
    assert.equal(hostSyncValid.valid, true);

    // Guest CANNOT broadcast ball_sync (Host Authoritative)
    const guestSyncValid = adapter.validateAction(
      state,
      {
        type: "EVENT",
        event: "ball_sync",
        data: { x: 220, y: 320, vx: 0, vy: 300, spin: 0, zHeight: 0.5, scoreOrange: 0, scoreBlue: 0 },
      },
      "guest-2"
    );
    assert.equal(guestSyncValid.valid, false);
    assert.equal(guestSyncValid.error, "Only host can broadcast ball sync");
  });

  await t.test("Action validation: non-participant rejection", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const invalidPlayer = adapter.validateAction(
      state,
      { type: "INPUT", input: "paddle.position", data: { x: 200 } },
      "stranger-99"
    );
    assert.equal(invalidPlayer.valid, false);
  });

  await t.test("Action application: player_input event emission", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const res = adapter.applyAction(
      state,
      { type: "INPUT", input: "paddle.position", data: { x: 240 } },
      "guest-2"
    );

    assert.equal(res.events?.length, 1);
    const firstEvent = res.events?.[0] as Record<string, unknown> | undefined;
    assert.equal(firstEvent?.type, "player_input");
    assert.equal(firstEvent?.playerRole, "blue");
  });

  await t.test("Score update and Game Over to 5 points", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Update score
    const scoreRes = adapter.applyAction(
      state,
      {
        type: "EVENT",
        event: "score_update",
        data: { scores: { orange: 3, blue: 2 }, scorer: "orange" },
      },
      "host-1"
    );
    assert.equal(scoreRes.nextState.scores.orange, 3);
    assert.equal(scoreRes.nextState.scores.blue, 2);

    // Game Over at 5
    const winRes = adapter.applyAction(
      scoreRes.nextState,
      {
        type: "EVENT",
        event: "game_over",
        data: { winner: "orange", scores: { orange: 5, blue: 2 } },
      },
      "host-1"
    );
    assert.equal(winRes.nextState.status, "won");
    assert.equal(winRes.nextState.winner, "orange");
    assert.equal(winRes.nextState.resultReason, "win");
    const winResult = winRes.result as { status?: string } | undefined;
    assert.equal(winResult?.status, "won");
  });

  await t.test("Rematch: resets scores and alternates starting player", () => {
    const state: PingPongGameState = {
      status: "won",
      startingPlayer: "orange",
      scores: { orange: 5, blue: 3 },
      winner: "orange",
      playerRoles: { "host-1": "orange", "guest-2": "blue" },
      rematchRequests: [],
    };

    // Host requests rematch
    const res1 = adapter.applyAction(state, { type: "REMATCH" }, "host-1");
    assert.equal(res1.nextState.rematchRequests.length, 1);
    assert.equal(res1.nextState.status, "won");

    // Guest requests rematch -> both ready -> match resets
    const res2 = adapter.applyAction(res1.nextState, { type: "REMATCH" }, "guest-2");
    assert.equal(res2.nextState.status, "in_progress");
    assert.equal(res2.nextState.scores.orange, 0);
    assert.equal(res2.nextState.scores.blue, 0);
    assert.equal(res2.nextState.startingPlayer, "blue", "Starting player alternates");
  });

  await t.test("Disconnect and forfeit handling", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const disconnectedState = adapter.handlePlayerDisconnect(state, "guest-2", Date.now() + 5000);
    assert.ok(disconnectedState.disconnectGraceExpiresAt);
    assert.equal(disconnectedState.disconnectedPlayerId, "guest-2");

    // Forfeit awards win to remaining player
    const forfeitRes = adapter.handleForfeit(disconnectedState, "guest-2", ["host-1"]);
    assert.equal(forfeitRes.nextState.status, "won");
    assert.equal(forfeitRes.nextState.winner, "orange");
    assert.equal(forfeitRes.nextState.resultReason, "disconnect_forfeit");
  });
});
