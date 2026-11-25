import type {
  OnlineUnoNoMercyState,
  UnoCard,
  UnoCardKind,
  UnoColor,
  UnoGameEventPayload,
  UnoPublicPlayerInfo,
} from "../../../../platform/multiplayer/types";

export function getCardDrawValue(card: UnoCard): 0 | 2 | 4 | 6 | 10 {
  switch (card.kind) {
    case "draw2":
      return 2;
    case "draw4":
    case "wild_reverse_draw4":
      return 4;
    case "wild_draw6":
      return 6;
    case "wild_draw10":
      return 10;
    default:
      return 0;
  }
}

export function isCardPlayable(
  card: UnoCard,
  gameState: Pick<
    OnlineUnoNoMercyState,
    "status" | "phase" | "activeActorId" | "pendingDrawCount" | "pendingDrawMinValue" | "activeColor" | "topDiscard"
  > | null | undefined,
  myPlayerId: string | null | undefined
): boolean {
  if (!gameState || !myPlayerId) return false;
  if (gameState.status !== "in_progress") return false;
  if (gameState.phase !== "playing") return false;
  if (gameState.activeActorId !== myPlayerId) return false;

  if (gameState.pendingDrawCount > 0) {
    const drawVal = getCardDrawValue(card);
    return drawVal > 0 && drawVal >= gameState.pendingDrawMinValue;
  }

  if (card.color === "wild") {
    return true;
  }

  if (card.color === gameState.activeColor) {
    return true;
  }

  const topCard = gameState.topDiscard;
  if (!topCard) {
    return true;
  }

  if (card.kind === "number" && topCard.kind === "number") {
    return card.number === topCard.number;
  }

  if (card.kind !== "number" && card.kind === topCard.kind) {
    return true;
  }

  return false;
}

const COLOR_ORDER: Record<UnoColor, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  wild: 4,
};

const KIND_ORDER: Record<UnoCardKind, number> = {
  number: 0,
  draw2: 10,
  skip: 11,
  reverse: 12,
  discard_all: 13,
  skip_everyone: 14,
  draw4: 15,
  wild_reverse_draw4: 20,
  wild_color_roulette: 21,
  wild_draw6: 22,
  wild_draw10: 23,
};

export function sortHand(cards: readonly UnoCard[]): UnoCard[] {
  return [...cards].sort((a, b) => {
    const colorDiff = COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
    if (colorDiff !== 0) return colorDiff;

    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;

    if (a.kind === "number" && b.kind === "number") {
      return (a.number ?? 0) - (b.number ?? 0);
    }

    return a.id.localeCompare(b.id);
  });
}

