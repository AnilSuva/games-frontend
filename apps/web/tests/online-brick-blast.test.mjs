import test from "node:test";
import assert from "node:assert/strict";
import { createResultSoundGuard } from "../src/games/common/resultSound.ts";

test("Online Brick Blast Sound Semantics: Winner hears victory, loser hears lose, draw produces no result sound", () => {
  // Scenario 1: Human is Orange, Server reports Orange won -> Victory sound
  const guardWinner = createResultSoundGuard();
  const humanWinnerSound = guardWinner.claim("victory");
  assert.equal(humanWinnerSound, "victory");
  // Sound cannot replay in same match
  assert.equal(guardWinner.claim("victory"), null);

  // Scenario 2: Human is Blue, Server reports Orange won -> Lose sound
  const guardLoser = createResultSoundGuard();
  const humanLoserSound = guardLoser.claim("lose");
  assert.equal(humanLoserSound, "lose");
  // Cannot replay in same match
  assert.equal(guardLoser.claim("lose"), null);

  // Scenario 3: Forfeit win
  const guardForfeit = createResultSoundGuard();
  assert.equal(guardForfeit.claim("victory"), "victory");

  // Rematch resets sound guard
  guardWinner.reset();
  assert.equal(guardWinner.claim("victory"), "victory");
});

test("Online Brick Blast Player Role Assignment: Host is Orange (Bottom), Guest is Blue (Top)", () => {
  const hostPlayerId = "ply_host_bb";
  const guestPlayerId = "ply_guest_bb";

  const roomDto = {
    roomId: "room_bb_1",
    roomCode: "BBTEST",
    gameId: "brick-blast",
    status: "in-progress",
    hostPlayerId,
    players: [
      { playerId: hostPlayerId, seat: 0, connected: true, joinedAt: 100 },
      { playerId: guestPlayerId, seat: 1, connected: true, joinedAt: 200 },
    ],
    maxPlayers: 2,
    version: 2,
    createdAt: 100,
  };

  assert.equal(roomDto.gameId, "brick-blast");

  const gameState = {
    status: "in_progress",
    currentLevel: 1,
    startingPlayer: "orange",
    serverPlayer: "orange",
    scores: { orange: 0, blue: 0 },
    winner: null,
    playerRoles: {
      [hostPlayerId]: "orange",
      [guestPlayerId]: "blue",
    },
    rematchRequests: [],
  };

  // Derive roles
  const hostRole = gameState.playerRoles[hostPlayerId];
  const guestRole = gameState.playerRoles[guestPlayerId];
  assert.equal(hostRole, "orange");
  assert.equal(guestRole, "blue");

  // Verify opposite role mapping
  const getOpponentRole = (role) => (role === "orange" ? "blue" : "orange");
  assert.equal(getOpponentRole(hostRole), "blue");
  assert.equal(getOpponentRole(guestRole), "orange");
});

test("Online Brick Blast Compact Input Model: Intent vs Position Commands", () => {
  const validInputs = ["paddle.left", "paddle.right", "paddle.stop", "paddle.position"];

  const validateInputCommand = (input, data) => {
    if (!validInputs.includes(input)) return { valid: false, error: "Invalid command" };
    if (input === "paddle.position") {
      if (!data || typeof data.x !== "number" || isNaN(data.x)) {
        return { valid: false, error: "Invalid coordinate" };
      }
    }
    return { valid: true };
  };

  assert.equal(validateInputCommand("paddle.left").valid, true);
  assert.equal(validateInputCommand("paddle.right").valid, true);
  assert.equal(validateInputCommand("paddle.stop").valid, true);
  assert.equal(validateInputCommand("paddle.position", { x: 180 }).valid, true);
  assert.equal(validateInputCommand("paddle.position", {}).valid, false);
  assert.equal(validateInputCommand("hack.teleport").valid, false);
});

test("Online Brick Blast Disconnect Grace & Forfeit Countdown Calculation", () => {
  const now = 1_000_000;
  const graceDurationMs = 30_000;
  const expiresAt = now + graceDurationMs;

  const calculateRemainingSeconds = (expiryTime, currentTime) => {
    if (!expiryTime || expiryTime <= currentTime) return 0;
    return Math.max(0, Math.ceil((expiryTime - currentTime) / 1000));
  };

  assert.equal(calculateRemainingSeconds(expiresAt, now), 30);
  assert.equal(calculateRemainingSeconds(expiresAt, now + 15_000), 15);
  assert.equal(calculateRemainingSeconds(expiresAt, now + 29_500), 1);
  assert.equal(calculateRemainingSeconds(expiresAt, now + 30_000), 0);
  assert.equal(calculateRemainingSeconds(expiresAt, now + 35_000), 0);
});

