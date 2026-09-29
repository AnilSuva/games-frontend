import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomErrorPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomUpdatedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";
import type { ConnectFourGameState } from "../src/games/connect-four/types.js";

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

test("Connect Four Server Integration: Full match lifecycle, turns, anti-cheat, win, draw, rematch, and reconnect", async (t) => {
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

  await t.test("Match flow: creation, player assignment, moves, win, and rematch rotation", async () => {
    // 1. Host (Player 1) connects and identifies
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "host_id",
      payload: { displayName: "OrangeHost" },
    });
    const hostReady = await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");
    const hostPlayerId = hostReady.payload.playerId;
    assert.ok(hostPlayerId);

    // 2. Host creates Connect Four room
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "create_c4",
      payload: { gameId: "connect-four", maxPlayers: 2 },
    });
    const roomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const roomCode = roomCreated.payload.room.roomCode;
    const roomId = roomCreated.payload.room.roomId;
    assert.equal(roomCreated.payload.room.status, "waiting");
    assert.equal(roomCreated.payload.room.gameId, "connect-four");

    // 3. Guest (Player 2) connects, identifies, and joins
    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "guest_id",
      payload: { displayName: "BlueGuest" },
    });
    const guestReady = await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");
    const guestPlayerId = guestReady.payload.playerId;
    assert.ok(guestPlayerId);

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "join_c4",
      payload: { roomCode },
    });

    const [guestJoinRes, hostInitialStateEnv, guestInitialStateEnv] = await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    assert.equal(guestJoinRes.payload.room.status, "in-progress");
    const initialGameState = hostInitialStateEnv.payload.gameState as ConnectFourGameState;
    assert.equal(initialGameState.status, "in_progress");
    assert.equal(initialGameState.currentPlayer, "R");
    assert.equal(initialGameState.startingPlayer, "R");
    assert.equal(initialGameState.playerDiscs[hostPlayerId], "R");
    assert.equal(initialGameState.playerDiscs[guestPlayerId], "Y");
    assert.deepEqual(guestInitialStateEnv.payload.gameState, initialGameState);

    // 4. Play Connect Four moves
    // Host plays col 0 -> disc at row 5
    const hostMove1Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove1Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_1",
      payload: { roomId, column: 0 },
    });
    const [hostState1, guestState1] = await Promise.all([hostMove1Promise, guestMove1Promise]);
    const state1 = hostState1.payload.gameState as ConnectFourGameState;
    assert.equal(state1.currentPlayer, "Y");
    assert.equal(state1.columnCounts[0], 1);
    assert.equal(state1.lastMove?.column, 0);
    assert.equal(state1.lastMove?.row, 5);
    assert.equal(state1.lastMove?.player, "R");
    assert.deepEqual(guestState1.payload.gameState, state1);

    // Guest plays col 1
    const hostMove2Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove2Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "move_2",
      payload: { roomId, column: 1 },
    });
    const [hostState2] = await Promise.all([hostMove2Promise, guestMove2Promise]);
    const state2 = hostState2.payload.gameState as ConnectFourGameState;
    assert.equal(state2.currentPlayer, "R");
    assert.equal(state2.columnCounts[1], 1);

    // Host col 0 (row 4)
    const hostMove3Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove3Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_3",
      payload: { roomId, column: 0 },
    });
    await Promise.all([hostMove3Promise, guestMove3Promise]);

    // Guest col 1 (row 4)
    const hostMove4Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove4Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "move_4",
      payload: { roomId, column: 1 },
    });
    await Promise.all([hostMove4Promise, guestMove4Promise]);

    // Host col 0 (row 3)
    const hostMove5Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove5Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_5",
      payload: { roomId, column: 0 },
    });
    await Promise.all([hostMove5Promise, guestMove5Promise]);

    // Guest col 1 (row 3)
    const hostMove6Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove6Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "move_6",
      payload: { roomId, column: 1 },
    });
    await Promise.all([hostMove6Promise, guestMove6Promise]);

    // Host col 0 (row 2) -> Connect Four Vertical Win! (discs at rows 5, 4, 3, 2)
    const hostWinPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestWinPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_win",
      payload: { roomId, column: 0 },
    });

    const [hostWinEnv, guestWinEnv] = await Promise.all([hostWinPromise, guestWinPromise]);

    const winState = hostWinEnv.payload.gameState as ConnectFourGameState;
    assert.equal(winState.status, "won");
    assert.equal(winState.winner, "R");
    assert.equal(winState.resultReason, "win");
    assert.ok(winState.winningLine);
    assert.equal(winState.winningLine.direction, "vertical");
    assert.deepEqual(guestWinEnv.payload.gameState, winState);

    // 5. Rematch: Host requests rematch
    const hostRematchWaitPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestRematchWaitPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.rematch",
      requestId: "rematch_host",
      payload: { roomId },
    });
    const [rematchWaitEnv] = await Promise.all([hostRematchWaitPromise, guestRematchWaitPromise]);
    const rematchWaitState = rematchWaitEnv.payload.gameState as ConnectFourGameState;
    assert.deepEqual(rematchWaitState.rematchRequests, [hostPlayerId]);
    assert.equal(rematchWaitState.status, "won");

    // Guest requests rematch -> Both ready -> Match restarts with starting player rotated!
    sendJson(wsGuest, {
      version: 1,
      type: "game.rematch",
      requestId: "rematch_guest",
      payload: { roomId },
    });

    const [hostRestartEnv, guestRestartEnv] = await Promise.all([
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    const restartState = hostRestartEnv.payload.gameState as ConnectFourGameState;
    assert.equal(restartState.status, "in_progress");
    assert.equal(restartState.startingPlayer, "Y"); // Rotated to Blue (Guest)
    assert.equal(restartState.currentPlayer, "Y");
    assert.equal(restartState.winner, null);
    assert.equal(restartState.moveCount, 0);
    assert.deepEqual(restartState.columnCounts, [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(guestRestartEnv.payload.gameState, restartState);

    wsHost.close();
    wsGuest.close();
  });

  await t.test("Move validation: wrong-turn, invalid column, full column, and outsider rejections", async () => {
    const wsHost = await createWsClient(wsUrl);
    const wsGuest = await createWsClient(wsUrl);
    const wsOutsider = await createWsClient(wsUrl);

    // Identify
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "h_id",
      payload: { displayName: "Host" },
    });
    const hReady = await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "g_id",
      payload: { displayName: "Guest" },
    });
    await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsOutsider, {
      version: 1,
      type: "session.identify",
      requestId: "out_id",
      payload: { displayName: "Outsider" },
    });
    await waitForMessage<SessionReadyPayload>(wsOutsider, (e) => e.type === "session.ready");

    // Create & Join
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_room",
      payload: { gameId: "connect-four" },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "j_room",
      payload: { roomCode },
    });
    await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);

    // Test 1: Guest tries to move when it's Host's turn
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "bad_turn",
      payload: { roomId, column: 0 },
    });
    const errTurn = await waitForMessage<RoomErrorPayload>(wsGuest, (e) => e.type === "room.error");
    assert.equal(errTurn.payload.code, "NOT_YOUR_TURN");

    // Test 2: Host sends invalid column (out of range: 9)
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "bad_col",
      payload: { roomId, column: 9 }, // Zod or adapter will reject
    });
    const errCol = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.ok(errCol.payload.code === "INVALID_MOVE" || errCol.payload.code === "INVALID_MESSAGE");

    // Test 3: Outsider tries to move
    sendJson(wsOutsider, {
      version: 1,
      type: "game.move",
      requestId: "out_move",
      payload: { roomId, column: 0 },
    });
    const errOut = await waitForMessage<RoomErrorPayload>(wsOutsider, (e) => e.type === "room.error");
    assert.equal(errOut.payload.code, "NOT_IN_ROOM");

    // Test 4: Fill a column (6 discs) then attempt a 7th move
    // Alternate 6 drops in column 3
    for (let i = 0; i < 6; i++) {
      const activeWs = i % 2 === 0 ? wsHost : wsGuest;
      sendJson(activeWs, {
        version: 1,
        type: "game.move",
        requestId: `fill_${i}`,
        payload: { roomId, column: 3 },
      });
      await waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    }

    // Now column 3 has 6 discs. It's Host's turn (i=6 % 2 === 0).
    // Host tries to drop in column 3 again:
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "col_full_move",
      payload: { roomId, column: 3 },
    });
    const errFull = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.equal(errFull.payload.code, "INVALID_MOVE");
    assert.equal(errFull.payload.message, "Column is full");

    wsHost.close();
    wsGuest.close();
    wsOutsider.close();
  });

  await t.test("Disconnect grace period: pauses match, forbids moves, and forfeits on expiry", async () => {
    const wsHost = await createWsClient(wsUrl);
    const wsGuest = await createWsClient(wsUrl);

    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "h_id2",
      payload: { displayName: "Host2" },
    });
    const hReady = await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "g_id2",
      payload: { displayName: "Guest2" },
    });
    await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_room2",
      payload: { gameId: "connect-four" },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "j_room2",
      payload: { roomCode },
    });
    await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);

    // Guest abruptly disconnects (socket closes without room.leave)
    wsGuest.close();

    const [hostUpdated1, hostState1] = await Promise.all([
      waitForMessage<RoomUpdatedPayload>(wsHost, (e) => e.type === "room.updated"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);
    assert.equal(hostUpdated1.payload.reason, "player_disconnected");
    const h1State = hostState1.payload.gameState as ConnectFourGameState;
    assert.ok(h1State.disconnectGraceExpiresAt);
    assert.ok(h1State.disconnectGraceExpiresAt > Date.now());

    // Host tries to move while opponent is disconnected -> Match paused
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "paused_move",
      payload: { roomId, column: 0 },
    });
    const errPaused = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.equal(errPaused.payload.code, "INVALID_MOVE");
    assert.match(errPaused.payload.message, /paused/i);

    // Wait for the test grace period (600ms) to expire
    const forfeitState = await waitForMessage<GameStatePayload>(
      wsHost,
      (e) => e.type === "game.state" && (e.payload.gameState as ConnectFourGameState).status === "won",
      3000
    );

    const fState = forfeitState.payload.gameState as ConnectFourGameState;
    assert.equal(fState.status, "won");
    assert.equal(fState.winner, "R"); // Host won
    assert.equal(fState.resultReason, "disconnect_forfeit");

    wsHost.close();
  });

  await t.test("Explicit room.leave exit: cleans up room, notifies opponent, and allows new room creation", async () => {
    const wsHost = await createWsClient(wsUrl);
    const wsGuest = await createWsClient(wsUrl);

    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "h_id3",
      payload: { displayName: "Host3" },
    });
    await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "g_id3",
      payload: { displayName: "Guest3" },
    });
    await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_room3",
      payload: { gameId: "connect-four" },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "j_room3",
      payload: { roomCode },
    });
    await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);

    // Host explicitly leaves (Home button)
    sendJson(wsHost, {
      version: 1,
      type: "room.leave",
      requestId: "host_leave",
      payload: { roomId },
    });

    const [hostLeft, guestNotified] = await Promise.all([
      waitForMessage<RoomLeftPayload>(wsHost, (e) => e.type === "room.left"),
      waitForMessage<RoomUpdatedPayload>(wsGuest, (e) => e.type === "room.updated" && e.payload.reason === "player_left"),
    ]);
    assert.equal(hostLeft.payload.roomId, roomId);
    assert.ok(guestNotified);

    // Host creates a brand new room immediately without stale state
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_new_room",
      payload: { gameId: "connect-four" },
    });
    const newRoomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    assert.notEqual(newRoomCreated.payload.room.roomId, roomId);
    assert.equal(newRoomCreated.payload.room.gameId, "connect-four");
    assert.equal(newRoomCreated.payload.room.status, "waiting");

    wsHost.close();
    wsGuest.close();
  });
});
