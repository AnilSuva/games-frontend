"use client";

import type { Participant } from "../types";

interface WinnerDisplayProps {
  winner: Participant | null;
  isSpinning: boolean;
}

export function WinnerDisplay({ winner, isSpinning }: WinnerDisplayProps) {
  return (
    <div className="mt-1 min-h-8 shrink-0 text-center lg:mt-4 lg:min-h-16" aria-live="polite" role="status">
      {winner && (
        <div className="animate-in fade-in duration-300">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b35d35] lg:text-[11px]">
            Winner
          </p>
          <p className="max-w-[80vw] truncate text-sm font-semibold tracking-tight text-[#1c1917] sm:text-base lg:mt-0.5 lg:text-3xl">
            {winner.name}
          </p>
        </div>
      )}
      {isSpinning && (
        <p className="text-[11px] font-medium text-[#6b665f] lg:pt-4 lg:text-sm">
          The wheel is spinning…
        </p>
      )}
    </div>
  );
}
