import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  gameReducer,
  validateAction,
  tickGame,
} from "../src/games/arcade/light-fingers/logic/gameLogic.ts";
import {
  WINNING_SCORE,
  MAX_ITEMS_ON_TABLE,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MIN_Y,
  PLAYFIELD_MAX_Y,
  COIN_VALUE,
  BANKNOTE_VALUE,
  TORN_PIECE_VALUE,
  VAULT_TOP_Y,
  VAULT_BOTTOM_Y,
  BOT_CONFIG,
} from "../src/games/arcade/light-fingers/config/constants.ts";
import { BotBrain } from "../src/games/arcade/light-fingers/bot/botBrain.ts";

test("Light Fingers: Initial Game State Setup", () => {
  const state = createInitialState("1v1", "medium");

  assert.equal(WINNING_SCORE, 15);
  assert.equal(state.status, "playing");
  assert.equal(state.winner, null);
  assert.equal(state.score.orange, 0);
  assert.equal(state.score.blue, 0);
  assert.equal(state.mode, "1v1");
  assert.equal(state.difficulty, "medium");
  assert.equal(state.claws.length, 0);

  // Seeded with initial items on the table
  assert.ok(state.items.length > 0);
  assert.ok(state.items.length <= MAX_ITEMS_ON_TABLE);

  // Each item has valid initial properties
  for (const item of state.items) {
    assert.ok(item.id.startsWith("item_"));
    assert.ok(item.kind === "coin" || item.kind === "banknote");
    assert.equal(item.value, item.kind === "coin" ? COIN_VALUE : BANKNOTE_VALUE);
    assert.equal(item.grabbedBy.length, 0);
    assert.ok(item.x >= PLAYFIELD_MIN_X && item.x <= PLAYFIELD_MAX_X);
    assert.ok(item.y >= PLAYFIELD_MIN_Y && item.y <= PLAYFIELD_MAX_Y);
  }
});

test("Light Fingers: Action Validation: Rejects invalid or corrupted actions", () => {
  const state = createInitialState("1v1", "medium");

  // Valid actions
  assert.equal(validateAction(state, { type: "TICK", dt: 0.016 }), true);
  assert.equal(
    validateAction(state, { type: "POINTER_DOWN", playerId: "orange", touchId: 1, x: 200, y: 300 }),
    true
  );
  assert.equal(
    validateAction(state, { type: "POINTER_MOVE", playerId: "blue", touchId: 2, x: 210, y: 280 }),
    true
  );
  assert.equal(
    validateAction(state, { type: "POINTER_UP", playerId: "orange", touchId: 1 }),
    true
  );

  // Invalid dt
  assert.equal(validateAction(state, { type: "TICK", dt: -0.1 }), false);
  assert.equal(validateAction(state, { type: "TICK", dt: 5.0 }), false);

  // Invalid player ID
  assert.equal(
    // @ts-expect-error test illegal player
    validateAction(state, { type: "POINTER_DOWN", playerId: "green", touchId: 1, x: 100, y: 100 }),
    false
  );

  // Invalid touchId
  assert.equal(
    validateAction(state, { type: "POINTER_DOWN", playerId: "orange", touchId: NaN, x: 100, y: 100 }),
    false
  );

  // Actions rejected when game is finished
  const finishedState = { ...state, status: "finished" };
  assert.equal(
    validateAction(finishedState, { type: "POINTER_DOWN", playerId: "orange", touchId: 1, x: 100, y: 100 }),
    false
  );
});

