import test from "node:test";
import assert from "node:assert/strict";
import { DodgeArenaAdapter } from "../src/games/dodge-arena/DodgeArenaAdapter.js";
import type { DodgeArenaGameState } from "../src/games/dodge-arena/types.js";

test("Dodge Arena Adapter: Pure unit tests for game logic, authority, scoring, and forfeits", async (t) => {
  const adapter = new DodgeArenaAdapter();

  await t.test("Initial state creation: maps host to orange and guest to blue", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.playerRoles["host-1"], "orange");
    assert.equal(state.playerRoles["guest-2"], "blue");
    assert.equal(state.lives.orange, 3);
    assert.equal(state.lives.blue, 3);
    assert.equal(state.winner, null);
    assert.equal(state.wave, 1);
    assert.ok(typeof state.seed === "number");
  });

  await t.test("Action validation: rejects non-participants", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const res = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: 1, directionY: 0 } },
      "intruder-3"
    );

    assert.equal(res.valid, false);
    assert.equal(res.error, "Player is not a participant in this game");
  });

  await t.test("Action validation: rejects invalid direction values", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const resInfinite = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: Infinity, directionY: 0 } },
      "host-1"
    );
    assert.equal(resInfinite.valid, false);

    const resOutOfRange = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: 2.5, directionY: 0 } },
      "host-1"
    );
    assert.equal(resOutOfRange.valid, false);
  });

  await t.test("Action validation: rejects movement from eliminated player", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });
    state.lives.orange = 0; // Orange is eliminated

    const res = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: 0, directionY: 1 } },
      "host-1"
    );

    assert.equal(res.valid, false);
    assert.equal(res.error, "Eliminated player cannot send movement input");
  });

  await t.test("Action validation: host-authoritative countdown_start restriction", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Host can send countdown_start
    const hostRes = adapter.validateAction(
      state,
      { type: "EVENT", event: "countdown_start" },
      "host-1"
    );
    assert.equal(hostRes.valid, true);

    // Guest cannot send countdown_start
    const guestRes = adapter.validateAction(
      state,
      { type: "EVENT", event: "countdown_start" },
      "guest-2"
    );
    assert.equal(guestRes.valid, false);
    assert.equal(guestRes.error, "Only host can broadcast countdown_start");
  });

  await t.test("Input application: forwards player input event", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const res = adapter.applyAction(
      state,
      {
        type: "INPUT",
        input: "move",
        data: { directionX: 0.5, directionY: -0.5, sequence: 1 },
      },
      "host-1"
    );

    assert.ok(res.events && res.events.length === 1);
    const ev = res.events[0] as { type: string; playerRole: string; playerId: string };
    assert.equal(ev.type, "player_input");
    assert.equal(ev.playerRole, "orange");
    assert.equal(ev.playerId, "host-1");
  });

  await t.test("Event application: player_hit decrements lives and determines winner", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    // Orange takes 1 damage
    const res1 = adapter.applyAction(
      state,
      { type: "EVENT", event: "player_hit", data: { player: "orange" } },
      "host-1"
    );
    state = res1.nextState;
    assert.equal(state.lives.orange, 2);
    assert.equal(state.status, "in_progress");

    // Orange takes 2nd damage
    const res2 = adapter.applyAction(
      state,
      { type: "EVENT", event: "player_hit", data: { player: "orange" } },
      "host-1"
    );
    state = res2.nextState;
    assert.equal(state.lives.orange, 1);
    assert.equal(state.status, "in_progress");

    // Orange takes fatal 3rd damage
    const res3 = adapter.applyAction(
      state,
      { type: "EVENT", event: "player_hit", data: { player: "orange" } },
      "host-1"
    );
    state = res3.nextState;
    assert.equal(state.lives.orange, 0);
    assert.equal(state.status, "won");
    assert.equal(state.winner, "blue", "Blue player should be declared winner");
  });

  await t.test("Event application: simultaneous elimination produces draw", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    state.lives.orange = 1;
    state.lives.blue = 0; // Blue already at 0

    // Orange takes hit as well on the same server resolution
    const res = adapter.applyAction(
      state,
      { type: "EVENT", event: "player_hit", data: { player: "orange" } },
      "host-1"
    );
    state = res.nextState;

    assert.equal(state.lives.orange, 0);
    assert.equal(state.lives.blue, 0);
    assert.equal(state.status, "draw");
    assert.equal(state.winner, "draw");
  });

  await t.test("Rematch negotiation: requires both players and resets state cleanly", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });
    state.status = "won";
    state.winner = "orange";

    // Player 1 requests rematch
    const res1 = adapter.applyAction(state, { type: "REMATCH" }, "host-1");
    state = res1.nextState;
    assert.equal(state.status, "won"); // Not restarted yet
    assert.deepEqual(state.rematchRequests, ["host-1"]);

    // Player 2 requests rematch
    const res2 = adapter.applyAction(state, { type: "REMATCH" }, "guest-2");
    state = res2.nextState;

    assert.equal(state.status, "in_progress", "Game should restart once both agreed");
    assert.equal(state.lives.orange, 3);
    assert.equal(state.lives.blue, 3);
    assert.equal(state.winner, null);
    assert.equal(state.rematchRequests.length, 0);
    assert.equal(state.startingPlayer, "blue", "Starting player should rotate on rematch");
  });

  await t.test("Disconnect & Forfeit: pauses match during grace and forfeits on expiry", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "host-1",
      guestPlayerId: "guest-2",
    });

    const graceExpiry = Date.now() + 30000;
    state = adapter.handlePlayerDisconnect(state, "guest-2", graceExpiry);

    assert.equal(state.disconnectGraceExpiresAt, graceExpiry);
    assert.equal(state.disconnectedPlayerId, "guest-2");

    // Inputs should be rejected while match is paused
    const inputVal = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: 1, directionY: 0 } },
      "host-1"
    );
    assert.equal(inputVal.valid, false);
    assert.equal(inputVal.error, "Match is paused while waiting for opponent to reconnect");

    // Reconnect resumes match
    state = adapter.handlePlayerReconnect(state, "guest-2");
    assert.equal(state.disconnectGraceExpiresAt, null);
    assert.equal(state.disconnectedPlayerId, null);

    const inputResume = adapter.validateAction(
      state,
      { type: "INPUT", input: "move", data: { directionX: 1, directionY: 0 } },
      "host-1"
    );
    assert.equal(inputResume.valid, true);

    // If forfeit occurs
    const forfeitResult = adapter.handleForfeit(state, "guest-2", ["host-1"]);
    assert.equal(forfeitResult.isCompleted, true);
    assert.equal(forfeitResult.nextState.status, "won");
    assert.equal(forfeitResult.nextState.winner, "orange");
    assert.equal(forfeitResult.nextState.resultReason, "disconnect_forfeit");
  });
});
