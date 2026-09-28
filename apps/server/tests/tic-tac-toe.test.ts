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
  RoomUpdatedPayload,
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

test("Tic-Tac-Toe Server Integration: Full match lifecycle, turns, anti-cheat, win, draw, rematch, and reconnect", async (t) => {
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

    // 2. Host creates Tic-Tac-Toe room
    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "create_ttt",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });
    const roomCreated = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const roomCode = roomCreated.payload.room.roomCode;
    const roomId = roomCreated.payload.room.roomId;
    assert.equal(roomCreated.payload.room.gameId, "tic-tac-toe");
    assert.equal(roomCreated.payload.room.players.length, 1);
    assert.equal(roomCreated.payload.room.players[0].seat, 0);

    // 3. Guest (Player 2) connects, identifies, and joins room
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

    const guestJoinPromise = waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");
    const hostUpdatePromise = waitForMessage<RoomUpdatedPayload>(wsHost, (e) => e.type === "room.updated");
    const guestStatePromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    const hostStatePromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "join_ttt",
      payload: { roomCode },
    });

    const [guestJoined, hostUpdated, guestInitialState, hostInitialState] = await Promise.all([
      guestJoinPromise,
      hostUpdatePromise,
      guestStatePromise,
      hostStatePromise,
    ]);

    // Verify player assignments & starting player
    assert.equal(guestJoined.payload.room.status, "in-progress");
    assert.equal(guestJoined.payload.room.players.length, 2);
    assert.equal(guestJoined.payload.room.players[0].playerId, hostPlayerId);
    assert.equal(guestJoined.payload.room.players[0].seat, 0); // Orange
    assert.equal(guestJoined.payload.room.players[1].playerId, guestPlayerId);
    assert.equal(guestJoined.payload.room.players[1].seat, 1); // Blue

    const initHostState = hostInitialState.payload.gameState as TicTacToeGameState;
    const initGuestState = guestInitialState.payload.gameState as TicTacToeGameState;
    assert.equal(initHostState.playerMarks[hostPlayerId], "X");
    assert.equal(initHostState.playerMarks[guestPlayerId], "O");
    assert.equal(initHostState.currentPlayer, "X"); // Orange starts first match
    assert.equal(initHostState.startingPlayer, "X");
    assert.equal(initGuestState.currentPlayer, "X");

    // 4. Turn & Move validation:
    // Move from wrong player (Guest moves when it's Orange's turn) -> rejected with NOT_YOUR_TURN
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "guest_illegal_move",
      payload: { roomId, position: 0 },
    });
    const guestError1 = await waitForMessage<RoomErrorPayload>(wsGuest, (e) => e.type === "room.error");
    assert.equal(guestError1.payload.code, "NOT_YOUR_TURN");

    // Valid move from Orange (position 0)
    const hostMove1Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestMove1Promise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "host_move_1",
      payload: { roomId, position: 0 },
    });
    const [hostStateAfter1, guestStateAfter1] = await Promise.all([hostMove1Promise, guestMove1Promise]);
    const state1 = hostStateAfter1.payload.gameState as TicTacToeGameState;
    assert.equal(state1.board[0], "X");
    assert.equal(state1.currentPlayer, "O");
    assert.ok(hostStateAfter1.payload.version > 1);

    // Double move rejected (Host tries to move again)
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "host_double_move",
      payload: { roomId, position: 1 },
    });
    const hostDoubleErr = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.equal(hostDoubleErr.payload.code, "NOT_YOUR_TURN");

    // Invalid position rejected (Move to already occupied cell 0 by guest)
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "guest_occupied_move",
      payload: { roomId, position: 0 },
    });
    const guestOccupiedErr = await waitForMessage<RoomErrorPayload>(wsGuest, (e) => e.type === "room.error");
    assert.equal(guestOccupiedErr.payload.code, "INVALID_MOVE");

    // Valid move from Blue (position 3)
    const hostMove2Promise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "guest_move_1",
      payload: { roomId, position: 3 },
    });
    const hostStateAfter2 = await hostMove2Promise;
    const state2 = hostStateAfter2.payload.gameState as TicTacToeGameState;
    assert.equal(state2.board[3], "O");
    assert.equal(state2.currentPlayer, "X");

    // Play towards an Orange horizontal win: row 0 [0, 1, 2]
    // Orange takes 1
    const p3 = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsHost, { version: 1, type: "game.move", requestId: "h_m2", payload: { roomId, position: 1 } });
    await p3;

    // Blue takes 4
    const p4 = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsGuest, { version: 1, type: "game.move", requestId: "g_m2", payload: { roomId, position: 4 } });
    await p4;

    // Orange takes 2 -> Orange completes top row [0, 1, 2]! Win!
    const winHostPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const winGuestPromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, { version: 1, type: "game.move", requestId: "h_m3", payload: { roomId, position: 2 } });
    const [finalHostState, finalGuestState] = await Promise.all([winHostPromise, winGuestPromise]);

    const winState = finalHostState.payload.gameState as TicTacToeGameState;
    assert.equal(winState.status, "won");
    assert.equal(winState.winner, "X");
    assert.ok(winState.winningLine);
    assert.deepEqual(winState.winningLine?.line, [0, 1, 2]);

    // Move after game over rejected
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "guest_after_game_over",
      payload: { roomId, position: 8 },
    });
    const afterOverErr = await waitForMessage<RoomErrorPayload>(wsGuest, (e) => e.type === "room.error");
    assert.equal(afterOverErr.payload.code, "GAME_NOT_IN_PROGRESS");

    // Rematch flow:
    // Host requests rematch
    const rematchHostPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.rematch",
      requestId: "h_rematch",
      payload: { roomId },
    });
    const stateAfterRematchReq = (await rematchHostPromise).payload.gameState as TicTacToeGameState;
    assert.deepEqual(stateAfterRematchReq.rematchRequests, [hostPlayerId]);
    assert.equal(stateAfterRematchReq.status, "won"); // Not reset yet because guest hasn't agreed

    // Guest requests rematch -> Both agreed! Starting player swaps to Blue ("O")!
    const rematchHostReset = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const rematchGuestReset = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.rematch",
      requestId: "g_rematch",
      payload: { roomId },
    });
    const [hostResetState, guestResetState] = await Promise.all([rematchHostReset, rematchGuestReset]);
    const nextMatchState = hostResetState.payload.gameState as TicTacToeGameState;
    assert.equal(nextMatchState.status, "in_progress");
    assert.equal(nextMatchState.moveCount, 0);
    assert.equal(nextMatchState.winner, null);
    assert.equal(nextMatchState.startingPlayer, "O"); // Rotated to Blue!
    assert.equal(nextMatchState.currentPlayer, "O"); // Blue plays first!
    assert.deepEqual(nextMatchState.board, [null, null, null, null, null, null, null, null, null]);

    // Blue can now make first move in rematch
    const blueMovePromise = waitForMessage<GameStatePayload>(
      wsGuest,
      (e) =>
        e.type === "game.state" &&
        (e.payload.gameState as TicTacToeGameState).moveCount === 1
    );
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "blue_first_move",
      payload: { roomId, position: 4 },
    });
    const blueMoveState = (await blueMovePromise).payload.gameState as TicTacToeGameState;
    assert.equal(blueMoveState.board[4], "O");
    assert.equal(blueMoveState.currentPlayer, "X");

    wsHost.close();
    wsGuest.close();
  });

  await t.test("Draw game detection and rematch reset", async () => {
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "draw_host_id",
      payload: { displayName: "DrawHost" },
    });
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "create_draw_room",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomCode, roomId } = created.payload.room;

    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "draw_guest_id",
      payload: { displayName: "DrawGuest" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    const hostReadyPromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "join_draw",
      payload: { roomCode },
    });
    await waitForMessage(wsGuest, (e) => e.type === "game.state");
    await hostReadyPromise;

    // Sequence producing a draw:
    // Board:
    // X O X
    // X X O
    // O X O
    // Positions:
    // 0: X, 1: O, 2: X, 4: O (let's do: 0(X), 1(O), 2(X), 3(O is wrong, wait: 0=X, 1=O, 2=X, 4=O, 3=X, 5=O, 7=X, 6=O, 8=X)
    // 0: X, 1: O, 2: X
    // 3: X, 4: O, 5: O
    // 6: O, 7: X, 8: X
    // Let's verify line checks:
    // Rows:
    // [0,1,2]: X, O, X (no)
    // [3,4,5]: X, O, O (no)
    // [6,7,8]: O, X, X (no)
    // Cols:
    // [0,3,6]: X, X, O (no)
    // [1,4,7]: O, O, X (no)
    // [2,5,8]: X, O, X (no)
    // Diagonals:
    // [0,4,8]: X, O, X (no)
    // [2,4,6]: X, O, O (no)
    // It's a draw!
    // Moves order:
    // 1. Host(X) -> 0
    // 2. Guest(O) -> 1
    // 3. Host(X) -> 2
    // 4. Guest(O) -> 4
    // 5. Host(X) -> 3
    // 6. Guest(O) -> 5
    // 7. Host(X) -> 7
    // 8. Guest(O) -> 6
    // 9. Host(X) -> 8

    const moves = [
      { ws: wsHost, pos: 0 },
      { ws: wsGuest, pos: 1 },
      { ws: wsHost, pos: 2 },
      { ws: wsGuest, pos: 4 },
      { ws: wsHost, pos: 3 },
      { ws: wsGuest, pos: 5 },
      { ws: wsHost, pos: 7 },
      { ws: wsGuest, pos: 6 },
      { ws: wsHost, pos: 8 },
    ];

    let lastState: TicTacToeGameState | null = null;
    for (let i = 0; i < moves.length; i++) {
      const { ws, pos } = moves[i];
      const p = waitForMessage<GameStatePayload>(
        ws,
        (e) =>
          e.type === "game.state" &&
          (e.payload.gameState as TicTacToeGameState).moveCount === i + 1
      );
      sendJson(ws, {
        version: 1,
        type: "game.move",
        requestId: `draw_move_${i}`,
        payload: { roomId, position: pos },
      });
      const res = await p;
      lastState = res.payload.gameState as TicTacToeGameState;
    }

    assert.ok(lastState);
    assert.equal(lastState.status, "draw");
    assert.equal(lastState.winner, null);
    assert.equal(lastState.winningLine, null);
    assert.equal(lastState.moveCount, 9);

    wsHost.close();
    wsGuest.close();
  });

  await t.test("Reconnect preserves game state and session during active match", async () => {
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "rec_host_id",
      payload: { displayName: "RecHost" },
    });
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "rec_create",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomCode, roomId } = created.payload.room;

    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "rec_guest_id",
      payload: { displayName: "RecGuest" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "rec_join",
      payload: { roomCode },
    });
    const guestJoined = await waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");
    const guestReconnectToken = guestJoined.payload.reconnectToken;
    assert.ok(guestReconnectToken);

    await waitForMessage(wsHost, (e) => e.type === "game.state");

    // Host makes 1 move
    const p1 = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "rec_m1",
      payload: { roomId, position: 4 },
    });
    await p1;

    // Guest disconnects unexpectedly
    const hostSeesDisconnect = waitForMessage<RoomUpdatedPayload>(
      wsHost,
      (e) => e.type === "room.updated" && e.payload.reason === "player_disconnected"
    );
    wsGuest.close();
    await hostSeesDisconnect;

    // Guest reconnects using reconnectToken on a fresh socket
    const wsGuestFresh = await createWsClient(wsUrl);
    const hostSeesReconnect = waitForMessage<RoomUpdatedPayload>(
      wsHost,
      (e) => e.type === "room.updated" && e.payload.reason === "player_reconnected"
    );
    const guestJoinedAgain = waitForMessage<RoomJoinedPayload>(wsGuestFresh, (e) => e.type === "room.joined");
    const guestStateAgain = waitForMessage<GameStatePayload>(wsGuestFresh, (e) => e.type === "game.state");

    sendJson(wsGuestFresh, {
      version: 1,
      type: "room.reconnect",
      requestId: "rec_token_reconnect",
      payload: { roomCode, reconnectToken: guestReconnectToken },
    });

    const [joinedPayload, restoredState] = await Promise.all([
      guestJoinedAgain,
      guestStateAgain,
      hostSeesReconnect,
    ]);

    assert.equal(joinedPayload.payload.room.roomId, roomId);
    assert.ok(joinedPayload.payload.room.gameState);
    const restoredGame = restoredState.payload.gameState as TicTacToeGameState;
    assert.equal(restoredGame.board[4], "X"); // Move preserved!
    assert.equal(restoredGame.currentPlayer, "O"); // It's still Blue's turn!

    // Reconnected Blue can now play their move
    const blueMovePromise = waitForMessage<GameStatePayload>(wsGuestFresh, (e) => e.type === "game.state");
    sendJson(wsGuestFresh, {
      version: 1,
      type: "game.move",
      requestId: "rec_blue_move",
      payload: { roomId, position: 0 },
    });
    const blueMoved = (await blueMovePromise).payload.gameState as TicTacToeGameState;
    assert.equal(blueMoved.board[0], "O");

    wsHost.close();
    wsGuestFresh.close();
  });

  await t.test("Security: Outsider cannot move, and reconnect after grace expiry fails", async () => {
    // 1. Host creates room
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "sec_h_id",
      payload: { displayName: "SecHost" },
    });
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "sec_create",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomCode, roomId } = created.payload.room;

    // 2. Guest joins room
    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "sec_g_id",
      payload: { displayName: "SecGuest" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "sec_join",
      payload: { roomCode },
    });
    const guestJoined = await waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");
    const guestReconnectToken = guestJoined.payload.reconnectToken;
    await waitForMessage(wsHost, (e) => e.type === "game.state");

    // 3. Outsider client (not in room) attempts to send move
    const wsOutsider = await createWsClient(wsUrl);
    sendJson(wsOutsider, {
      version: 1,
      type: "session.identify",
      requestId: "sec_out_id",
      payload: { displayName: "Attacker" },
    });
    await waitForMessage(wsOutsider, (e) => e.type === "session.ready");

    sendJson(wsOutsider, {
      version: 1,
      type: "game.move",
      requestId: "attack_move",
      payload: { roomId, position: 0 },
    });
    const outsiderErr = await waitForMessage<RoomErrorPayload>(wsOutsider, (e) => e.type === "room.error");
    assert.equal(outsiderErr.payload.code, "NOT_IN_ROOM");

    // 4. Guest disconnects, wait beyond grace period (server disconnectGracePeriodMs is 600ms)
    wsGuest.close();
    await new Promise((r) => setTimeout(r, 800));

    // Guest attempts reconnect after grace expiry
    const wsGuestLate = await createWsClient(wsUrl);
    sendJson(wsGuestLate, {
      version: 1,
      type: "room.reconnect",
      requestId: "sec_late_reconnect",
      payload: { roomCode, reconnectToken: guestReconnectToken },
    });
    const lateErr = await waitForMessage<RoomErrorPayload>(wsGuestLate, (e) => e.type === "room.error");
    assert.ok(
      lateErr.payload.code === "RECONNECT_EXPIRED" ||
      lateErr.payload.code === "INVALID_SESSION"
    );

    wsHost.close();
    wsOutsider.close();
    wsGuestLate.close();
  });

  await t.test("Disconnect grace period: pause match, forbid moves, resume on reconnect, and forfeit on expiry", async () => {
    // 1. Host creates room
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "forfeit_h_id",
      payload: { displayName: "ForfeitHost" },
    });
    await waitForMessage(wsHost, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "forfeit_create",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomCode, roomId } = created.payload.room;

    // 2. Guest joins room
    let wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "forfeit_g_id",
      payload: { displayName: "ForfeitGuest" },
    });
    await waitForMessage(wsGuest, (e) => e.type === "session.ready");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "forfeit_join",
      payload: { roomCode },
    });
    const guestJoined = await waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");
    let guestReconnectToken = guestJoined.payload.reconnectToken;
    await waitForMessage(wsHost, (e) => e.type === "game.state");

    // 3. Guest disconnects mid-game
    wsGuest.close();

    // Host receives room.updated (player_disconnected) and game.state with disconnectGraceExpiresAt
    const [hostUpdated1, hostState1] = await Promise.all([
      waitForMessage<RoomUpdatedPayload>(wsHost, (e) => e.type === "room.updated"),
      waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state"),
    ]);

    assert.equal(hostUpdated1.payload.reason, "player_disconnected");
    const h1State = hostState1.payload.gameState as TicTacToeGameState;
    assert.ok(h1State.disconnectGraceExpiresAt);
    assert.ok(h1State.disconnectGraceExpiresAt > Date.now());

    // 4. Host attempts to move while match is paused -> must be rejected
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "move_during_pause",
      payload: { roomId, position: 0 },
    });
    const pauseErr = await waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    assert.equal(pauseErr.payload.code, "INVALID_MOVE");
    assert.match(pauseErr.payload.message, /Match is paused/);

    // 5. Guest reconnects within grace period -> match resumes and pause is cleared
    wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "room.reconnect",
      requestId: "reconnect_within_grace",
      payload: { roomCode, reconnectToken: guestReconnectToken },
    });
    const reconnectedPayload = await waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");
    guestReconnectToken = reconnectedPayload.payload.reconnectToken;

    const hostResumedState = await waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const hResumed = hostResumedState.payload.gameState as TicTacToeGameState;
    assert.equal(hResumed.disconnectGraceExpiresAt, null);
    assert.equal(hResumed.status, "in_progress");

    // Host can now move
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "host_move_after_resume",
      payload: { roomId, position: 4 },
    });
    const hostMovedState = await waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const hMoved = hostMovedState.payload.gameState as TicTacToeGameState;
    assert.equal(hMoved.board[4], "X");

    // 6. Guest disconnects again, this time allowing grace period to expire
    wsGuest.close();
    await waitForMessage(wsHost, (e) => e.type === "room.updated");

    // Wait for the 600ms grace period to expire on the server
    const forfeitState = await waitForMessage<GameStatePayload>(
      wsHost,
      (e) => e.type === "game.state" && (e.payload.gameState as TicTacToeGameState).status === "won",
      3000
    );

    const fState = forfeitState.payload.gameState as TicTacToeGameState;
    assert.equal(fState.status, "won");
    assert.equal(fState.winner, "X");
    assert.equal(fState.resultReason, "disconnect_forfeit");

    // 7. Disconnected guest cannot reconnect after forfeit
    const wsLateGuest = await createWsClient(wsUrl);
    sendJson(wsLateGuest, {
      version: 1,
      type: "room.reconnect",
      requestId: "late_after_forfeit",
      payload: { roomCode, reconnectToken: guestReconnectToken },
    });
    const lateErr = await waitForMessage<RoomErrorPayload>(wsLateGuest, (e) => e.type === "room.error");
    assert.ok(lateErr.payload.code === "RECONNECT_EXPIRED" || lateErr.payload.code === "INVALID_SESSION");

    wsHost.close();
    wsLateGuest.close();
  });
});
