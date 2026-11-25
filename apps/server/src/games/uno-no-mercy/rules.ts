import { z } from "zod";
import type { ActionResult, ImmediateRemoveResult, ValidationOutcome } from "../GameAdapter.js";
import { createUnoDeck, drawOneCard, flipInitialDiscard, shuffleCards } from "./deck.js";
import type {
  UnoAction,
  UnoCard,
  UnoCardColor,
  UnoFinalStanding,
  UnoGameState,
  UnoPlayerState,
  UnoPublicPlayerView,
  UnoSettings,
} from "./types.js";

export const DEFAULT_UNO_SETTINGS: UnoSettings = {
  startingHandSize: 7,
  mercyLimit: 25,
  maxPlayers: 6,
  turnTimeoutMs: 120_000,
  drawUntilPlayable: true,
  endOnFirstMercyLoss: false,
};

const unoSettingsSchema = z
  .object({
    startingHandSize: z.number().int().min(4).max(15).default(7),
    mercyLimit: z.number().int().min(15).max(50).default(25),
    maxPlayers: z.number().int().min(2).max(6).default(6),
    turnTimeoutMs: z.number().int().min(20).max(600_000).default(120_000),
    drawUntilPlayable: z.boolean().default(true),
    endOnFirstMercyLoss: z.boolean().default(false),
  })
  .refine((s) => s.mercyLimit >= s.startingHandSize + 3, {
    message: "mercyLimit must be at least startingHandSize + 3",
  });

export function validateUnoSettings(
  raw: Record<string, unknown>
): ValidationOutcome & { normalized?: Record<string, unknown> } {
  const parsed = unoSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error.issues[0]?.message ?? "Invalid UNO No Mercy settings",
    };
  }
  return {
    valid: true,
    normalized: parsed.data as unknown as Record<string, unknown>,
  };
}

