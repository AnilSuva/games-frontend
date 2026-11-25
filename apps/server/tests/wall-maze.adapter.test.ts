import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import { WallMazeAdapter } from "../src/games/wall-maze/WallMazeAdapter.js";
import type { WallMazeGameState } from "../src/games/wall-maze/types.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomErrorPayload,
  RoomJoinedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";

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

test("WallMazeAdapter: Pure unit tests for Quoridor rules, BFS validation, and lifecycle", async (t) => {
  const adapter = new WallMazeAdapter();

  await t.test("createInitialState sets up (8,4)/(0,4), 10 walls each, and valid starter", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.currentPlayer, "X");
    assert.equal(state.startingPlayer, "X");
    assert.equal(state.playerRoles["player-x"], "X");
    assert.equal(state.playerRoles["player-o"], "O");
    assert.deepEqual(state.pawns.X, { row: 8, col: 4 });
    assert.deepEqual(state.pawns.O, { row: 0, col: 4 });
    assert.deepEqual(state.walls, []);
    assert.deepEqual(state.wallsLeft, { X: 10, O: 10 });
    assert.equal(state.moveCount, 0);
    assert.equal(state.lastAction, null);
    assert.equal(state.winner, null);
  });

  await t.test("valid orthogonal moves, straight jump, and blocked diagonal side-step", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Advance pawns into face-to-face position (X at (5,4), O at (4,4))
    state = {
      ...state,
      pawns: { X: { row: 5, col: 4 }, O: { row: 4, col: 4 } },
      currentPlayer: "X",
    };

    // Straight jump over O onto (3,4) is valid
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 3, col: 4 }, "player-x").valid,
      true
    );
    // Diagonal side-step when straight jump is open is illegal
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 4, col: 3 }, "player-x").valid,
      false
    );

    // Put a wall directly behind O at (3,4,"h") -> blocks (4,4)<->(3,4)
    state = {
      ...state,
      walls: [{ row: 3, col: 4, orientation: "h", owner: "O" }],
    };

    // Straight jump now invalid; diagonal side-steps (4,3) and (4,5) become valid!
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 3, col: 4 }, "player-x").valid,
      false
    );
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 4, col: 3 }, "player-x").valid,
      true
    );
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 4, col: 5 }, "player-x").valid,
      true
    );

    const jumped = adapter.applyAction(
      state,
      { type: "MOVE_PAWN", row: 4, col: 3 },
      "player-x"
    ).nextState;
    assert.deepEqual(jumped.pawns.X, { row: 4, col: 3 });
    assert.equal(jumped.currentPlayer, "O");
    assert.equal(jumped.moveCount, 1);
    assert.deepEqual(jumped.lastAction, {
      type: "MOVE_PAWN",
      row: 4,
      col: 3,
      player: "X",
      moveCount: 1,
    });
  });

  await t.test("rejects out-of-turn, out-of-bounds, blocked-edge, and post-finish moves", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Out of turn
    const wrongTurn = adapter.validateAction(
      state,
      { type: "MOVE_PAWN", row: 1, col: 4 },
      "player-o"
    );
    assert.equal(wrongTurn.valid, false);
    assert.equal(wrongTurn.error, "It is not your turn");

    // Non-participant
    const stranger = adapter.validateAction(
      state,
      { type: "MOVE_PAWN", row: 7, col: 4 },
      "stranger"
    );
    assert.equal(stranger.valid, false);

    // Out-of-bounds
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: 9, col: 4 }, "player-x").valid,
      false
    );
    assert.equal(
      adapter.validateAction(state, { type: "MOVE_PAWN", row: -1, col: 4 }, "player-x").valid,
      false
    );

    // Blocked edge
    const walled: WallMazeGameState = {
      ...state,
      walls: [{ row: 7, col: 4, orientation: "h", owner: "O" }],
    };
    assert.equal(
      adapter.validateAction(walled, { type: "MOVE_PAWN", row: 7, col: 4 }, "player-x").valid,
      false
    );

    // Moves rejected after game over
    const finished: WallMazeGameState = {
      ...state,
      pawns: { X: { row: 0, col: 4 }, O: { row: 2, col: 4 } },
      status: "won",
      winner: "X",
    };
    const afterEnd = adapter.validateAction(
      finished,
      { type: "MOVE_PAWN", row: 1, col: 4 },
      "player-o"
    );
    assert.equal(afterEnd.valid, false);
    assert.equal(afterEnd.error, "Game is not in progress");
  });

  await t.test("wall validation enforces inventory, overlap, crossing, and BFS anti-seal-off", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });

    // Place valid horizontal wall at (3, 4, "h")
    assert.equal(
      adapter.validateAction(
        state,
        { type: "PLACE_WALL", row: 3, col: 4, orientation: "h" },
        "player-x"
      ).valid,
      true
    );
    state = adapter.applyAction(
      state,
      { type: "PLACE_WALL", row: 3, col: 4, orientation: "h" },
      "player-x"
    ).nextState;
    assert.equal(state.walls.length, 1);
    assert.equal(state.wallsLeft.X, 9);
    assert.equal(state.currentPlayer, "O");
    assert.deepEqual(state.lastAction, {
      type: "PLACE_WALL",
      row: 3,
      col: 4,
      orientation: "h",
      player: "X",
      moveCount: 1,
    });

    // Overlapping horizontal wall & crossing vertical wall at (3, 4) rejected
    assert.equal(
      adapter.validateAction(
        state,
        { type: "PLACE_WALL", row: 3, col: 3, orientation: "h" },
        "player-o"
      ).valid,
      false
    );
    assert.equal(
      adapter.validateAction(
        state,
        { type: "PLACE_WALL", row: 3, col: 4, orientation: "v" },
        "player-o"
      ).valid,
      false
    );

    // Out of bounds wall rejected
    assert.equal(
      adapter.validateAction(
        state,
        { type: "PLACE_WALL", row: 8, col: 0, orientation: "h" },
        "player-o"
      ).valid,
      false
    );

    // Zero walls left rejected
    const noWallsState: WallMazeGameState = {
      ...state,
      wallsLeft: { X: 9, O: 0 },
    };
    assert.equal(
      adapter.validateAction(
        noWallsState,
        { type: "PLACE_WALL", row: 1, col: 1, orientation: "v" },
        "player-o"
      ).valid,
      false
    );

    // Authoritative BFS rejection: trap O in pocket at (0,4)
    const almostSealed: WallMazeGameState = {
      ...state,
      walls: [
        { row: 0, col: 3, orientation: "v", owner: "X" },
        { row: 0, col: 4, orientation: "v", owner: "X" },
      ],
      currentPlayer: "X",
    };
    const sealAttempt = adapter.validateAction(
      almostSealed,
      { type: "PLACE_WALL", row: 1, col: 3, orientation: "h" },
      "player-x"
    );
    assert.equal(sealAttempt.valid, false);
    assert.ok(sealAttempt.error?.includes("blocks all paths"));

    // Winding detour wall across row 4 leaving col 8 open must be ALLOWED
    const corridorState: WallMazeGameState = {
      ...state,
      walls: [
        { row: 4, col: 0, orientation: "h", owner: "X" },
        { row: 4, col: 2, orientation: "h", owner: "O" },
        { row: 4, col: 4, orientation: "h", owner: "X" },
      ],
      currentPlayer: "O",
    };
    assert.equal(
      adapter.validateAction(
        corridorState,
        { type: "PLACE_WALL", row: 4, col: 6, orientation: "h" },
        "player-o"
      ).valid,
      true
    );
  });

  await t.test("win detection, disconnect forfeit, and rematch alternation", () => {
    // X reaches row 0
    const nearWinX: WallMazeGameState = {
      ...adapter.createInitialState({
        hostPlayerId: "player-x",
        guestPlayerId: "player-o",
      }),
      pawns: { X: { row: 1, col: 4 }, O: { row: 2, col: 4 } },
      currentPlayer: "X",
    };
    const winResX = adapter.applyAction(
      nearWinX,
      { type: "MOVE_PAWN", row: 0, col: 4 },
      "player-x"
    );
    assert.equal(winResX.nextState.status, "won");
    assert.equal(winResX.nextState.winner, "X");
    assert.equal(winResX.nextState.resultReason, "win");

    // Rematch requires both players, alternates starter to O
    const req1 = adapter.applyAction(winResX.nextState, { type: "REMATCH" }, "player-x").nextState;
    assert.equal(req1.status, "won");
    assert.deepEqual(req1.rematchRequests, ["player-x"]);

    const req2 = adapter.applyAction(req1, { type: "REMATCH" }, "player-o").nextState;
    assert.equal(req2.status, "in_progress");
    assert.equal(req2.startingPlayer, "O");
    assert.equal(req2.currentPlayer, "O");
    assert.deepEqual(req2.pawns, { X: { row: 8, col: 4 }, O: { row: 0, col: 4 } });
    assert.deepEqual(req2.wallsLeft, { X: 10, O: 10 });
    assert.equal(req2.moveCount, 0);

    // O reaches row 8
    const nearWinO: WallMazeGameState = {
      ...req2,
      pawns: { X: { row: 4, col: 4 }, O: { row: 7, col: 4 } },
      currentPlayer: "O",
    };
    const winResO = adapter.applyAction(
      nearWinO,
      { type: "MOVE_PAWN", row: 8, col: 4 },
      "player-o"
    );
    assert.equal(winResO.nextState.status, "won");
    assert.equal(winResO.nextState.winner, "O");

    // Disconnect grace pause + reconnect + forfeit
    const active = adapter.createInitialState({
      hostPlayerId: "player-x",
      guestPlayerId: "player-o",
    });
    const paused = adapter.handlePlayerDisconnect(active, "player-x", Date.now() + 30000);
    assert.equal(paused.disconnectedPlayerId, "player-x");
    assert.equal(
      adapter.validateAction(paused, { type: "MOVE_PAWN", row: 7, col: 4 }, "player-x").valid,
      false
    );

    const resumed = adapter.handlePlayerReconnect(paused, "player-x");
    assert.equal(resumed.disconnectedPlayerId, null);

    const forfeited = adapter.handleForfeit(resumed, "player-x", ["player-o"]);
    assert.equal(forfeited.isCompleted, true);
    assert.equal(forfeited.nextState.status, "won");
    assert.equal(forfeited.nextState.winner, "O");
    assert.equal(forfeited.nextState.resultReason, "disconnect_forfeit");
  });
});

