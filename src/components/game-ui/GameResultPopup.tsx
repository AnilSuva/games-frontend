"use client";

import Link from "next/link";

interface GameResultPopupProps {
  /** Result label (e.g. "Orange won", "Blue won", "Draw") */
  resultText: string;
  /** Accent color hex for the result indicator dot (null for draws) */
  accentColor?: string | null;
  /** Called when user wants to play again */
  onPlayAgain: () => void;
  /** Called when user dismisses the popup to inspect the board */
  onClose: () => void;
  /** Home route (defaults to "/") */
  homeHref?: string;
}

/**
 * Compact floating result card shown after a game ends.
 * Reusable across any game that needs a win/draw/loss popup.
 */
export function GameResultPopup({
  resultText,
  accentColor,
  onPlayAgain,
  onClose,
  homeHref = "/",
}: GameResultPopupProps) {
  return (
    <div
      role="dialog"
      aria-label="Game Result"
      className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:top-3 sm:right-3 sm:left-auto sm:translate-x-0 sm:translate-y-0 w-[88%] max-w-[260px]"
    >
      <div className="w-full p-4 bg-white rounded-2xl border border-[#e6e3dc] shadow-lg flex flex-col gap-3 result-popup-card">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {accentColor && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
            )}
            <span className="text-sm font-semibold text-[#1c1917] tracking-tight">
              {resultText}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 -mr-1.5 -mt-1.5 flex items-center justify-center rounded-lg text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:bg-[#f0eee9] active:bg-[#e7e4dc] transition-colors cursor-pointer"
            aria-label="Close result"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-0.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#1c1917] sm:hover:bg-[#322f2c] active:bg-black transition-colors shadow-xs cursor-pointer flex items-center justify-center"
          >
            Play Again
          </button>

          <Link
            href={homeHref}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] text-center transition-colors shadow-2xs block"
          >
            Home
          </Link>
        </div>
      </div>

      <style jsx>{`
        .result-popup-card {
          animation: popupCardIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes popupCardIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .result-popup-card {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
