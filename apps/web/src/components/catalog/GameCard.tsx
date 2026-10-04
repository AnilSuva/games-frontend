import Link from "next/link";
import type { GameMetadata } from "@/platform/registry/types";
import { soundManager } from "@/platform/audio";

interface GameCardProps {
  game: GameMetadata;
  className?: string;
}

/**
 * Clean, tactile geometric miniature illustrations for each game.
 * Simple, elegant, vector-based, no glowing gradients.
 */
function GameIllustration({ id }: { id: string }) {
  switch (id) {
    case "tic-tac-toe":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center p-3">
          <div className="grid grid-cols-3 gap-1.5 w-16 h-16">
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-[10px] font-bold text-[#e0530a]">X</div>
            <div className="rounded bg-[#eeece6]" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-[10px] font-bold text-[#2563eb]">O</div>
            <div className="rounded bg-[#eeece6]" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-[10px] font-bold text-[#e0530a]">X</div>
            <div className="rounded bg-[#eeece6]" />
            <div className="rounded bg-[#eeece6] flex items-center justify-center text-[10px] font-bold text-[#2563eb]">O</div>
            <div className="rounded bg-[#eeece6]" />
            <div className="rounded bg-[#eeece6]" />
          </div>
        </div>
      );
    case "brick-blast":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex flex-col items-center justify-between p-3.5">
          <div className="grid grid-cols-4 gap-1.5 w-24">
            <div className="h-2 rounded-sm bg-[#e0530a]/80" />
            <div className="h-2 rounded-sm bg-[#e0530a]/80" />
            <div className="h-2 rounded-sm bg-[#e0530a]/80" />
            <div className="h-2 rounded-sm bg-[#e0530a]/80" />
            <div className="h-2 rounded-sm bg-[#2563eb]/80" />
            <div className="h-2 rounded-sm bg-[#2563eb]/80" />
            <div className="h-2 rounded-sm bg-[#2563eb]/80" />
            <div className="h-2 rounded-sm bg-[#2563eb]/80" />
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#1c1917]" />
          <div className="w-12 h-1.5 rounded-full bg-[#1c1917]" />
        </div>
      );
    case "connect-four":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center p-3">
          <div className="grid grid-cols-4 gap-1.5 w-20">
            <div className="w-3.5 h-3.5 rounded-full bg-[#eeece6]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#eeece6]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#e0530a]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#eeece6]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#eeece6]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#2563eb]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#e0530a]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#eeece6]" />
          </div>
        </div>
      );
    case "spin-wheel":
      return (
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-[#eeece6] bg-[#faf9f6]">
          <div className="relative h-16 w-16 rounded-full border-[3px] border-white shadow-sm" style={{ background: "conic-gradient(#F3B768 0deg 45deg,#99C7C4 45deg 90deg,#E78C72 90deg 135deg,#A8B7D8 135deg 180deg,#E6C777 180deg 225deg,#9CBF91 225deg 270deg,#D7A3B6 270deg 315deg,#B5A7D5 315deg)" }}>
            <span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[9px] border-x-transparent border-t-[#1c1917]" />
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1c1917]" />
          </div>
        </div>
      );
    case "chess":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1c1917]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v3m-3-1.5h6M9 9h6l1 4H8l1-4zm-1 4v5h8v-5m-10 5h12v2H6v-2z" />
          </svg>
        </div>
      );
    case "checkers":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-[#e0530a] bg-[#fff7ed] flex items-center justify-center text-[10px] font-bold text-[#e0530a]">●</div>
          <div className="w-6 h-6 rounded-full border-2 border-[#2563eb] bg-[#eff6ff] flex items-center justify-center text-[10px] font-bold text-[#2563eb]">●</div>
        </div>
      );
    default:
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center text-[#9c978e]">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="4" y="6" width="16" height="12" rx="3" />
            <line x1="8" y1="12" x2="11" y2="12" />
            <line x1="9.5" y1="10.5" x2="9.5" y2="13.5" />
            <circle cx="15.5" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
      );
  }
}

export function GameCard({ game, className = "" }: GameCardProps) {
  const isAvailable = game.status === "available";
  const href = `/games/${game.id}`;

  const CardWrapper = isAvailable ? Link : "div";
  const wrapperProps = isAvailable
    ? {
        href,
        onClick: () => soundManager.play("buttonClick"),
        className:
          `group flex flex-col justify-between p-4 sm:p-5 rounded-xl bg-white border border-[#e6e3dc] hover:border-[#1c1917] hover:shadow-sm transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] ${className}`.trim(),
      }
    : {
        className:
          `flex flex-col justify-between p-4 sm:p-5 rounded-xl bg-[#faf9f6] border border-[#eeece6] opacity-65 cursor-not-allowed select-none ${className}`.trim(),
      };

  return (
    // @ts-expect-error dynamic polymorphic link or div
    <CardWrapper {...wrapperProps} aria-label={`${game.title} - ${isAvailable ? "Play" : "Coming Soon"}`}>
      <div>
        {/* Simple tactile illustration */}
        <GameIllustration id={game.id} />

        {/* Metadata & Title */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#6b665f] tracking-wide">
            {game.category === "board" ? "Board Game" : game.category === "arcade" ? "Arcade" : "Random Royale"}
          </span>

          {!isAvailable ? (
            <span className="text-[11px] font-normal text-[#9c978e]">
              Coming soon
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#1c1917] group-hover:underline">
              Play →
            </span>
          )}
        </div>

        <h3 className="mt-1 text-base font-semibold text-[#1c1917] tracking-tight">
          {game.title}
        </h3>

        <p className="mt-1 text-xs text-[#6b665f] line-clamp-2 leading-relaxed font-normal">
          {game.shortDescription}
        </p>
      </div>

      {/* Subtle footer */}
      <div className="mt-4 pt-3 border-t border-[#f0eee9] flex items-center justify-between text-[11px] text-[#9c978e]">
        <span>{game.id === "spin-wheel" ? "Random selection" : game.engine === "react-dom" ? "Turn-based" : "2D Physics"}</span>
        <span className="flex items-center gap-1">
          {game.supportedModes.includes("pvp-bot") && <span>• Solo Bot</span>}
          {game.supportedModes.includes("local-2p") && <span>• 2-Player</span>}
        </span>
      </div>
    </CardWrapper>
  );
}
