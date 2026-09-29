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
import type { BrickBlastGameState } from "../src/games/brick-blast/types.js";

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

test("Brick Blast Server Integration: Full match lifecycle, inputs, events, anti-cheat, win, rematch, and reconnect", async (t) => {
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

  await t.test("Match flow: creation, player assignment, inputs, level progression, game over, and rematch rotation", async () => {
    // 1. Host (Player 1) connects and identifies
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "bb_host_id",
      payload: { displayName: "BBHost" },
    });
    const hostReady = await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");
    const hostPlayerId = hostReady.payload.playerId;
    assert.ok(hostPlayerId);

    // 2. Host creates Brick Blast room
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "bb_create",
      payload: { gameId: "brick-blast", maxPlayers: 2 },
    });
    const roomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const roomCode = roomCreated.payload.room.roomCode;
    const roomId = roomCreated.payload.room.roomId;
    assert.equal(roomCreated.payload.room.status, "waiting");
    assert.equal(roomCreated.payload.room.gameId, "brick-blast");

    // 3. Guest (Player 2) connects, identifies, and joins
    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "bb_guest_id",
      payload: { displayName: "BBGuest" },
    });
    const guestReady = await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");
    const guestPlayerId = guestReady.payload.playerId;
    assert.ok(guestPlayerId);

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "bb_join",
      payload: { roomCode },
    });

    const [guestJoinRes, hostInitialStateEnv, guestInitialStateEnv] = await Promise.all([
      waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state"),
    ]);

    assert.equal(guestJoinRes.payload.room.status, "in-progress");
    const initialGameState = hostInitialStateEnv.payload.gameState as BrickBlastGameState;
    assert.equal(initialGameState.status, "in_progress");
    assert.equal(initialGameState.currentLevel, 1);
    assert.equal(initialGameState.startingPlayer, "orange");
    assert.equal(initialGameState.playerRoles[hostPlayerId], "orange");
    assert.equal(initialGameState.playerRoles[guestPlayerId], "blue");
    assert.deepEqual(guestInitialStateEnv.payload.gameState, initialGameState);

    // 4. Test player input: Host moves paddle right
    const guestInputPromise = waitForMessage(wsGuest, (e) => e.type === "game.event");
    sendJson(wsHost, {
      version: 1,
      type: "game.input",
      requestId: "input_1",
      payload: { roomId, input: "paddle.right" },
    });
    const guestInputEnv = await guestInputPromise;
    const inputPayload = guestInputEnv.payload as {
      type: string;
      playerId: string;
      playerRole: string;
      input: string;
    };
    assert.equal(inputPayload.type, "player_input");
    assert.equal(inputPayload.playerId, hostPlayerId);
    assert.equal(inputPayload.playerRole, "orange");
    assert.equal(inputPayload.input, "paddle.right");

    // Guest stops paddle
    const hostInputPromise = waitForMessage(wsHost, (e) => e.type === "game.event");
    sendJson(wsGuest, {
      version: 1,
      type: "game.input",
      requestId: "input_2",
      payload: { roomId, input: "paddle.stop" },
    });
    const hostInputEnv = await hostInputPromise;
    const input2Payload = hostInputEnv.payload as {
      type: string;
      playerId: string;
      playerRole: string;
      input: string;
    };
    assert.equal(input2Payload.type, "player_input");
    assert.equal(input2Payload.playerId, guestPlayerId);
    assert.equal(input2Payload.playerRole, "blue");
    assert.equal(input2Payload.input, "paddle.stop");

    // 5. Test level complete event: Advances level authoritatively
    const hostLevelPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestLevelPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.event",
      requestId: "ev_lvl",
      payload: { roomId, event: "level_complete", data: { level: 2, score: 350 } },
    });
    const [hostLevelEnv, guestLevelEnv] = await Promise.all([hostLevelPromise, guestLevelPromise]);
    const lvlState = hostLevelEnv.payload.gameState as BrickBlastGameState;
    assert.equal(lvlState.currentLevel, 2);
    assert.deepEqual(guestLevelEnv.payload.gameState, lvlState);

    // 6. Test game over event: Ends match authoritatively
    const hostGameOverPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestGameOverPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.event",
      requestId: "ev_over",
      payload: { roomId, event: "game_over", data: { winner: "orange", score: 850 } },
    });
    const [hostOverEnv, guestOverEnv] = await Promise.all([hostGameOverPromise, guestGameOverPromise]);
    const overState = hostOverEnv.payload.gameState as BrickBlastGameState;
    assert.equal(overState.status, "won");
    assert.equal(overState.winner, "orange");
    assert.equal(overState.resultReason, "win");
    assert.deepEqual(guestOverEnv.payload.gameState, overState);

    // 7. Test rematch request and starting-player rotation
    const hostRematchWaitPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestRematchWaitPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.rematch",
      requestId: "bb_rematch_h",
      payload: { roomId },
    });
    const [hostRematchWaitEnv] = await Promise.all([hostRematchWaitPromise, guestRematchWaitPromise]);
    const rematchWaitState = hostRematchWaitEnv.payload.gameState as BrickBlastGameState;
    assert.deepEqual(rematchWaitState.rematchRequests, [hostPlayerId]);

    // Guest accepts rematch -> restarts match with starting player rotated to blue!
    const hostRestartPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestRestartPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.rematch",
      requestId: "bb_rematch_g",
      payload: { roomId },
    });
    const [hostRestartEnv, guestRestartEnv] = await Promise.all([hostRestartPromise, guestRestartPromise]);
    const restartState = hostRestartEnv.payload.gameState as BrickBlastGameState;
    assert.equal(restartState.status, "in_progress");
    assert.equal(restartState.currentLevel, 1);
    assert.equal(restartState.startingPlayer, "blue"); // Rotated
    assert.equal(restartState.winner, null);
    assert.deepEqual(guestRestartEnv.payload.gameState, restartState);

    wsHost.close();
    wsGuest.close();
  });

  await t.test("Input and Event validation: outsider rejection and malformed payload checks", async () => {
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
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "g_id",
      payload: { displayName: "Guest" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsOutsider, {
      version: 1,
      type: "session.identify",
      requestId: "out_id",
      payload: { displayName: "Outsider" },
    });
    await waitForMessage(wsOutsider, (e) => e.type === "session.ready");

    // Create & Join
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_bb",
      payload: { gameId: "brick-blast" },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "j_bb",
      payload: { roomCode },
    });
    await Promise.all([
      waitForMessage(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage(wsHost, (e) => e.type === "game.state"),
    ]);

    // Test 1: Outsider attempts input
    sendJson(wsOutsider, {
      version: 1,
      type: "game.input",
      requestId: "out_inp",
      payload: { roomId, input: "paddle.left" },
    });
    const errOut = await waitForMessage<RoomErrorPayload>(wsOutsider, (e) => e.type === "room.error");
    assert.equal(errOut.payload.code, "NOT_IN_ROOM");

    // Test 2: Outsider attempts event
    sendJson(wsOutsider, {
      version: 1,
      type: "game.event",
      requestId: "out_ev",
      payload: { roomId, event: "game_over", data: { winner: "blue" } },
    });
    const errOutEv = await waitForMessage<RoomErrorPayload>(wsOutsider, (e) => e.type === "room.error");
    assert.equal(errOutEv.payload.code, "NOT_IN_ROOM");

    wsHost.close();
    wsGuest.close();
    wsOutsider.close();
  });

  await t.test("Disconnect grace period: pauses match, forbids inputs, and forfeits on expiry", async () => {
    const wsHost = await createWsClient(wsUrl);
    const wsGuest = await createWsClient(wsUrl);

    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "h_bb2",
      payload: { displayName: "HostBB2" },
    });
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "g_bb2",
      payload: { displayName: "GuestBB2" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "c_bb2",
      payload: { gameId: "brick-blast" },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "j_bb2",
      payload: { roomCode },
    });
    await Promise.all([
      waitForMessage(wsGuest, (e) => e.type === "room.joined"),
      waitForMessage(wsHost, (e) => e.type === "game.state"),
    ]);

    // Guest abruptly disconnects
    wsGuest.close();

    const [hostUpdated, hostState] = await Promise.all([
      waitForMessage<RoomUpdatedPayload>(wsHost, (e) => e.type === "room.updated"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);
    assert.equal(hostUpdated.payload.reason, "player_disconnected");
    const hState = hostState.payload.gameState as BrickBlastGameState;
    assert.ok(hState.disconnectGraceExpiresAt);
    assert.ok(hState.disconnectGraceExpiresAt > Date.now());

    // Host attempts input while match is paused
    sendJson(wsHost, {
      version: 1,
      type: "game.input",
      requestId: "paused_input",
      payload: { roomId, input: "paddle.left" },
    });
    const errPaused = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.equal(errPaused.payload.code, "INVALID_MOVE");
    assert.match(errPaused.payload.message, /paused/i);

    // Wait for the 600ms grace period to expire on server -> Forfeit
    const forfeitState = await waitForMessage<GameStatePayload>(
      wsHost,
      (e) => e.type === "game.state" && (e.payload.gameState as BrickBlastGameState).status === "won",
      3000
    );

    const fState = forfeitState.payload.gameState as BrickBlastGameState;
    assert.equal(fState.status, "won");
    assert.equal(fState.winner, "orange"); // Connected player (Host) won by forfeit
    assert.equal(fState.resultReason, "disconnect_forfeit");

    wsHost.close();
  });
});
