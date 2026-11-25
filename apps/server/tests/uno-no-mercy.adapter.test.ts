import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { buildApp } from "../src/index.js";
import { createUnoDeck, drawOneCard, UNO_COLORS } from "../src/games/uno-no-mercy/deck.js";
import { UnoNoMercyAdapter } from "../src/games/uno-no-mercy/UnoNoMercyAdapter.js";
import type {
  UnoCard,
  UnoGameState,
  UnoPublicPlayerView,
} from "../src/games/uno-no-mercy/types.js";
import type {
  ClientEnvelope,
  GameStatePayload,
  RoomCreatedPayload,
  RoomErrorPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomUpdatedPayload,
  ServerEnvelope,
  SessionReadyPayload,
} from "../src/types/index.js";

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

async function identifyClient(ws: WebSocket, name: string, reqId: string): Promise<string> {
  sendJson(ws, {
    version: 1,
    type: "session.identify",
    requestId: reqId,
    payload: { displayName: name },
  });
  const ready = await waitForMessage<SessionReadyPayload>(
    ws,
    (env) => env.type === "session.ready"
  );
  return ready.payload.playerId;
}

test("UNO No Mercy Deck & Core Rules: Unit tests", async (t) => {
  const adapter = new UnoNoMercyAdapter();

  await t.test("1. Exact 168-card deck composition and unique IDs", () => {
    const deck = createUnoDeck();
    assert.equal(deck.length, 168);

    const ids = new Set(deck.map((c) => c.id));
    assert.equal(ids.size, 168, "All 168 cards must have unique IDs");

    for (const color of UNO_COLORS) {
      for (let n = 0; n <= 9; n++) {
        assert.equal(
          deck.filter((c) => c.color === color && c.kind === "number" && c.number === n).length,
          2,
          `Expected 2 of ${color} ${n}`
        );
      }
      assert.equal(deck.filter((c) => c.color === color && c.kind === "draw2").length, 3);
      assert.equal(deck.filter((c) => c.color === color && c.kind === "draw4").length, 2);
      assert.equal(deck.filter((c) => c.color === color && c.kind === "skip").length, 3);
      assert.equal(deck.filter((c) => c.color === color && c.kind === "skip_everyone").length, 2);
      assert.equal(deck.filter((c) => c.color === color && c.kind === "reverse").length, 3);
      assert.equal(deck.filter((c) => c.color === color && c.kind === "discard_all").length, 3);
    }

    assert.equal(deck.filter((c) => c.color === "wild" && c.kind === "wild_reverse_draw4").length, 8);
    assert.equal(deck.filter((c) => c.color === "wild" && c.kind === "wild_color_roulette").length, 8);
    assert.equal(deck.filter((c) => c.color === "wild" && c.kind === "wild_draw6").length, 4);
    assert.equal(deck.filter((c) => c.color === "wild" && c.kind === "wild_draw10").length, 4);
  });

  await t.test("2. Initial discard is always a Number card and hidden-hand projection leaks nothing", () => {
    const state = adapter.createInitialState({
      players: [
        { playerId: "p1", seat: 0 },
        { playerId: "p2", seat: 1 },
        { playerId: "p3", seat: 2 },
      ],
      settings: { startingHandSize: 8, mercyLimit: 30 },
    });

    assert.equal(state.players[0].hand.length, 8);
    assert.equal(state.discardPile.length, 1);
    assert.equal(state.discardPile[0].kind, "number");
    assert.notEqual(state.discardPile[0].color, "wild");

    const viewP1 = adapter.projectStateForPlayer(state, "p1");
    assert.equal(viewP1.myHand.length, 8);
    assert.equal(viewP1.drawPileCount, state.drawPile.length);
    assert.equal((viewP1 as unknown as Record<string, unknown>).drawPile, undefined);
    assert.equal((viewP1 as unknown as Record<string, unknown>).eliminatedReservePile, undefined);

    for (const p of viewP1.players) {
      assert.equal((p as unknown as Record<string, unknown>).hand, undefined);
      assert.equal(p.cardCount, 8);
    }

    const p2CardIds = new Set(state.players[1].hand.map((c) => c.id));
    for (const c of viewP1.myHand) {
      assert.equal(p2CardIds.has(c.id), false);
    }
  });

  await t.test("3. Draw stacking escalation (+2 -> colored +4 -> Wild +6 -> Wild +10 -> accept) and invalid stacks", () => {
    let state = adapter.createInitialState({
      players: [
        { playerId: "p1", seat: 0 },
        { playerId: "p2", seat: 1 },
        { playerId: "p3", seat: 2 },
      ],
    });

    const p1Draw2: UnoCard = { id: "c-d2", color: "red", kind: "draw2" };
    const p1Extra: UnoCard = { id: "c-x1", color: "red", kind: "number", number: 1 };
    const p2Draw4Blue: UnoCard = { id: "c-d4", color: "blue", kind: "draw4" };
    const p2Roulette: UnoCard = { id: "c-rl", color: "wild", kind: "wild_color_roulette" };
    const p3Wild6: UnoCard = { id: "c-w6", color: "wild", kind: "wild_draw6" };
    const p3Extra: UnoCard = { id: "c-x3", color: "green", kind: "number", number: 3 };
    const p1Wild10: UnoCard = { id: "c-w10", color: "wild", kind: "wild_draw10" };
    const p1LowDraw2: UnoCard = { id: "c-d2b", color: "green", kind: "draw2" };

    state.activeColor = "red";
    state.discardPile = [{ id: "top-0", color: "red", kind: "number", number: 5 }];
    state.players[0].hand = [p1Draw2, p1Extra, p1Wild10, p1LowDraw2];
    state.players[1].hand = [p2Draw4Blue, p2Roulette, { id: "c-x2", color: "yellow", kind: "number", number: 2 }];
    state.players[2].hand = [p3Wild6, p3Extra];
    state.activeActorId = "p1";

    // p1 plays +2
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "c-d2" }, "p1").nextState;
    assert.equal(state.pendingDrawCount, 2);
    assert.equal(state.pendingDrawMinValue, 2);
    assert.equal(state.activeActorId, "p2");

    // p2 cannot stack Wild Color Roulette
    assert.equal(
      adapter.validateAction(state, { type: "PLAY_CARD", cardId: "c-rl" }, "p2").valid,
      false
    );

    // p2 CAN stack colored +4 (even though blue on red!)
    assert.equal(
      adapter.validateAction(state, { type: "PLAY_CARD", cardId: "c-d4" }, "p2").valid,
      true
    );
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "c-d4" }, "p2").nextState;
    assert.equal(state.pendingDrawCount, 6);
    assert.equal(state.pendingDrawMinValue, 4);
    assert.equal(state.activeActorId, "p3");

    // p3 stacks Wild +6
    state = adapter.applyAction(
      state,
      { type: "PLAY_CARD", cardId: "c-w6", chosenColor: "green" },
      "p3"
    ).nextState;
    assert.equal(state.pendingDrawCount, 12);
    assert.equal(state.pendingDrawMinValue, 6);
    assert.equal(state.activeActorId, "p1");

    // p1 CANNOT stack +2 on +6
    assert.equal(
      adapter.validateAction(state, { type: "PLAY_CARD", cardId: "c-d2b" }, "p1").valid,
      false
    );

    // p1 stacks Wild +10
    state = adapter.applyAction(
      state,
      { type: "PLAY_CARD", cardId: "c-w10", chosenColor: "yellow" },
      "p1"
    ).nextState;
    assert.equal(state.pendingDrawCount, 22);
    assert.equal(state.pendingDrawMinValue, 10);
    assert.equal(state.activeActorId, "p2");

    // p2 accepts penalty of 22 cards -> triggers Mercy Rule (2 + 22 = 24 < 25? Let's set mercyLimit 24 to test or check 24)
    const beforeLen = state.players[1].hand.length;
    state = adapter.applyAction(state, { type: "ACCEPT_DRAW_PENALTY" }, "p2").nextState;
    assert.equal(state.pendingDrawCount, 0);
    assert.equal(state.pendingDrawMinValue, 0);
    assert.equal(state.players[1].hand.length, beforeLen + 22);
    assert.equal(state.activeActorId, "p3");
  });

  await t.test("4. Wild Reverse Draw 4 in 3+ players vs 2 active players (bounces to self)", () => {
    let state = adapter.createInitialState({
      players: [
        { playerId: "p1", seat: 0 },
        { playerId: "p2", seat: 1 },
      ],
    });
    const wr4: UnoCard = { id: "wr4-1", color: "wild", kind: "wild_reverse_draw4" };
    const w6: UnoCard = { id: "w6-1", color: "wild", kind: "wild_draw6" };
    state.players[0].hand = [wr4, w6, { id: "x1", color: "red", kind: "number", number: 1 }];
    state.players[1].hand = [{ id: "x2", color: "red", kind: "number", number: 2 }];
    state.activeActorId = "p1";

    // In 2 active players, Wild Reverse Draw 4 bounces +4 back onto p1!
    state = adapter.applyAction(
      state,
      { type: "PLAY_CARD", cardId: "wr4-1", chosenColor: "blue" },
      "p1"
    ).nextState;

    assert.equal(state.activeActorId, "p1");
    assert.equal(state.pendingDrawCount, 4);
    assert.equal(state.pendingDrawMinValue, 4);

    // p1 can stack Wild +6 back at p2!
    state = adapter.applyAction(
      state,
      { type: "PLAY_CARD", cardId: "w6-1", chosenColor: "green" },
      "p1"
    ).nextState;
    assert.equal(state.activeActorId, "p2");
    assert.equal(state.pendingDrawCount, 10);
  });

  await t.test("5. 7-Swap, 0-Rotate, Discard All ordering, Skip Everyone, and Wild Color Roulette", () => {
    let state = adapter.createInitialState({
      players: [
        { playerId: "p1", seat: 0 },
        { playerId: "p2", seat: 1 },
        { playerId: "p3", seat: 2 },
      ],
    });

    const c7: UnoCard = { id: "c7", color: "red", kind: "number", number: 7 };
    const c0: UnoCard = { id: "c0", color: "red", kind: "number", number: 0 };
    const cSkipAll: UnoCard = { id: "csa", color: "red", kind: "skip_everyone" };
    const cDiscAll: UnoCard = { id: "cda", color: "red", kind: "discard_all" };
    const cRedExtra: UnoCard = { id: "cre", color: "red", kind: "number", number: 9 };
    const cBlueKeep: UnoCard = { id: "cbk", color: "blue", kind: "number", number: 4 };

    state.activeColor = "red";
    state.discardPile = [{ id: "top", color: "red", kind: "number", number: 2 }];
    state.players[0].hand = [c7, cSkipAll, cDiscAll, cRedExtra, cBlueKeep];
    state.players[1].hand = [c0, { id: "p2-a", color: "green", kind: "number", number: 3 }];
    state.players[2].hand = [{ id: "p3-a", color: "yellow", kind: "number", number: 6 }];
    state.activeActorId = "p1";

    // Skip Everyone keeps turn on p1
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "csa" }, "p1").nextState;
    assert.equal(state.activeActorId, "p1");

    // Discard All puts matching red card underneath discard_all
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "cda" }, "p1").nextState;
    assert.equal(state.discardPile[state.discardPile.length - 1].id, "cda");
    assert.equal(state.discardPile[state.discardPile.length - 2].id, "cre");
    assert.equal(state.players[0].hand.some((c) => c.id === "cre"), false);
    assert.equal(state.players[0].hand.some((c) => c.id === "cbk"), true);

    // Force turn back to p1 to test 7-swap
    state.activeActorId = "p1";
    state.activeColor = "red";
    state.players[0].hand.push(c7);
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "c7" }, "p1").nextState;
    assert.equal(state.phase, "choosing_swap_target");
    state = adapter.applyAction(
      state,
      { type: "CHOOSE_SWAP_TARGET", targetPlayerId: "p3" },
      "p1"
    ).nextState;
    assert.equal(state.phase, "playing");
    assert.equal(state.players[0].hand[0].id, "p3-a");
    assert.equal(state.players[2].hand[0].id, "cbk");

    // p2 plays 0 -> rotates hands clockwise (p1->p2, p2->p3, p3->p1)
    assert.equal(state.activeActorId, "p2");
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "c0" }, "p2").nextState;
    assert.equal(state.players[0].hand[0].id, "cbk"); // from p3
    assert.equal(state.players[1].hand[0].id, "p3-a"); // from p1
    assert.equal(state.players[2].hand[0].id, "p2-a"); // from p2

    // Wild Color Roulette ignores Wild cards during reveal
    state.activeActorId = "p3";
    state.players[2].hand.push({ id: "wcr", color: "wild", kind: "wild_color_roulette" });
    state.drawPile = [
      { id: "d-match", color: "blue", kind: "number", number: 8 }, // popped 3rd
      { id: "d-wild", color: "wild", kind: "wild_draw6" }, // popped 2nd (ignored!)
      { id: "d-miss", color: "green", kind: "number", number: 1 }, // popped 1st
    ];
    state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: "wcr" }, "p3").nextState;
    assert.equal(state.phase, "choosing_roulette_color");
    assert.equal(state.activeActorId, "p1");

    state = adapter.applyAction(
      state,
      { type: "CHOOSE_ROULETTE_COLOR", color: "blue" },
      "p1"
    ).nextState;
    assert.equal(state.lastRouletteReveal.length, 3);
    assert.equal(state.activeColor, "blue");
    assert.equal(state.activeActorId, "p2"); // victim p1 lost turn
  });

  await t.test("6. Last-card win priority (7, 0, Discard All, Wild immediately win without sub-phase)", () => {
    for (const card of [
      { id: "win-7", color: "red", kind: "number", number: 7 },
      { id: "win-0", color: "red", kind: "number", number: 0 },
      { id: "win-da", color: "red", kind: "discard_all" },
      { id: "win-w6", color: "wild", kind: "wild_draw6" },
    ] as UnoCard[]) {
      let state = adapter.createInitialState({
        players: [
          { playerId: "p1", seat: 0 },
          { playerId: "p2", seat: 1 },
        ],
      });
      state.activeColor = "red";
      state.discardPile = [{ id: "top", color: "red", kind: "number", number: 5 }];
      state.players[0].hand = [card];
      state.activeActorId = "p1";

      state = adapter.applyAction(state, { type: "PLAY_CARD", cardId: card.id }, "p1").nextState;
      assert.equal(state.status, "won");
      assert.equal(state.phase, "finished");
      assert.equal(state.winnerId, "p1");
      assert.equal(state.resultReason, "emptied_hand");
    }
  });

  await t.test("7. Mercy Rule elimination at custom mercyLimit (24) & Deck exhaustion safety", () => {
    let state = adapter.createInitialState({
      players: [
        { playerId: "p1", seat: 0 },
        { playerId: "p2", seat: 1 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 24 },
    });

    // Give p2 20 cards and +4 penalty -> reaches 24 -> eliminated -> p1 wins!
    while (state.players[1].hand.length < 20) {
      state.players[1].hand.push(state.drawPile.pop()!);
    }
    state.pendingDrawCount = 4;
    state.pendingDrawMinValue = 4;
    state.activeActorId = "p2";

    state = adapter.applyAction(state, { type: "ACCEPT_DRAW_PENALTY" }, "p2").nextState;
    assert.equal(state.players[1].status, "eliminated_mercy");
    assert.equal(state.players[1].hand.length, 0);
    assert.equal(state.eliminatedReservePile.length, 24);
    assert.equal(state.status, "won");
    assert.equal(state.winnerId, "p1");
    assert.equal(state.resultReason, "mercy_elimination");

    // Test drawOneCard when drawPile is empty, reshuffling eliminatedReservePile + discardPile, and returning null when completely empty
    const emptyTestState: Pick<UnoGameState, "drawPile" | "discardPile" | "eliminatedReservePile"> = {
      drawPile: [],
      discardPile: [{ id: "only-top", color: "red", kind: "number", number: 1 }],
      eliminatedReservePile: [{ id: "res-1", color: "blue", kind: "number", number: 2 }],
    };
    const drawn1 = drawOneCard(emptyTestState);
    assert.equal(drawn1?.id, "res-1");
    const drawn2 = drawOneCard(emptyTestState);
    assert.equal(drawn2, null);
  });

  await t.test("8. Host One-Loser Mercy Rule (endOnFirstMercyLoss: true) triggers immediate match end on draw stack, draw-until-playable, roulette, and UNO catch", () => {
    // A. Draw stack penalty triggers single_loser_mercy in a 3-player game
    let stackState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
        { playerId: "p3", displayName: "Charlie", seat: 2 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 24, endOnFirstMercyLoss: true },
    });
    while (stackState.players[1].hand.length < 20) {
      stackState.players[1].hand.push(stackState.drawPile.pop()!);
    }
    stackState.pendingDrawCount = 4;
    stackState.pendingDrawMinValue = 4;
    stackState.activeActorId = "p2";

    const stackRes = adapter.applyAction(stackState, { type: "ACCEPT_DRAW_PENALTY" }, "p2");
    stackState = stackRes.nextState;
    assert.equal(stackState.status, "finished");
    assert.equal(stackState.phase, "finished");
    assert.equal(stackState.winnerId, null);
    assert.equal(stackState.loserId, "p2");
    assert.equal(stackState.loserName, "Bob");
    assert.equal(stackState.loserCardCount, 24);
    assert.equal(stackState.resultReason, "single_loser_mercy");
    assert.equal(stackState.pendingDrawCount, 0);
    assert.equal(stackState.turnDeadlineAt, null);
    assert.equal(adapter.getTurnDeadline(stackState), null);

    const viewP1 = adapter.projectStateForPlayer(stackState, "p1");
    assert.equal(viewP1.loserId, "p2");
    assert.equal(viewP1.loserName, "Bob");
    assert.equal(viewP1.loserCardCount, 24);
    assert.equal(viewP1.settings.endOnFirstMercyLoss, true);
    assert.ok(viewP1.finalStandings && viewP1.finalStandings.length === 3);
    assert.equal(viewP1.finalStandings![2].playerId, "p2");
    assert.equal(viewP1.finalStandings![2].isLoser, true);

    // B. Wild Color Roulette triggers single_loser_mercy
    let rouletteState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
        { playerId: "p3", displayName: "Charlie", seat: 2 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 15, endOnFirstMercyLoss: true },
    });
    while (rouletteState.players[2].hand.length < 13) {
      rouletteState.players[2].hand.push(rouletteState.drawPile.pop()!);
    }
    rouletteState.drawPile = [
      { id: "r-match", color: "red", kind: "number", number: 4 },
      { id: "r-miss", color: "blue", kind: "number", number: 2 },
    ];
    rouletteState.phase = "choosing_roulette_color";
    rouletteState.activeActorId = "p3";
    rouletteState = adapter.applyAction(
      rouletteState,
      { type: "CHOOSE_ROULETTE_COLOR", color: "red" },
      "p3"
    ).nextState;
    assert.equal(rouletteState.status, "finished");
    assert.equal(rouletteState.resultReason, "single_loser_mercy");
    assert.equal(rouletteState.loserId, "p3");
    assert.equal(rouletteState.loserCardCount, 15);

    // C. UNO Catch (+2) triggers single_loser_mercy
    let catchState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 15, endOnFirstMercyLoss: true },
    });
    while (catchState.players[0].hand.length < 14) {
      catchState.players[0].hand.push(catchState.drawPile.pop()!);
    }
    catchState.players[0].vulnerableToUnoCatch = true;
    catchState = adapter.applyAction(
      catchState,
      { type: "CATCH_UNO", targetPlayerId: "p1" },
      "p2"
    ).nextState;
    assert.equal(catchState.status, "finished");
    assert.equal(catchState.resultReason, "single_loser_mercy");
    assert.equal(catchState.loserId, "p1");

    // D. Draw-until-playable hits mercyLimit -> single_loser_mercy
    let drawState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 15, endOnFirstMercyLoss: true, drawUntilPlayable: true },
    });
    while (drawState.players[0].hand.length < 14) {
      drawState.players[0].hand.push(drawState.drawPile.pop()!);
    }
    drawState.activeColor = "red";
    drawState.discardPile = [{ id: "top-d", color: "red", kind: "number", number: 9 }];
    drawState.drawPile = [{ id: "non-match", color: "blue", kind: "number", number: 1 }];
    drawState.activeActorId = "p1";
    drawState = adapter.applyAction(drawState, { type: "DRAW_CARD" }, "p1").nextState;
    assert.equal(drawState.status, "finished");
    assert.equal(drawState.resultReason, "single_loser_mercy");
    assert.equal(drawState.loserId, "p1");

    // E. Emptying hand (0 cards) while endOnFirstMercyLoss: true still ends as emptied_hand win
    let winState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 25, endOnFirstMercyLoss: true },
    });
    winState.activeColor = "red";
    winState.discardPile = [{ id: "top-w", color: "red", kind: "number", number: 5 }];
    winState.players[0].hand = [{ id: "last-w", color: "red", kind: "number", number: 2 }];
    winState.activeActorId = "p1";
    winState = adapter.applyAction(winState, { type: "PLAY_CARD", cardId: "last-w" }, "p1").nextState;
    assert.equal(winState.status, "won");
    assert.equal(winState.winnerId, "p1");
    assert.equal(winState.resultReason, "emptied_hand");

    // F. Classic mode (endOnFirstMercyLoss: false) continues when 2+ players remain after 1 mercy elimination
    let classicState = adapter.createInitialState({
      players: [
        { playerId: "p1", displayName: "Alice", seat: 0 },
        { playerId: "p2", displayName: "Bob", seat: 1 },
        { playerId: "p3", displayName: "Charlie", seat: 2 },
      ],
      settings: { startingHandSize: 5, mercyLimit: 24, endOnFirstMercyLoss: false },
    });
    while (classicState.players[1].hand.length < 20) {
      classicState.players[1].hand.push(classicState.drawPile.pop()!);
    }
    classicState.pendingDrawCount = 4;
    classicState.pendingDrawMinValue = 4;
    classicState.activeActorId = "p2";
    classicState = adapter.applyAction(classicState, { type: "ACCEPT_DRAW_PENALTY" }, "p2").nextState;
    assert.equal(classicState.status, "in_progress");
    assert.equal(classicState.players[1].status, "eliminated_mercy");
    assert.equal(classicState.activeActorId, "p3");
  });
});

