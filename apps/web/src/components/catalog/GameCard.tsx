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
    case "ping-pong":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center p-2">
          <svg className="w-auto h-20 max-w-full" viewBox="0 0 96 72" fill="none">
            {/* Table Surface Base */}
            <rect x="14" y="58" width="68" height="6" rx="3" fill="#7ac84c" stroke="#1c1917" strokeWidth="2.2" />
            <line x1="48" y1="58" x2="48" y2="64" stroke="#ffffff" strokeWidth="1.75" />

            {/* Net */}
            <rect x="44" y="47" width="8" height="12" rx="1.5" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="48" y1="47" x2="48" y2="59" stroke="#1c1917" strokeWidth="1" strokeOpacity="0.35" />
            <line x1="44" y1="53" x2="52" y2="53" stroke="#1c1917" strokeWidth="1" strokeOpacity="0.35" />

            {/* Blue Paddle (Left) */}
            <g transform="translate(29, 34) rotate(-18)">
              <rect x="-3" y="10" width="6" height="15" rx="2" fill="#1f2937" stroke="#1c1917" strokeWidth="2.2" />
              <circle cx="0" cy="0" r="14" fill="#2563eb" stroke="#1c1917" strokeWidth="2.5" />
              <circle cx="-4" cy="-4" r="5" fill="#ffffff" fillOpacity="0.28" />
            </g>

            {/* Orange Paddle (Right) */}
            <g transform="translate(67, 34) rotate(18)">
              <rect x="-3" y="10" width="6" height="15" rx="2" fill="#1f2937" stroke="#1c1917" strokeWidth="2.2" />
              <circle cx="0" cy="0" r="14" fill="#e0530a" stroke="#1c1917" strokeWidth="2.5" />
              <circle cx="-4" cy="-4" r="5" fill="#ffffff" fillOpacity="0.28" />
            </g>

            {/* Ball & Rally Arc */}
            <path d="M 29 22 Q 48 4 67 22" fill="none" stroke="#1c1917" strokeWidth="1.75" strokeDasharray="3 2.5" strokeOpacity="0.35" />
            <line x1="41" y1="8" x2="38" y2="6" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.35" />
            <line x1="55" y1="8" x2="58" y2="6" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.35" />
            <circle cx="48" cy="16" r="5.5" fill="#ffffff" stroke="#1c1917" strokeWidth="2.2" />
            <circle cx="46.5" cy="14.5" r="1.5" fill="#ffffff" />
          </svg>
        </div>
      );
    case "knife-thrower":
      return (
        <div className="w-full h-24 rounded-lg bg-[#faf9f6] border border-[#eeece6] flex items-center justify-center p-2">
          <svg className="w-auto h-20 max-w-full" viewBox="0 0 96 72" fill="none">
            {/* Embedded Knife Left (Orange) */}
            <g transform="translate(35, 17) rotate(-45)">
              <polygon points="-2.5,-3 2.5,-3 0,6" fill="#e2e8f0" stroke="#1c1917" strokeWidth="1.8" />
              <rect x="-4.5" y="-5" width="9" height="2" rx="0.5" fill="#1c1917" />
              <rect x="-2.2" y="-14" width="4.4" height="9" rx="1" fill="#e0530a" stroke="#1c1917" strokeWidth="1.8" />
              <line x1="-2" y1="-10" x2="2" y2="-10" stroke="#1c1917" strokeWidth="1" />
              <circle cx="0" cy="-15" r="1.6" fill="#94a3b8" stroke="#1c1917" strokeWidth="1.5" />
            </g>

            {/* Embedded Knife Right (Blue) */}
            <g transform="translate(61, 17) rotate(45)">
              <polygon points="-2.5,-3 2.5,-3 0,6" fill="#e2e8f0" stroke="#1c1917" strokeWidth="1.8" />
              <rect x="-4.5" y="-5" width="9" height="2" rx="0.5" fill="#1c1917" />
              <rect x="-2.2" y="-14" width="4.4" height="9" rx="1" fill="#2563eb" stroke="#1c1917" strokeWidth="1.8" />
              <line x1="-2" y1="-10" x2="2" y2="-10" stroke="#1c1917" strokeWidth="1" />
              <circle cx="0" cy="-15" r="1.6" fill="#94a3b8" stroke="#1c1917" strokeWidth="1.5" />
            </g>

            {/* Wood Target Disk */}
            <circle cx="48" cy="29" r="18" fill="#78350f" stroke="#1c1917" strokeWidth="2.4" />
            <circle cx="48" cy="29" r="15" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
            <circle cx="48" cy="29" r="11" fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="6 2 9 2" />
            <circle cx="48" cy="29" r="6.5" fill="none" stroke="#b45309" strokeWidth="1.2" />
            <circle cx="48" cy="29" r="3.2" fill="#ef4444" stroke="#1c1917" strokeWidth="1.5" />
            <circle cx="47" cy="28" r="0.8" fill="#ffffff" />

            {/* Flying Knife from Bottom */}
            <line x1="42" y1="53" x2="42" y2="65" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3" strokeDasharray="3 2" />
            <line x1="54" y1="53" x2="54" y2="65" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3" strokeDasharray="3 2" />
            <polygon points="48,43 51,53 45,53" fill="#f8fafc" stroke="#1c1917" strokeWidth="2" strokeLinejoin="round" />
            <line x1="48" y1="44" x2="48" y2="53" stroke="#cbd5e1" strokeWidth="1.2" />
            <rect x="43.5" y="53" width="9" height="2" rx="0.5" fill="#1c1917" />
            <rect x="45.8" y="55" width="4.4" height="10" rx="1" fill="#e0530a" stroke="#1c1917" strokeWidth="2" />
            <line x1="46" y1="59" x2="50" y2="59" stroke="#1c1917" strokeWidth="1" />
            <line x1="46" y1="62" x2="50" y2="62" stroke="#1c1917" strokeWidth="1" />
            <circle cx="48" cy="66.5" r="1.8" fill="#94a3b8" stroke="#1c1917" strokeWidth="1.6" />
          </svg>
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
