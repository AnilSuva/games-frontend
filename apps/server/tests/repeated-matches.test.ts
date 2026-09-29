import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";
import type { TicTacToeGameState } from "../src/games/tic-tac-toe/types.js";

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

test("Repeated Match Lifecycle & Connection Stability", async (t) => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "test",
    port: 0,
    disconnectGracePeriodMs: 2000,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  t.after(async () => {
    await server.stop();
  });

  await t.test("Pattern 1: Reconnecting/new sockets across matches racing with previous socket close", async () => {
    // 1. Initial sessions
    const wsA1 = await createWsClient(wsUrl);
    sendJson(wsA1, {
      version: 1,
      type: "session.identify",
      requestId: "p1_id_a",
      payload: { displayName: "PlayerA" },
    });
    const readyA = await waitForMessage<SessionReadyPayload>(wsA1, (e) => e.type === "session.ready");
    const sessionTokenA = readyA.payload.sessionToken;

    const wsB1 = await createWsClient(wsUrl);
    sendJson(wsB1, {
      version: 1,
      type: "session.identify",
      requestId: "p1_id_b",
      payload: { displayName: "PlayerB" },
    });
    const readyB = await waitForMessage<SessionReadyPayload>(wsB1, (e) => e.type === "session.ready");
    const sessionTokenB = readyB.payload.sessionToken;

    let currentWsA = wsA1;
    let currentWsB = wsB1;

    for (let match = 1; match <= 5; match++) {
      // Create room
      sendJson(currentWsA, {
        version: 1,
        type: "room.create",
        requestId: `p1_create_${match}`,
        payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
      });
      const created = await waitForMessage<RoomCreatedPayload>(currentWsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      // Join room
      const guestJoinPromise = waitForMessage<RoomJoinedPayload>(currentWsB, (e) => e.type === "room.joined");
      const hostStatePromise = waitForMessage<GameStatePayload>(currentWsA, (e) => e.type === "game.state");
      sendJson(currentWsB, {
        version: 1,
        type: "room.join",
        requestId: `p1_join_${match}`,
        payload: { roomCode },
      });
      await Promise.all([guestJoinPromise, hostStatePromise]);

      // Play 5 moves (A wins)
      const a1 = waitForMessage<GameStatePayload>(currentWsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[0] === "X");
      sendJson(currentWsA, { version: 1, type: "game.move", requestId: `p1_m1_${match}`, payload: { roomId, position: 0 } });
      await a1;

      const b1 = waitForMessage<GameStatePayload>(currentWsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[3] === "O");
      sendJson(currentWsB, { version: 1, type: "game.move", requestId: `p1_m2_${match}`, payload: { roomId, position: 3 } });
      await b1;

      const a2 = waitForMessage<GameStatePayload>(currentWsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[1] === "X");
      sendJson(currentWsA, { version: 1, type: "game.move", requestId: `p1_m3_${match}`, payload: { roomId, position: 1 } });
      await a2;

      const b2 = waitForMessage<GameStatePayload>(currentWsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[4] === "O");
      sendJson(currentWsB, { version: 1, type: "game.move", requestId: `p1_m4_${match}`, payload: { roomId, position: 4 } });
      await b2;

      const a3 = waitForMessage<GameStatePayload>(currentWsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).status === "won");
      sendJson(currentWsA, { version: 1, type: "game.move", requestId: `p1_m5_${match}`, payload: { roomId, position: 2 } });
      const winState = await a3;
      assert.equal((winState.payload.gameState as TicTacToeGameState).status, "won");

      // Leave room
      const aLeave = waitForMessage<RoomLeftPayload>(currentWsA, (e) => e.type === "room.left");
      sendJson(currentWsA, { version: 1, type: "room.leave", requestId: `p1_leave_a_${match}`, payload: { roomId } });
      await aLeave;

      const bLeave = waitForMessage<RoomLeftPayload>(currentWsB, (e) => e.type === "room.left");
      sendJson(currentWsB, { version: 1, type: "room.leave", requestId: `p1_leave_b_${match}`, payload: { roomId } });
      await bLeave;

      // Connect new sockets identifying with same session tokens BEFORE closing old sockets
      const oldWsA = currentWsA;
      const oldWsB = currentWsB;

      const nextWsA = await createWsClient(wsUrl);
      sendJson(nextWsA, {
        version: 1,
        type: "session.identify",
        requestId: `p1_id_a_${match}`,
        payload: { sessionToken: sessionTokenA },
      });
      await waitForMessage<SessionReadyPayload>(nextWsA, (e) => e.type === "session.ready");

      const nextWsB = await createWsClient(wsUrl);
      sendJson(nextWsB, {
        version: 1,
        type: "session.identify",
        requestId: `p1_id_b_${match}`,
        payload: { sessionToken: sessionTokenB },
      });
      await waitForMessage<SessionReadyPayload>(nextWsB, (e) => e.type === "session.ready");

      // Close previous sockets asynchronously
      oldWsA.close();
      oldWsB.close();

      currentWsA = nextWsA;
      currentWsB = nextWsB;

      // Small pause to allow old socket close events to reach server
      await new Promise((r) => setTimeout(r, 60));
    }

    currentWsA.close();
    currentWsB.close();
  });

  await t.test("Pattern 2: Persistent socket, leaving room and immediately creating next room without reconnect", async () => {
    const wsA = await createWsClient(wsUrl);
    sendJson(wsA, { version: 1, type: "session.identify", requestId: "p2_a", payload: { displayName: "PersistentA" } });
    await waitForMessage<SessionReadyPayload>(wsA, (e) => e.type === "session.ready");

    const wsB = await createWsClient(wsUrl);
    sendJson(wsB, { version: 1, type: "session.identify", requestId: "p2_b", payload: { displayName: "PersistentB" } });
    await waitForMessage<SessionReadyPayload>(wsB, (e) => e.type === "session.ready");

    for (let match = 1; match <= 5; match++) {
      sendJson(wsA, {
        version: 1,
        type: "room.create",
        requestId: `p2_c_${match}`,
        payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
      });
      const created = await waitForMessage<RoomCreatedPayload>(wsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      const guestJoinPromise = waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      const hostStatePromise = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");
      sendJson(wsB, { version: 1, type: "room.join", requestId: `p2_j_${match}`, payload: { roomCode } });
      await Promise.all([guestJoinPromise, hostStatePromise]);

      // Quick win
      const a1 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[0] === "X");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p2_m1_${match}`, payload: { roomId, position: 0 } });
      await a1;

      const b1 = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[3] === "O");
      sendJson(wsB, { version: 1, type: "game.move", requestId: `p2_m2_${match}`, payload: { roomId, position: 3 } });
      await b1;

      const a2 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[1] === "X");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p2_m3_${match}`, payload: { roomId, position: 1 } });
      await a2;

      const b2 = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[4] === "O");
      sendJson(wsB, { version: 1, type: "game.move", requestId: `p2_m4_${match}`, payload: { roomId, position: 4 } });
      await b2;

      const a3 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).status === "won");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p2_m5_${match}`, payload: { roomId, position: 2 } });
      await a3;

      // Both leave
      const aLeave = waitForMessage<RoomLeftPayload>(wsA, (e) => e.type === "room.left");
      sendJson(wsA, { version: 1, type: "room.leave", requestId: `p2_l_a_${match}`, payload: { roomId } });
      await aLeave;

      const bLeave = waitForMessage<RoomLeftPayload>(wsB, (e) => e.type === "room.left");
      sendJson(wsB, { version: 1, type: "room.leave", requestId: `p2_l_b_${match}`, payload: { roomId } });
      await bLeave;
    }

    wsA.close();
    wsB.close();
  });

  await t.test("Pattern 4: Mid-game disconnect, reconnect with token, finish, then new room cycle", async () => {
    let wsA = await createWsClient(wsUrl);
    sendJson(wsA, { version: 1, type: "session.identify", requestId: "p4_a", payload: { displayName: "ReconnA" } });
    const readyA = await waitForMessage<SessionReadyPayload>(wsA, (e) => e.type === "session.ready");
    const sessionTokenA = readyA.payload.sessionToken;

    let wsB = await createWsClient(wsUrl);
    sendJson(wsB, { version: 1, type: "session.identify", requestId: "p4_b", payload: { displayName: "ReconnB" } });
    const readyB = await waitForMessage<SessionReadyPayload>(wsB, (e) => e.type === "session.ready");
    const sessionTokenB = readyB.payload.sessionToken;

    for (let match = 1; match <= 3; match++) {
      sendJson(wsA, { version: 1, type: "room.create", requestId: `p4_c_${match}`, payload: { gameId: "tic-tac-toe", maxPlayers: 2 } });
      const created = await waitForMessage<RoomCreatedPayload>(wsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      const guestJoined = waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      sendJson(wsB, { version: 1, type: "room.join", requestId: `p4_j_${match}`, payload: { roomCode } });
      const bJoined = await guestJoined;
      const bReconnectToken = bJoined.payload.reconnectToken;

      await waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");

      // Player B disconnects mid-game
      wsB.close();
      await waitForMessage(wsA, (e) => e.type === "room.updated" && (e.payload as any).reason === "player_disconnected");

      // Player B reconnects with reconnectToken
      wsB = await createWsClient(wsUrl);
      sendJson(wsB, {
        version: 1,
        type: "room.reconnect",
        requestId: `p4_rec_${match}`,
        payload: { roomCode, reconnectToken: bReconnectToken },
      });
      await waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      await waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).disconnectGraceExpiresAt === null);

      // Finish match cleanly (A plays 0, B plays 3, A plays 1, B plays 4, A plays 2)
      const a1 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[0] === "X");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p4_m_1_${match}`, payload: { roomId, position: 0 } });
      await a1;

      const b1 = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[3] === "O");
      sendJson(wsB, { version: 1, type: "game.move", requestId: `p4_m_2_${match}`, payload: { roomId, position: 3 } });
      await b1;

      const a2 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[1] === "X");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p4_m_3_${match}`, payload: { roomId, position: 1 } });
      await a2;

      const b2 = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).board[4] === "O");
      sendJson(wsB, { version: 1, type: "game.move", requestId: `p4_m_4_${match}`, payload: { roomId, position: 4 } });
      await b2;

      const a3 = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).status === "won");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p4_m_5_${match}`, payload: { roomId, position: 2 } });
      await a3;

      // Both leave
      const aLeave = waitForMessage<RoomLeftPayload>(wsA, (e) => e.type === "room.left");
      sendJson(wsA, { version: 1, type: "room.leave", requestId: `p4_l_a_${match}`, payload: { roomId } });
      await aLeave;

      const bLeave = waitForMessage<RoomLeftPayload>(wsB, (e) => e.type === "room.left");
      sendJson(wsB, { version: 1, type: "room.leave", requestId: `p4_l_b_${match}`, payload: { roomId } });
      await bLeave;
    }

    wsA.close();
    wsB.close();
  });

  await t.test("Pattern 3: One player creates next room before opponent leaves, joinRoom cleans up prior room", async () => {
    const wsA = await createWsClient(wsUrl);
    sendJson(wsA, { version: 1, type: "session.identify", requestId: "p3_a", payload: { displayName: "PlayerA" } });
    await waitForMessage<SessionReadyPayload>(wsA, (e) => e.type === "session.ready");

    const wsB = await createWsClient(wsUrl);
    sendJson(wsB, { version: 1, type: "session.identify", requestId: "p3_b", payload: { displayName: "PlayerB" } });
    await waitForMessage<SessionReadyPayload>(wsB, (e) => e.type === "session.ready");

    for (let match = 1; match <= 5; match++) {
      // Host creates room
      sendJson(wsA, { version: 1, type: "room.create", requestId: `p3_c_${match}`, payload: { gameId: "tic-tac-toe", maxPlayers: 2 } });
      const created = await waitForMessage<RoomCreatedPayload>(wsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      // Guest joins
      const guestJoined = waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      sendJson(wsB, { version: 1, type: "room.join", requestId: `p3_j_${match}`, payload: { roomCode } });
      await guestJoined;
      await waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");

      // Host leaves room FIRST while Guest is still in room
      const aLeave = waitForMessage<RoomLeftPayload>(wsA, (e) => e.type === "room.left");
      sendJson(wsA, { version: 1, type: "room.leave", requestId: `p3_l_a_${match}`, payload: { roomId } });
      await aLeave;

      // In the next iteration, Host creates a new room, and Guest will join it (triggering automatic room transition)
    }

    // Guest leaves final room
    const bLeave = waitForMessage<RoomLeftPayload>(wsB, (e) => e.type === "room.left");
    sendJson(wsB, { version: 1, type: "room.leave", requestId: "p3_final_b_leave", payload: {} });
    await bLeave;

    wsA.close();
    wsB.close();
  });

  await t.test("Pattern 5: Connect Four repeated match cycles 5+ times (Create -> Join -> Move -> Leave -> New Room)", async () => {
    const wsA = await createWsClient(wsUrl);
    sendJson(wsA, { version: 1, type: "session.identify", requestId: "p5_a", payload: { displayName: "C4PlayerA" } });
    await waitForMessage<SessionReadyPayload>(wsA, (e) => e.type === "session.ready");

    const wsB = await createWsClient(wsUrl);
    sendJson(wsB, { version: 1, type: "session.identify", requestId: "p5_b", payload: { displayName: "C4PlayerB" } });
    await waitForMessage<SessionReadyPayload>(wsB, (e) => e.type === "session.ready");

    for (let match = 1; match <= 5; match++) {
      sendJson(wsA, {
        version: 1,
        type: "room.create",
        requestId: `p5_c_${match}`,
        payload: { gameId: "connect-four", maxPlayers: 2 },
      });
      const created = await waitForMessage<RoomCreatedPayload>(wsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      const guestJoinPromise = waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      const hostStatePromise = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");
      sendJson(wsB, { version: 1, type: "room.join", requestId: `p5_j_${match}`, payload: { roomCode } });
      await Promise.all([guestJoinPromise, hostStatePromise]);

      // Move: Player A plays column 0
      const aMoveHost = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");
      const aMoveGuest = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state");
      sendJson(wsA, { version: 1, type: "game.move", requestId: `p5_m1_${match}`, payload: { roomId, column: 0 } });
      await Promise.all([aMoveHost, aMoveGuest]);

      // Both leave
      const aLeave = waitForMessage<RoomLeftPayload>(wsA, (e) => e.type === "room.left");
      sendJson(wsA, { version: 1, type: "room.leave", requestId: `p5_la_${match}`, payload: { roomId } });
      await aLeave;

      const bLeave = waitForMessage<RoomLeftPayload>(wsB, (e) => e.type === "room.left");
      sendJson(wsB, { version: 1, type: "room.leave", requestId: `p5_lb_${match}`, payload: { roomId } });
      await bLeave;
    }

    wsA.close();
    wsB.close();
  });

  await t.test("Pattern 6: Brick Blast repeated match cycles 5+ times (Create -> Join -> Input -> Event -> Leave -> New Room)", async () => {
    const wsA = await createWsClient(wsUrl);
    sendJson(wsA, { version: 1, type: "session.identify", requestId: "p6_a", payload: { displayName: "BBPlayerA" } });
    await waitForMessage<SessionReadyPayload>(wsA, (e) => e.type === "session.ready");

    const wsB = await createWsClient(wsUrl);
    sendJson(wsB, { version: 1, type: "session.identify", requestId: "p6_b", payload: { displayName: "BBPlayerB" } });
    await waitForMessage<SessionReadyPayload>(wsB, (e) => e.type === "session.ready");

    for (let match = 1; match <= 5; match++) {
      sendJson(wsA, {
        version: 1,
        type: "room.create",
        requestId: `p6_c_${match}`,
        payload: { gameId: "brick-blast", maxPlayers: 2 },
      });
      const created = await waitForMessage<RoomCreatedPayload>(wsA, (e) => e.type === "room.created");
      const { roomId, roomCode } = created.payload.room;

      const guestJoinPromise = waitForMessage<RoomJoinedPayload>(wsB, (e) => e.type === "room.joined");
      const hostStatePromise = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");
      sendJson(wsB, { version: 1, type: "room.join", requestId: `p6_j_${match}`, payload: { roomCode } });
      await Promise.all([guestJoinPromise, hostStatePromise]);

      // Player inputs
      const inputHost = waitForMessage(wsA, (e) => e.type === "game.event" && (e.payload as any).type === "player_input");
      const inputGuest = waitForMessage(wsB, (e) => e.type === "game.event" && (e.payload as any).type === "player_input");
      sendJson(wsA, { version: 1, type: "game.input", requestId: `p6_inp_${match}`, payload: { roomId, input: "paddle.left" } });
      await Promise.all([inputHost, inputGuest]);

      // Game over event
      const endHost = waitForMessage<GameStatePayload>(wsA, (e) => e.type === "game.state");
      const endGuest = waitForMessage<GameStatePayload>(wsB, (e) => e.type === "game.state");
      sendJson(wsA, { version: 1, type: "game.event", requestId: `p6_ev_${match}`, payload: { roomId, event: "game_over", data: { winner: "orange" } } });
      await Promise.all([endHost, endGuest]);

      // Both leave
      const aLeave = waitForMessage<RoomLeftPayload>(wsA, (e) => e.type === "room.left");
      sendJson(wsA, { version: 1, type: "room.leave", requestId: `p6_la_${match}`, payload: { roomId } });
      await aLeave;

      const bLeave = waitForMessage<RoomLeftPayload>(wsB, (e) => e.type === "room.left");
      sendJson(wsB, { version: 1, type: "room.leave", requestId: `p6_lb_${match}`, payload: { roomId } });
      await bLeave;
    }

    wsA.close();
    wsB.close();
  });

  await t.test("Resource Leak Check: No stale rooms, connections, or timers after all tests", async () => {
    // Wait briefly for all sockets to close completely
    await new Promise((r) => setTimeout(r, 100));

    const activeRooms = (server.roomManager as any).roomsById.size;
    const activeConnections = server.wsContext.connectionTracker.size();
    const activeTimers = (server.roomManager as any).reconnectManager.disconnectTimers.size;

    assert.equal(activeRooms, 0, `Expected 0 active rooms, found ${activeRooms}`);
    assert.equal(activeConnections, 0, `Expected 0 active connections, found ${activeConnections}`);
    assert.equal(activeTimers, 0, `Expected 0 active timers, found ${activeTimers}`);
  });
});
