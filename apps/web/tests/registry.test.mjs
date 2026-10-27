import test from "node:test";
import assert from "node:assert/strict";
import {
  getAllGames,
  getVisibleGames,
  getAllRegisteredGames,
  getGameMetadata,
  getRegisteredGameMetadata,
  getGamesByCategory,
  getAllAvailableGameIds,
} from "../src/platform/registry/index.ts";

test("Registry: getAllGames and getVisibleGames return only built, playable games", () => {
  const allGames = getAllGames();
  const visibleGames = getVisibleGames();

  assert.equal(allGames.length, 10, "Visible games and tools should appear in the catalog");
  assert.equal(visibleGames.length, 10);

  const expectedIds = ["tic-tac-toe", "connect-four", "dots-and-boxes", "brick-blast", "spin-wheel", "checkers", "ping-pong", "knife-thrower", "star-catcher", "typing-race"];
  const returnedIds = allGames.map((g) => g.id);
  assert.deepEqual(returnedIds.sort(), expectedIds.sort());

  for (const game of allGames) {
    assert.equal(game.status, "available", `${game.id} must have status 'available'`);
    assert.equal(game.isVisible, true, `${game.id} must have isVisible true`);
  }
});

test("Registry: unfinished games are excluded from the visible catalog", () => {
  const visibleIds = new Set(getAllGames().map((g) => g.id));

  const unfinishedIds = ["chess", "archery", "platformer", "endless-runner"];
  for (const id of unfinishedIds) {
    assert.ok(
      !visibleIds.has(id),
      `Unfinished game '${id}' must NOT be in the visible catalog`
    );
  }
});

test("Registry: categories only contain visible playable games", () => {
  const boardGames = getGamesByCategory("board");
  const arcadeGames = getGamesByCategory("arcade");
  const randomRoyaleTools = getGamesByCategory("random-royale");

  const boardIds = boardGames.map((g) => g.id).sort();
  const arcadeIds = arcadeGames.map((g) => g.id).sort();

  assert.deepEqual(boardIds, ["checkers", "connect-four", "dots-and-boxes", "tic-tac-toe"]);
  assert.deepEqual(arcadeIds, ["brick-blast", "knife-thrower", "ping-pong", "star-catcher", "typing-race"]);
  assert.deepEqual(randomRoyaleTools.map((game) => game.id), ["spin-wheel"]);

  assert.ok(!boardIds.includes("chess"));
  assert.ok(!arcadeIds.includes("archery"));
  assert.ok(!arcadeIds.includes("platformer"));
  assert.ok(!arcadeIds.includes("endless-runner"));
});

test("Registry: getGameMetadata returns undefined for unfinished games (protecting routes)", () => {
  // Playable games must be found
  assert.ok(getGameMetadata("tic-tac-toe") !== undefined);
  assert.equal(getGameMetadata("tic-tac-toe")?.title, "Tic-Tac-Toe");
  assert.ok(getGameMetadata("connect-four") !== undefined);
  assert.equal(getGameMetadata("connect-four")?.title, "Connect Four");
  assert.ok(getGameMetadata("checkers") !== undefined);
  assert.equal(getGameMetadata("checkers")?.title, "Checkers");
  assert.ok(getGameMetadata("dots-and-boxes") !== undefined);
  assert.equal(getGameMetadata("dots-and-boxes")?.title, "Dots and Boxes");
  assert.ok(getGameMetadata("brick-blast") !== undefined);
  assert.equal(getGameMetadata("brick-blast")?.title, "Brick Blast");
  assert.ok(getGameMetadata("ping-pong") !== undefined);
  assert.equal(getGameMetadata("ping-pong")?.title, "Ping Pong");
  assert.ok(getGameMetadata("knife-thrower") !== undefined);
  assert.equal(getGameMetadata("knife-thrower")?.title, "Knife Thrower");
  assert.ok(getGameMetadata("star-catcher") !== undefined);
  assert.equal(getGameMetadata("star-catcher")?.title, "Star Catcher");
  assert.ok(getGameMetadata("typing-race") !== undefined);
  assert.equal(getGameMetadata("typing-race")?.title, "Typing Race");
  assert.equal(getGameMetadata("spin-wheel")?.title, "Spin Wheel");

  // Unfinished games must return undefined so dynamic route triggers 404 notFound()
  assert.equal(getGameMetadata("chess"), undefined);
  assert.equal(getGameMetadata("archery"), undefined);
  assert.equal(getGameMetadata("platformer"), undefined);
  assert.equal(getGameMetadata("endless-runner"), undefined);
  assert.equal(getGameMetadata("non-existent"), undefined);
});

test("Registry: unreleased definitions are preserved in master registry for future development", () => {
  const registered = getAllRegisteredGames();
  assert.ok(registered.length >= 8, "Master registry preserves future game manifests");

  const chess = getRegisteredGameMetadata("chess");
  assert.ok(chess !== undefined);
  assert.equal(chess?.status, "coming-soon");
  assert.equal(chess?.isVisible, false);

  const checkers = getRegisteredGameMetadata("checkers");
  assert.ok(checkers !== undefined);
  assert.equal(checkers?.status, "available");
  assert.equal(checkers?.isVisible, true);
});

test("Registry: getAllAvailableGameIds matches playable games for static params", () => {
  const ids = getAllAvailableGameIds();
  assert.deepEqual(ids.sort(), ["brick-blast", "checkers", "connect-four", "dots-and-boxes", "knife-thrower", "ping-pong", "spin-wheel", "star-catcher", "tic-tac-toe", "typing-race"]);
});