test("Wall Maze Server Integration: Full WebSocket match, BFS rejection, and disconnect forfeit", async (t) => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "test",
    port: 0,
    disconnectGracePeriodMs: 300,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  t.after(async () => {
    await server.stop();
  });

  await t.test("Two players create/join wall-maze room, move pawns, place walls, and reject illegal moves", async () => {
    const wsHost = await createWsClient(wsUrl);
    sendJson(wsHost, {
      version: 1,
      type: "session.identify",
      requestId: "wm_id_1",
      payload: { displayName: "OrangeHost" },
    });
    await waitForMessage<SessionReadyPayload>(wsHost, (e) => e.type === "session.ready");

    sendJson(wsHost, {
      version: 1,
      type: "room.create",
      requestId: "wm_create",
      payload: { gameId: "wall-maze", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(wsHost, (e) => e.type === "room.created");
    const { roomId, roomCode } = created.payload.room;

    const wsGuest = await createWsClient(wsUrl);
    sendJson(wsGuest, {
      version: 1,
      type: "session.identify",
      requestId: "wm_id_2",
      payload: { displayName: "BlueGuest" },
    });
    await waitForMessage<SessionReadyPayload>(wsGuest, (e) => e.type === "session.ready");

    const hostStatePromise = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const guestStatePromise = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    const guestJoinedPromise = waitForMessage<RoomJoinedPayload>(wsGuest, (e) => e.type === "room.joined");

    sendJson(wsGuest, {
      version: 1,
      type: "room.join",
      requestId: "wm_join",
      payload: { roomCode },
    });

    const [guestJoined, hostInitial, guestInitial] = await Promise.all([
      guestJoinedPromise,
      hostStatePromise,
      guestStatePromise,
    ]);
    assert.equal(guestJoined.payload.room.gameId, "wall-maze");

    const initState = hostInitial.payload.gameState as WallMazeGameState;
    assert.equal(initState.status, "in_progress");
    assert.equal(initState.currentPlayer, "X");
    assert.deepEqual(initState.pawns.X, { row: 8, col: 4 });
    assert.deepEqual((guestInitial.payload.gameState as WallMazeGameState).pawns.O, { row: 0, col: 4 });

    // Host moves pawn (8,4) -> (7,4)
    const p1HostState = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const p1GuestState = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "wm_move_1",
      payload: {
        roomId,
        action: { type: "MOVE_PAWN", row: 7, col: 4 },
      },
    });
    const [afterMove1Host, afterMove1Guest] = await Promise.all([p1HostState, p1GuestState]);
    const state1 = afterMove1Host.payload.gameState as WallMazeGameState;
    assert.deepEqual(state1.pawns.X, { row: 7, col: 4 });
    assert.equal(state1.currentPlayer, "O");
    assert.equal((afterMove1Guest.payload.gameState as WallMazeGameState).moveCount, 1);

    // Out-of-turn move by Host must be rejected with NOT_YOUR_TURN
    const errTurnPromise = waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "wm_bad_turn",
      payload: {
        roomId,
        action: { type: "MOVE_PAWN", row: 6, col: 4 },
      },
    });
    const errTurn = await errTurnPromise;
    assert.equal(errTurn.payload.code, "NOT_YOUR_TURN");

    // Guest places horizontal wall at (6, 4, "h") blocking X straight ahead
    const p2HostState = waitForMessage<GameStatePayload>(wsHost, (e) => e.type === "game.state");
    const p2GuestState = waitForMessage<GameStatePayload>(wsGuest, (e) => e.type === "game.state");
    sendJson(wsGuest, {
      version: 1,
      type: "game.move",
      requestId: "wm_wall_1",
      payload: {
        roomId,
        action: { type: "PLACE_WALL", row: 6, col: 4, orientation: "h" },
      },
    });
    const [afterWallHost] = await Promise.all([p2HostState, p2GuestState]);
    const state2 = afterWallHost.payload.gameState as WallMazeGameState;
    assert.equal(state2.walls.length, 1);
    assert.equal(state2.wallsLeft.O, 9);
    assert.equal(state2.currentPlayer, "X");

    // Host attempts illegal move straight through the wall (7,4) -> (6,4): rejected with INVALID_MOVE
    const errWallBlockPromise = waitForMessage<RoomErrorPayload>(wsHost, (e) => e.type === "room.error");
    sendJson(wsHost, {
      version: 1,
      type: "game.move",
      requestId: "wm_blocked_move",
      payload: {
        roomId,
        action: { type: "MOVE_PAWN", row: 6, col: 4 },
      },
    });
    const errBlocked = await errWallBlockPromise;
    assert.equal(errBlocked.payload.code, "INVALID_MOVE");

    // Host disconnects -> after 300ms grace expires, Guest wins by disconnect_forfeit
    const forfeitStatePromise = waitForMessage<GameStatePayload>(
      wsGuest,
      (e) =>
        e.type === "game.state" &&
        (e.payload.gameState as WallMazeGameState).status === "won"
    );
    wsHost.close();
    const forfeitMsg = await forfeitStatePromise;
    const finalState = forfeitMsg.payload.gameState as WallMazeGameState;
    assert.equal(finalState.status, "won");
    assert.equal(finalState.winner, "O");
    assert.equal(finalState.resultReason, "disconnect_forfeit");

    wsGuest.close();
  });
});
