export type UnoCardColor = "red" | "yellow" | "green" | "blue";
export type UnoColor = UnoCardColor | "wild";

export type UnoCardKind =
  | "number"
  | "draw2"
  | "draw4"
  | "skip"
  | "skip_everyone"
  | "reverse"
  | "discard_all"
  | "wild_reverse_draw4"
  | "wild_color_roulette"
  | "wild_draw6"
  | "wild_draw10";

export interface UnoCard {
  id: string;
  color: UnoColor;
  kind: UnoCardKind;
  number?: number; // 0..9 when kind === "number"
}

export interface UnoSettings {
  startingHandSize: number; // default 7, range 4..15
  mercyLimit: number; // default 25, range 15..50, >= startingHandSize + 3
  maxPlayers: number; // default 6, range 2..6
  turnTimeoutMs: number; // default 120000
  drawUntilPlayable: boolean; // default true
  endOnFirstMercyLoss: boolean; // default false
}

export type UnoPlayerStatus =
  | "active"
  | "eliminated_mercy"
  | "disconnected"
  | "kicked_afk";

export interface UnoPlayerState {
  playerId: string;
  displayName?: string;
  seat: number;
  status: UnoPlayerStatus;
  hand: UnoCard[];
  unoCalled: boolean;
  vulnerableToUnoCatch: boolean;
}

export type UnoPhase =
  | "playing"
  | "choosing_wild_color"
  | "choosing_swap_target"
  | "choosing_roulette_color"
  | "finished";

export type UnoResultReason =
  | "emptied_hand"
  | "mercy_elimination"
  | "single_loser_mercy"
  | "last_player_standing";

export interface UnoFinalStanding {
  playerId: string;
  displayName: string;
  seat: number;
  status: UnoPlayerStatus;
  cardCount: number;
  isLoser: boolean;
  isWinner: boolean;
}

export interface UnoGameState {
  gameId: "uno-no-mercy";
  status: "in_progress" | "won" | "finished";
  phase: UnoPhase;
  settings: UnoSettings;
  players: UnoPlayerState[];
  activeActorId: string | null;
  direction: 1 | -1;
  activeColor: UnoCardColor;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  eliminatedReservePile: UnoCard[];
  pendingDrawCount: number;
  pendingDrawMinValue: 0 | 2 | 4 | 6 | 10;
  pendingWildCardKind: "wild_reverse_draw4" | "wild_draw6" | "wild_draw10" | null;
  hasDrawnThisTurn: boolean;
  lastRouletteReveal: UnoCard[];
  turnDeadlineAt: number | null;
  winnerId: string | null;
  loserId: string | null;
  loserName: string | null;
  loserCardCount: number | null;
  resultReason: UnoResultReason | null;
  moveCount: number;
}

export type UnoAction =
  | { type: "PLAY_CARD"; cardId: string; chosenColor?: UnoCardColor }
  | { type: "DRAW_CARD" }
  | { type: "PASS_TURN" }
  | { type: "ACCEPT_DRAW_PENALTY" }
  | { type: "CHOOSE_WILD_COLOR"; color: UnoCardColor }
  | { type: "CHOOSE_SWAP_TARGET"; targetPlayerId: string }
  | { type: "CHOOSE_ROULETTE_COLOR"; color: UnoCardColor }
  | { type: "CALL_UNO" }
  | { type: "CATCH_UNO"; targetPlayerId: string };

export interface UnoPublicPlayerInfo {
  playerId: string;
  displayName?: string;
  seat: number;
  status: UnoPlayerStatus;
  cardCount: number;
  unoCalled: boolean;
  vulnerableToUnoCatch: boolean;
}

export interface UnoPublicPlayerView {
  gameId: "uno-no-mercy";
  status: "in_progress" | "won" | "finished";
  phase: UnoPhase;
  settings: UnoSettings;
  players: UnoPublicPlayerInfo[];
  myPlayerId: string;
  myHand: UnoCard[];
  activeActorId: string | null;
  direction: 1 | -1;
  activeColor: UnoCardColor;
  topDiscard: UnoCard;
  discardCount: number;
  drawPileCount: number;
  eliminatedReserveCount: number;
  pendingDrawCount: number;
  pendingDrawMinValue: 0 | 2 | 4 | 6 | 10;
  pendingWildCardKind: "wild_reverse_draw4" | "wild_draw6" | "wild_draw10" | null;
  hasDrawnThisTurn: boolean;
  lastRouletteReveal: UnoCard[];
  turnDeadlineAt: number | null;
  winnerId: string | null;
  loserId: string | null;
  loserName: string | null;
  loserCardCount: number | null;
  resultReason: UnoResultReason | null;
  finalStandings?: UnoFinalStanding[];
  moveCount: number;
}