export function formatCountdown(msRemaining: number): string {
  const clampedMs = Math.max(0, msRemaining);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getPlayerName(
  players: readonly UnoPublicPlayerInfo[],
  playerId?: string
): string {
  if (!playerId) return "Player";
  const found = players.find((p) => p.playerId === playerId);
  return found?.displayName || `Seat ${(found?.seat ?? 0) + 1}`;
}

export function formatCardLabel(card: UnoCard): string {
  const colorLabel =
    card.color === "wild"
      ? ""
      : `${card.color.charAt(0).toUpperCase() + card.color.slice(1)} `;
  switch (card.kind) {
    case "number":
      return `${colorLabel}${card.number ?? 0}`;
    case "draw2":
      return `${colorLabel}+2`;
    case "draw4":
      return `${colorLabel}+4`;
    case "skip":
      return `${colorLabel}Skip`;
    case "skip_everyone":
      return `${colorLabel}Skip Everyone`;
    case "reverse":
      return `${colorLabel}Reverse`;
    case "discard_all":
      return `${colorLabel}Discard All`;
    case "wild_reverse_draw4":
      return "Wild Reverse +4";
    case "wild_color_roulette":
      return "Wild Color Roulette";
    case "wild_draw6":
      return "Wild +6";
    case "wild_draw10":
      return "Wild +10";
  }
}

export function formatUnoEvent(
  ev: UnoGameEventPayload,
  players: readonly UnoPublicPlayerInfo[]
): string | null {
  const actor = getPlayerName(players, ev.playerId);
  switch (ev.type) {
    case "card_played":
      return ev.card ? `${actor} played ${formatCardLabel(ev.card)}` : null;
    case "cards_drawn":
      return ev.count ? `${actor} drew ${ev.count} card${ev.count === 1 ? "" : "s"}` : null;
    case "draw_penalty_accepted":
      return `${actor} took +${ev.drawnCount ?? 0} cards!`;
    case "hands_swapped":
      return `Swap! ${actor} ↔ ${getPlayerName(players, ev.targetPlayerId)}`;
    case "hands_rotated":
      return `0 Played! Everyone rotated hands ${ev.direction === 1 ? "↻" : "↺"}`;
    case "roulette_resolved":
      return `Roulette! ${actor} drew ${ev.drawnCount ?? 0} cards`;
    case "uno_called":
      return `${actor} shouted UNO!`;
    case "uno_caught":
      return `${getPlayerName(players, ev.catcherId)} caught ${getPlayerName(players, ev.targetPlayerId)} (+${ev.cardsDrawn ?? 2})!`;
    case "player_eliminated":
      if (ev.reason === "single_loser_mercy") {
        return `No Mercy! ${ev.playerName || actor} hit ${ev.cardCount ?? 25} cards — Game Over!`;
      }
      return `Mercy Rule! ${ev.playerName || actor} hit ${ev.cardCount ?? 25} cards`;
    case "player_kicked_afk":
      return `${actor} kicked (AFK 2:00)`;
    case "player_removed":
      return `${actor} disconnected & removed`;
    default:
      return null;
  }
}

export type TableSeatPosition =
  | "top"
  | "top-left"
  | "top-right"
  | "left"
  | "right";

export interface RelativeTableSeat {
  player: UnoPublicPlayerInfo;
  position: TableSeatPosition;
  relativeIndex: number;
}

const SEAT_LAYOUTS: Record<number, readonly TableSeatPosition[]> = {
  2: ["top"],
  3: ["top-left", "top-right"],
  4: ["left", "top", "right"],
  5: ["left", "top-left", "top-right", "right"],
  6: ["left", "top-left", "top", "top-right", "right"],
};

/**
 * Anchors `myPlayerId` at the bottom seat and arranges the remaining players
 * in exact relative clockwise order around the table perimeter.
 */
export function getRelativeTableSeats(
  players: readonly UnoPublicPlayerInfo[],
  myPlayerId: string
): RelativeTableSeat[] {
  if (players.length <= 1) return [];

  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const foundIndex = sorted.findIndex((p) => p.playerId === myPlayerId);
  const myIndex = foundIndex >= 0 ? foundIndex : 0;

  const opponents: UnoPublicPlayerInfo[] = [];
  for (let i = 1; i < sorted.length; i++) {
    opponents.push(sorted[(myIndex + i) % sorted.length]);
  }

  const positions =
    SEAT_LAYOUTS[sorted.length] ??
    (["left", "top-left", "top", "top-right", "right"] as const);

  return opponents.map((player, idx) => ({
    player,
    position: positions[idx] ?? "top",
    relativeIndex: idx + 1,
  }));
}

/**
 * Returns the next active player's ID walking from `activeActorId` in `direction`
 * (1 = clockwise, -1 = counter-clockwise), skipping eliminated/kicked/disconnected seats.
 */
export function getNextActivePlayerId(
  players: readonly UnoPublicPlayerInfo[],
  activeActorId: string | null | undefined,
  direction: 1 | -1
): string | null {
  if (!activeActorId) return null;

  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const active = sorted.filter((p) => p.status === "active");
  if (active.length < 2) return null;

  const idx = active.findIndex((p) => p.playerId === activeActorId);
  if (idx !== -1) {
    const nextIdx =
      (((idx + direction) % active.length) + active.length) % active.length;
    return active[nextIdx].playerId;
  }

  const actorSeat = sorted.find((p) => p.playerId === activeActorId)?.seat ?? -1;
  if (direction === 1) {
    const next = active.find((p) => p.seat > actorSeat) ?? active[0];
    return next.playerId;
  }
  const prevCandidates = active.filter((p) => p.seat < actorSeat);
  const prev =
    prevCandidates.length > 0
      ? prevCandidates[prevCandidates.length - 1]
      : active[active.length - 1];
  return prev.playerId;
}
