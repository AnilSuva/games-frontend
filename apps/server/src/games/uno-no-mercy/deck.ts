import crypto from "node:crypto";
import type { UnoCard, UnoCardColor, UnoGameState } from "./types.js";

export const UNO_COLORS: readonly UnoCardColor[] = ["red", "yellow", "green", "blue"];

/**
 * Generates the exact 168-card "UNO Show 'Em No Mercy" deck:
 * Per color (4 colors):
 *  - Numbers 0..9: 2 each (80)
 *  - draw2: 3 each (12)
 *  - draw4: 2 each (8)
 *  - skip: 3 each (12)
 *  - skip_everyone: 2 each (8)
 *  - reverse: 3 each (12)
 *  - discard_all: 3 each (12)
 * Wild cards:
 *  - wild_reverse_draw4: 8
 *  - wild_color_roulette: 8
 *  - wild_draw6: 4
 *  - wild_draw10: 4
 * Total = 168 cards.
 */
export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let seq = 1;
  const nextId = () => `uno-${String(seq++).padStart(3, "0")}`;

  for (const color of UNO_COLORS) {
    for (let num = 0; num <= 9; num++) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({ id: nextId(), color, kind: "number", number: num });
      }
    }
    for (let copy = 0; copy < 3; copy++) {
      deck.push({ id: nextId(), color, kind: "draw2" });
    }
    for (let copy = 0; copy < 2; copy++) {
      deck.push({ id: nextId(), color, kind: "draw4" });
    }
    for (let copy = 0; copy < 3; copy++) {
      deck.push({ id: nextId(), color, kind: "skip" });
    }
    for (let copy = 0; copy < 2; copy++) {
      deck.push({ id: nextId(), color, kind: "skip_everyone" });
    }
    for (let copy = 0; copy < 3; copy++) {
      deck.push({ id: nextId(), color, kind: "reverse" });
    }
    for (let copy = 0; copy < 3; copy++) {
      deck.push({ id: nextId(), color, kind: "discard_all" });
    }
  }

  for (let copy = 0; copy < 8; copy++) {
    deck.push({ id: nextId(), color: "wild", kind: "wild_reverse_draw4" });
  }
  for (let copy = 0; copy < 8; copy++) {
    deck.push({ id: nextId(), color: "wild", kind: "wild_color_roulette" });
  }
  for (let copy = 0; copy < 4; copy++) {
    deck.push({ id: nextId(), color: "wild", kind: "wild_draw6" });
  }
  for (let copy = 0; copy < 4; copy++) {
    deck.push({ id: nextId(), color: "wild", kind: "wild_draw10" });
  }

  return deck;
}

export function shuffleCards<T>(items: readonly T[], rng?: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng ? Math.floor(rng() * (i + 1)) : crypto.randomInt(0, i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Draws until a Number card (0..9) is flipped face-up.
 * Any flipped Action/Wild cards are returned to drawPile and reshuffled.
 */
export function flipInitialDiscard(
  drawPile: UnoCard[],
  rng?: () => number
): { topDiscard: UnoCard; drawPile: UnoCard[] } {
  const pile = [...drawPile];
  const putAside: UnoCard[] = [];

  while (pile.length > 0) {
    const candidate = pile.pop()!;
    if (candidate.kind === "number" && candidate.color !== "wild") {
      const remaining = putAside.length > 0 ? shuffleCards([...pile, ...putAside], rng) : pile;
      return { topDiscard: candidate, drawPile: remaining };
    }
    putAside.push(candidate);
  }

  // Fallback (should never happen with a 168-card deck)
  const fallback = putAside.pop()!;
  return { topDiscard: fallback, drawPile: shuffleCards(putAside, rng) };
}

/**
 * Safely draws 1 card from drawPile.
 * If drawPile is empty, reshuffles discardPile (except top card) + eliminatedReservePile into drawPile.
 * Returns null if 0 cards remain anywhere outside active hands — never throws or loops infinitely.
 */
export function drawOneCard(
  state: Pick<UnoGameState, "drawPile" | "discardPile" | "eliminatedReservePile">,
  rng?: () => number
): UnoCard | null {
  if (state.drawPile.length > 0) {
    return state.drawPile.pop()!;
  }

  const recyclableDiscard =
    state.discardPile.length > 1 ? state.discardPile.slice(0, state.discardPile.length - 1) : [];
  const topDiscard =
    state.discardPile.length > 0 ? [state.discardPile[state.discardPile.length - 1]] : [];

  const pool = [...recyclableDiscard, ...state.eliminatedReservePile];
  if (pool.length === 0) {
    return null;
  }

  state.drawPile = shuffleCards(pool, rng);
  state.discardPile = topDiscard;
  state.eliminatedReservePile = [];

  return state.drawPile.pop() ?? null;
}
