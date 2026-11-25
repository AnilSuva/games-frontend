"use client";

import type { UnoCard as UnoCardModel, UnoColor } from "@/platform/multiplayer/types";

export type UnoCardSize = "xs" | "sm" | "md" | "lg";

interface UnoCardProps {
  card?: UnoCardModel;
  faceDown?: boolean;
  size?: UnoCardSize;
  playable?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASSES: Record<UnoCardSize, string> = {
  xs: "w-11 h-16 rounded-lg text-[10px]",
  sm: "w-14 h-20 rounded-xl text-xs",
  md: "w-[70px] h-[102px] sm:w-[78px] sm:h-[114px] rounded-xl text-sm",
  lg: "w-[86px] h-[126px] sm:w-[96px] sm:h-[140px] rounded-2xl text-base",
};

const COLOR_STYLES: Record<
  UnoColor,
  { bg: string; text: string; cornerText: string; ring: string }
> = {
  red: {
    bg: "bg-[#dc2626]",
    text: "text-[#dc2626]",
    cornerText: "text-white",
    ring: "ring-red-400/70",
  },
  yellow: {
    bg: "bg-[#eab308]",
    text: "text-[#a16207]",
    cornerText: "text-stone-950",
    ring: "ring-yellow-300/80",
  },
  green: {
    bg: "bg-[#16a34a]",
    text: "text-[#15803d]",
    cornerText: "text-white",
    ring: "ring-emerald-400/70",
  },
  blue: {
    bg: "bg-[#2563eb]",
    text: "text-[#1d4ed8]",
    cornerText: "text-white",
    ring: "ring-blue-400/70",
  },
  wild: {
    bg: "bg-[#18181b]",
    text: "text-white",
    cornerText: "text-white",
    ring: "ring-amber-400/70",
  },
};

function getCornerBadge(card: UnoCardModel): string {
  switch (card.kind) {
    case "number":
      return String(card.number ?? 0);
    case "draw2":
      return "+2";
    case "draw4":
      return "+4";
    case "skip":
      return "⊘";
    case "skip_everyone":
      return "⊘⊘";
    case "reverse":
      return "⇄";
    case "discard_all":
      return "ALL";
    case "wild_reverse_draw4":
      return "⇄+4";
    case "wild_color_roulette":
      return "◎";
    case "wild_draw6":
      return "+6";
    case "wild_draw10":
      return "+10";
  }
}

function CardCenterGraphic({
  card,
  size,
}: {
  card: UnoCardModel;
  size: UnoCardSize;
}) {
  const palette = COLOR_STYLES[card.color];
  const isSmall = size === "xs" || size === "sm";
  const iconDim = isSmall ? "w-5 h-5" : "w-8 h-8";

  if (card.kind === "number") {
    return (
      <div className="flex flex-col items-center justify-center leading-none">
        <span
          className={`font-black tracking-tighter ${palette.text} ${
            size === "xs"
              ? "text-lg"
              : size === "sm"
              ? "text-2xl"
              : size === "md"
              ? "text-3xl"
              : "text-4xl"
          }`}
        >
          {card.number ?? 0}
        </span>
        {card.number === 7 && (
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-stone-500">
            ⇄ SWAP
          </span>
        )}
        {card.number === 0 && (
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-stone-500">
            ↻ PASS
          </span>
        )}
      </div>
    );
  }

  if (card.kind === "draw2" || card.kind === "draw4") {
    const label = card.kind === "draw2" ? "+2" : "+4";
    return (
      <div className={`flex flex-col items-center justify-center ${palette.text}`}>
        <svg className={iconDim} viewBox="0 0 28 28" fill="none">
          <rect
            x="4"
            y="6"
            width="11"
            height="15"
            rx="2"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="12"
            y="4"
            width="11"
            height="15"
            rx="2"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>
        <span className="font-black text-xs sm:text-sm leading-none mt-0.5">
          {label}
        </span>
      </div>
    );
  }

  if (card.kind === "skip") {
    return (
      <svg className={`${iconDim} ${palette.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
        <circle cx="12" cy="12" r="8" />
        <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
      </svg>
    );
  }

  if (card.kind === "skip_everyone") {
    return (
      <div className={`flex flex-col items-center justify-center ${palette.text}`}>
        <svg className={iconDim} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="11" cy="13" r="6.5" />
          <line x1="6.5" y1="8.5" x2="15.5" y2="17.5" />
          <circle cx="17" cy="15" r="6.5" fill="white" fillOpacity="0.85" />
          <circle cx="17" cy="15" r="6.5" />
          <line x1="12.5" y1="10.5" x2="21.5" y2="19.5" />
        </svg>
        {!isSmall && (
          <span className="text-[7px] font-extrabold uppercase tracking-wider leading-none mt-0.5">
            SKIP ALL
          </span>
        )}
      </div>
    );
  }

  if (card.kind === "reverse") {
    return (
      <svg className={`${iconDim} ${palette.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3l4 4-4 4" />
        <path d="M3 7h18" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M21 17H3" />
      </svg>
    );
  }

  if (card.kind === "discard_all") {
    return (
      <div className={`flex flex-col items-center justify-center ${palette.text}`}>
        <svg className={iconDim} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="9" height="12" rx="1.5" fill="currentColor" fillOpacity="0.18" />
          <rect x="9" y="7" width="9" height="12" rx="1.5" fill="currentColor" fillOpacity="0.3" />
          <path d="M19 11v11m0 0l-3.5-3.5M19 22l3.5-3.5" />
        </svg>
        {!isSmall && (
          <span className="text-[7px] font-extrabold uppercase tracking-wider leading-none mt-0.5">
            DROP ALL
          </span>
        )}
      </div>
    );
  }

  // Wild cards
  if (card.kind === "wild_color_roulette") {
    return (
      <div className="flex flex-col items-center justify-center">
        <svg className={iconDim} viewBox="0 0 24 24">
          <path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" fill="#dc2626" />
          <path d="M22 12 A10 10 0 0 1 12 22 L12 12 Z" fill="#2563eb" />
          <path d="M12 22 A10 10 0 0 1 2 12 L12 12 Z" fill="#16a34a" />
          <path d="M2 12 A10 10 0 0 1 12 2 L12 12 Z" fill="#eab308" />
          <circle cx="12" cy="12" r="3.2" fill="#18181b" stroke="white" strokeWidth="1.2" />
        </svg>
        {!isSmall && (
          <span className="text-[7px] font-extrabold uppercase tracking-wider text-stone-900 leading-none mt-0.5">
            ROULETTE
          </span>
        )}
      </div>
    );
  }

  if (card.kind === "wild_reverse_draw4") {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="grid grid-cols-2 w-6 h-6 rounded-full overflow-hidden border border-stone-900/20">
          <div className="bg-[#dc2626]" />
          <div className="bg-[#2563eb]" />
          <div className="bg-[#eab308]" />
          <div className="bg-[#16a34a]" />
        </div>
        <span className="font-black text-xs text-stone-900 leading-none mt-0.5">
          ⇄+4
        </span>
      </div>
    );
  }

  // wild_draw6 or wild_draw10
  const label = card.kind === "wild_draw6" ? "+6" : "+10";
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-0.5">
        <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
        <span className="w-2 h-2 rounded-full bg-[#eab308]" />
        <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
        <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      </div>
      <span
        className={`font-black tracking-tighter text-stone-950 leading-none mt-0.5 ${
          isSmall ? "text-sm" : "text-xl sm:text-2xl"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function UnoCard({
  card,
  faceDown = false,
  size = "md",
  playable = false,
  disabled = false,
  selected = false,
  onClick,
  className = "",
}: UnoCardProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${sizeClass} relative select-none bg-[#18181b] border-2 border-white/90 shadow-md flex items-center justify-center overflow-hidden ${className}`}
      >
        <div className="w-[82%] h-[68%] rounded-full bg-[#dc2626] -rotate-18 flex items-center justify-center border border-amber-300/70 shadow-inner">
          <span className="font-black italic tracking-tight text-amber-300 text-[9px] sm:text-xs drop-shadow">
            NO MERCY
          </span>
        </div>
      </div>
    );
  }

