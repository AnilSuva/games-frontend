import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import type {
  ClientEnvelope,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomUpdatedPayload,
  ServerEnvelope,
  ServerPongPayload,
  SessionReadyPayload,
} from "../src/types/index.js";

function createWsClient(
  url: string,
  options?: { origin?: string }
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: options?.origin ? { Origin: options.origin } : undefined,
    });
    ws.once("open", () => resolve(ws));
    ws.once("error", (err) => reject(err));
  });
}

function waitForMessage<T>(
  ws: WebSocket,
  predicate?: (env: ServerEnvelope<T>) => boolean,
  timeoutMs: number = 3000
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

test("WebSocket Integration: End-to-end connection, room lifecycle, reconnect, and ping", async () => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "test",
    port: 0,
    disconnectGracePeriodMs: 5000,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  try {
    // 1. Client 1 Connects
    const ws1 = await createWsClient(wsUrl, { origin: "http://localhost:3000" });

    // Identify Client 1
    sendJson(ws1, {
      version: 1,
      type: "session.identify",
      requestId: "req_id_1",
      payload: { displayName: "PlayerAlpha" },
    });

    const ready1 = await waitForMessage<SessionReadyPayload>(
      ws1,
      (env) => env.type === "session.ready"
    );
    assert.equal(ready1.type, "session.ready");
    assert.ok(ready1.payload.playerId);
    assert.ok(ready1.payload.sessionToken);
    assert.equal(ready1.payload.displayName, "PlayerAlpha");

    // 2. Client 1 Creates Room
    sendJson(ws1, {
      version: 1,
      type: "room.create",
      requestId: "req_create_1",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });

    const created = await waitForMessage<RoomCreatedPayload>(
      ws1,
      (env) => env.type === "room.created"
    );
    assert.equal(created.type, "room.created");
    assert.equal(created.payload.room.gameId, "tic-tac-toe");
    assert.equal(created.payload.room.players.length, 1);
    assert.equal(created.payload.room.status, "waiting");
    const roomCode = created.payload.room.roomCode;
    assert.ok(roomCode);

    // 3. Client 2 Connects and Identifies
    const ws2 = await createWsClient(wsUrl, { origin: "http://localhost:3000" });

    sendJson(ws2, {
      version: 1,
      type: "session.identify",
      requestId: "req_id_2",
      payload: { displayName: "PlayerBeta" },
    });

    const ready2 = await waitForMessage<SessionReadyPayload>(
      ws2,
      (env) => env.type === "session.ready"
    );
    assert.ok(ready2.payload.playerId);
    assert.notEqual(ready2.payload.playerId, ready1.payload.playerId);

    // 4. Client 2 Joins Room
    const updatePromiseClient1 = waitForMessage<RoomUpdatedPayload>(
      ws1,
      (env) => env.type === "room.updated" && env.payload.reason === "player_joined"
    );

    sendJson(ws2, {
      version: 1,
      type: "room.join",
      requestId: "req_join_2",
      payload: { roomCode },
    });

    const joinedClient2 = await waitForMessage<RoomJoinedPayload>(
      ws2,
      (env) => env.type === "room.joined"
    );
    assert.equal(joinedClient2.type, "room.joined");
    assert.equal(joinedClient2.payload.room.players.length, 2);
    assert.equal(joinedClient2.payload.room.status, "in-progress");
    const client2ReconnectToken = joinedClient2.payload.reconnectToken;
    assert.ok(client2ReconnectToken);

    // Client 1 receives room.updated notification
    const updatedClient1 = await updatePromiseClient1;
    assert.equal(updatedClient1.payload.room.players.length, 2);
    assert.equal(updatedClient1.payload.reason, "player_joined");

    // 5. Client 3 attempts to join full room
    const ws3 = await createWsClient(wsUrl, { origin: "http://localhost:3000" });
    sendJson(ws3, {
      version: 1,
      type: "session.identify",
      requestId: "req_id_3",
      payload: { displayName: "PlayerGamma" },
    });
    await waitForMessage(ws3, (env) => env.type === "session.ready");

    sendJson(ws3, {
      version: 1,
      type: "room.join",
      requestId: "req_join_3",
      payload: { roomCode },
    });

    const fullError = await waitForMessage<{ code: string; message: string }>(
      ws3,
      (env) => env.type === "room.error"
    );
    assert.equal(fullError.type, "room.error");
    assert.equal(fullError.payload.code, "ROOM_FULL");
    ws3.close();

    // 6. Client 2 Disconnects -> Client 1 receives notification
    const disconnectNoticePromise = waitForMessage<RoomUpdatedPayload>(
      ws1,
      (env) => env.type === "room.updated" && env.payload.reason === "player_disconnected"
    );
    ws2.close();

    const disconnectNotice = await disconnectNoticePromise;
    assert.equal(disconnectNotice.payload.reason, "player_disconnected");
    const p2InNotice = disconnectNotice.payload.room.players.find(
      (p) => p.playerId === ready2.payload.playerId
    );
    assert.equal(p2InNotice?.connected, false);

    // 7. Client 2 Reconnects on fresh socket using reconnectToken
    const ws2Reconnected = await createWsClient(wsUrl, { origin: "http://localhost:3000" });

    const reconnectNoticePromise = waitForMessage<RoomUpdatedPayload>(
      ws1,
      (env) => env.type === "room.updated" && env.payload.reason === "player_reconnected"
    );

    sendJson(ws2Reconnected, {
      version: 1,
      type: "room.reconnect",
      requestId: "req_reconn_2",
      payload: {
        roomCode,
        reconnectToken: client2ReconnectToken,
      },
    });

    const reconnectedJoin = await waitForMessage<RoomJoinedPayload>(
      ws2Reconnected,
      (env) => env.type === "room.joined"
    );
    assert.equal(reconnectedJoin.type, "room.joined");
    assert.equal(reconnectedJoin.payload.room.roomCode, roomCode);

    const reconnectedNotice = await reconnectNoticePromise;
    assert.equal(reconnectedNotice.payload.reason, "player_reconnected");

    // 8. Ping / Pong test
    sendJson(ws1, {
      version: 1,
      type: "ping",
      requestId: "req_ping",
      payload: { clientTime: 9999 },
    });

    const pong = await waitForMessage<ServerPongPayload>(
      ws1,
      (env) => env.type === "server.pong"
    );
    assert.equal(pong.type, "server.pong");
    assert.equal(pong.payload.clientTime, 9999);
    assert.ok(pong.payload.serverTime > 0);

    // Clean up sockets
    ws1.close();
    ws2Reconnected.close();
  } finally {
    await server.stop();
  }
});

test("WebSocket Integration: rejects connection with unpermitted origin", async () => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "production", // Enforce strict origin checking
    port: 0,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  try {
    let errorCaught = false;
    try {
      await createWsClient(wsUrl, { origin: "http://unauthorized-domain.com" });
    } catch {
      errorCaught = true;
    }

    assert.equal(errorCaught, true, "Must reject connection from unauthorized origin");
  } finally {
    await server.stop();
  }
});
