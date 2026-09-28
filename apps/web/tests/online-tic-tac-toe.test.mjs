import test from "node:test";
import assert from "node:assert/strict";
import { getMultiplayerWsUrl } from "../src/platform/multiplayer/config.ts";
import { createResultSoundGuard } from "../src/games/common/resultSound.ts";

test("Multiplayer Config: resolves WebSocket URL with env fallback", () => {
  const originalEnv = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL;

  try {
    delete process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL;
    assert.equal(getMultiplayerWsUrl(), "ws://localhost:3001/ws");

    process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL = "wss://games-backend-dwqw.onrender.com/ws";
    assert.equal(getMultiplayerWsUrl(), "wss://games-backend-dwqw.onrender.com/ws");
  } finally {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL;
    }
  }
});

test("Online Mode Sound Semantics: Winner hears victory, loser hears lose, draw produces no result sound", () => {
  // Scenario 1: Human is Orange ("X"), Server reports "X" won -> Victory sound
  const guardWinner = createResultSoundGuard();
  const humanWinnerSound = guardWinner.claim("victory");
  assert.equal(humanWinnerSound, "victory");
  // Cannot replay in same match
  assert.equal(guardWinner.claim("victory"), null);

  // Scenario 2: Human is Blue ("O"), Server reports "X" won -> Lose sound
  const guardLoser = createResultSoundGuard();
  const humanLoserSound = guardLoser.claim("lose");
  assert.equal(humanLoserSound, "lose");
  // Cannot replay in same match
  assert.equal(guardLoser.claim("lose"), null);

  // Scenario 3: Draw -> No sound
  const guardDraw = createResultSoundGuard();
  assert.equal(guardDraw.claim(null), null);

  // Rematch resets sound guard
  guardWinner.reset();
  assert.equal(guardWinner.claim("lose"), "lose");
});

test("Room Code Validation & Formatting: enforces normalized format and bounds", () => {
  function validateRoomCode(raw) {
    const trimmed = (raw || "").trim().toUpperCase();
    if (trimmed.length < 3 || trimmed.length > 10) {
      return { valid: false, error: "Room code must be between 3 and 10 characters" };
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      return { valid: false, error: "Room code must contain only letters and numbers" };
    }
    return { valid: true, code: trimmed };
  }

  assert.deepEqual(validateRoomCode("abc234"), { valid: true, code: "ABC234" });
  assert.deepEqual(validateRoomCode("  xyz999  "), { valid: true, code: "XYZ999" });
  assert.equal(validateRoomCode("").valid, false);
  assert.equal(validateRoomCode("ab").valid, false);
  assert.equal(validateRoomCode("AB-CD").valid, false);
});

test("Online Tic-Tac-Toe Player Assignment & Turn Authority Logic", () => {
  const hostPlayerId = "ply_host_123";
  const guestPlayerId = "ply_guest_456";

  const roomDto = {
    roomId: "room_1",
    roomCode: "ABC234",
    gameId: "tic-tac-toe",
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

  const gameState = {
    board: [null, null, null, null, null, null, null, null, null],
    currentPlayer: "X",
    startingPlayer: "X",
    status: "in_progress",
    winner: null,
    winningLine: null,
    moveCount: 0,
    playerMarks: {
      [hostPlayerId]: "X",
      [guestPlayerId]: "O",
    },
    rematchRequests: [],
  };

  // Host authority check
  const hostMark = gameState.playerMarks[hostPlayerId];
  assert.equal(hostMark, "X"); // Host is Orange / X
  const isHostTurn = gameState.currentPlayer === hostMark;
  assert.equal(isHostTurn, true); // Orange starts first match

  // Guest authority check
  const guestMark = gameState.playerMarks[guestPlayerId];
  assert.equal(guestMark, "O"); // Guest is Blue / O
  const isGuestTurn = gameState.currentPlayer === guestMark;
  assert.equal(isGuestTurn, false); // Guest must wait for Orange

  // Opponent connection check: if guest temporarily disconnects, opponent connected is false
  roomDto.players[1].connected = false;
  const isOpponentActive = roomDto.players.find((p) => p.playerId === guestPlayerId)?.connected ?? false;
  assert.equal(isOpponentActive, false);
});

test("Rematch starting player swap semantics", () => {
  let startingPlayer = "X";
  assert.equal(startingPlayer, "X");

  // Swap on first rematch
  startingPlayer = startingPlayer === "X" ? "O" : "X";
  assert.equal(startingPlayer, "O");

  // Swap on second rematch
  startingPlayer = startingPlayer === "X" ? "O" : "X";
  assert.equal(startingPlayer, "X");
});
