import test from "node:test";
import assert from "node:assert/strict";
import { StarCatcherAdapter } from "../src/games/star-catcher/StarCatcherAdapter.js";
import type { StarCatcherGameState } from "../src/games/star-catcher/types.js";

test("Star Catcher Adapter: Pure unit tests for game logic, authority, scoring, and forfeits", async (t) => {
  const adapter = new StarCatcherAdapter();

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

  await t.test("Action validation: enforces host-authoritative star_spawn and score_update", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Host can send star_spawn
    const hostSpawnValid = adapter.validateAction(
      state,
      {
        type: "EVENT",
        event: "star_spawn",
        data: { x: 180, y: 300 },
      },
      "host-1"
    );
    assert.equal(hostSpawnValid.valid, true);

    // Guest CANNOT broadcast star_spawn (Host Authoritative)
    const guestSpawnValid = adapter.validateAction(
      state,
      {
        type: "EVENT",
        event: "star_spawn",
        data: { x: 180, y: 300 },
      },
      "guest-2"
    );
    assert.equal(guestSpawnValid.valid, false);
    assert.equal(guestSpawnValid.error, "Only host can broadcast star_spawn");
  });

  await t.test("Action validation: non-participant rejection", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const invalidPlayer = adapter.validateAction(
      state,
      { type: "INPUT", input: "ship_sync", data: { x: 180, y: 500 } },
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
      { type: "INPUT", input: "ship_sync", data: { x: 180, y: 150, vx: 20, vy: 10, rotation: 1.5, thrusting: true } },
      "guest-2"
    );

    assert.equal(res.events?.length, 1);
    const firstEvent = res.events?.[0] as Record<string, unknown> | undefined;
    assert.equal(firstEvent?.type, "player_input");
    assert.equal(firstEvent?.playerRole, "blue");
  });

  await t.test("Action application: player_ready event tracks ready status and notifies allReady", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Host reports ready
    const res1 = adapter.applyAction(
      state,
      { type: "EVENT", event: "player_ready" },
      "host-1"
    );
    assert.deepEqual(res1.nextState.readyPlayers, ["host-1"]);
    const ev1 = res1.events?.[0] as { type: string; event: string; data: { allReady: boolean } };
    assert.equal(ev1.type, "game_event");
    assert.equal(ev1.event, "player_ready");
    assert.equal(ev1.data.allReady, false);

    // Guest reports ready
    const res2 = adapter.applyAction(
      res1.nextState,
      { type: "EVENT", event: "player_ready" },
      "guest-2"
    );
    assert.deepEqual(res2.nextState.readyPlayers, ["host-1", "guest-2"]);
    const ev2 = res2.events?.[0] as { type: string; event: string; data: { allReady: boolean } };
    assert.equal(ev2.data.allReady, true);
  });

  await t.test("Score update and Game Over to 5 stars", () => {
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
        data: { scores: { orange: 4, blue: 2 }, collector: "orange" },
      },
      "host-1"
    );

    assert.equal(scoreRes.nextState.scores.orange, 4);
    assert.equal(scoreRes.nextState.scores.blue, 2);

    // Trigger Game Over
    const gameOverRes = adapter.applyAction(
      scoreRes.nextState,
      {
        type: "EVENT",
        event: "game_over",
        data: { winner: "orange", scores: { orange: 5, blue: 2 } },
      },
      "host-1"
    );

    assert.equal(gameOverRes.nextState.status, "won");
    assert.equal(gameOverRes.nextState.winner, "orange");
    assert.equal(gameOverRes.nextState.scores.orange, 5);
  });

  await t.test("Rematch negotiation: requires both players to accept", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    state = {
      ...state,
      status: "won",
      winner: "blue",
      scores: { orange: 3, blue: 5 },
    };

    // First rematch request
    const firstRematch = adapter.applyAction(state, { type: "REMATCH" }, "host-1");
    assert.equal(firstRematch.nextState.status, "won");
    assert.deepEqual(firstRematch.nextState.rematchRequests, ["host-1"]);

    // Second rematch request triggers match restart
    const secondRematch = adapter.applyAction(
      firstRematch.nextState,
      { type: "REMATCH" },
      "guest-2"
    );
    assert.equal(secondRematch.nextState.status, "in_progress");
    assert.equal(secondRematch.nextState.scores.orange, 0);
    assert.equal(secondRematch.nextState.scores.blue, 0);
    assert.equal(secondRematch.nextState.winner, null);
    assert.deepEqual(secondRematch.nextState.rematchRequests, []);
  });

  await t.test("Disconnect & Forfeit: handles disconnect grace period and remaining player forfeit win", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const graceExpiresAt = Date.now() + 30000;
    const disconnectedState = adapter.handlePlayerDisconnect(
      state,
      "guest-2",
      graceExpiresAt
    );
    assert.equal(disconnectedState.disconnectGraceExpiresAt, graceExpiresAt);
    assert.equal(disconnectedState.disconnectedPlayerId, "guest-2");

    // Reconnection clears grace period
    const reconnectedState = adapter.handlePlayerReconnect(disconnectedState, "guest-2");
    assert.equal(reconnectedState.disconnectGraceExpiresAt, null);
    assert.equal(reconnectedState.disconnectedPlayerId, null);

    // Forfeit awards win to remaining player
    const forfeitRes = adapter.handleForfeit(disconnectedState, "guest-2", ["host-1"]);
    assert.equal(forfeitRes.isCompleted, true);
    assert.equal(forfeitRes.nextState.status, "won");
    assert.equal(forfeitRes.nextState.winner, "orange");
    assert.equal(forfeitRes.nextState.resultReason, "disconnect_forfeit");
  });
});