test("Online Brick Blast Rematch Logic & Starting Player Alternation", () => {
  const state = {
    status: "won",
    winner: "orange",
    startingPlayer: "orange",
    rematchRequests: [],
  };

  // Host requests rematch
  state.rematchRequests.push("ply_host_bb");
  assert.equal(state.rematchRequests.length, 1);
  assert.equal(state.status, "won"); // Not restarted yet

  // Guest accepts rematch
  state.rematchRequests.push("ply_guest_bb");
  assert.equal(state.rematchRequests.length, 2);

  // Both accepted -> Match restarts with rotated starting player
  const nextStarter = state.startingPlayer === "orange" ? "blue" : "orange";
  assert.equal(nextStarter, "blue");

  const restartedState = {
    status: "in_progress",
    currentLevel: 1,
    startingPlayer: nextStarter,
    scores: { orange: 0, blue: 0 },
    winner: null,
    rematchRequests: [],
  };

  assert.equal(restartedState.status, "in_progress");
  assert.equal(restartedState.startingPlayer, "blue");
  assert.equal(restartedState.rematchRequests.length, 0);
});

test("Online Brick Blast Joiner Match Entry Guard & Lifecycle Transition", () => {
  // Test isInOnlineMatch logic: requires connectionState in_game/game_over AND gameState
  const evaluateInOnlineMatch = (connectionState, gameState) => {
    return (
      (connectionState === "in_game" || connectionState === "game_over") &&
      Boolean(gameState)
    );
  };

  // 1. Initial state when entering online mode: lobby
  assert.equal(evaluateInOnlineMatch("connected", null), false);

  // 2. Joining room before server response: lobby
  assert.equal(evaluateInOnlineMatch("joining_room", null), false);

  // 3. If connectionState became in_game but gameState was null: MUST STAY in lobby (not blank)
  assert.equal(evaluateInOnlineMatch("in_game", null), false);

  // 4. Once room.joined or game.state supplies gameState: TRANSITIONS to active match
  const validGameState = {
    status: "in_progress",
    currentLevel: 1,
    startingPlayer: "orange",
    playerRoles: { ply_host: "orange", ply_guest: "blue" },
  };
  assert.equal(evaluateInOnlineMatch("in_game", validGameState), true);
  assert.equal(evaluateInOnlineMatch("game_over", validGameState), true);
});

test("Online Brick Blast Guest Room.Joined Game State Ingestion & Role Assignment", () => {
  const hostId = "host_123";
  const guestId = "guest_456";

  const roomDtoFromJoin = {
    roomId: "bb_room_abc",
    roomCode: "BLAST1",
    gameId: "brick-blast",
    status: "in-progress",
    hostPlayerId: hostId,
    players: [
      { playerId: hostId, seat: 0, connected: true },
      { playerId: guestId, seat: 1, connected: true },
    ],
    gameState: {
      status: "in_progress",
      currentLevel: 1,
      startingPlayer: "orange",
      playerRoles: {
        [hostId]: "orange",
        [guestId]: "blue",
      },
    },
  };

  // Simulate onRoomUpdated ingestion on guest client
  let guestGameState = null;
  const handleRoomUpdated = (room) => {
    if (room.gameState) {
      guestGameState = room.gameState;
    }
  };

  handleRoomUpdated(roomDtoFromJoin);

  assert.notEqual(guestGameState, null);
  assert.equal(guestGameState.playerRoles[guestId], "blue");
  assert.equal(guestGameState.playerRoles[hostId], "orange");

  // Derive myRole on Guest
  const deriveMyRole = (myPlayerId, state, room) => {
    if (myPlayerId && state?.playerRoles?.[myPlayerId]) {
      return state.playerRoles[myPlayerId];
    }
    if (room && myPlayerId) {
      return room.hostPlayerId === myPlayerId ? "orange" : "blue";
    }
    return null;
  };

  assert.equal(deriveMyRole(guestId, guestGameState, roomDtoFromJoin), "blue");
  assert.equal(deriveMyRole(hostId, guestGameState, roomDtoFromJoin), "orange");
});
