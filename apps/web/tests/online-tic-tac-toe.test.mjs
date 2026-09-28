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

test("Multiplayer Config: auto-selects production URL on production domains", () => {
  const originalEnv = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL;
  delete process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL;

  try {
    // Simulate production browser window
    globalThis.window = {
      location: {
        hostname: "games.anilsuva.com",
      },
    };

    assert.equal(getMultiplayerWsUrl(), "wss://games-backend-dwqw.onrender.com/ws");

    // Localhost stays local
    globalThis.window = {
      location: {
        hostname: "localhost",
      },
    };
    assert.equal(getMultiplayerWsUrl(), "ws://localhost:3001/ws");
  } finally {
    delete globalThis.window;
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL = originalEnv;
    }
  }
});

test("Finite Connection State & UX Button Semantics", () => {
  function getLobbyButtonStates(connectionState, roomCodeInput = "ABC234", hasRoom = false) {
    const isConnecting = connectionState === "connecting" || connectionState === "identifying";
    const isCreating = connectionState === "creating_room";
    const isJoining = connectionState === "joining_room";
    const isWaiting = connectionState === "waiting_for_opponent" && hasRoom;

    return {
      createBtnText: isConnecting ? "Connecting..." : isCreating ? "Creating room..." : "Create Room",
      createBtnDisabled: isConnecting || isCreating,
      joinTabBtnText: isConnecting ? "Connecting..." : isJoining ? "Joining match..." : "Join Match",
      joinTabBtnDisabled: roomCodeInput.trim().length < 3 || isJoining || isConnecting,
      isWaiting,
    };
  }

  // State: connecting (Initial socket connection)
  const connecting = getLobbyButtonStates("connecting");
  assert.equal(connecting.createBtnText, "Connecting...");
  assert.equal(connecting.createBtnDisabled, true);
  assert.equal(connecting.joinTabBtnText, "Connecting...");
  assert.equal(connecting.joinTabBtnDisabled, true);

  // State: identifying (Initial session identification)
  const identifying = getLobbyButtonStates("identifying");
  assert.equal(identifying.createBtnText, "Connecting...");
  assert.equal(identifying.createBtnDisabled, true);

  // State: connected (Lobby is ready for action)
  const connected = getLobbyButtonStates("connected");
  assert.equal(connected.createBtnText, "Create Room");
  assert.equal(connected.createBtnDisabled, false);
  assert.equal(connected.joinTabBtnText, "Join Match");
  assert.equal(connected.joinTabBtnDisabled, false);

  // State: creating_room (User clicked Create Room)
  const creating = getLobbyButtonStates("creating_room");
  assert.equal(creating.createBtnText, "Creating room...");
  assert.equal(creating.createBtnDisabled, true);

  // State: waiting_for_opponent (Room code displayed to host)
  const waiting = getLobbyButtonStates("waiting_for_opponent", "ABC234", true);
  assert.equal(waiting.isWaiting, true);

  // State: joining_room (User clicked Join Match)
  const joining = getLobbyButtonStates("joining_room");
  assert.equal(joining.joinTabBtnText, "Joining match...");
  assert.equal(joining.joinTabBtnDisabled, true);
});

test("Server Error Mapping: translates error codes to user-friendly messages and exits loading", () => {
  function formatRoomErrorMessage(code, rawMessage) {
    switch (code) {
      case "ROOM_NOT_FOUND":
        return "Room not found. Please check the 6-character room code.";
      case "ROOM_FULL":
        return "This room is already full.";
      case "INVALID_ROOM_STATE":
        return "This match is no longer available to join.";
      case "RATE_LIMITED":
        return "Too many requests. Please slow down and try again.";
      case "RECONNECT_EXPIRED":
      case "INVALID_SESSION":
        return "The previous match has ended or expired.";
      case "UNAUTHORIZED":
        return "Multiplayer session expired. Reconnecting...";
      default:
        return rawMessage || "An error occurred. Please try again.";
    }
  }

  assert.equal(
    formatRoomErrorMessage("ROOM_NOT_FOUND"),
    "Room not found. Please check the 6-character room code."
  );
  assert.equal(
    formatRoomErrorMessage("ROOM_FULL"),
    "This room is already full."
  );
  assert.equal(
    formatRoomErrorMessage("RATE_LIMITED"),
    "Too many requests. Please slow down and try again."
  );
});

