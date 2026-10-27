"use client";

import type { PlayerRaceStats, TypingRaceOnlinePlayer } from "@/platform/multiplayer/types";

export interface RaceStatsProps {
  myStats: PlayerRaceStats;
  opponentStats: PlayerRaceStats;
  myRole: TypingRaceOnlinePlayer | null;
  totalWords: number;
}

export function RaceStats({
  myStats,
  opponentStats,
  myRole,
  totalWords,
}: RaceStatsProps) {
  const isOrange = myRole === "orange";
  const myAccentColor = isOrange ? "text-orange-400" : "text-blue-400";
  const myBgBadge = isOrange
    ? "bg-orange-500/15 border-orange-500/40"
    : "bg-blue-500/15 border-blue-500/40";

  // Calculate current completed words approximately based on progress
  const completedWords = Math.min(
    totalWords,
    Math.round(myStats.progress * totalWords)
  );

  return (
    <div className="w-full flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md backdrop-blur-md select-none font-mono">
      {/* 1. Live Speed (WPM) Meter */}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 sm:p-2 rounded-lg border ${myBgBadge}`}>
          <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 ${myAccentColor}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 14 4-4" />
            <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Speed
          </span>
          <span className="text-sm sm:text-base font-black text-white leading-none">
            {myStats.wpm}{" "}
            <span className="text-[10px] font-normal text-slate-400">WPM</span>
          </span>
        </div>
      </div>

      {/* 2. Accuracy Meter */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 sm:p-2 rounded-lg border bg-emerald-500/15 border-emerald-500/40">
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Accuracy
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-400 leading-none">
            {myStats.accuracy}
            <span className="text-[10px] font-normal text-slate-400">%</span>
          </span>
        </div>
      </div>

      {/* 3. Word Progress & Lap Count */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 sm:p-2 rounded-lg border bg-amber-500/15 border-amber-500/40">
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Words
          </span>
          <span className="text-sm sm:text-base font-black text-white leading-none">
            {completedWords}
            <span className="text-[10px] font-normal text-slate-400">
              /{totalWords}
            </span>
          </span>
        </div>
      </div>

      {/* 4. Opponent Progress Pill */}
      <div className="hidden xs:flex flex-col items-end text-right">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
          Rival Speed
        </span>
        <span className="text-xs sm:text-sm font-bold text-slate-300 leading-none">
          {opponentStats.wpm} WPM • {Math.round(opponentStats.progress * 100)}%
        </span>
      </div>
    </div>
  );
}
