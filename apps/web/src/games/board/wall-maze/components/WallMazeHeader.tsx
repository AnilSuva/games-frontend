import React from "react";
import { INITIAL_WALLS } from "../logic/rules";
import type { Player } from "../logic/types";

interface WallMazeHeaderProps {
  currentPlayer: Player;
  wallsLeft: Record<Player, number>;
  mode: "local-2p" | "pvp-bot" | "online-2p";
  localPlayerSeat?: Player;
  isBotThinking?: boolean;
}

function WallPips({ remaining, accent }: { remaining: number; accent: string }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: INITIAL_WALLS }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] h-2.5 rounded-full transition-colors duration-150"
          style={{
            backgroundColor: i < remaining ? accent : "#e6e3dc",
            opacity: i < remaining ? 0.9 : 0.7,
          }}
        />
      ))}
    </div>
  );
}

export function WallMazeHeader({
  currentPlayer,
  wallsLeft,
  mode,
  localPlayerSeat = "X",
  isBotThinking = false,
}: WallMazeHeaderProps) {
  const isP1Turn = currentPlayer === "X";
  const isP2Turn = currentPlayer === "O";

  const p1Label =
    mode === "pvp-bot"
      ? "You (Orange)"
      : mode === "online-2p"
      ? localPlayerSeat === "X"
        ? "You (Orange)"
        : "Opponent (Orange)"
      : "Orange (P1)";

  const p2Label =
    mode === "pvp-bot"
      ? isBotThinking
        ? "Bot..."
        : "Bot (Blue)"
      : mode === "online-2p"
      ? localPlayerSeat === "O"
        ? "You (Blue)"
        : "Opponent (Blue)"
      : "Blue (P2)";

  return (
    <div className="w-full flex items-center justify-between gap-2 select-none">
      {/* Player 1: Orange (Goal: Top) */}
      <div
        className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 ${
          isP1Turn
            ? "bg-[#fff7ed] border-[#fed7aa] shadow-xs"
            : "bg-white border-[#e6e3dc] opacity-80"
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-[#e0530a] border border-white shadow-2xs shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold tracking-tight text-[#1c1917] truncate">
              {p1Label}
            </span>
            <span className="text-[10px] font-bold text-[#c2410c] shrink-0">
              ▲ Top
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-0.5">
            <WallPips remaining={wallsLeft.X} accent="#e0530a" />
            <span className="text-[10px] font-mono font-semibold text-[#6b665f] tabular-nums">
              {wallsLeft.X}w
            </span>
          </div>
        </div>
      </div>

      {/* VS Badge */}
      <div className="text-[10px] font-bold tracking-wider text-[#9c978e] uppercase shrink-0">
        VS
      </div>

      {/* Player 2: Blue (Goal: Bottom) */}
      <div
        className={`flex-1 min-w-0 flex items-center justify-end gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 ${
          isP2Turn
            ? "bg-[#eff6ff] border-[#bfdbfe] shadow-xs"
            : "bg-white border-[#e6e3dc] opacity-80"
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-[#1d4ed8] shrink-0">
              ▼ Bottom
            </span>
            <span className="text-[11px] font-semibold tracking-tight text-[#1c1917] truncate text-right">
              {p2Label}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono font-semibold text-[#6b665f] tabular-nums">
              {wallsLeft.O}w
            </span>
            <WallPips remaining={wallsLeft.O} accent="#2563eb" />
          </div>
        </div>
        <div className="w-3 h-3 rounded-full bg-[#2563eb] border border-white shadow-2xs shrink-0" />
      </div>
    </div>
  );
}