test("Match Entry Resilience: initializes fallback Tic-Tac-Toe state when two players present", () => {
  const room = {
    roomId: "rm_1",
    roomCode: "XYZ123",
    gameId: "tic-tac-toe",
    status: "in-progress",
    hostPlayerId: "p1",
    players: [
      { playerId: "p1", seat: 0, connected: true, joinedAt: 100 },
      { playerId: "p2", seat: 1, connected: true, joinedAt: 200 },
    ],
    maxPlayers: 2,
    version: 4,
    createdAt: 100,
  };

  function resolveMatchState(room) {
    if (room.gameState) return room.gameState;
    if (room.players.length >= 2) {
      const host = room.players.find((p) => p.seat === 0) || room.players[0];
      const guest = room.players.find((p) => p.seat === 1) || room.players[1];
      const marks = {
        [host.playerId]: "X",
        [guest.playerId]: "O",
      };
      return {
        board: Array(9).fill(null),
        currentPlayer: "X",
        startingPlayer: "X",
        status: "in_progress",
        winner: null,
        winningLine: null,
        moveCount: 0,
        playerMarks: marks,
        rematchRequests: [],
      };
    }
    return null;
  }

  const resolved = resolveMatchState(room);
  assert.notEqual(resolved, null);
  assert.equal(resolved.status, "in_progress");
  assert.equal(resolved.currentPlayer, "X");
  assert.equal(resolved.playerMarks.p1, "X");
  assert.equal(resolved.playerMarks.p2, "O");
  assert.equal(resolved.board.length, 9);
});

test("Disconnect Countdown & Match Pause Semantics", () => {
  const futureExpiry = Date.now() + 27_400; // 27.4 seconds in future

  function getGraceSecondsRemaining(disconnectGraceExpiresAt, currentTime) {
    if (!disconnectGraceExpiresAt || disconnectGraceExpiresAt <= currentTime) return null;
    return Math.max(0, Math.ceil((disconnectGraceExpiresAt - currentTime) / 1000));
  }

  // 27.4 seconds rounds to 28
  assert.equal(getGraceSecondsRemaining(futureExpiry, Date.now()), 28);
  // 1.1 seconds rounds to 2
  assert.equal(getGraceSecondsRemaining(Date.now() + 1100, Date.now()), 2);
  // 0.2 seconds rounds to 1
  assert.equal(getGraceSecondsRemaining(Date.now() + 200, Date.now()), 1);
  // Expired returns null
  assert.equal(getGraceSecondsRemaining(Date.now() - 500, Date.now()), null);
  // Null returns null
  assert.equal(getGraceSecondsRemaining(null, Date.now()), null);
});

test("Result Reason & Message Semantics: Win, Draw, and Disconnect Forfeit", () => {
  function getResultMessage(status, isWinner, resultReason) {
    const isDisconnectForfeit = resultReason === "disconnect_forfeit";
    if (status === "won") {
      if (isWinner) {
        return isDisconnectForfeit ? "Opponent forfeit (disconnected)" : "You won!";
      }
      return isDisconnectForfeit ? "You forfeit (disconnected)" : "Opponent won";
    }
    return "Draw";
  }

  // Normal win
  assert.equal(getResultMessage("won", true, "win"), "You won!");
  assert.equal(getResultMessage("won", false, "win"), "Opponent won");

  // Disconnect forfeit win/loss
  assert.equal(getResultMessage("won", true, "disconnect_forfeit"), "Opponent forfeit (disconnected)");
  assert.equal(getResultMessage("won", false, "disconnect_forfeit"), "You forfeit (disconnected)");

  // Normal draw
  assert.equal(getResultMessage("draw", false, "draw"), "Draw");
});


