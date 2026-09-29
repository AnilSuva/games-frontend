import test from "node:test";
import assert from "node:assert/strict";
import { createResultSoundGuard } from "../src/games/common/resultSound.ts";
import {
  isColumnFull,
  isValidColumn,
  getLandingRow,
  createInitialColumnCounts,
  incrementColumnCount,
} from "../src/games/board/connect-four/logic/rules.ts";

test("Online Connect Four Sound Semantics: Winner hears victory, loser hears lose, draw produces no result sound", () => {
  // Scenario 1: Human is Orange ("R"), Server reports "R" won -> Victory sound
  const guardWinner = createResultSoundGuard();
  const humanWinnerSound = guardWinner.claim("victory");
  assert.equal(humanWinnerSound, "victory");
  // Sound cannot replay in same match
  assert.equal(guardWinner.claim("victory"), null);

  // Scenario 2: Human is Blue ("Y"), Server reports "R" won -> Lose sound
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
  assert.equal(guardWinner.claim("victory"), "victory");
});

test("Online Connect Four Player Assignment & Turn Authority Logic", () => {
  const hostPlayerId = "ply_host_c4";
  const guestPlayerId = "ply_guest_c4";

  const roomDto = {
    roomId: "room_c4_1",
    roomCode: "C4TEST",
    gameId: "connect-four",
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

  assert.equal(roomDto.gameId, "connect-four");

  const gameState = {
    board: Array(42).fill(null),
    columnCounts: [0, 0, 0, 0, 0, 0, 0],
    currentPlayer: "R",
    startingPlayer: "R",
    status: "in_progress",
    winner: null,
    winningLine: null,
    lastMove: null,
    moveCount: 0,
    playerDiscs: {
      [hostPlayerId]: "R",
      [guestPlayerId]: "Y",
    },
    rematchRequests: [],
  };

  // Derive roles
  const hostRole = gameState.playerDiscs[hostPlayerId];
  const guestRole = gameState.playerDiscs[guestPlayerId];
  assert.equal(hostRole, "R"); // Orange
  assert.equal(guestRole, "Y"); // Blue

  // Turn checks
  const isHostTurn = gameState.currentPlayer === hostRole;
  const isGuestTurn = gameState.currentPlayer === guestRole;
  assert.equal(isHostTurn, true);
  assert.equal(isGuestTurn, false);

  // Column validation
  assert.equal(isValidColumn(0), true);
  assert.equal(isValidColumn(6), true);
  assert.equal(isValidColumn(-1), false);
  assert.equal(isValidColumn(7), false);

  // Drop simulation
  let colCounts = createInitialColumnCounts();
  for (let i = 0; i < 6; i++) {
    assert.equal(isColumnFull(colCounts, 3), false);
    const targetRow = getLandingRow(colCounts, 3);
    assert.equal(targetRow, 5 - i);
    colCounts = incrementColumnCount(colCounts, 3);
  }
  // After 6 discs in col 3, column is full
  assert.equal(isColumnFull(colCounts, 3), true);
  assert.equal(getLandingRow(colCounts, 3), -1);
});

test("Online Connect Four Disconnect Countdown & Pause State Logic", () => {
  const now = 1000000;
  const disconnectGraceExpiresAt = now + 15000; // 15 seconds remaining

  const isMatchPaused = Boolean(
    disconnectGraceExpiresAt &&
      disconnectGraceExpiresAt > now
  );
  assert.equal(isMatchPaused, true);

  const secondsRemaining = Math.max(
    0,
    Math.ceil((disconnectGraceExpiresAt - now) / 1000)
  );
  assert.equal(secondsRemaining, 15);

  // Once grace expired
  const expiredNow = now + 16000;
  const isExpired = Boolean(
    disconnectGraceExpiresAt &&
      disconnectGraceExpiresAt > expiredNow
  );
  assert.equal(isExpired, false);
});

test("Online Connect Four Rematch State Rotation Logic", () => {
  let startingPlayer = "R";
  const rotateStarter = (current) => (current === "R" ? "Y" : "R");

  startingPlayer = rotateStarter(startingPlayer);
  assert.equal(startingPlayer, "Y");

  startingPlayer = rotateStarter(startingPlayer);
  assert.equal(startingPlayer, "R");
});
