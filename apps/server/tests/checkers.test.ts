import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import { CheckersAdapter } from "../src/games/checkers/CheckersAdapter.js";
import {
  BLUE_KING,
  BLUE_MAN,
  EMPTY,
  ORANGE_KING,
  ORANGE_MAN,
} from "../src/games/checkers/types.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";
import type { CheckersGameState } from "../src/games/checkers/types.js";

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

test("CheckersAdapter: Pure unit tests for rules, validation, captures, and lifecycle", async (t) => {
  const adapter = new CheckersAdapter();

  await t.test("createInitialState creates correct 8x8 checkers match", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.currentPlayer, "orange");
    assert.equal(state.startingPlayer, "orange");
    assert.equal(state.playerRoles["player-orange"], "orange");
    assert.equal(state.playerRoles["player-blue"], "blue");
    assert.equal(state.orangeCaptures, 0);
    assert.equal(state.blueCaptures, 0);
    assert.equal(state.activePiece, null);

    const orangePieces = state.board.filter((p) => p === ORANGE_MAN);
    const bluePieces = state.board.filter((p) => p === BLUE_MAN);
    assert.equal(orangePieces.length, 12);
    assert.equal(bluePieces.length, 12);
  });

  await t.test("validateAction enforces turn order and legal moves", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    // Blue cannot move on Orange's turn
    const blueAttempt = adapter.validateAction(
      state,
      { type: "MOVE", from: 17, to: 26 },
      "player-blue"
    );
    assert.equal(blueAttempt.valid, false);
    assert.equal(blueAttempt.error, "It is not your turn");

    // Non-participant cannot move
    const intruderAttempt = adapter.validateAction(
      state,
      { type: "MOVE", from: 40, to: 33 },
      "stranger"
    );
    assert.equal(intruderAttempt.valid, false);
    assert.equal(intruderAttempt.error, "Player is not a participant in this game");

    // Orange moving valid diagonal forward
    const validOrange = adapter.validateAction(
      state,
      { type: "MOVE", from: 40, to: 33 },
      "player-orange"
    );
    assert.equal(validOrange.valid, true);

    // Orange moving backwards (illegal for Man)
    const invalidBackward = adapter.validateAction(
      state,
      { type: "MOVE", from: 40, to: 49 },
      "player-orange"
    );
    assert.equal(invalidBackward.valid, false);
    assert.equal(invalidBackward.error, "Invalid move");
  });

  await t.test("applyAction executes simple moves and alternates turns", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    const orangeRes = adapter.applyAction(
      state,
      { type: "MOVE", from: 40, to: 33 },
      "player-orange"
    );
    state = orangeRes.nextState;

    assert.equal(state.board[40], EMPTY);
    assert.equal(state.board[33], ORANGE_MAN);
    assert.equal(state.currentPlayer, "blue");
    assert.equal(state.moveCount, 1);
    assert.equal(state.lastMove?.from, 40);
    assert.equal(state.lastMove?.to, 33);

    const blueRes = adapter.applyAction(
      state,
      { type: "MOVE", from: 17, to: 26 },
      "player-blue"
    );
    state = blueRes.nextState;

    assert.equal(state.board[17], EMPTY);
    assert.equal(state.board[26], BLUE_MAN);
    assert.equal(state.currentPlayer, "orange");
    assert.equal(state.moveCount, 2);
  });

  await t.test("Forced Jump Rule: must capture when available", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    // Place an Orange piece at 35 and Blue piece at 28 (where Orange at 35 can jump over 28 to 21)
    const board = new Array(64).fill(EMPTY);
    board[35] = ORANGE_MAN;
    board[28] = BLUE_MAN;
    board[43] = ORANGE_MAN; // Another orange piece that has a simple move to 34 or 36

    const jumpState: CheckersGameState = {
      ...state,
      board,
      currentPlayer: "orange",
    };

    // Attempting simple move with 43 must be rejected because jump is forced
    const simpleAttempt = adapter.validateAction(
      jumpState,
      { type: "MOVE", from: 43, to: 34 },
      "player-orange"
    );
    assert.equal(simpleAttempt.valid, false);
    assert.equal(simpleAttempt.error, "Invalid move");

    // Jump from 35 to 21 must be valid
    const jumpAttempt = adapter.validateAction(
      jumpState,
      { type: "MOVE", from: 35, to: 21 },
      "player-orange"
    );
    assert.equal(jumpAttempt.valid, true);

    // Apply the jump
    const result = adapter.applyAction(
      jumpState,
      { type: "MOVE", from: 35, to: 21 },
      "player-orange"
    );
    assert.equal(result.nextState.board[35], EMPTY);
    assert.equal(result.nextState.board[28], EMPTY, "Captured piece removed");
    assert.equal(result.nextState.board[21], ORANGE_MAN);
    assert.equal(result.nextState.orangeCaptures, 1);
  });

  await t.test("King Promotion: reaching furthest row crowns and ends turn immediately", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    const board = new Array(64).fill(EMPTY);
    board[9] = ORANGE_MAN; // row 1, col 1. Forward step to 2 (row 0, col 2)
    board[11] = BLUE_MAN;

    const nearKingState: CheckersGameState = {
      ...state,
      board,
      currentPlayer: "orange",
    };

    const res = adapter.applyAction(
      nearKingState,
      { type: "MOVE", from: 9, to: 2 },
      "player-orange"
    );

    assert.equal(res.nextState.board[2], ORANGE_KING);
    assert.equal(res.nextState.activePiece, null);
    assert.equal(res.nextState.currentPlayer, "blue");
  });

  await t.test("Multi-jump: piece mid-jump must continue jumping until exhausted", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-orange",
      guestPlayerId: "player-blue",
    });

    const board = new Array(64).fill(EMPTY);
    board[43] = ORANGE_MAN; // row 5, col 3
    board[36] = BLUE_MAN;   // row 4, col 4 -> jump to 29 (row 3, col 5)
    board[22] = BLUE_MAN;   // row 2, col 6 -> jump from 29 to 15 (row 1, col 7)

    const multiState: CheckersGameState = {
      ...state,
      board,
      currentPlayer: "orange",
    };

    // First jump
    const firstRes = adapter.applyAction(
      multiState,
      { type: "MOVE", from: 43, to: 29 },
      "player-orange"
    );

    assert.equal(firstRes.nextState.activePiece, 29, "Piece at 29 must continue multi-jump");
    assert.equal(firstRes.nextState.currentPlayer, "orange", "Turn does not end mid-jump");
    assert.equal(firstRes.nextState.orangeCaptures, 1);

    // Second jump
    const secondRes = adapter.applyAction(
      firstRes.nextState,
      { type: "MOVE", from: 29, to: 15 },
      "player-orange"
    );

    assert.equal(secondRes.nextState.activePiece, null, "Multi-jump sequence ended");
    assert.equal(secondRes.nextState.currentPlayer, "blue", "Turn passes to Blue");
    assert.equal(secondRes.nextState.orangeCaptures, 2);
  });

  await t.test("Rematch: resets board and alternates starting player", () => {
    const state: CheckersGameState = {
      ...adapter.createInitialState({
        hostPlayerId: "player-orange",
        guestPlayerId: "player-blue",
      }),
      status: "won",
      winner: "orange",
    };

    const req1 = adapter.applyAction(state, { type: "REMATCH" }, "player-orange");
    assert.equal(req1.nextState.status, "won");
    assert.deepEqual(req1.nextState.rematchRequests, ["player-orange"]);

    const req2 = adapter.applyAction(req1.nextState, { type: "REMATCH" }, "player-blue");
    assert.equal(req2.nextState.status, "in_progress");
    assert.equal(req2.nextState.startingPlayer, "blue", "Starting player alternated to blue");
    assert.equal(req2.nextState.currentPlayer, "blue");
    assert.equal(req2.nextState.winner, null);
    assert.equal(req2.nextState.moveCount, 0);
  });

  await t.test("Disconnect & Forfeit: handles grace period and forfeit awarding", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    const disconnected = adapter.handlePlayerDisconnect(state, "p1", Date.now() + 5000);
    assert.equal(disconnected.disconnectedPlayerId, "p1");
    assert.ok(disconnected.disconnectGraceExpiresAt);

    const reconnected = adapter.handlePlayerReconnect(disconnected, "p1");
    assert.equal(reconnected.disconnectedPlayerId, null);
    assert.equal(reconnected.disconnectGraceExpiresAt, null);

    const forfeit = adapter.handleForfeit(state, "p1", ["p2"]);
    assert.equal(forfeit.isCompleted, true);
    assert.equal(forfeit.nextState.status, "won");
    assert.equal(forfeit.nextState.winner, "blue");
    assert.equal(forfeit.nextState.resultReason, "disconnect_forfeit");
  });

  await t.test("serializeState returns full state for players", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });
    const serialized = adapter.serializeState(state, "p1");
    assert.deepEqual(serialized, state);
  });
});

