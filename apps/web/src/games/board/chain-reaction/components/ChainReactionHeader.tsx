import React from "react";
import type { Player } from "../logic/types";

interface ChainReactionHeaderProps {
  currentPlayer: Player;
  counts: Record<Player, number>;
  movesPlayed: number;
  mode: "1v1" | "vs-bot";
  humanPlayer?: Player;
}

export function ChainReactionHeader({
  currentPlayer,
  counts,
  mode,
  humanPlayer = "X",
}: ChainReactionHeaderProps) {
  const isPlayer1Turn = currentPlayer === "X";
  const isPlayer2Turn = currentPlayer === "O";

  return (
    <div className="w-full max-w-[400px] mx-auto mb-2 px-1 flex items-center justify-between gap-3 select-none">
      {/* Player 1 (Orange, X) */}
      <div
        className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
          isPlayer1Turn
            ? "bg-[#fff7ed] border-[#fed7aa] shadow-xs scale-[1.02]"
            : "bg-white border-[#e6e3dc] opacity-75"
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#e0530a] shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold tracking-tight text-[#1c1917] truncate">
            {mode === "vs-bot" && humanPlayer === "X" ? "You (Orange)" : "Orange (P1)"}
          </span>
          <span className="text-[10px] text-[#6b665f] font-mono">
            {counts.X} {counts.X === 1 ? "orb" : "orbs"}
          </span>
        </div>
      </div>

      {/* VS / Turn Indicator */}
      <div className="text-[10px] font-bold tracking-wider text-[#9c978e] uppercase px-1">
        VS
      </div>

      {/* Player 2 (Blue, O) */}
      <div
        className={`flex-1 flex items-center justify-end gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
          isPlayer2Turn
            ? "bg-[#eff6ff] border-[#bfdbfe] shadow-xs scale-[1.02]"
            : "bg-white border-[#e6e3dc] opacity-75"
        }`}
      >
        <div className="flex flex-col min-w-0 text-right">
          <span className="text-[11px] font-semibold tracking-tight text-[#1c1917] truncate">
            {mode === "vs-bot" && humanPlayer === "X" ? "Bot (Blue)" : "Blue (P2)"}
          </span>
          <span className="text-[10px] text-[#6b665f] font-mono">
            {counts.O} {counts.O === 1 ? "orb" : "orbs"}
          </span>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
      </div>
    </div>
  );
}
