"use client";

import { soundManager } from "@/platform/audio";
import type {
  UnoCardColor,
  UnoPublicPlayerInfo,
} from "@/platform/multiplayer/types";
import type { TableSeatPosition } from "../logic/uiHelpers";
import { UnoTurnTimer } from "./UnoTurnTimer";

interface UnoTableSeatProps {
  player: UnoPublicPlayerInfo;
  position: TableSeatPosition;
  activeColor: UnoCardColor;
  isTurn: boolean;
  isNext: boolean;
  direction: 1 | -1;
  mercyLimit: number;
  turnDeadlineAt: number | null;
  totalTimeoutMs: number;
  pendingAction: boolean;
  canCatch: boolean;
  onCatchUno: (targetPlayerId: string) => void;
}

const ACTIVE_TURN_RING: Record<UnoCardColor, string> = {
  red: "border-[#dc2626] ring-3 ring-[#dc2626]/30",
  yellow: "border-[#eab308] ring-3 ring-[#eab308]/40",
  green: "border-[#16a34a] ring-3 ring-[#16a34a]/30",
  blue: "border-[#2563eb] ring-3 ring-[#2563eb]/30",
};

const AVATAR_TINTS = [
  "bg-rose-600 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-500 text-stone-950",
  "bg-purple-600 text-white",
  "bg-cyan-600 text-white",
];

export function UnoTableSeat({
  player,
  position,
  activeColor,
  isTurn,
  isNext,
  direction,
  mercyLimit,
  turnDeadlineAt,
  totalTimeoutMs,
  pendingAction,
  canCatch,
  onCatchUno,
}: UnoTableSeatProps) {
  const isSide = position === "left" || position === "right";
  const isMuted = player.status !== "active";
  const isDanger =
    player.status === "active" &&
    player.cardCount >= Math.max(1, mercyLimit - 5);

  const name = player.displayName || `Seat ${player.seat + 1}`;
  const initial = name.charAt(0).toUpperCase();
  const avatarTone = AVATAR_TINTS[player.seat % AVATAR_TINTS.length];

  return (
    <div
      className={`relative rounded-2xl border bg-white/95 transition-all flex flex-col gap-1 shadow-xs ${
        isSide
          ? "w-[76px] sm:w-[132px] p-1.5 sm:p-2"
          : "w-[96px] sm:w-[136px] p-1.5 sm:p-2"
      } ${
        isMuted
          ? "bg-stone-200/80 border-stone-300 opacity-60"
          : isTurn
          ? `${ACTIVE_TURN_RING[activeColor]} shadow-md scale-[1.03]`
          : isDanger
          ? "border-rose-400 bg-rose-50/90 animate-pulse"
          : "border-[#dfd9cd]"
      }`}
    >
      {/* Top Role Badge (TURN / NEXT) */}
      {isTurn && !isMuted && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-[#1c1917] text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow whitespace-nowrap">
          PLAYING
        </span>
      )}
      {!isTurn && isNext && !isMuted && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-amber-300 border border-amber-400 text-stone-950 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow whitespace-nowrap">
          {direction === 1 ? "NEXT ↻" : "NEXT ↺"}
        </span>
      )}

      {/* Avatar + Name + Card Count */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 ${
              isMuted ? "bg-stone-400 text-white" : avatarTone
            }`}
          >
            {initial}
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-[#1c1917] truncate">
            {name}
          </span>
        </div>

        {player.status === "active" ? (
          <span
            className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] sm:text-xs font-black shrink-0 flex items-center gap-0.5 ${
              isDanger
                ? "bg-rose-600 text-white"
                : "bg-[#f7f6f2] text-[#1c1917] border border-[#e6e3dc]"
            }`}
            title={`${player.cardCount} cards`}
          >
            <span className="hidden sm:inline text-[9px] opacity-70">🃏</span>
            {player.cardCount}
          </span>
        ) : (
          <span className="px-1 py-0.5 rounded bg-stone-300 text-stone-800 text-[8px] font-extrabold uppercase shrink-0">
            {player.status === "eliminated_mercy"
              ? "MERCY"
              : player.status === "kicked_afk"
              ? "AFK"
              : "LEFT"}
          </span>
        )}
      </div>

      {/* Bottom Meta Row: Timer / UNO! / CATCH! */}
      <div className="flex items-center justify-between gap-1 min-h-[16px]">
        {isTurn && !isMuted && (
          <UnoTurnTimer
            turnDeadlineAt={turnDeadlineAt}
            totalTimeoutMs={totalTimeoutMs}
            isMyTurn={false}
            compact
          />
        )}
        {player.unoCalled && player.status === "active" && (
          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-stone-950 text-[8px] sm:text-[9px] font-black">
            UNO!
          </span>
        )}
        {canCatch && player.vulnerableToUnoCatch && (
          <button
            type="button"
            disabled={pendingAction}
            onClick={() => {
              soundManager.play("tileBreak");
              onCatchUno(player.playerId);
            }}
            className="ml-auto px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider cursor-pointer animate-bounce"
          >
            CATCH!
          </button>
        )}
      </div>
    </div>
  );
}
