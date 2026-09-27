"use client";

import Link from "next/link";
import type { GameMetadata } from "@/platform/registry/types";
import type { GameLifecycle } from "@/games/common/types";

interface GameHUDProps {
  game: GameMetadata;
  score: number;
  lifecycle?: GameLifecycle;
  onPause: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export function GameHUD({
  game,
  score,
  lifecycle = "pre-game",
  onPause,
  onToggleFullscreen,
  isFullscreen,
}: GameHUDProps) {
  return (
    <div className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white border-b border-[#e6e3dc] select-none">
      {/* Back and Title */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="p-1 rounded-md text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:bg-[#f4f2eb] active:bg-[#f4f2eb] transition cursor-pointer"
          aria-label="Back to Games"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[#1c1917]">{game.title}</h1>
          <span className="text-[11px] font-normal text-[#9c978e] hidden xs:inline">
            • {game.category === "board" ? "Board" : "Arcade"}
          </span>
        </div>
      </div>

      {/* Center: Score indicator if game tracks points */}
      {score > 0 && (
        <div className="px-2.5 py-0.5 rounded-full bg-[#f4f2eb] border border-[#e6e3dc] text-xs font-mono text-[#1c1917]">
          Score: <strong>{score}</strong>
        </div>
      )}

      {/* Actions: Pause & Fullscreen */}
      <div className="flex items-center gap-1.5">
        {/* Pause control is ONLY available when an active match is playing */}
        {lifecycle === "playing" && (
          <button
            type="button"
            onClick={onPause}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-[#1c1917] bg-[#faf9f6] sm:hover:bg-[#eeece6] active:bg-[#eeece6] border border-[#e6e3dc] transition flex items-center gap-1.5 cursor-pointer"
            aria-label="Pause game"
          >
            <svg className="w-3.5 h-3.5 text-[#6b665f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
            <span>Pause</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-md text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:bg-[#f4f2eb] active:bg-[#f4f2eb] transition cursor-pointer"
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0m-5 0l0 5m11 0l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5m11 0l5 5m0 0l-5 0m5 0l0-5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