export function getDrawValue(card: UnoCard): 0 | 2 | 4 | 6 | 10 {
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

export function isCardPlayable(card: UnoCard, state: UnoGameState): boolean {
  if (state.pendingDrawCount > 0) {
    const val = getDrawValue(card);
    return val > 0 && val >= state.pendingDrawMinValue;
  }

  if (card.color === "wild") {
    return true;
  }

  if (card.color === state.activeColor) {
    return true;
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
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

function getActivePlayers(players: UnoPlayerState[]): UnoPlayerState[] {
  return players.filter((p) => p.status === "active").sort((a, b) => a.seat - b.seat);
}

function getNextActivePlayerId(
  players: UnoPlayerState[],
  fromPlayerId: string,
  direction: 1 | -1,
  steps: number = 1
): string | null {
  const active = getActivePlayers(players);
  if (active.length === 0) return null;

  let idx = active.findIndex((p) => p.playerId === fromPlayerId);
  if (idx === -1) {
    // Fallback by seat order if fromPlayerId was just removed
    const removedSeat = players.find((p) => p.playerId === fromPlayerId)?.seat ?? -1;
    if (direction === 1) {
      const next = active.find((p) => p.seat > removedSeat) ?? active[0];
      idx = active.indexOf(next);
    } else {
      const prevCandidates = active.filter((p) => p.seat < removedSeat);
      const prev =
        prevCandidates.length > 0
          ? prevCandidates[prevCandidates.length - 1]
          : active[active.length - 1];
      idx = active.indexOf(prev);
    }
    const extraSteps = Math.max(0, steps - 1);
    const finalIdx = (((idx + direction * extraSteps) % active.length) + active.length) % active.length;
    return active[finalIdx].playerId;
  }

  const nextIdx = (((idx + direction * steps) % active.length) + active.length) % active.length;
  return active[nextIdx].playerId;
}

function cloneState(state: UnoGameState): UnoGameState {
  return {
    ...state,
    settings: { ...state.settings },
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    eliminatedReservePile: [...state.eliminatedReservePile],
    lastRouletteReveal: [...state.lastRouletteReveal],
  };
}

function checkMercyElimination(
  state: UnoGameState,
  player: UnoPlayerState,
  events: unknown[]
): boolean {
  if (player.status !== "active" || player.hand.length < state.settings.mercyLimit) {
    return false;
  }

  const cardCount = player.hand.length;
  const playerName = player.displayName || `Player ${player.seat + 1}`;
  player.status = "eliminated_mercy";
  player.unoCalled = false;
  player.vulnerableToUnoCatch = false;

  if (state.settings.endOnFirstMercyLoss) {
    state.status = "finished";
    state.phase = "finished";
    state.winnerId = null;
    state.loserId = player.playerId;
    state.loserName = playerName;
    state.loserCardCount = cardCount;
    state.resultReason = "single_loser_mercy";
    state.pendingDrawCount = 0;
    state.pendingDrawMinValue = 0;
    state.pendingWildCardKind = null;
    state.hasDrawnThisTurn = false;
    state.activeActorId = null;
    state.turnDeadlineAt = null;

    events.push({
      type: "player_eliminated",
      reason: "single_loser_mercy",
      playerId: player.playerId,
      playerName,
      cardCount,
      mercyLimit: state.settings.mercyLimit,
    });
    return true;
  }

  state.eliminatedReservePile.push(...player.hand);
  player.hand = [];

  events.push({
    type: "player_eliminated",
    reason: "mercy_rule",
    playerId: player.playerId,
    playerName,
    cardCount,
  });

  const active = getActivePlayers(state.players);
  if (active.length === 1) {
    state.status = "won";
    state.phase = "finished";
    state.winnerId = active[0].playerId;
    state.resultReason = "mercy_elimination";
    state.activeActorId = null;
    state.turnDeadlineAt = null;
  }

  return true;
}

function declareEmptiedHandWin(state: UnoGameState, winnerId: string): void {
  state.status = "won";
  state.phase = "finished";
  state.winnerId = winnerId;
  state.resultReason = "emptied_hand";
  state.activeActorId = null;
  state.turnDeadlineAt = null;
  state.pendingWildCardKind = null;
}

function clearOtherUnoVulnerability(state: UnoGameState, actorId: string): void {
  for (const p of state.players) {
    if (p.playerId !== actorId) {
      p.vulnerableToUnoCatch = false;
    }
  }
}

export function createUnoInitialState(options?: Record<string, unknown>): UnoGameState {
  const rawSettings = (options?.settings as Record<string, unknown> | undefined) ?? {};
  const validated = validateUnoSettings({ ...DEFAULT_UNO_SETTINGS, ...rawSettings });
  const settings: UnoSettings = validated.valid
    ? (validated.normalized as unknown as UnoSettings)
    : { ...DEFAULT_UNO_SETTINGS };

  const rawPlayers = Array.isArray(options?.players)
    ? (options!.players as Array<{ playerId: string; displayName?: string; seat?: number }>)
    : [
        { playerId: (options?.hostPlayerId as string) ?? "player-1", seat: 0 },
        { playerId: (options?.guestPlayerId as string) ?? "player-2", seat: 1 },
      ];

  const ordered = [...rawPlayers].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const deck = shuffleCards(createUnoDeck());

  const players: UnoPlayerState[] = ordered.map((p, idx) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    seat: p.seat ?? idx,
    status: "active",
    hand: [],
    unoCalled: false,
    vulnerableToUnoCatch: false,
  }));

  for (let i = 0; i < settings.startingHandSize; i++) {
    for (const player of players) {
      const card = deck.pop();
      if (card) {
        player.hand.push(card);
      }
    }
  }

  const { topDiscard, drawPile } = flipInitialDiscard(deck);
  const firstActorId = players[0]?.playerId ?? null;

  return {
    gameId: "uno-no-mercy",
    status: "in_progress",
    phase: "playing",
    settings,
    players,
    activeActorId: firstActorId,
    direction: 1,
    activeColor: topDiscard.color as UnoCardColor,
    drawPile,
    discardPile: [topDiscard],
    eliminatedReservePile: [],
    pendingDrawCount: 0,
    pendingDrawMinValue: 0,
    pendingWildCardKind: null,
    hasDrawnThisTurn: false,
    lastRouletteReveal: [],
    turnDeadlineAt: firstActorId ? Date.now() + settings.turnTimeoutMs : null,
    winnerId: null,
    loserId: null,
    loserName: null,
    loserCardCount: null,
    resultReason: null,
    moveCount: 0,
  };
}

export function validateUnoAction(
  state: UnoGameState,
  action: UnoAction,
  playerId: string
): ValidationOutcome {
  if (state.status !== "in_progress") {
    return { valid: false, error: "Game is not in progress" };
  }

  const player = state.players.find((p) => p.playerId === playerId);
  if (!player || player.status !== "active") {
    return { valid: false, error: "Player is not active in this match" };
  }

  if (action.type === "CALL_UNO") {
    if (player.hand.length > 2) {
      return { valid: false, error: "Can only call UNO with 2 or fewer cards" };
    }
    return { valid: true };
  }

  if (action.type === "CATCH_UNO") {
    if (action.targetPlayerId === playerId) {
      return { valid: false, error: "Cannot catch yourself" };
    }
    const target = state.players.find((p) => p.playerId === action.targetPlayerId);
    if (!target || target.status !== "active" || !target.vulnerableToUnoCatch) {
      return { valid: false, error: "Target player is not vulnerable to UNO catch" };
    }
    return { valid: true };
  }

  if (state.activeActorId !== playerId) {
    return { valid: false, error: "It is not your turn" };
  }

  switch (state.phase) {
    case "choosing_wild_color": {
      if (action.type !== "CHOOSE_WILD_COLOR") {
        return { valid: false, error: "Must choose a Wild color" };
      }
      return { valid: true };
    }

    case "choosing_swap_target": {
      if (action.type !== "CHOOSE_SWAP_TARGET") {
        return { valid: false, error: "Must choose a swap target" };
      }
      if (action.targetPlayerId === playerId) {
        return { valid: false, error: "Cannot swap hands with yourself" };
      }
      const target = state.players.find((p) => p.playerId === action.targetPlayerId);
      if (!target || target.status !== "active") {
        return { valid: false, error: "Invalid swap target player" };
      }
      return { valid: true };
    }

    case "choosing_roulette_color": {
      if (action.type !== "CHOOSE_ROULETTE_COLOR") {
        return { valid: false, error: "Must choose a Color Roulette color" };
      }
      return { valid: true };
    }

    case "playing": {
      if (action.type === "ACCEPT_DRAW_PENALTY") {
        if (state.pendingDrawCount <= 0) {
          return { valid: false, error: "No pending draw penalty to accept" };
        }
        return { valid: true };
      }

      if (action.type === "DRAW_CARD") {
        if (state.pendingDrawCount > 0) {
          return { valid: false, error: "Must stack a draw card or accept draw penalty" };
        }
        if (state.hasDrawnThisTurn) {
          return { valid: false, error: "Already drew this turn" };
        }
        return { valid: true };
      }

      if (action.type === "PASS_TURN") {
        if (!state.hasDrawnThisTurn || state.pendingDrawCount > 0) {
          return { valid: false, error: "Cannot pass turn without drawing first" };
        }
        return { valid: true };
      }

      if (action.type === "PLAY_CARD") {
        const card = player.hand.find((c) => c.id === action.cardId);
        if (!card) {
          return { valid: false, error: "Card not found in hand" };
        }
        if (!isCardPlayable(card, state)) {
          return { valid: false, error: "Invalid move: card cannot be played on current pile" };
        }
        return { valid: true };
      }

      return { valid: false, error: "Invalid action for current phase" };
    }

    default:
      return { valid: false, error: "Game is not in progress" };
  }
}

function applyWildEffectAndAdvance(
  next: UnoGameState,
  casterId: string,
  kind: "wild_reverse_draw4" | "wild_draw6" | "wild_draw10",
  chosenColor: UnoCardColor
): void {
  next.activeColor = chosenColor;
  next.pendingWildCardKind = null;
  next.phase = "playing";

  const active = getActivePlayers(next.players);

  if (kind === "wild_reverse_draw4") {
    next.pendingDrawCount += 4;
    next.pendingDrawMinValue = Math.max(next.pendingDrawMinValue, 4) as 0 | 2 | 4 | 6 | 10;
    next.direction = next.direction === 1 ? -1 : 1;

    if (active.length === 2) {
      // Dynamic 2-active-player rule: bounces +4 onto the player who played it!
      next.activeActorId = casterId;
    } else {
      next.activeActorId = getNextActivePlayerId(next.players, casterId, next.direction, 1);
    }
  } else if (kind === "wild_draw6") {
    next.pendingDrawCount += 6;
    next.pendingDrawMinValue = Math.max(next.pendingDrawMinValue, 6) as 0 | 2 | 4 | 6 | 10;
    next.activeActorId = getNextActivePlayerId(next.players, casterId, next.direction, 1);
  } else if (kind === "wild_draw10") {
    next.pendingDrawCount += 10;
    next.pendingDrawMinValue = 10;
    next.activeActorId = getNextActivePlayerId(next.players, casterId, next.direction, 1);
  }

  next.hasDrawnThisTurn = false;
  next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
}

export function applyUnoAction(
  state: UnoGameState,
  action: UnoAction,
  playerId: string
): ActionResult<UnoGameState> {
  const next = cloneState(state);
  const events: unknown[] = [];
  const player = next.players.find((p) => p.playerId === playerId)!;

  if (action.type === "CALL_UNO") {
    player.unoCalled = true;
    player.vulnerableToUnoCatch = false;
    events.push({ type: "uno_called", playerId });
    return { nextState: next, events };
  }

  if (action.type === "CATCH_UNO") {
    const target = next.players.find((p) => p.playerId === action.targetPlayerId)!;
    target.vulnerableToUnoCatch = false;
    target.unoCalled = false;

    let drawn = 0;
    for (let i = 0; i < 2; i++) {
      const card = drawOneCard(next);
      if (card) {
        target.hand.push(card);
        drawn++;
      }
    }

    events.push({
      type: "uno_caught",
      catcherId: playerId,
      targetPlayerId: target.playerId,
      cardsDrawn: drawn,
    });

    const eliminated = checkMercyElimination(next, target, events);
    if (eliminated && next.status === "in_progress" && next.activeActorId === target.playerId) {
      next.phase = "playing";
      next.pendingWildCardKind = null;
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, target.playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
    }

    return { nextState: next, events };
  }

  // Any normal turn action clears other players' UNO catch vulnerability
  clearOtherUnoVulnerability(next, playerId);
  next.moveCount += 1;

  if (action.type === "CHOOSE_WILD_COLOR") {
    const kind = next.pendingWildCardKind!;
    applyWildEffectAndAdvance(next, playerId, kind, action.color);
    events.push({ type: "wild_color_chosen", playerId, color: action.color, kind });
    return { nextState: next, events };
  }

  if (action.type === "CHOOSE_SWAP_TARGET") {
    const target = next.players.find((p) => p.playerId === action.targetPlayerId)!;
    const temp = player.hand;
    player.hand = target.hand;
    target.hand = temp;

    player.unoCalled = false;
    player.vulnerableToUnoCatch = false;
    target.unoCalled = false;
    target.vulnerableToUnoCatch = false;

    next.phase = "playing";
    next.hasDrawnThisTurn = false;
    next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
    next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;

    events.push({ type: "hands_swapped", playerId, targetPlayerId: target.playerId });
    return { nextState: next, events };
  }

  if (action.type === "CHOOSE_ROULETTE_COLOR") {
    const revealed: UnoCard[] = [];
    while (player.hand.length < next.settings.mercyLimit) {
      const drawn = drawOneCard(next);
      if (!drawn) {
        break;
      }
      player.hand.push(drawn);
      revealed.push(drawn);
      if (drawn.color === action.color) {
        break;
      }
    }

    next.lastRouletteReveal = revealed;
    next.activeColor = action.color;
    player.unoCalled = false;
    player.vulnerableToUnoCatch = false;

    events.push({
      type: "roulette_resolved",
      playerId,
      chosenColor: action.color,
      drawnCount: revealed.length,
    });

    checkMercyElimination(next, player, events);

    if (next.status === "in_progress") {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
    }

    return { nextState: next, events };
  }

  if (action.type === "ACCEPT_DRAW_PENALTY") {
    const count = next.pendingDrawCount;
    let drawnCount = 0;
    for (let i = 0; i < count; i++) {
      const drawn = drawOneCard(next);
      if (!drawn) break;
      player.hand.push(drawn);
      drawnCount++;
      if (player.hand.length >= next.settings.mercyLimit) {
        break;
      }
    }

    next.pendingDrawCount = 0;
    next.pendingDrawMinValue = 0;
    player.unoCalled = false;
    player.vulnerableToUnoCatch = false;

    events.push({ type: "draw_penalty_accepted", playerId, drawnCount });

    checkMercyElimination(next, player, events);

    if (next.status === "in_progress") {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
    }

    return { nextState: next, events };
  }

  if (action.type === "PASS_TURN") {
    next.hasDrawnThisTurn = false;
    next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
    next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
    events.push({ type: "turn_passed", playerId });
    return { nextState: next, events };
  }

  if (action.type === "DRAW_CARD") {
    player.unoCalled = false;
    player.vulnerableToUnoCatch = false;

    if (next.settings.drawUntilPlayable) {
      let drawnPlayable = false;
      let drawnCount = 0;
      while (player.hand.length < next.settings.mercyLimit) {
        const card = drawOneCard(next);
        if (!card) break;
        player.hand.push(card);
        drawnCount++;
        if (player.hand.length >= next.settings.mercyLimit) {
          break;
        }
        if (isCardPlayable(card, next)) {
          drawnPlayable = true;
          break;
        }
      }

      events.push({ type: "cards_drawn", playerId, count: drawnCount, drawnPlayable });

      const eliminated = checkMercyElimination(next, player, events);
      if (!eliminated && next.status === "in_progress") {
        if (drawnPlayable) {
          next.hasDrawnThisTurn = true;
          next.turnDeadlineAt = Date.now() + next.settings.turnTimeoutMs;
        } else {
          // Deck exhausted without finding a playable card
          next.hasDrawnThisTurn = false;
          next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
          next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
        }
      } else if (eliminated && next.status === "in_progress") {
        next.hasDrawnThisTurn = false;
        next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
        next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      }

      return { nextState: next, events };
    } else {
      const card = drawOneCard(next);
      const drawnCount = card ? 1 : 0;
      const drawnPlayable = card ? isCardPlayable(card, next) : false;
      if (card) {
        player.hand.push(card);
      }

      events.push({ type: "cards_drawn", playerId, count: drawnCount, drawnPlayable });

      const eliminated = checkMercyElimination(next, player, events);
      if (!eliminated && next.status === "in_progress") {
        if (drawnPlayable) {
          next.hasDrawnThisTurn = true;
          next.turnDeadlineAt = Date.now() + next.settings.turnTimeoutMs;
        } else {
          next.hasDrawnThisTurn = false;
          next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
          next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
        }
      } else if (eliminated && next.status === "in_progress") {
        next.hasDrawnThisTurn = false;
        next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
        next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      }

      return { nextState: next, events };
    }
  }

  // PLAY_CARD
  const cardIdx = player.hand.findIndex((c) => c.id === action.cardId);
  const [playedCard] = player.hand.splice(cardIdx, 1);

  if (playedCard.kind === "discard_all") {
    const matchingColorCards = player.hand.filter((c) => c.color === playedCard.color);
    player.hand = player.hand.filter((c) => c.color !== playedCard.color);
    // Matching-color cards placed underneath discard_all so top card remains discard_all
    next.discardPile.push(...matchingColorCards, playedCard);
  } else {
    next.discardPile.push(playedCard);
  }

  events.push({ type: "card_played", playerId, card: playedCard });

  // Update UNO vulnerability state
  if (player.hand.length === 1) {
    if (!player.unoCalled) {
      player.vulnerableToUnoCatch = true;
    }
  } else {
    player.unoCalled = false;
    player.vulnerableToUnoCatch = false;
  }

  // Last-Card Win Priority: 0 cards -> immediate win, skip any sub-phases!
  if (player.hand.length === 0) {
    declareEmptiedHandWin(next, playerId);
    events.push({ type: "game_won", winnerId: playerId, reason: "emptied_hand" });
    return { nextState: next, events };
  }

  // Update activeColor for colored cards
  if (playedCard.color !== "wild") {
    next.activeColor = playedCard.color;
  }

  const active = getActivePlayers(next.players);

  switch (playedCard.kind) {
    case "number": {
      if (playedCard.number === 7) {
        next.phase = "choosing_swap_target";
        next.activeActorId = playerId;
        next.hasDrawnThisTurn = false;
        next.turnDeadlineAt = Date.now() + next.settings.turnTimeoutMs;
      } else if (playedCard.number === 0) {
        // Rotate all active players' hands 1 seat in current direction
        if (active.length >= 2) {
          const hands = active.map((p) => p.hand);
          if (next.direction === 1) {
            for (let i = 0; i < active.length; i++) {
              active[(i + 1) % active.length].hand = hands[i];
            }
          } else {
            for (let i = 0; i < active.length; i++) {
              active[i].hand = hands[(i + 1) % active.length];
            }
          }
          for (const p of active) {
            p.unoCalled = false;
            p.vulnerableToUnoCatch = false;
          }
          events.push({ type: "hands_rotated", direction: next.direction });
        }
        next.phase = "playing";
        next.hasDrawnThisTurn = false;
        next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
        next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      } else {
        next.phase = "playing";
        next.hasDrawnThisTurn = false;
        next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
        next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      }
      break;
    }

    case "discard_all": {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "skip": {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 2);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "skip_everyone": {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = playerId;
      next.turnDeadlineAt = Date.now() + next.settings.turnTimeoutMs;
      break;
    }

    case "reverse": {
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      if (active.length === 2) {
        // Dynamic 2-active-player rule: Reverse acts as Skip
        next.activeActorId = playerId;
      } else {
        next.direction = next.direction === 1 ? -1 : 1;
        next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      }
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "draw2": {
      next.pendingDrawCount += 2;
      next.pendingDrawMinValue = Math.max(next.pendingDrawMinValue, 2) as 0 | 2 | 4 | 6 | 10;
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "draw4": {
      next.pendingDrawCount += 4;
      next.pendingDrawMinValue = Math.max(next.pendingDrawMinValue, 4) as 0 | 2 | 4 | 6 | 10;
      next.phase = "playing";
      next.hasDrawnThisTurn = false;
      next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "wild_color_roulette": {
      const victimId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
      next.phase = "choosing_roulette_color";
      next.hasDrawnThisTurn = false;
      next.activeActorId = victimId;
      next.turnDeadlineAt = victimId ? Date.now() + next.settings.turnTimeoutMs : null;
      break;
    }

    case "wild_reverse_draw4":
    case "wild_draw6":
    case "wild_draw10": {
      if (action.chosenColor) {
        applyWildEffectAndAdvance(next, playerId, playedCard.kind, action.chosenColor);
      } else {
        next.phase = "choosing_wild_color";
        next.pendingWildCardKind = playedCard.kind;
        next.hasDrawnThisTurn = false;
        next.activeActorId = playerId;
        next.turnDeadlineAt = Date.now() + next.settings.turnTimeoutMs;
      }
      break;
    }
  }

  return { nextState: next, events };
}

export function removeUnoPlayer(
  state: UnoGameState,
  playerId: string,
  reason: "disconnected" | "afk_timeout"
): ImmediateRemoveResult<UnoGameState> {
  const next = cloneState(state);
  const events: unknown[] = [];

  const target = next.players.find((p) => p.playerId === playerId);
  if (!target || target.status !== "active") {
    return {
      nextState: next,
      isCompleted: next.status === "won" || next.status === "finished",
      events,
    };
  }

  // Return hand cards to reserve pool
  if (target.hand.length > 0) {
    next.eliminatedReservePile.push(...target.hand);
    target.hand = [];
  }
  target.status = reason === "afk_timeout" ? "kicked_afk" : "disconnected";
  target.unoCalled = false;
  target.vulnerableToUnoCatch = false;

  events.push({
    type: reason === "afk_timeout" ? "player_kicked_afk" : "player_removed",
    reason,
    playerId,
  });

  const active = getActivePlayers(next.players);
  if (active.length <= 1) {
    if (active.length === 1) {
      next.status = "won";
      next.phase = "finished";
      next.winnerId = active[0].playerId;
      next.resultReason = "last_player_standing";
      next.activeActorId = null;
      next.turnDeadlineAt = null;
      next.pendingWildCardKind = null;
    }
    return { nextState: next, isCompleted: true, events };
  }

  // If it was the removed player's turn (including sub-phases), safely reset and advance
  if (next.activeActorId === playerId) {
    next.phase = "playing";
    next.pendingWildCardKind = null;
    next.hasDrawnThisTurn = false;
    next.pendingDrawCount = 0;
    next.pendingDrawMinValue = 0;
    next.activeActorId = getNextActivePlayerId(next.players, playerId, next.direction, 1);
    next.turnDeadlineAt = next.activeActorId ? Date.now() + next.settings.turnTimeoutMs : null;
  }

  return { nextState: next, isCompleted: false, events };
}

export function projectUnoStateForPlayer(
  state: UnoGameState,
  playerId: string
): UnoPublicPlayerView {
  const me = state.players.find((p) => p.playerId === playerId);
  const topDiscard = state.discardPile[state.discardPile.length - 1];
  const isEnded = state.status === "won" || state.status === "finished";

  const finalStandings: UnoFinalStanding[] | undefined = isEnded
    ? [...state.players]
        .sort((a, b) => {
          const aIsLoser = a.playerId === state.loserId ? 1 : 0;
          const bIsLoser = b.playerId === state.loserId ? 1 : 0;
          if (aIsLoser !== bIsLoser) return aIsLoser - bIsLoser;
          const aActive = a.status === "active" ? 0 : 1;
          const bActive = b.status === "active" ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          return a.hand.length - b.hand.length;
        })
        .map((p) => ({
          playerId: p.playerId,
          displayName: p.displayName || `Player ${p.seat + 1}`,
          seat: p.seat,
          status: p.status,
          cardCount: p.hand.length,
          isLoser: p.playerId === state.loserId,
          isWinner: p.playerId === state.winnerId,
        }))
    : undefined;

  return {
    gameId: state.gameId,
    status: state.status,
    phase: state.phase,
    settings: { ...state.settings },
    players: state.players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      seat: p.seat,
      status: p.status,
      cardCount: p.hand.length,
      unoCalled: p.unoCalled,
      vulnerableToUnoCatch: p.vulnerableToUnoCatch,
    })),
    myPlayerId: playerId,
    myHand: me ? [...me.hand] : [],
    activeActorId: state.activeActorId,
    direction: state.direction,
    activeColor: state.activeColor,
    topDiscard,
    discardCount: state.discardPile.length,
    drawPileCount: state.drawPile.length,
    eliminatedReserveCount: state.eliminatedReservePile.length,
    pendingDrawCount: state.pendingDrawCount,
    pendingDrawMinValue: state.pendingDrawMinValue,
    pendingWildCardKind: state.pendingWildCardKind,
    hasDrawnThisTurn: state.hasDrawnThisTurn,
    lastRouletteReveal: [...state.lastRouletteReveal],
    turnDeadlineAt: state.turnDeadlineAt,
    winnerId: state.winnerId,
    loserId: state.loserId,
    loserName: state.loserName,
    loserCardCount: state.loserCardCount,
    resultReason: state.resultReason,
    finalStandings,
    moveCount: state.moveCount,
  };
}