test("Light Fingers: Local 1v1 Grabbing and Dragging Mechanics", () => {
  let state = createInitialState("1v1", "medium");
  const targetItem = state.items[0];

  // Player 1 (Orange) presses on the item
  state = gameReducer(state, {
    type: "POINTER_DOWN",
    playerId: "orange",
    touchId: 10,
    x: targetItem.x,
    y: targetItem.y,
  });

  const updatedItem = state.items.find((it) => it.id === targetItem.id);
  assert.ok(updatedItem);
  assert.equal(updatedItem.grabbedBy.length, 1);
  assert.equal(updatedItem.grabbedBy[0].playerId, "orange");
  assert.equal(updatedItem.grabbedBy[0].touchId, 10);
  assert.equal(state.claws.length, 1);
  assert.equal(state.claws[0].targetItemId, targetItem.id);

  // Player 1 moves finger toward bottom vault
  const newY = targetItem.y + 80;
  state = gameReducer(state, {
    type: "POINTER_MOVE",
    playerId: "orange",
    touchId: 10,
    x: targetItem.x,
    y: newY,
  });

  // Advance simulation tick
  state = gameReducer(state, { type: "TICK", dt: 0.05 });
  const draggedItem = state.items.find((it) => it.id === targetItem.id);
  assert.ok(draggedItem);
  assert.ok(draggedItem.y > targetItem.y, "Item should move along with pointer");

  // Player 1 releases finger
  state = gameReducer(state, {
    type: "POINTER_UP",
    playerId: "orange",
    touchId: 10,
  });

  const releasedItem = state.items.find((it) => it.id === targetItem.id);
  assert.ok(releasedItem);
  assert.equal(releasedItem.grabbedBy.length, 0);
  assert.equal(state.claws.length, 0);
});

test("Light Fingers: Vault Entry Scoring: Coin (+1) and Banknote (+3)", () => {
  let state = createInitialState("1v1", "medium");

  // Test Coin collection for Orange Vault (Bottom)
  const coin = state.items.find((it) => it.kind === "coin");
  assert.ok(coin);
  coin.x = 300;
  coin.y = VAULT_BOTTOM_Y - 5; // right at the vault entrance
  coin.vy = 200; // moving down into vault

  state = tickGame(state, 0.05);

  assert.equal(state.score.orange, 1, "Orange should score 1 point for a coin");
  assert.equal(state.items.some((it) => it.id === coin.id), false, "Collected coin should be removed");

  // Test Banknote collection for Blue Vault (Top)
  const banknote = state.items.find((it) => it.kind === "banknote");
  assert.ok(banknote);
  banknote.x = 300;
  banknote.y = VAULT_TOP_Y + 5; // right at the vault entrance
  banknote.vy = -200; // moving up into vault

  state = tickGame(state, 0.05);

  assert.equal(state.score.blue, 3, "Blue should score 3 points for a banknote");
  assert.equal(state.items.some((it) => it.id === banknote.id), false, "Collected banknote should be removed");
});

test("Light Fingers: Tug-of-War Banknote Ripping: Both players pulling in opposite directions", () => {
  let state = createInitialState("1v1", "medium");

  // Find or insert a banknote
  let banknote = state.items.find((it) => it.kind === "banknote");
  if (!banknote) {
    banknote = {
      id: "test_bill",
      kind: "banknote",
      value: 3,
      x: 300,
      y: 400,
      vx: 0,
      vy: 0,
      rotation: 0,
      width: 84,
      height: 44,
      radius: 42,
      grabbedBy: [],
      spawnTime: Date.now(),
    };
    state.items.push(banknote);
  } else {
    banknote.x = 300;
    banknote.y = 400;
  }

  // Player 1 (Orange, bottom) grabs the banknote
  state = gameReducer(state, {
    type: "POINTER_DOWN",
    playerId: "orange",
    touchId: 1,
    x: 300,
    y: 410,
  });

  // Player 2 (Blue, top) also grabs the banknote
  state = gameReducer(state, {
    type: "POINTER_DOWN",
    playerId: "blue",
    touchId: 2,
    x: 300,
    y: 390,
  });

  const grabbedBill = state.items.find((it) => it.id === banknote.id);
  assert.ok(grabbedBill);
  assert.equal(grabbedBill.grabbedBy.length, 2, "Banknote should be grabbed by both players simultaneously");

  // Now, pull apart beyond the tear distance threshold!
  // Blue pulls upward to Y = 320, Orange pulls downward to Y = 480 (distance = 160px > 110px threshold)
  state = gameReducer(state, {
    type: "POINTER_MOVE",
    playerId: "blue",
    touchId: 2,
    x: 300,
    y: 320,
  });
  state = gameReducer(state, {
    type: "POINTER_MOVE",
    playerId: "orange",
    touchId: 1,
    x: 300,
    y: 480,
  });

  // Tick simulation
  state = tickGame(state, 0.05);

  // The original banknote should be ripped and replaced by two torn halves
  assert.equal(state.items.some((it) => it.id === banknote.id), false, "Original whole banknote destroyed");
  const tornPieces = state.items.filter((it) => it.kind === "torn_piece");
  assert.equal(tornPieces.length, 2, "Two torn pieces should be spawned");

  // Both players are awarded +1 point each for tearing the bill
  assert.equal(state.score.orange, TORN_PIECE_VALUE);
  assert.equal(state.score.blue, TORN_PIECE_VALUE);

  // Check event emitted
  const ripEvent = state.recentEvents.find((e) => e.kind === "banknote_ripped");
  assert.ok(ripEvent, "banknote_ripped event should be emitted");
});

