"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "@/platform/audio";
import type {
  OnlineUnoNoMercyState,
  UnoCard as UnoCardModel,
  UnoCardColor,
  UnoGameEventPayload,
} from "@/platform/multiplayer/types";
import {
  formatUnoEvent,
  getNextActivePlayerId,
  getRelativeTableSeats,
  isCardPlayable,
  sortHand,
} from "../logic/uiHelpers";
import { UnoCard } from "./UnoCard";
import { UnoResultModal } from "./UnoResultModal";
import { UnoTableSeat } from "./UnoTableSeat";
import { UnoTurnTimer } from "./UnoTurnTimer";

interface UnoGameTableProps {
  gameState: OnlineUnoNoMercyState;
  myPlayerId: string;
  events: UnoGameEventPayload[];
  pendingAction: boolean;
  errorMessage: string | null;
  onPlayCard: (cardId: string, chosenColor?: UnoCardColor) => void;
  onDrawCard: () => void;
  onAcceptDrawPenalty: () => void;
  onPassTurn: () => void;
  onChooseWildColor: (color: UnoCardColor) => void;
  onChooseSwapTarget: (targetPlayerId: string) => void;
  onChooseRouletteColor: (color: UnoCardColor) => void;
  onCallUno: () => void;
  onCatchUno: (targetPlayerId: string) => void;
  onLeaveRoom: () => void;
  onOpenHowToPlay: () => void;
}

const COLOR_BADGE: Record<
  UnoCardColor,
  { label: string; bg: string; text: string; ring: string; border: string }
> = {
  red: {
    label: "Red",
    bg: "bg-[#dc2626]",
    text: "text-white",
    ring: "ring-red-300",
    border: "border-red-300/80",
  },
  yellow: {
    label: "Yellow",
    bg: "bg-[#eab308]",
    text: "text-stone-950",
    ring: "ring-yellow-300",
    border: "border-yellow-400/80",
  },
  green: {
    label: "Green",
    bg: "bg-[#16a34a]",
    text: "text-white",
    ring: "ring-emerald-300",
    border: "border-emerald-300/80",
  },
  blue: {
    label: "Blue",
    bg: "bg-[#2563eb]",
    text: "text-white",
    ring: "ring-blue-300",
    border: "border-blue-300/80",
  },
};

const WILD_COLORS: { color: UnoCardColor; label: string; cls: string }[] = [
  { color: "red", label: "Red", cls: "bg-[#dc2626] hover:bg-red-700 text-white" },
  { color: "yellow", label: "Yellow", cls: "bg-[#eab308] hover:bg-yellow-500 text-stone-950" },
  { color: "green", label: "Green", cls: "bg-[#16a34a] hover:bg-green-700 text-white" },
  { color: "blue", label: "Blue", cls: "bg-[#2563eb] hover:bg-blue-700 text-white" },
];