test("UNO No Mercy Server Integration: Lobby settings, Manual start, Hidden hands, Disconnect & AFK kick", async (t) => {
  const server = await buildApp({
    logLevel: "silent",
    nodeEnv: "test",
    port: 0,
    disconnectGracePeriodMs: 5000,
    allowedOrigins: ["http://localhost:3000"],
  });

  const address = await server.app.listen({ port: 0, host: "127.0.0.1" });
  const wsUrl = address.replace(/^http:/, "ws:") + "/ws";

  try {
    await t.test("Host settings, manual start, hidden hands, immediate disconnect, and AFK kick", async () => {
      const ws1 = await createWsClient(wsUrl);
      const ws2 = await createWsClient(wsUrl);
      const ws3 = await createWsClient(wsUrl);

      const p1Id = await identifyClient(ws1, "HostAlice", "id-1");
      const p2Id = await identifyClient(ws2, "Bob", "id-2");
      const p3Id = await identifyClient(ws3, "Charlie", "id-3");

      // 1. Host creates uno-no-mercy room with fast turnTimeoutMs for AFK testing
      sendJson(ws1, {
        version: 1,
        type: "room.create",
        requestId: "c-1",
        payload: {
          gameId: "uno-no-mercy",
          settings: { startingHandSize: 8, mercyLimit: 30, turnTimeoutMs: 120 },
        },
      });
      const created = await waitForMessage<RoomCreatedPayload>(ws1, (e) => e.type === "room.created");
      const roomCode = created.payload.room.roomCode;
      const roomId = created.payload.room.roomId;
      assert.equal(created.payload.room.status, "waiting");
      assert.equal(created.payload.room.manualStart, true);

      // 2. Bob & Charlie join -> room MUST stay "waiting"
      sendJson(ws2, { version: 1, type: "room.join", requestId: "j-2", payload: { roomCode } });
      const joined2 = await waitForMessage<RoomJoinedPayload>(ws2, (e) => e.type === "room.joined");
      assert.equal(joined2.payload.room.status, "waiting");

      sendJson(ws3, { version: 1, type: "room.join", requestId: "j-3", payload: { roomCode } });
      const joined3 = await waitForMessage<RoomJoinedPayload>(ws3, (e) => e.type === "room.joined");
      assert.equal(joined3.payload.room.status, "waiting");
      assert.equal(joined3.payload.room.players.length, 3);

      // 3. Non-host cannot update settings or start game
      sendJson(ws2, {
        version: 1,
        type: "update_room_settings",
        requestId: "u-bad",
        payload: { roomId, settings: { mercyLimit: 24 } },
      });
      const errNonHost = await waitForMessage<RoomErrorPayload>(ws2, (e) => e.type === "room.error");
      assert.equal(errNonHost.payload.code, "FORBIDDEN");

      // 4. Host updates settings to mercyLimit: 24
      const p2UpdatePromise = waitForMessage<RoomUpdatedPayload>(
        ws2,
        (e) => e.type === "room.updated" && e.payload.reason === "settings_updated"
      );
      sendJson(ws1, {
        version: 1,
        type: "update_room_settings",
        requestId: "u-ok",
        payload: { roomId, settings: { mercyLimit: 24 } },
      });
      const updated = await p2UpdatePromise;
      assert.equal(updated.payload.room.settings?.mercyLimit, 24);

      // 5. Host starts game -> each player gets personalized hidden-hand state
      const s1P = waitForMessage<GameStatePayload>(ws1, (e) => e.type === "game.state");
      const s2P = waitForMessage<GameStatePayload>(ws2, (e) => e.type === "game.state");
      const s3P = waitForMessage<GameStatePayload>(ws3, (e) => e.type === "game.state");

      sendJson(ws1, { version: 1, type: "start_game", requestId: "start-1", payload: { roomId } });
      const [s1, s2, s3] = await Promise.all([s1P, s2P, s3P]);

      const v1 = s1.payload.gameState as UnoPublicPlayerView;
      const v2 = s2.payload.gameState as UnoPublicPlayerView;
      const v3 = s3.payload.gameState as UnoPublicPlayerView;

      assert.equal(v1.myPlayerId, p1Id);
      assert.equal(v2.myPlayerId, p2Id);
      assert.equal(v3.myPlayerId, p3Id);
      assert.equal(v1.myHand.length, 8);
      assert.equal(v2.myHand.length, 8);
      assert.equal((v1 as unknown as Record<string, unknown>).drawPile, undefined);
      assert.equal(v1.settings.mercyLimit, 24);
      assert.ok(v1.turnDeadlineAt && v1.turnDeadlineAt > Date.now() - 1000);

      // 6. AFK Kick Timer: p1 (activeActorId) does nothing for 120ms -> kicked_afk!
      const p1KickedLeft = waitForMessage<RoomLeftPayload>(
        ws1,
        (e) => e.type === "room.left" && e.payload.reason === "afk_timeout"
      );
      const p2SeesKick = waitForMessage<RoomUpdatedPayload>(
        ws2,
        (e) => e.type === "room.updated" && e.payload.reason === "player_kicked_afk"
      );
      const p2NextState = waitForMessage<GameStatePayload>(
        ws2,
        (e) =>
          e.type === "game.state" &&
          (e.payload.gameState as UnoPublicPlayerView).activeActorId === p2Id
      );

      await Promise.all([p1KickedLeft, p2SeesKick, p2NextState]);

      // 7. Immediate disconnect removal: p3 disconnects -> p2 wins by last_player_standing immediately!
      const p2WinStateP = waitForMessage<GameStatePayload>(
        ws2,
        (e) =>
          e.type === "game.state" &&
          (e.payload.gameState as UnoPublicPlayerView).status === "won"
      );
      ws3.close();
      const p2WinState = await p2WinStateP;
      const winView = p2WinState.payload.gameState as UnoPublicPlayerView;
      assert.equal(winView.winnerId, p2Id);
      assert.equal(winView.resultReason, "last_player_standing");

      ws1.close();
      ws2.close();
    });

    await t.test("Host toggles endOnFirstMercyLoss via update_room_settings and match finishes cleanly without AFK leak", async () => {
      const ws1 = await createWsClient(wsUrl);
      const ws2 = await createWsClient(wsUrl);
      const ws3 = await createWsClient(wsUrl);

      await identifyClient(ws1, "HostOne", "ol-1");
      await identifyClient(ws2, "PlayerTwo", "ol-2");
      await identifyClient(ws3, "PlayerThree", "ol-3");

      sendJson(ws1, {
        version: 1,
        type: "room.create",
        requestId: "ol-c1",
        payload: {
          gameId: "uno-no-mercy",
          settings: { startingHandSize: 5, mercyLimit: 15, turnTimeoutMs: 120 },
        },
      });
      const created = await waitForMessage<RoomCreatedPayload>(ws1, (e) => e.type === "room.created");
      const roomCode = created.payload.room.roomCode;
      const roomId = created.payload.room.roomId;

      sendJson(ws2, { version: 1, type: "room.join", requestId: "ol-j2", payload: { roomCode } });
      await waitForMessage<RoomJoinedPayload>(ws2, (e) => e.type === "room.joined");
      sendJson(ws3, { version: 1, type: "room.join", requestId: "ol-j3", payload: { roomCode } });
      await waitForMessage<RoomJoinedPayload>(ws3, (e) => e.type === "room.joined");

      const updatedP = waitForMessage<RoomUpdatedPayload>(
        ws2,
        (e) => e.type === "room.updated" && e.payload.reason === "settings_updated"
      );
      sendJson(ws1, {
        version: 1,
        type: "update_room_settings",
        requestId: "ol-u1",
        payload: { roomId, settings: { endOnFirstMercyLoss: true } },
      });
      const updated = await updatedP;
      assert.equal(updated.payload.room.settings?.endOnFirstMercyLoss, true);

      const s1P = waitForMessage<GameStatePayload>(ws1, (e) => e.type === "game.state");
      sendJson(ws1, { version: 1, type: "start_game", requestId: "ol-s1", payload: { roomId } });
      const s1 = await s1P;
      const view1 = s1.payload.gameState as UnoPublicPlayerView;
      assert.equal(view1.settings.endOnFirstMercyLoss, true);

      // Force p1 hand to 14 cards and drawPile to mismatch so DRAW_CARD triggers single_loser_mercy
      const roomObj = server.roomManager.getRoomById(roomId)!;
      const internalState = roomObj.gameState as UnoGameState;
      while (internalState.players[0].hand.length < 14) {
        internalState.players[0].hand.push(internalState.drawPile.pop()!);
      }
      internalState.activeColor = "red";
      internalState.discardPile = [{ id: "ol-top", color: "red", kind: "number", number: 9 }];
      internalState.drawPile = [{ id: "ol-miss", color: "blue", kind: "number", number: 1 }];

      const p2FinishP = waitForMessage<GameStatePayload>(
        ws2,
        (e) =>
          e.type === "game.state" &&
          (e.payload.gameState as UnoPublicPlayerView).status === "finished"
      );
      sendJson(ws1, {
        version: 1,
        type: "game.move",
        requestId: "ol-draw",
        payload: { roomId, action: { type: "DRAW_CARD" } },
      });

      const p2Finish = await p2FinishP;
      const finView = p2Finish.payload.gameState as UnoPublicPlayerView;
      assert.equal(finView.status, "finished");
      assert.equal(finView.resultReason, "single_loser_mercy");
      assert.equal(finView.loserName, "HostOne");
      assert.equal(finView.loserCardCount, 15);
      assert.ok(finView.finalStandings && finView.finalStandings.length === 3);
      assert.equal(roomObj.status, "completed");

      // Wait longer than turnTimeoutMs (120ms) to confirm AFK timer was cancelled and no ghost kick occurs
      await new Promise((r) => setTimeout(r, 180));
      assert.equal(roomObj.players.size, 3);

      ws1.close();
      ws2.close();
      ws3.close();
    });
  } finally {
    await server.stop();
  }
});
