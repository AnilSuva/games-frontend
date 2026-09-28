import test from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../src/rooms/RoomManager.js";

test("Rooms: createRoom initializes room with valid code and host", () => {
  const manager = new RoomManager(1000);
  const result = manager.createRoom("player_host", "tic-tac-toe", {
    displayName: "HostPlayer",
  });

  assert.equal(result.success, true);
  if (result.success) {
    const { room, reconnectToken } = result.data;
    assert.ok(room.id);
    assert.equal(room.code.length, 6);
    assert.equal(room.gameId, "tic-tac-toe");
    assert.equal(room.hostPlayerId, "player_host");
    assert.equal(room.status, "waiting");
    assert.equal(room.players.size, 1);
    assert.equal(room.version, 2); // Initial (1) + host added (+1)
    assert.ok(reconnectToken.length > 20);

    const player = room.players.get("player_host");
    assert.ok(player);
    assert.equal(player.seat, 0);
    assert.equal(player.displayName, "HostPlayer");
    assert.equal(player.connected, true);
  }
});

test("Rooms: joinRoom adds players, updates version, and transitions status when full", () => {
  const manager = new RoomManager(1000);
  const createRes = manager.createRoom("host_1", "connect-four", { maxPlayers: 2 });
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const roomCode = createRes.data.room.code;
  const initialVersion = createRes.data.room.version;

  const joinRes = manager.joinRoom(roomCode, "guest_2", "GuestPlayer");
  assert.equal(joinRes.success, true);
  if (joinRes.success) {
    const { room } = joinRes.data;
    assert.equal(room.players.size, 2);
    assert.equal(room.status, "in-progress");
    assert.ok(room.version > initialVersion, "Version must increase monotonically");

    const guest = room.players.get("guest_2");
    assert.ok(guest);
    assert.equal(guest.seat, 1);
    assert.equal(guest.displayName, "GuestPlayer");
  }
});

test("Rooms: joinRoom rejects when room is full or not found", () => {
  const manager = new RoomManager(1000);

  // Non-existent room
  const notFoundRes = manager.joinRoom("UNKNOWN", "player_x");
  assert.equal(notFoundRes.success, false);
  if (!notFoundRes.success) {
    assert.equal(notFoundRes.code, "ROOM_NOT_FOUND");
  }

  // Create room with capacity 2
  const createRes = manager.createRoom("host_p", "tic-tac-toe", { maxPlayers: 2 });
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const roomCode = createRes.data.room.code;

  // Add 2nd player
  const p2Res = manager.joinRoom(roomCode, "player_2");
  assert.equal(p2Res.success, true);

  // Attempt to add 3rd player
  const p3Res = manager.joinRoom(roomCode, "player_3");
  assert.equal(p3Res.success, false);
  if (!p3Res.success) {
    assert.equal(p3Res.code, "ROOM_FULL");
  }
});

test("Rooms: leaveRoom removes player and destroys empty room", () => {
  const manager = new RoomManager(1000);
  const createRes = manager.createRoom("host_solo", "brick-blast");
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const roomId = createRes.data.room.id;
  const roomCode = createRes.data.room.code;

  const leaveRes = manager.leaveRoom("host_solo", roomId);
  assert.equal(leaveRes.destroyed, true);
  assert.equal(manager.getRoomById(roomId), undefined);
  assert.equal(manager.getRoomByCode(roomCode), undefined);
});

test("Rooms: host leaving reassigns host to remaining player", () => {
  const manager = new RoomManager(1000);
  const createRes = manager.createRoom("host_a", "tic-tac-toe");
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const roomCode = createRes.data.room.code;
  manager.joinRoom(roomCode, "guest_b");

  const leaveRes = manager.leaveRoom("host_a");
  assert.equal(leaveRes.wasHost, true);
  assert.equal(leaveRes.destroyed, false);

  const room = manager.getRoomByCode(roomCode);
  assert.ok(room);
  assert.equal(room.hostPlayerId, "guest_b", "Host must be transferred to guest_b");
});

test("Rooms: disconnect and reconnect within grace period", () => {
  const manager = new RoomManager(5000);
  const createRes = manager.createRoom("host_reconn", "tic-tac-toe");
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const { room, reconnectToken } = createRes.data;

  // Simulate disconnect
  const disc = manager.handleDisconnect("host_reconn");
  assert.equal(disc.scheduled, true);
  assert.equal(room.players.get("host_reconn")?.connected, false);

  // Reconnect with valid token
  const reconnRes = manager.reconnectPlayer(room.code, reconnectToken);
  assert.equal(reconnRes.success, true);
  if (reconnRes.success) {
    assert.equal(reconnRes.data.playerId, "host_reconn");
    assert.equal(room.players.get("host_reconn")?.connected, true);
    assert.notEqual(reconnRes.data.reconnectToken, reconnectToken, "Must issue fresh reconnect token");
  }
});

test("Rooms: reconnect with invalid token fails with RECONNECT_EXPIRED", () => {
  const manager = new RoomManager(5000);
  const createRes = manager.createRoom("host_bad_token", "tic-tac-toe");
  assert.equal(createRes.success, true);
  if (!createRes.success) return;

  const reconnRes = manager.reconnectPlayer(createRes.data.room.code, "invalid_token_123");
  assert.equal(reconnRes.success, false);
  if (!reconnRes.success) {
    assert.equal(reconnRes.code, "RECONNECT_EXPIRED");
  }
});