test("Checkers Server Integration: Full match lifecycle over WebSocket", async (t) => {
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

  await t.test("Two players connect, join checkers room, make moves, and receive state updates", async () => {
    // 1. Host identifies & creates checkers room
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
      requestId: "create_chk",
      payload: { gameId: "checkers", maxPlayers: 2 },
    });
    const roomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const roomCode = roomCreated.payload.room.roomCode;
    const roomId = roomCreated.payload.room.roomId;
    assert.ok(roomCode);

    // 2. Guest identifies & joins checkers room
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
      requestId: "join_chk",
      payload: { roomCode },
    });
    const [guestJoined, hostInitialState, guestInitialState] = await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    assert.equal(guestJoined.payload.room.gameId, "checkers");
    const hostChkState = hostInitialState.payload.gameState as CheckersGameState;
    const guestChkState = guestInitialState.payload.gameState as CheckersGameState;
    assert.equal(hostChkState.status, "in_progress");
    assert.equal(hostChkState.currentPlayer, "orange");
    assert.equal(guestChkState.status, "in_progress");

    // 3. Host makes opening move: 40 to 33
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_1",
      payload: {
        roomId,
        from: 40,
        to: 33,
      },
    });

    const [hostMoveState, guestMoveState] = await Promise.all([
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    const nextChkState = hostMoveState.payload.gameState as CheckersGameState;
    assert.equal(nextChkState.board[40], EMPTY);
    assert.equal(nextChkState.board[33], ORANGE_MAN);
    assert.equal(nextChkState.currentPlayer, "blue");
    assert.equal((guestMoveState.payload.gameState as CheckersGameState).currentPlayer, "blue");

    wsHost.close();
    wsGuest.close();
  });
});