export function UnoGameTable({
  gameState,
  myPlayerId,
  events,
  pendingAction,
  errorMessage,
  onPlayCard,
  onDrawCard,
  onAcceptDrawPenalty,
  onPassTurn,
  onChooseWildColor,
  onChooseSwapTarget,
  onChooseRouletteColor,
  onCallUno,
  onCatchUno,
  onLeaveRoom,
  onOpenHowToPlay,
}: UnoGameTableProps) {
  const [sortEnabled, setSortEnabled] = useState(true);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(true);
  const [showRouletteStrip, setShowRouletteStrip] = useState(false);

  const prevRouletteKeyRef = useRef<string>("");

  const me = useMemo(
    () => gameState.players.find((p) => p.playerId === myPlayerId),
    [gameState.players, myPlayerId]
  );

  const opponents = useMemo(
    () => gameState.players.filter((p) => p.playerId !== myPlayerId),
    [gameState.players, myPlayerId]
  );

  const tableSeats = useMemo(
    () => getRelativeTableSeats(gameState.players, myPlayerId),
    [gameState.players, myPlayerId]
  );

  const nextActivePlayerId = useMemo(
    () =>
      gameState.status === "in_progress"
        ? getNextActivePlayerId(
            gameState.players,
            gameState.activeActorId,
            gameState.direction
          )
        : null,
    [gameState.status, gameState.players, gameState.activeActorId, gameState.direction]
  );

  const seatByPosition = useMemo(() => {
    return {
      top: tableSeats.find((s) => s.position === "top") ?? null,
      topLeft: tableSeats.find((s) => s.position === "top-left") ?? null,
      topRight: tableSeats.find((s) => s.position === "top-right") ?? null,
      left: tableSeats.find((s) => s.position === "left") ?? null,
      right: tableSeats.find((s) => s.position === "right") ?? null,
    };
  }, [tableSeats]);

  const isMyTurn =
    gameState.status === "in_progress" && gameState.activeActorId === myPlayerId;
  const isUpNext =
    gameState.status === "in_progress" &&
    !isMyTurn &&
    nextActivePlayerId === myPlayerId;
  const isEliminated = me?.status === "eliminated_mercy";
  const isMatchEnded =
    gameState.status === "won" || gameState.status === "finished";

  const displayedHand = useMemo(
    () => (sortEnabled ? sortHand(gameState.myHand) : gameState.myHand),
    [gameState.myHand, sortEnabled]
  );

  const hasAnyPlayable = useMemo(
    () =>
      gameState.myHand.some((c) => isCardPlayable(c, gameState, myPlayerId)),
    [gameState, myPlayerId]
  );

  useEffect(() => {
    const key = gameState.lastRouletteReveal.map((c) => c.id).join(",");
    if (key && key !== prevRouletteKeyRef.current) {
      prevRouletteKeyRef.current = key;
      setShowRouletteStrip(true);
      const timer = setTimeout(() => setShowRouletteStrip(false), 2600);
      return () => clearTimeout(timer);
    }
  }, [gameState.lastRouletteReveal]);

  useEffect(() => {
    if (isMatchEnded) {
      setShowResultPopup(true);
    }
  }, [isMatchEnded]);

  const latestToast = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const msg = formatUnoEvent(events[i], gameState.players);
      if (msg) return msg;
    }
    return null;
  }, [events, gameState.players]);

  const handleCardClick = (card: UnoCardModel) => {
    if (pendingAction || !isCardPlayable(card, gameState, myPlayerId)) return;

    const needsColorChoice =
      card.kind === "wild_reverse_draw4" ||
      card.kind === "wild_draw6" ||
      card.kind === "wild_draw10";

    if (needsColorChoice && gameState.myHand.length > 1) {
      soundManager.play("buttonClick");
      setPendingWildCardId(card.id);
      return;
    }

    soundManager.play("checkersSlide");
    onPlayCard(card.id);
  };

  const handleWildColorSelected = (color: UnoCardColor) => {
    soundManager.play("checkersSlide");
    if (gameState.phase === "choosing_wild_color") {
      onChooseWildColor(color);
      setPendingWildCardId(null);
      return;
    }
    if (pendingWildCardId) {
      const cardId = pendingWildCardId;
      setPendingWildCardId(null);
      onPlayCard(cardId, color);
    }
  };

  const activeColorBadge = COLOR_BADGE[gameState.activeColor];
  const mercyDanger =
    gameState.myHand.length >= Math.max(1, gameState.settings.mercyLimit - 5);

  const canCallUno =
    me?.status === "active" &&
    !me.unoCalled &&
    ((isMyTurn && gameState.myHand.length === 2 && hasAnyPlayable) ||
      gameState.myHand.length === 1);

  const showWildPicker =
    !pendingAction &&
    ((isMyTurn && gameState.phase === "choosing_wild_color") ||
      pendingWildCardId !== null);

  const showSwapPicker =
    !pendingAction && isMyTurn && gameState.phase === "choosing_swap_target";

  const showRoulettePicker =
    !pendingAction && isMyTurn && gameState.phase === "choosing_roulette_color";

  const swapCandidates = useMemo(
    () =>
      opponents
        .filter((p) => p.status === "active")
        .sort((a, b) => a.cardCount - b.cardCount),
    [opponents]
  );

  const renderSeat = (seat: (typeof tableSeats)[number] | null) => {
    if (!seat) return null;
    return (
      <UnoTableSeat
        key={seat.player.playerId}
        player={seat.player}
        position={seat.position}
        activeColor={gameState.activeColor}
        isTurn={
          gameState.status === "in_progress" &&
          gameState.activeActorId === seat.player.playerId
        }
        isNext={
          gameState.status === "in_progress" &&
          nextActivePlayerId === seat.player.playerId
        }
        direction={gameState.direction}
        mercyLimit={gameState.settings.mercyLimit}
        turnDeadlineAt={gameState.turnDeadlineAt}
        totalTimeoutMs={gameState.settings.turnTimeoutMs}
        pendingAction={pendingAction}
        canCatch={!isEliminated && !isMatchEnded}
        onCatchUno={onCatchUno}
      />
    );
  };

  const hasTopRow =
    Boolean(seatByPosition.topLeft) ||
    Boolean(seatByPosition.top) ||
    Boolean(seatByPosition.topRight);
  const hasSideRow =
    Boolean(seatByPosition.left) || Boolean(seatByPosition.right);

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden touch-none select-none bg-[#f7f6f2] px-2 sm:px-4 py-1.5 sm:py-2">
      {/* 1. Compact Header Bar: Mode Badge, Live Toast & Utility Controls */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-2 shrink-0 min-h-[32px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {gameState.settings.endOnFirstMercyLoss && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold whitespace-nowrap">
              One Loser · {gameState.settings.mercyLimit} Max
            </span>
          )}
          {latestToast && (
            <div className="px-2.5 py-0.5 rounded-full bg-white border border-[#e6e3dc] shadow-2xs text-[11px] font-semibold text-[#1c1917] truncate">
              {latestToast}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onOpenHowToPlay();
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-[#eeece6] border border-[#e6e3dc] text-xs font-bold text-[#1c1917] cursor-pointer"
            title="How to Play"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onLeaveRoom();
            }}
            className="px-2.5 h-7 sm:h-8 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-700 border border-[#e6e3dc] text-xs font-semibold text-[#6b665f] cursor-pointer"
          >
            Leave
          </button>
        </div>
      </div>

      {/* 2. Visual Seated Card Table Arena */}
      <div className="relative flex-1 min-h-0 w-full max-w-4xl mx-auto my-1 flex flex-col justify-between rounded-[32px] sm:rounded-[52px] bg-[#efede6] border-2 border-[#dfd9cd] shadow-inner px-1.5 sm:px-4 py-2.5 sm:py-3">
        <div
          className="pointer-events-none absolute inset-3 sm:inset-4 rounded-[26px] sm:rounded-[42px] border border-[#e2ddd1]"
          aria-hidden="true"
        />

        {/* Top Perimeter Seats */}
        {hasTopRow && (
          <div className="relative z-10 w-full flex items-start justify-center gap-2 sm:gap-8 shrink-0 pt-1">
            {seatByPosition.topLeft && renderSeat(seatByPosition.topLeft)}
            {seatByPosition.top && renderSeat(seatByPosition.top)}
            {seatByPosition.topRight && renderSeat(seatByPosition.topRight)}
          </div>
        )}

        {/* Middle Row: Left Seat + Center Draw/Discard + Right Seat */}
        <div className="relative z-10 flex-1 min-h-0 flex items-center justify-between gap-1 sm:gap-4 my-1">
          {hasSideRow && (
            <div className="shrink-0 flex items-center justify-start">
              {renderSeat(seatByPosition.left)}
            </div>
          )}

          {/* Center Piles + Direction Track */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5">
            {gameState.pendingDrawCount > 0 && (
              <div className="px-2.5 sm:px-3.5 py-1 rounded-xl bg-rose-600 text-white shadow-md flex items-center gap-2 animate-pulse max-w-full">
                <span className="text-[11px] sm:text-xs font-black tracking-tight truncate">
                  STACK +{gameState.pendingDrawCount} (+{gameState.pendingDrawMinValue}+)
                </span>
                {isMyTurn && gameState.phase === "playing" && (
                  <button
                    type="button"
                    disabled={pendingAction}
                    onClick={() => {
                      soundManager.play("dropBall");
                      onAcceptDrawPenalty();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white text-rose-700 text-[10px] sm:text-[11px] font-black hover:bg-rose-50 cursor-pointer shrink-0"
                  >
                    Take +{gameState.pendingDrawCount}
                  </button>
                )}
              </div>
            )}

            <div
              className={`relative flex items-center justify-center gap-3 sm:gap-7 px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-3xl bg-white/85 border-2 shadow-xs ${activeColorBadge.border}`}
            >
              {/* Direction Track Pill */}
              <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap bg-white ${activeColorBadge.border} text-[#1c1917]`}
              >
                <span
                  className={
                    gameState.direction === 1 ? "text-emerald-700" : "text-amber-700"
                  }
                >
                  {gameState.direction === 1
                    ? "↻ Clockwise"
                    : "↺ Counter-Clockwise"}
                </span>
              </div>

              {/* Draw Pile */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={
                    pendingAction ||
                    !isMyTurn ||
                    gameState.phase !== "playing" ||
                    gameState.pendingDrawCount > 0 ||
                    gameState.hasDrawnThisTurn
                  }
                  onClick={() => {
                    soundManager.play("dropBall");
                    onDrawCard();
                  }}
                  className={`relative rounded-xl transition-transform ${
                    isMyTurn &&
                    gameState.phase === "playing" &&
                    gameState.pendingDrawCount === 0 &&
                    !gameState.hasDrawnThisTurn
                      ? `cursor-pointer sm:hover:scale-105 active:scale-95 ${
                          !hasAnyPlayable ? "ring-3 ring-amber-400 animate-pulse" : ""
                        }`
                      : "opacity-85 cursor-default"
                  }`}
                  aria-label="Draw Card"
                >
                  <UnoCard faceDown size="md" />
                  <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#1c1917] text-white font-mono text-[9px] sm:text-[10px] font-bold border border-white shadow">
                    {gameState.drawPileCount}
                  </span>
                </button>
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#6b665f]">
                  Draw
                </span>
              </div>

              {/* Discard Pile */}
              <div className="flex flex-col items-center gap-1">
                <UnoCard card={gameState.topDiscard} size="md" />
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ring-2 ${activeColorBadge.bg} ${activeColorBadge.text} ${activeColorBadge.ring}`}
                >
                  {activeColorBadge.label}
                </span>
              </div>
            </div>

            {showRouletteStrip && gameState.lastRouletteReveal.length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-[#e6e3dc] shadow-md max-w-full overflow-x-auto">
                <span className="text-[9px] font-bold uppercase text-[#6b665f] mr-0.5 shrink-0">
                  Roulette:
                </span>
                {gameState.lastRouletteReveal.slice(-5).map((c) => (
                  <UnoCard key={c.id} card={c} size="xs" />
                ))}
              </div>
            )}

            {errorMessage && (
              <div className="px-2.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-semibold text-rose-700 max-w-full truncate">
                {errorMessage}
              </div>
            )}
          </div>

          {hasSideRow && (
            <div className="shrink-0 flex items-center justify-end">
              {renderSeat(seatByPosition.right)}
            </div>
          )}
        </div>

        {/* Bottom Rim Indicator: YOUR TURN or YOU'RE UP NEXT */}
        <div className="relative z-10 flex items-center justify-center min-h-[20px] shrink-0">
          {isMyTurn ? (
            <span className="px-3 py-0.5 rounded-full bg-[#1c1917] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
              YOUR TURN
            </span>
          ) : isUpNext ? (
            <span className="px-3 py-0.5 rounded-full bg-amber-300 border border-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
              YOU&apos;RE UP NEXT {gameState.direction === 1 ? "↻" : "↺"}
            </span>
          ) : null}
        </div>
      </div>

      {/* 3. Bottom Player Hand Tray & Controls */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-1 shrink-0">
        {isMyTurn && (
          <div className="px-1">
            <UnoTurnTimer
              turnDeadlineAt={gameState.turnDeadlineAt}
              totalTimeoutMs={gameState.settings.turnTimeoutMs}
              isMyTurn={isMyTurn}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
                mercyDanger
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-white text-[#1c1917] border-[#e6e3dc]"
              }`}
            >
              {gameState.myHand.length} / {gameState.settings.mercyLimit} Cards
            </span>

            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                setSortEnabled((s) => !s);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                sortEnabled
                  ? "bg-[#1c1917] text-white border-[#1c1917]"
                  : "bg-white text-[#6b665f] border-[#e6e3dc]"
              }`}
            >
              Sort
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {canCallUno && (
              <button
                type="button"
                disabled={pendingAction}
                onClick={() => {
                  soundManager.play("victory");
                  onCallUno();
                }}
                className="px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black tracking-wide shadow-sm animate-bounce cursor-pointer"
              >
                UNO!
              </button>
            )}

            {isMyTurn && gameState.phase === "playing" && (
              <>
                {gameState.pendingDrawCount > 0 ? (
                  <button
                    type="button"
                    disabled={pendingAction}
                    onClick={() => {
                      soundManager.play("dropBall");
                      onAcceptDrawPenalty();
                    }}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Take +{gameState.pendingDrawCount}
                  </button>
                ) : gameState.hasDrawnThisTurn ? (
                  <button
                    type="button"
                    disabled={pendingAction}
                    onClick={() => {
                      soundManager.play("buttonClick");
                      onPassTurn();
                    }}
                    className="px-3 py-1 rounded-lg bg-[#1c1917] hover:bg-[#322f2c] text-white text-xs font-bold cursor-pointer"
                  >
                    Pass Turn
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pendingAction}
                    onClick={() => {
                      soundManager.play("dropBall");
                      onDrawCard();
                    }}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-[#eeece6] border border-[#e6e3dc] text-[#1c1917] text-xs font-bold cursor-pointer"
                  >
                    Draw
                  </button>
                )}
              </>
            )}

            {!isMyTurn && gameState.status === "in_progress" && !isEliminated && (
              <span className="px-2.5 py-1 rounded-lg bg-white border border-[#e6e3dc] text-[11px] font-semibold text-[#6b665f]">
                {isUpNext ? "Get Ready" : "Waiting..."}
              </span>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto touch-pan-x pt-3 pb-1 px-2">
          <div className="flex items-end justify-start sm:justify-center min-w-max mx-auto">
            {displayedHand.map((card, idx) => {
              const playable =
                !pendingAction && isCardPlayable(card, gameState, myPlayerId);
              return (
                <div
                  key={card.id}
                  style={{ marginLeft: idx === 0 ? 0 : "-14px" }}
                  className="transition-all hover:z-20"
                >
                  <UnoCard
                    card={card}
                    size="md"
                    playable={playable}
                    disabled={!playable}
                    onClick={() => handleCardClick(card)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-Phase Modal 1: Wild Color Picker */}
      {showWildPicker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white border border-[#e6e3dc] shadow-xl p-5 flex flex-col gap-3 text-center">
            <h3 className="text-base font-bold text-[#1c1917]">
              Choose Active Color
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {WILD_COLORS.map((opt) => (
                <button
                  key={opt.color}
                  type="button"
                  onClick={() => handleWildColorSelected(opt.color)}
                  className={`py-3 rounded-xl font-bold text-sm shadow-xs cursor-pointer transition-transform active:scale-95 ${opt.cls}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pendingWildCardId && gameState.phase === "playing" && (
              <button
                type="button"
                onClick={() => setPendingWildCardId(null)}
                className="text-xs font-semibold text-[#6b665f] hover:text-[#1c1917] pt-1 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-Phase Modal 2: 7-Swap Target Picker */}
      {showSwapPicker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white border border-[#e6e3dc] shadow-xl p-5 flex flex-col gap-3">
            <div className="text-center">
              <h3 className="text-base font-bold text-[#1c1917]">
                7 Played — Swap Hands!
              </h3>
              <p className="text-xs text-[#6b665f]">
                Pick a player to trade your entire hand with:
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {swapCandidates.map((cand) => (
                <button
                  key={cand.playerId}
                  type="button"
                  onClick={() => {
                    soundManager.play("checkersSlide");
                    onChooseSwapTarget(cand.playerId);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#f7f6f2] hover:bg-[#eeece6] border border-[#e6e3dc] text-sm font-semibold text-[#1c1917] cursor-pointer"
                >
                  <span>{cand.displayName || `Seat ${cand.seat + 1}`}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-[#e6e3dc] font-mono text-xs font-bold">
                    {cand.cardCount} cards
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Phase Modal 3: Wild Color Roulette Picker */}
      {showRoulettePicker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white border border-[#e6e3dc] shadow-xl p-5 flex flex-col gap-3 text-center">
            <h3 className="text-base font-bold text-[#1c1917]">
              Wild Color Roulette!
            </h3>
            <p className="text-xs text-[#6b665f]">
              Pick a color — you&apos;ll draw cards until you hit a non-Wild card of
              that color!
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {WILD_COLORS.map((opt) => (
                <button
                  key={opt.color}
                  type="button"
                  onClick={() => {
                    soundManager.play("dropBall");
                    onChooseRouletteColor(opt.color);
                  }}
                  className={`py-3 rounded-xl font-bold text-sm shadow-xs cursor-pointer transition-transform active:scale-95 ${opt.cls}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mercy-Eliminated Spectator Banner */}
      {isEliminated && gameState.status === "in_progress" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-[#1c1917] text-white shadow-lg flex items-center gap-3">
          <span className="text-xs font-bold">
            Mercy Rule! You were eliminated ({gameState.settings.mercyLimit}+ cards).
            Spectating...
          </span>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-[11px] font-bold cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      )}

      {/* Match Over / One Loser Result Modal */}
      {isMatchEnded && showResultPopup && (
        <UnoResultModal
          gameState={gameState}
          myPlayerId={myPlayerId}
          onLeaveRoom={onLeaveRoom}
          onClose={() => setShowResultPopup(false)}
        />
      )}
    </div>
  );
}
