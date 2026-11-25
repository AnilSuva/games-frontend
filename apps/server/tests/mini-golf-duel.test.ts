import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import { MiniGolfAdapter } from "../src/games/mini-golf-duel/MiniGolfAdapter.js";
import { COURSES } from "../src/games/mini-golf-duel/courses.js";
import { simulateShot } from "../src/games/mini-golf-duel/physics.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";
import type { MiniGolfGameState } from "../src/games/mini-golf-duel/types.js";

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

test("Mini Golf Duel: Physics Simulation Unit Tests", async (t) => {
  const course0 = COURSES[0];

  await t.test("Power and friction: higher power travels further; ball smoothly settles", () => {
    const lowPower = simulateShot(course0, { x: 190, y: 500 }, { x: 0, y: -1 }, 0.2);
    const highPower = simulateShot(course0, { x: 190, y: 500 }, { x: 0, y: -1 }, 0.7);

    assert.ok(lowPower.settled);
    assert.ok(highPower.settled);
    // high power traveled further up (lower y coordinate)
    assert.ok(
      highPower.finalPosition.y < lowPower.finalPosition.y,
      `Expected high power y (${highPower.finalPosition.y}) < low power y (${lowPower.finalPosition.y})`
    );
    assert.ok(lowPower.trajectory.length > 5);
  });

  await t.test("Wall bounce: ball reflects off perimeter wall with energy loss", () => {
    // Shoot towards the left wall at (25, y)
    const result = simulateShot(course0, { x: 80, y: 400 }, { x: -1, y: 0 }, 0.5);
    assert.ok(result.events.some((e) => e.type === "wall_bounce"));
    // Ball bounced back to the right (x > 25)
    assert.ok(result.finalPosition.x > 30);
  });

  await t.test("Bumper collision: ball bounces off bumper and records event", () => {
    // Bumper in Course 0 is at (190, 220), radius 18
    // Shoot straight up towards bumper from (190, 270)
    const result = simulateShot(course0, { x: 190, y: 270 }, { x: 0, y: -1 }, 0.4);
    assert.ok(result.events.some((e) => e.type === "bumper_hit"));
  });

  await t.test("Sand bunker: ball slows down drastically", () => {
    // Sand bunker in Course 0 is at x: 270..345, y: 130..240
    const grassShot = simulateShot(course0, { x: 80, y: 240 }, { x: 0, y: -1 }, 0.4);
    const sandShot = simulateShot(course0, { x: 300, y: 230 }, { x: 0, y: -1 }, 0.4);

    const distGrass = Math.abs(grassShot.finalPosition.y - 240);
    const distSand = Math.abs(sandShot.finalPosition.y - 230);
    assert.ok(distSand < distGrass, "Sand shot should cover less distance than grass shot");
  });

  await t.test("Water hazard: ball entering water registers penalty and resets position", () => {
    const course2 = COURSES[2]; // Water Challenge
    // Water hazard 1 is at x: 25..130, y: 175..345
    // Shoot directly into water from (80, 320)
    const result = simulateShot(course2, { x: 80, y: 320 }, { x: 0, y: -1 }, 0.4);
    assert.ok(result.waterHazard, "Should be flagged as water hazard");
    assert.ok(result.events.some((e) => e.type === "water_hazard"));
    // Resets to initial position
    assert.equal(result.finalPosition.x, 80);
    assert.equal(result.finalPosition.y, 320);
  });

  await t.test("Hole capture vs Lip-out: appropriate speeds sink or lip out", () => {
    // Cup at (190, 90)
    // Gentle shot straight at hole from close distance
    const gentleShot = simulateShot(course0, { x: 190, y: 140 }, { x: 0, y: -1 }, 0.26);
    assert.ok(gentleShot.sunk, "Gentle shot should sink in cup");
    assert.equal(gentleShot.finalPosition.x, 190);
    assert.equal(gentleShot.finalPosition.y, 90);
    assert.ok(gentleShot.events.some((e) => e.type === "hole_sink"));

    // Fast angled shot that cuts across cup rim: lips out and deflects away without sinking
    const fastAngledShot = simulateShot(course0, { x: 185, y: 140 }, { x: 0.15, y: -1 }, 0.6);
    assert.ok(fastAngledShot.events.some((e) => e.type === "lip_out" || e.type === "wall_bounce"));
  });
});

