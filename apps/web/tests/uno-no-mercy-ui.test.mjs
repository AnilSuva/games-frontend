import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  getCardDrawValue,
  getNextActivePlayerId,
  getRelativeTableSeats,
  isCardPlayable,
  sortHand,
} from "../src/games/board/uno-no-mercy/logic/uiHelpers.ts";

test("UNO UI Helpers: isCardPlayable handles normal matching, stacking, and Wild Color Roulette", () => {
  const baseState = {
    status: "in_progress",
    phase: "playing",
    activeActorId: "p1",
    pendingDrawCount: 0,
    pendingDrawMinValue: 0,
    activeColor: "red",
    topDiscard: { id: "top", color: "red", kind: "number", number: 5 },
  };

  // Not my turn -> false
  assert.equal(
    isCardPlayable({ id: "c1", color: "red", kind: "number", number: 2 }, baseState, "p2"),
    false
  );

  // Color match, number match, and Wild -> true
  assert.equal(
    isCardPlayable({ id: "c1", color: "red", kind: "number", number: 2 }, baseState, "p1"),
    true
  );
  assert.equal(
    isCardPlayable({ id: "c2", color: "blue", kind: "number", number: 5 }, baseState, "p1"),
    true
  );
  assert.equal(
    isCardPlayable({ id: "c3", color: "wild", kind: "wild_draw6" }, baseState, "p1"),
    true
  );

  // Mismatch -> false
  assert.equal(
    isCardPlayable({ id: "c4", color: "green", kind: "number", number: 9 }, baseState, "p1"),
    false
  );

  // Active stack (+4 min): +2 and Wild Color Roulette rejected; colored +4 and Wild +6/+10 accepted
  const stackState = {
    ...baseState,
    pendingDrawCount: 4,
    pendingDrawMinValue: 4,
  };
  assert.equal(
    isCardPlayable({ id: "s1", color: "red", kind: "draw2" }, stackState, "p1"),
    false
  );
  assert.equal(
    isCardPlayable({ id: "s2", color: "wild", kind: "wild_color_roulette" }, stackState, "p1"),
    false
  );
  assert.equal(
    isCardPlayable({ id: "s3", color: "blue", kind: "draw4" }, stackState, "p1"),
    true
  );
  assert.equal(
    isCardPlayable({ id: "s4", color: "wild", kind: "wild_draw10" }, stackState, "p1"),
    true
  );
  assert.equal(getCardDrawValue({ id: "s2", color: "wild", kind: "wild_color_roulette" }), 0);
});

test("UNO UI Helpers: sortHand groups by color then value/action/wild", () => {
  const unsorted = [
    { id: "w1", color: "wild", kind: "wild_draw10" },
    { id: "b9", color: "blue", kind: "number", number: 9 },
    { id: "r7", color: "red", kind: "number", number: 7 },
    { id: "r2", color: "red", kind: "number", number: 2 },
    { id: "y_skip", color: "yellow", kind: "skip" },
    { id: "r_d2", color: "red", kind: "draw2" },
  ];

  const sorted = sortHand(unsorted);
  assert.deepEqual(
    sorted.map((c) => c.id),
    ["r2", "r7", "r_d2", "y_skip", "b9", "w1"]
  );
});

test("UNO UI Helpers: formatCountdown clamps cleanly and formats M:SS", () => {
  assert.equal(formatCountdown(120_000), "2:00");
  assert.equal(formatCountdown(15_000), "0:15");
  assert.equal(formatCountdown(4_100), "0:05");
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(-5000), "0:00");
});

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    displayName: `Player ${i + 1}`,
    seat: i,
    status: "active",
    cardCount: 7,
    unoCalled: false,
    vulnerableToUnoCatch: false,
  }));
}

test("UNO UI Helpers: getRelativeTableSeats arranges 2..6 players in exact clockwise order", () => {
  // 2 players -> ["top"]
  const s2 = getRelativeTableSeats(makePlayers(2), "p2");
  assert.deepEqual(
    s2.map((s) => [s.player.playerId, s.position]),
    [["p1", "top"]]
  );

  // 3 players -> ["top-left", "top-right"]
  const s3 = getRelativeTableSeats(makePlayers(3), "p2");
  assert.deepEqual(
    s3.map((s) => [s.player.playerId, s.position]),
    [
      ["p3", "top-left"],
      ["p1", "top-right"],
    ]
  );

  // 4 players -> ["left", "top", "right"]
  const s4 = getRelativeTableSeats(makePlayers(4), "p3");
  assert.deepEqual(
    s4.map((s) => [s.player.playerId, s.position]),
    [
      ["p4", "left"],
      ["p1", "top"],
      ["p2", "right"],
    ]
  );

  // 5 players -> ["left", "top-left", "top-right", "right"]
  const s5 = getRelativeTableSeats(makePlayers(5), "p4");
  assert.deepEqual(
    s5.map((s) => [s.player.playerId, s.position]),
    [
      ["p5", "left"],
      ["p1", "top-left"],
      ["p2", "top-right"],
      ["p3", "right"],
    ]
  );

  // 6 players -> ["left", "top-left", "top", "top-right", "right"], keeping eliminated seats anchored
  const p6 = makePlayers(6);
  p6[2].status = "eliminated_mercy";
  const s6 = getRelativeTableSeats(p6, "p5");
  assert.deepEqual(
    s6.map((s) => [s.player.playerId, s.position]),
    [
      ["p6", "left"],
      ["p1", "top-left"],
      ["p2", "top"],
      ["p3", "top-right"],
      ["p4", "right"],
    ]
  );
});

test("UNO UI Helpers: getNextActivePlayerId handles clockwise, counter-clockwise, and skipped inactive seats", () => {
  const players = makePlayers(4);
  players[1].status = "eliminated_mercy"; // p2 out
  players[3].status = "kicked_afk"; // p4 out -> active are p1, p3

  assert.equal(getNextActivePlayerId(players, "p1", 1), "p3");
  assert.equal(getNextActivePlayerId(players, "p1", -1), "p3");

  // Re-activate p4 -> active are p1, p3, p4
  players[3].status = "active";
  assert.equal(getNextActivePlayerId(players, "p1", 1), "p3");
  assert.equal(getNextActivePlayerId(players, "p1", -1), "p4");
  assert.equal(getNextActivePlayerId(players, "p4", 1), "p1");
  assert.equal(getNextActivePlayerId(players, "p3", -1), "p1");

  // < 2 active players -> null
  players[2].status = "disconnected";
  players[3].status = "disconnected";
  assert.equal(getNextActivePlayerId(players, "p1", 1), null);
});
