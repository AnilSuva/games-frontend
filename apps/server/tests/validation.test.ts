import test from "node:test";
import assert from "node:assert/strict";
import { parseClientMessage } from "../src/validation/messages.js";

test("Validation: parses valid messages for all message types", () => {
  const validMessages = [
    {
      version: 1,
      type: "session.identify",
      requestId: "req_1",
      payload: { displayName: "PlayerOne" },
    },
    {
      version: 1,
      type: "room.create",
      requestId: "req_2",
      payload: { gameId: "tic-tac-toe", maxPlayers: 2 },
    },
    {
      version: 1,
      type: "room.join",
      requestId: "req_3",
      payload: { roomCode: "ABC234" },
    },
    {
      version: 1,
      type: "room.leave",
      requestId: "req_4",
      payload: {},
    },
    {
      version: 1,
      type: "room.reconnect",
      requestId: "req_5",
      payload: { roomCode: "ABC234", reconnectToken: "token123" },
    },
    {
      version: 1,
      type: "ping",
      requestId: "req_6",
      payload: { clientTime: 123456789 },
    },
  ];

  for (const msg of validMessages) {
    const result = parseClientMessage(JSON.stringify(msg));
    assert.equal(result.success, true, `Should succeed for type ${msg.type}`);
    if (result.success) {
      assert.equal(result.message.type, msg.type);
      assert.equal(result.message.requestId, msg.requestId);
      assert.equal(result.message.version, 1);
    }
  }
});

test("Validation: rejects invalid protocol version", () => {
  const invalidVersion = JSON.stringify({
    version: 2,
    type: "ping",
    requestId: "req_v2",
    payload: {},
  });

  const result = parseClientMessage(invalidVersion);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INVALID_VERSION");
    assert.equal(result.requestId, "req_v2");
  }
});

test("Validation: rejects unknown message types", () => {
  const unknownType = JSON.stringify({
    version: 1,
    type: "game.cheat",
    requestId: "req_cheat",
    payload: { win: true },
  });

  const result = parseClientMessage(unknownType);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "INVALID_MESSAGE");
  }
});

test("Validation: rejects invalid payload schemas", () => {
  // Empty room code
  const emptyRoomCode = JSON.stringify({
    version: 1,
    type: "room.join",
    requestId: "req_empty",
    payload: { roomCode: "" },
  });
  const res1 = parseClientMessage(emptyRoomCode);
  assert.equal(res1.success, false);
  if (!res1.success) {
    assert.equal(res1.code, "INVALID_MESSAGE");
  }

  // maxPlayers out of range (< 2)
  const invalidMaxPlayers = JSON.stringify({
    version: 1,
    type: "room.create",
    requestId: "req_invalid_players",
    payload: { gameId: "tic-tac-toe", maxPlayers: 1 },
  });
  const res2 = parseClientMessage(invalidMaxPlayers);
  assert.equal(res2.success, false);
  if (!res2.success) {
    assert.equal(res2.code, "INVALID_MESSAGE");
  }

  // Missing reconnectToken in room.reconnect
  const missingToken = JSON.stringify({
    version: 1,
    type: "room.reconnect",
    requestId: "req_no_token",
    payload: { roomCode: "ABC123" },
  });
  const res3 = parseClientMessage(missingToken);
  assert.equal(res3.success, false);
  if (!res3.success) {
    assert.equal(res3.code, "INVALID_MESSAGE");
  }
});