test("Mini Golf Duel: Adapter Rules, Turns, and 3-Hole Match Progression", async (t) => {
  const adapter = new MiniGolfAdapter();

  await t.test("createInitialState initializes Course 0, starting with Orange", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    assert.equal(state.status, "in_progress");
    assert.equal(state.currentHoleIndex, 0);
    assert.equal(state.currentPlayer, "orange");
    assert.equal(state.startingPlayer, "orange");
    assert.equal(state.playerRoles.p1, "orange");
    assert.equal(state.playerRoles.p2, "blue");
    assert.equal(state.holeState.orange.strokes, 0);
    assert.equal(state.holeState.blue.strokes, 0);
    assert.equal(state.holeState.orange.finished, false);
    assert.equal(state.holeState.blue.finished, false);
  });

  await t.test("validateAction enforces turn order, legal aim, and participant checks", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    // p2 is Blue; trying to shoot on Orange's turn
    const wrongTurn = adapter.validateAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.5 },
      "p2"
    );
    assert.equal(wrongTurn.valid, false);
    assert.equal(wrongTurn.error, "It is not your turn");

    // Outsider trying to shoot
    const outsider = adapter.validateAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.5 },
      "outsider"
    );
    assert.equal(outsider.valid, false);
    assert.equal(outsider.error, "Player is not a participant in this game");

    // Invalid power (< 0 or > 1)
    const badPower = adapter.validateAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 1.5 },
      "p1"
    );
    assert.equal(badPower.valid, false);

    // Valid shot
    const valid = adapter.validateAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.5 },
      "p1"
    );
    assert.equal(valid.valid, true);
  });

  await t.test("applyAction alternates turns, increments strokes, and switches between players", () => {
    const state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    // Orange shoots
    const shot1 = adapter.applyAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.2 },
      "p1"
    );
    assert.equal(shot1.nextState.holeState.orange.strokes, 1);
    assert.equal(shot1.nextState.currentPlayer, "blue");

    // Blue shoots
    const shot2 = adapter.applyAction(
      shot1.nextState,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.2 },
      "p2"
    );
    assert.equal(shot2.nextState.holeState.blue.strokes, 1);
    assert.equal(shot2.nextState.currentPlayer, "orange");
  });

  await t.test("Max stroke limit (8) marks hole finished to avoid infinite matches", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    state.holeState.orange.strokes = 7;
    const shot = adapter.applyAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.1 },
      "p1"
    );

    assert.equal(shot.nextState.holeState.orange.strokes, 8);
    assert.equal(shot.nextState.holeState.orange.finished, true);
  });

  await t.test("3-Hole progression and Match Completion with winner calculation", () => {
    let state = adapter.createInitialState({
      hostPlayerId: "p1",
      guestPlayerId: "p2",
    });

    // Simulate completion of Hole 0
    state.holeState.orange.finished = true;
    state.holeState.orange.strokes = 3;
    state.currentPlayer = "blue";
    state.holeState.blue.strokes = 3;
    state.holeState.blue.finished = true;
    state.holeState.blue.ballPosition = { x: 190, y: 110 };

    const h0Res = adapter.applyAction(
      state,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.1 },
      "p2"
    );

    // Advanced to Hole 1!
    assert.equal(h0Res.nextState.currentHoleIndex, 1);
    // Starting player alternates to Blue on Hole 1
    assert.equal(h0Res.nextState.currentPlayer, "blue");
    assert.deepEqual(h0Res.nextState.holeScores.orange, [3]);
    assert.equal(h0Res.nextState.holeScores.blue.length, 1);

    // Now simulate Hole 1 to Hole 2 transition
    let stateH1 = h0Res.nextState;
    stateH1.holeState.blue.finished = true;
    stateH1.holeState.blue.strokes = 4;
    stateH1.currentPlayer = "orange";
    stateH1.holeState.orange.finished = true;
    stateH1.holeState.orange.strokes = 3;
    stateH1.holeState.orange.ballPosition = { x: 190, y: 95 };

    const h1Res = adapter.applyAction(
      stateH1,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.1 },
      "p1"
    );

    assert.equal(h1Res.nextState.currentHoleIndex, 2);
    // Starting player rotates back to Orange on Hole 2
    assert.equal(h1Res.nextState.currentPlayer, "orange");

    // Complete Hole 2 (Final hole)
    let stateH2 = h1Res.nextState;
    stateH2.holeState.orange.finished = true;
    stateH2.holeState.orange.strokes = 2;
    stateH2.currentPlayer = "blue";
    stateH2.holeState.blue.finished = true;
    stateH2.holeState.blue.strokes = 3;
    stateH2.holeState.blue.ballPosition = { x: 190, y: 100 };

    const h2Res = adapter.applyAction(
      stateH2,
      { type: "SHOT", aim: { x: 0, y: -1 }, power: 0.1 },
      "p2"
    );

    assert.ok(h2Res.nextState.status === "won" || h2Res.nextState.status === "draw");
    assert.equal(h2Res.nextState.holeScores.orange.length, 3);
    assert.equal(h2Res.nextState.holeScores.blue.length, 3);
  });
});

