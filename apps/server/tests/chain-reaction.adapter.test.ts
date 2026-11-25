import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import { ChainReactionAdapter } from "../src/games/chain-reaction/ChainReactionAdapter.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";
import type { ChainReactionGameState } from "../src/games/chain-reaction/types.js";

function createWsClient(url: string, origin = "http://localhost:3000"): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Origin: origin },
    });
    ws.once("open", () => resolve(ws));
    ws.once("error", (err) => reject(err));
  });
}

function waitForMessage<T>(
  ws: WebSocket,
  predicate?: (env: ServerEnvelope<T>) => boolean,
  timeoutMs = 4000
): Promise<ServerEnvelope<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timeout waiting for message after ${timeoutMs}ms`));
    }, timeoutMs);

    const onMessage = (data: Buffer | string) => {
      try {
        const text = typeof data === "string" ? data : data.toString("utf8");
        const env = JSON.parse(text) as ServerEnvelope<T>;
        if (!predicate || predicate(env)) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(env);
        }
      } catch (err) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        reject(err);
      }
    };

    ws.on("message", onMessage);
  });
}

function sendJson<T>(ws: WebSocket, message: ClientEnvelope<T>): void {
  ws.send(JSON.stringify(message));
}

test("ChainReactionAdapter: Pure unit tests for rules, validation, cascades, and lifecycle", async (t) => {
  const adapter = new ChainReactionAdapter();

  await t.test("createInitialState creates correct 6x8 chain reaction match", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.currentPlayer, "X");
    assert.equal(state.startingPlayer, "X");
    assert.equal(state.playerRoles["player-x"], "X");
    assert.equal(state.playerRoles["player-o"], "O");
    assert.equal(state.movesPlayed, 0);
    assert.equal(state.moveNumber, 0);
    assert.equal(state.orbCounts.X, 0);
    assert.equal(state.orbCounts.O, 0);
    assert.equal(state.lastMove, null);
    assert.equal(state.winner, null);
    assert.equal(state.board.length, 8);
    assert.equal(state.board[0].length, 6);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        assert.equal(state.board[r][c].count, 0);
        assert.equal(state.board[r][c].owner, null);
      }
    }
  });

  await t.test("validateAction enforces turn order, bounds, and cell ownership", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Guest cannot move on X's turn
    const guestAttempt = adapter.validateAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-o"
    );
    assert.equal(guestAttempt.valid, false);
    assert.equal(guestAttempt.error, "It is not your turn");

    // Stranger cannot move
    const strangerAttempt = adapter.validateAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "stranger"
    );
    assert.equal(strangerAttempt.valid, false);
    assert.equal(strangerAttempt.error, "Player is not a participant in this game");

    // Out of bounds
    assert.equal(
      adapter.validateAction(state, { type: "PLACE_ORB", row: -1, col: 0 }, "player-x").valid,
      false
    );
    assert.equal(
      adapter.validateAction(state, { type: "PLACE_ORB", row: 8, col: 0 }, "player-x").valid,
      false
    );
    assert.equal(
      adapter.validateAction(state, { type: "PLACE_ORB", row: 0, col: 6 }, "player-x").valid,
      false
    );

    // Valid placement on empty cell
    const validMove = adapter.validateAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-x"
    );
    assert.equal(validMove.valid, true);

    // Apply move so (0,0) is owned by X
    const res1 = adapter.applyAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-x"
    );
    state = res1.nextState;

    // Now it's O's turn. O placing on X's cell is illegal
    const illegalO = adapter.validateAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-o"
    );
    assert.equal(illegalO.valid, false);
    assert.equal(
      illegalO.error,
      "Invalid move: cell is out of bounds or occupied by opponent"
    );

    // O placing on empty cell is legal
    const validO = adapter.validateAction(
      state,
      { type: "PLACE_ORB", row: 1, col: 1 },
      "player-o"
    );
    assert.equal(validO.valid, true);
  });

  await t.test("applyAction triggers cascades and converts neighbor cells", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Move 1: X plays at corner (0,0) - critical mass is 2
    state = adapter.applyAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-x"
    ).nextState;
    assert.equal(state.board[0][0].count, 1);
    assert.equal(state.board[0][0].owner, "X");
    assert.equal(state.currentPlayer, "O");
    assert.equal(state.moveNumber, 1);
    assert.equal(state.movesPlayed, 1);

    // Move 2: O plays at (7,5) - opposite corner
    state = adapter.applyAction(
      state,
      { type: "PLACE_ORB", row: 7, col: 5 },
      "player-o"
    ).nextState;
    assert.equal(state.board[7][5].count, 1);
    assert.equal(state.board[7][5].owner, "O");
    assert.equal(state.currentPlayer, "X");

    // Move 3: X plays at (0,0) again -> reaches critical mass 2 and explodes!
    state = adapter.applyAction(
      state,
      { type: "PLACE_ORB", row: 0, col: 0 },
      "player-x"
    ).nextState;

    // Corner (0,0) exploded: loses 2 orbs -> count 0, owner null
    assert.equal(state.board[0][0].count, 0);
    assert.equal(state.board[0][0].owner, null);

    // Orthogonal neighbors (0,1) and (1,0) gain 1 orb each, owned by X
    assert.equal(state.board[0][1].count, 1);
    assert.equal(state.board[0][1].owner, "X");
    assert.equal(state.board[1][0].count, 1);
    assert.equal(state.board[1][0].owner, "X");

    assert.equal(state.orbCounts.X, 2);
    assert.equal(state.orbCounts.O, 1);
    assert.equal(state.status, "in_progress");
  });

  await t.test("cascade elimination detects win and stops after both have moved", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Move 1: X places at (0,0)
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 0 }, "player-x").nextState;
    // Move 2: O places next to X at (0,1)
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 1 }, "player-o").nextState;

    // Both players have now made at least 1 move (movesPlayed = 2)
    assert.equal(state.movesPlayed, 2);
    assert.equal(state.orbCounts.X, 1);
    assert.equal(state.orbCounts.O, 1);

    // Move 3: X plays at (0,0) -> triggers explosion!
    // Critical mass of corner (0,0) is 2.
    // Explodes into (0,1) [O's cell!] and (1,0) [empty].
    // (0,1) is converted to X, so O now has 0 orbs on the board!
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 0 }, "player-x").nextState;

    assert.equal(state.status, "won");
    assert.equal(state.winner, "X");
    assert.equal(state.resultReason, "win");
    assert.equal(state.orbCounts.O, 0);
    assert.equal(state.orbCounts.X, 3);
  });

  await t.test("rematch alternates starting player and resets state once both agree", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Win the game so rematch can be initiated
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 0 }, "player-x").nextState;
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 1 }, "player-o").nextState;
    state = adapter.applyAction(state, { type: "PLACE_ORB", row: 0, col: 0 }, "player-x").nextState;
    assert.equal(state.status, "won");

    // Player X requests rematch
    const res1 = adapter.applyAction(state, { type: "REMATCH" }, "player-x");
    state = res1.nextState;
    assert.equal(state.rematchRequests.length, 1);
    assert.equal(state.status, "won");

    // Player O also requests rematch -> triggers new game!
    const res2 = adapter.applyAction(state, { type: "REMATCH" }, "player-o");
    const rematchState = res2.nextState;

    assert.equal(rematchState.status, "in_progress");
    assert.equal(rematchState.startingPlayer, "O");
    assert.equal(rematchState.currentPlayer, "O");
    assert.equal(rematchState.movesPlayed, 0);
    assert.equal(rematchState.moveNumber, 0);
    assert.equal(rematchState.winner, null);
    assert.equal(rematchState.orbCounts.X, 0);
    assert.equal(rematchState.orbCounts.O, 0);
    assert.equal(rematchState.lastMove, null);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        assert.equal(rematchState.board[r][c].count, 0);
        assert.equal(rematchState.board[r][c].owner, null);
      }
    }
  });

  await t.test("disconnect, reconnect, and forfeit handling", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Disconnect host
    const discRes = adapter.handlePlayerDisconnect(state, "player-x", Date.now() + 30000);
    state = discRes;
    assert.equal(state.disconnectedPlayerId, "player-x");
    assert.equal(state.status, "in_progress");

    // Reconnect host
    const recRes = adapter.handlePlayerReconnect(state, "player-x");
    state = recRes;
    assert.equal(state.disconnectedPlayerId, null);

    // Forfeit host (remaining: player-o)
    const forfeitRes = adapter.handleForfeit(state, "player-x", ["player-o"]);
    state = forfeitRes.nextState;
    assert.equal(state.status, "won");
    assert.equal(state.winner, "O");
    assert.equal(state.resultReason, "disconnect_forfeit");
  });

  await t.test("serializeState returns full state for participants", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });
    const serialized = adapter.serializeState(state, "p1");
    assert.deepEqual(serialized, state);
  });
});

test("Chain Reaction Server Integration: Full match lifecycle over WebSocket", async (t) => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "test",
    port: 0,
    disconnectGracePeriodMs: 600,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  t.after(async () => {
    await server.stop();
  });

  await t.test("Two players connect, join chain-reaction room, make moves, and receive state updates", async () => {
    // 1. Host identifies & creates chain-reaction room
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "host_init",
      payload: { displayName: "Alice" },
    });
    const hostReady = await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");
    const hostId = hostReady.payload.playerId;
    assert.ok(hostId);

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "create_cr",
      payload: { gameId: "chain-reaction", maxPlayers: 2 },
    });
    const roomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const roomCode = roomCreated.payload.room.roomCode;
    const roomId = roomCreated.payload.room.roomId;
    assert.ok(roomCode);

    // 2. Guest identifies & joins chain-reaction room
    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "guest_init",
      payload: { displayName: "Bob" },
    });
    await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "join_cr",
      payload: { roomCode },
    });
    const [guestJoined, hostInitialState, guestInitialState] = await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    assert.equal(guestJoined.payload.room.gameId, "chain-reaction");
    const hostCrState = hostInitialState.payload.gameState as ChainReactionGameState;
    const guestCrState = guestInitialState.payload.gameState as ChainReactionGameState;
    assert.equal(hostCrState.status, "in_progress");
    assert.equal(hostCrState.currentPlayer, "X");
    assert.equal(guestCrState.status, "in_progress");
    assert.equal(guestCrState.currentPlayer, "X");

    // 3. Host makes opening move: row 0, col 0
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_1",
      payload: {
        roomId,
        row: 0,
        col: 0,
      },
    });

    const [hostMoveState, guestMoveState] = await Promise.all([
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    const nextCrState = hostMoveState.payload.gameState as ChainReactionGameState;
    assert.equal(nextCrState.board[0][0].count, 1);
    assert.equal(nextCrState.board[0][0].owner, "X");
    assert.equal(nextCrState.currentPlayer, "O");
    assert.equal(nextCrState.moveNumber, 1);
    assert.equal((guestMoveState.payload.gameState as ChainReactionGameState).currentPlayer, "O");

    // 4. Guest makes reply move: row 0, col 5
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "move_2",
      payload: {
        roomId,
        row: 0,
        col: 5,
      },
    });

    const [hostMove2State, guestMove2State] = await Promise.all([
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    const guestReplyState = guestMove2State.payload.gameState as ChainReactionGameState;
    assert.equal(guestReplyState.board[0][5].count, 1);
    assert.equal(guestReplyState.board[0][5].owner, "O");
    assert.equal(guestReplyState.currentPlayer, "X");
    assert.equal(guestReplyState.moveNumber, 2);
    assert.equal((hostMove2State.payload.gameState as ChainReactionGameState).currentPlayer, "X");

    wsHost.close();
    wsGuest.close();
  });
});