test("Light Fingers: Winner Determination: Reaching 15 points wins match", () => {
  let state = createInitialState("1v1", "medium");
  state.score.orange = 14;
  state.score.blue = 10;

  // Orange collects a coin (+1 point -> 15 points)
  const coin = {
    id: "win_coin",
    kind: "coin",
    value: 1,
    x: 300,
    y: VAULT_BOTTOM_Y - 2,
    vx: 0,
    vy: 100,
    rotation: 0,
    width: 52,
    height: 52,
    radius: 26,
    grabbedBy: [],
    spawnTime: Date.now(),
  };
  state.items.push(coin);

  state = tickGame(state, 0.05);

  assert.equal(state.score.orange, 15);
  assert.equal(state.status, "finished");
  assert.equal(state.winner, "orange");
  const winEvent = state.recentEvents.find((e) => e.kind === "game_won");
  assert.ok(winEvent);
  assert.equal(winEvent.playerId, "orange");
});

test("Light Fingers: Bot Decision-Making and Difficulty Parameters", () => {
  const bot = new BotBrain("easy");
  const state = createInitialState("bot", "easy");

  // Bot configuration checks
  assert.equal(BOT_CONFIG.easy.maxClaws, 3);
  assert.equal(BOT_CONFIG.medium.maxClaws, 5);
  assert.equal(BOT_CONFIG.hard.maxClaws, 5);

  assert.equal(BOT_CONFIG.easy.reactionDelayMin, 1.2);
  assert.equal(BOT_CONFIG.medium.reactionDelayMin, 0.7);
  assert.equal(BOT_CONFIG.hard.reactionDelayMin, 0.45);

  // Bot updates with initial state: it will pick an intent but respect reaction delay
  const actionsInitial = bot.update(state, 0.1);
  // Waiting during reaction delay; should not instantly fire POINTER_DOWN
  assert.equal(actionsInitial.length, 0);

  // Advance time past reaction delay (3.0s is greater than easy delay max 2.5s)
  const actionsAfterDelay = bot.update(state, 3.0);
  assert.ok(actionsAfterDelay.length > 0, "Bot should initiate POINTER_DOWN after reaction delay");
  assert.equal(actionsAfterDelay[0].type, "POINTER_DOWN");
  assert.equal(actionsAfterDelay[0].playerId, "blue");

  // Subsequent ticks should produce POINTER_MOVE actions dragging towards Blue Vault
  const moveActions = bot.update(state, 0.05);
  assert.ok(moveActions.length > 0);
  assert.equal(moveActions[0].type, "POINTER_MOVE");
  assert.equal(moveActions[0].playerId, "blue");
});

test("Light Fingers: Match Restart and State Reset", () => {
  let state = createInitialState("1v1", "medium");
  state.score.orange = 12;
  state.score.blue = 9;

  // Restart match action
  state = gameReducer(state, { type: "RESTART_GAME" });

  assert.equal(state.status, "playing");
  assert.equal(state.winner, null);
  assert.equal(state.score.orange, 0);
  assert.equal(state.score.blue, 0);
  assert.equal(state.claws.length, 0);
  assert.ok(state.items.length > 0);
});