test("Mini Golf Duel: Full WebSocket Online Match Integration", async (t) => {
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

  await t.test("Two players connect, join Mini Golf Duel room, take shots, and sync state", async () => {
    const ws1 = await createWsClient(wsUrl);
    const ws2 = await createWsClient(wsUrl);

    // 1. Identify Host
    sendJson(ws1, {
      version: 1,
      type: "session.identify",
      requestId: "id-1",
      payload: { displayName: "GolferOrange" },
    });
    const ready1 = await waitForMessage<SessionReadyPayload>(ws1, (e) => e.type === "session.ready");
    assert.equal(ready1.payload.displayName, "GolferOrange");

    // 2. Host creates room
    sendJson(ws1, {
      version: 1,
      type: "room.create",
      requestId: "rc-1",
      payload: { gameId: "mini-golf-duel", maxPlayers: 2 },
    });
    const created = await waitForMessage<RoomCreatedPayload>(ws1, (e) => e.type === "room.created");
    const roomCode = created.payload.room.roomCode;
    const roomId = created.payload.room.roomId;

    // 3. Identify Guest
    sendJson(ws2, {
      version: 1,
      type: "session.identify",
      requestId: "id-2",
      payload: { displayName: "GolferBlue" },
    });
    await waitForMessage<SessionReadyPayload>(ws2, (e) => e.type === "session.ready");

    // 4. Guest joins room
    const joinPromise = Promise.all([
      waitForMessage<RoomJoinedPayload>(ws2, (e) => e.type === "room.joined"),
      waitForMessage<GameStatePayload>(ws1, (e) => e.type === "game.state"),
      waitForMessage<GameStatePayload>(ws2, (e) => e.type === "game.state"),
    ]);

    sendJson(ws2, {
      version: 1,
      type: "room.join",
      requestId: "rj-1",
      payload: { roomCode },
    });

    const [joined2, stateMsg1] = await joinPromise;
    assert.equal(joined2.payload.room.roomId, roomId);

    const gameState = stateMsg1.payload.gameState as MiniGolfGameState;
    assert.equal(gameState.currentHoleIndex, 0);
    assert.equal(gameState.currentPlayer, "orange");

    // 5. Host takes a shot via game.shot
    const shotPromise = Promise.all([
      waitForMessage(ws1, (e) => e.type === "game.event"),
      waitForMessage(ws2, (e) => e.type === "game.event"),
      waitForMessage<GameStatePayload>(ws1, (e) => e.type === "game.state"),
    ]);

    sendJson(ws1, {
      version: 1,
      type: "game.shot",
      requestId: "shot-1",
      payload: {
        roomId,
        aim: { x: 0, y: -1 },
        power: 0.3,
      },
    });

    // Both clients receive game.event with shot_resolved
    const [shotEv1, shotEv2, stateMsgAfterShot] = await shotPromise;
    assert.equal((shotEv1.payload as { type: string }).type, "shot_resolved");
    assert.equal((shotEv2.payload as { type: string }).type, "shot_resolved");

    // Next turn is Blue
    const stateAfterShot = stateMsgAfterShot.payload.gameState as MiniGolfGameState;
    assert.equal(stateAfterShot.currentPlayer, "blue");

    // 6. Security: Non-turn player (Orange) attempts to shoot on Blue's turn -> Rejected with NOT_YOUR_TURN
    sendJson(ws1, {
      version: 1,
      type: "game.shot",
      requestId: "illegal-shot",
      payload: {
        roomId,
        aim: { x: 0, y: -1 },
        power: 0.4,
      },
    });
    const err = await waitForMessage(ws1, (e) => e.type === "room.error");
    assert.equal((err.payload as { code: string }).code, "NOT_YOUR_TURN");

    ws1.close();
    ws2.close();
  });
});
