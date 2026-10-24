"use client";

import type { DotsBoxesState, PlatformPlayer } from "../logic/types";

interface ScoreHeaderProps {
  state: DotsBoxesState;
  mode: "1v1" | "vs-bot" | "online";
  botDifficulty?: string;
  myOnlinePlayer?: PlatformPlayer | null;
}

export function ScoreHeader({
  state,
  mode,
  botDifficulty = "medium",
  myOnlinePlayer,
}: ScoreHeaderProps) {
  const { scores, currentPlayer, config, consecutiveBoxesThisTurn } = state;
  const totalBoxes = config.rows * config.cols;
  const totalCompleted = scores.orange + scores.blue;

  const orangeName =
    mode === "online"
      ? myOnlinePlayer === "orange"
        ? "You (Orange)"
        : "Opponent (Orange)"
      : "Player 1 (Orange)";

  const blueName =
    mode === "vs-bot"
      ? `Bot (${botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1)})`
      : mode === "online"
      ? myOnlinePlayer === "blue"
        ? "You (Blue)"
        : "Opponent (Blue)"
      : "Player 2 (Blue)";

  const isOrangeTurn = currentPlayer === "orange";
  const isBlueTurn = currentPlayer === "blue";

  return (
    <div className="w-full max-w-[460px] mx-auto mb-3 flex flex-col gap-2">
      {/* Player Score Badges */}
      <div className="grid grid-cols-2 gap-3">
        {/* Orange Player */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
            isOrangeTurn
              ? "bg-[#e0530a]/15 border-[#e0530a] shadow-[0_0_15px_rgba(224,83,10,0.3)]"
              : "bg-[#18181b]/80 border-white/5 opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#e0530a] animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-white/90 truncate max-w-[110px]">
                {orangeName}
              </span>
              {isOrangeTurn && (
                <span className="text-[10px] text-[#fb923c] font-medium">
                  {consecutiveBoxesThisTurn > 0 ? "Extra Turn! 🎯" : "Active Turn"}
                </span>
              )}
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-[#fb923c]">
            {scores.orange}
          </span>
        </div>

        {/* Blue Player */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
            isBlueTurn
              ? "bg-[#2563eb]/15 border-[#2563eb] shadow-[0_0_15px_rgba(37,99,235,0.3)]"
              : "bg-[#18181b]/80 border-white/5 opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#2563eb] animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-white/90 truncate max-w-[110px]">
                {blueName}
              </span>
              {isBlueTurn && (
                <span className="text-[10px] text-[#60a5fa] font-medium">
                  {consecutiveBoxesThisTurn > 0 ? "Extra Turn! 🎯" : "Active Turn"}
                </span>
              )}
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-[#60a5fa]">
            {scores.blue}
          </span>
        </div>
      </div>

      {/* Match progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden flex">
        <div
          className="bg-[#e0530a] transition-all duration-300"
          style={{ width: `${(scores.orange / totalBoxes) * 100}%` }}
        />
        <div
          className="bg-white/10 flex-1"
        />
        <div
          className="bg-[#2563eb] transition-all duration-300"
          style={{ width: `${(scores.blue / totalBoxes) * 100}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-[11px] text-white/40 px-1">
        <span>Boxes Claimed: {totalCompleted} / {totalBoxes}</span>
        <span>
          {totalBoxes - totalCompleted === 1
            ? "1 box remaining"
            : `${totalBoxes - totalCompleted} boxes remaining`}
        </span>
      </div>
    </div>
  );
}