  const palette = COLOR_STYLES[card.color];
  const corner = getCornerBadge(card);
  const isWild = card.color === "wild";
  const interactive = Boolean(onClick) && !disabled;

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className={`${sizeClass} ${palette.bg} relative select-none border-2 border-white shadow-md flex items-center justify-center overflow-hidden transition-all duration-150 ${
        playable
          ? `cursor-pointer -translate-y-2 ring-2 ${palette.ring} shadow-lg sm:hover:-translate-y-3 active:scale-95`
          : disabled
          ? "opacity-55 cursor-not-allowed"
          : onClick
          ? "cursor-pointer sm:hover:-translate-y-1"
          : "cursor-default"
      } ${selected ? "ring-3 ring-stone-900 -translate-y-3" : ""} ${className}`}
    >
      {/* Wild 4-color subtle border glow */}
      {isWild && (
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background:
              "conic-gradient(from 45deg, #dc2626, #eab308, #16a34a, #2563eb, #dc2626)",
          }}
        />
      )}

      {/* Top-left corner index */}
      <span
        className={`absolute top-1 left-1.5 font-black leading-none tracking-tight ${palette.cornerText} ${
          size === "xs" ? "text-[9px]" : "text-[11px] sm:text-xs"
        }`}
      >
        {corner}
      </span>

      {/* Diagonal white inner oval */}
      <div className="w-[78%] h-[68%] rounded-[50%] bg-white/95 -rotate-12 flex items-center justify-center shadow-inner">
        <div className="rotate-12 flex items-center justify-center">
          <CardCenterGraphic card={card} size={size} />
        </div>
      </div>

      {/* Bottom-right corner index */}
      <span
        className={`absolute bottom-1 right-1.5 font-black leading-none tracking-tight rotate-180 ${palette.cornerText} ${
          size === "xs" ? "text-[9px]" : "text-[11px] sm:text-xs"
        }`}
      >
        {corner}
      </span>
    </button>
  );
}
