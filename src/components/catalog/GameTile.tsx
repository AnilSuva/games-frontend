"use client";

import Link from "next/link";
import type { GameMetadata } from "@/platform/registry/types";
import { soundManager } from "@/platform/audio";

interface GameTileProps {
  game: GameMetadata;
}

/**
 * Compact game tile for mobile/tablet discovery.
 * Shows only logo and game name.
 */
export function GameTile({ game }: GameTileProps) {
  const isAvailable = game.status === "available";
  const href = `/games/${game.id}`;

  const TileWrapper = isAvailable ? Link : "div";
  const wrapperProps = isAvailable
    ? {
        href,
        onClick: () => soundManager.play("buttonClick"),
        className:
          "group flex flex-col items-center p-3 rounded-2xl bg-white border border-[#e6e3dc] hover:border-[#1c1917] hover:shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]",
      }
    : {
        className:
          "flex flex-col items-center p-3 rounded-2xl bg-[#faf9f6] border border-[#eeece6] opacity-65 cursor-not-allowed select-none",
      };

  return (
    // @ts-expect-error dynamic polymorphic link or div
    <TileWrapper {...wrapperProps} aria-label={`${game.title} - ${isAvailable ? "Play" : "Coming Soon"}`}>
      <div className="w-full aspect-[5/4] flex items-center justify-center mb-1.5">
        <GameTileIllustration id={game.id} />
      </div>
      <h3 className="text-sm font-semibold text-[#1c1917] tracking-tight text-center leading-snug group-hover:underline">
        {game.title}
      </h3>
    </TileWrapper>
  );
}

/**
 * Clean, tactile geometric illustrations for each game tile.
 * Logos maximize available space while preserving aspect ratios.
 */
function GameTileIllustration({ id }: { id: string }) {
  switch (id) {
    case "tic-tac-toe":
      return (
        <div className="w-full h-full max-w-[112px] max-h-[112px] flex items-center justify-center">
          <div className="w-full h-full aspect-square grid grid-cols-3 gap-1.5">
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-lg font-bold text-[#e0530a] min-w-0">X</div>
            <div className="rounded bg-[#eeece6] min-w-0" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-lg font-bold text-[#2563eb] min-w-0">O</div>
            <div className="rounded bg-[#eeece6] min-w-0" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-lg font-bold text-[#e0530a] min-w-0">X</div>
            <div className="rounded bg-[#eeece6] min-w-0" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-lg font-bold text-[#2563eb] min-w-0">O</div>
            <div className="rounded bg-[#eeece6] min-w-0" />
            <div className="rounded bg-[#eeece6] min-w-0" />
          </div>
        </div>
      );
    case "brick-blast":
      return (
        <div className="w-full h-full max-w-[112px] max-h-[84px] flex items-center justify-center">
          <div className="w-full h-full flex flex-col items-center justify-between gap-2">
            <div className="w-full grid grid-cols-4 gap-1.5">
              <div className="h-3 rounded-sm bg-[#e0530a]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#e0530a]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#e0530a]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#e0530a]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#2563eb]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#2563eb]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#2563eb]/80 min-w-0" />
              <div className="h-3 rounded-sm bg-[#2563eb]/80 min-w-0" />
            </div>
            <div className="w-3 h-3 rounded-full bg-[#1c1917] shrink-0" />
            <div className="w-16 h-2.5 rounded-full bg-[#1c1917] shrink-0" />
          </div>
        </div>
      );
    case "connect-four":
      return (
        <div className="w-full h-full max-w-[112px] max-h-[112px] flex items-center justify-center">
          <div className="w-full h-full aspect-square grid grid-cols-4 gap-1.5">
            <div className="aspect-square rounded-full bg-[#eeece6] min-w-0" />
            <div className="aspect-square rounded-full bg-[#eeece6] min-w-0" />
            <div className="aspect-square rounded-full bg-[#e0530a] min-w-0" />
            <div className="aspect-square rounded-full bg-[#eeece6] min-w-0" />
            <div className="aspect-square rounded-full bg-[#eeece6] min-w-0" />
            <div className="aspect-square rounded-full bg-[#2563eb] min-w-0" />
            <div className="aspect-square rounded-full bg-[#e0530a] min-w-0" />
            <div className="aspect-square rounded-full bg-[#eeece6] min-w-0" />
          </div>
        </div>
      );
    case "spin-wheel":
      return (
        <div className="w-full h-full max-w-[96px] max-h-[96px] flex items-center justify-center">
          <div className="relative w-full h-full aspect-square max-w-full max-h-full rounded-full border-[3px] border-white shadow-sm" style={{ background: "conic-gradient(#F3B768 0deg 45deg,#99C7C4 45deg 90deg,#E78C72 90deg 135deg,#A8B7D8 135deg 180deg,#E6C777 180deg 225deg,#9CBF91 225deg 270deg,#D7A3B6 270deg 315deg,#B5A7D5 315deg)" }}>
            <span className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[13px] border-x-transparent border-t-[#1c1917]" />
            <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1c1917]" />
          </div>
        </div>
      );
    case "chess":
      return (
        <div className="w-full h-full max-w-[80px] max-h-[80px] flex items-center justify-center">
          <svg className="w-full h-full text-[#1c1917]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v3m-3-1.5h6M9 9h6l1 4H8l1-4zm-1 4v5h8v-5m-10 5h12v2H6v-2z" />
          </svg>
        </div>
      );
    case "checkers":
      return (
        <div className="w-full h-full max-w-[120px] max-h-[72px] flex items-center justify-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#e0530a] bg-[#fff7ed] flex items-center justify-center text-lg font-bold text-[#e0530a] shrink-0">●</div>
          <div className="w-10 h-10 rounded-full border-2 border-[#2563eb] bg-[#eff6ff] flex items-center justify-center text-lg font-bold text-[#2563eb] shrink-0">●</div>
        </div>
      );
    default:
      return (
        <div className="w-full h-full max-w-[80px] max-h-[80px] flex items-center justify-center text-[#9c978e]">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="4" y="6" width="16" height="12" rx="3" />
            <line x1="8" y1="12" x2="11" y2="12" />
            <line x1="9.5" y1="10.5" x2="9.5" y2="13.5" />
            <circle cx="15.5" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
      );
  }
}