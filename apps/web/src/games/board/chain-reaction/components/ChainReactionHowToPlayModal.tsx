"use client";

import { useEffect } from "react";
import { soundManager } from "@/platform/audio";

interface ChainReactionHowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChainReactionHowToPlayModal({
  isOpen,
  onClose,
}: ChainReactionHowToPlayModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        soundManager.play("buttonClick");
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    soundManager.play("buttonClick");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1c1917]/40 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chain-reaction-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-sm sm:max-w-md max-h-[85dvh] bg-white rounded-2xl sm:rounded-3xl border border-[#e6e3dc] shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-[#eeece6] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2
              id="chain-reaction-guide-title"
              className="text-lg sm:text-xl font-bold text-[#1c1917] tracking-tight"
            >
              How to Play
            </h2>
            <p className="text-xs text-[#6b665f] font-medium">
              Chain Reaction Rules & Strategy
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b665f] hover:text-[#1c1917] hover:bg-[#f0eee9] active:bg-[#e7e4dc] transition-colors cursor-pointer"
            aria-label="Close guide"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
          {/* Step 1: Place Your Orbs */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Place Your Orbs
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              Tap any <strong className="text-[#1c1917]">empty cell</strong> or a cell with{" "}
              <strong className="text-[#1c1917]">your own color</strong> to add +1 orb. You cannot place on your opponent&apos;s cells.
            </p>

            {/* SVG Diagram 1 */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 74"
                className="w-full max-w-[290px] h-auto"
                aria-label="Valid and invalid orb placements"
              >
                {/* Empty Cell: Legal */}
                <g transform="translate(10, 5)">
                  <rect
                    width="80"
                    height="50"
                    rx="8"
                    fill="#ffffff"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  <circle cx="40" cy="25" r="7" fill="none" stroke="#10b981" strokeWidth="1.5" />
                  <path d="M40 21v8M36 25h8" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                  <text
                    x="40"
                    y="63"
                    textAnchor="middle"
                    fill="#059669"
                    fontSize="9"
                    fontWeight="700"
                  >
                    EMPTY (OK)
                  </text>
                </g>

                {/* Own Cell: Legal */}
                <g transform="translate(110, 5)">
                  <rect
                    width="80"
                    height="50"
                    rx="8"
                    fill="#fff7ed"
                    stroke="#e0530a"
                    strokeWidth="1.5"
                  />
                  <circle cx="34" cy="25" r="8" fill="#e0530a" />
                  <circle cx="34" cy="22" r="2.5" fill="#ffffff" opacity="0.6" />
                  <circle cx="48" cy="25" r="6" fill="#e0530a" opacity="0.5" stroke="#e0530a" />
                  <path d="M48 22v6M45 25h6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <text
                    x="40"
                    y="63"
                    textAnchor="middle"
                    fill="#c2410c"
                    fontSize="9"
                    fontWeight="700"
                  >
                    OWN COLOR (+1)
                  </text>
                </g>

                {/* Opponent Cell: Illegal */}
                <g transform="translate(210, 5)">
                  <rect
                    width="80"
                    height="50"
                    rx="8"
                    fill="#eff6ff"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                  />
                  <circle cx="40" cy="25" r="8" fill="#2563eb" />
                  <circle cx="40" cy="22" r="2.5" fill="#ffffff" opacity="0.6" />
                  {/* Forbidden sign */}
                  <circle cx="40" cy="25" r="14" fill="none" stroke="#ef4444" strokeWidth="2" />
                  <line x1="30" y1="15" x2="50" y2="35" stroke="#ef4444" strokeWidth="2" />
                  <text
                    x="40"
                    y="63"
                    textAnchor="middle"
                    fill="#dc2626"
                    fontSize="9"
                    fontWeight="700"
                  >
                    ENEMY (BLOCKED)
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Step 2: Hit Critical Mass (2 · 3 · 4) */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Hit Critical Mass (2 · 3 · 4)
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              A cell explodes when its orbs equal its orthogonal neighbor count:
            </p>

            {/* SVG Diagram 2 */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 80"
                className="w-full max-w-[290px] h-auto"
                aria-label="Critical mass thresholds for corners, edges, and center cells"
              >
                {/* Corner: 2 */}
                <g transform="translate(10, 4)">
                  <rect width="80" height="52" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.5" />
                  <circle cx="34" cy="22" r="6" fill="#e0530a" />
                  <circle cx="46" cy="22" r="6" fill="#e0530a" />
                  <rect x="18" y="36" width="44" height="12" rx="4" fill="#eeece6" />
                  <text x="40" y="45" textAnchor="middle" fill="#1c1917" fontSize="8" fontWeight="800">
                    BURSTS AT 2
                  </text>
                  <text x="40" y="68" textAnchor="middle" fill="#6b665f" fontSize="9" fontWeight="700">
                    Corners (2)
                  </text>
                </g>

                {/* Edge: 3 */}
                <g transform="translate(110, 4)">
                  <rect width="80" height="52" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.5" />
                  <circle cx="30" cy="22" r="5.5" fill="#e0530a" />
                  <circle cx="40" cy="18" r="5.5" fill="#e0530a" />
                  <circle cx="50" cy="22" r="5.5" fill="#e0530a" />
                  <rect x="18" y="36" width="44" height="12" rx="4" fill="#eeece6" />
                  <text x="40" y="45" textAnchor="middle" fill="#1c1917" fontSize="8" fontWeight="800">
                    BURSTS AT 3
                  </text>
                  <text x="40" y="68" textAnchor="middle" fill="#6b665f" fontSize="9" fontWeight="700">
                    Edges (3)
                  </text>
                </g>

                {/* Center: 4 */}
                <g transform="translate(210, 4)">
                  <rect width="80" height="52" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.5" />
                  <circle cx="34" cy="17" r="5" fill="#e0530a" />
                  <circle cx="46" cy="17" r="5" fill="#e0530a" />
                  <circle cx="34" cy="27" r="5" fill="#e0530a" />
                  <circle cx="46" cy="27" r="5" fill="#e0530a" />
                  <rect x="18" y="36" width="44" height="12" rx="4" fill="#eeece6" />
                  <text x="40" y="45" textAnchor="middle" fill="#1c1917" fontSize="8" fontWeight="800">
                    BURSTS AT 4
                  </text>
                  <text x="40" y="68" textAnchor="middle" fill="#6b665f" fontSize="9" fontWeight="700">
                    Center (4)
                  </text>
                </g>
              </svg>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#fff7ed] border border-[#fed7aa] text-[11px] sm:text-xs text-[#c2410c] font-medium">
              <span className="text-sm">⚡</span>
              <span>Cells visually <strong>wobble</strong> when 1 orb away from exploding!</span>
            </div>
          </div>

          {/* Step 3: Explode & Convert */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Explode &amp; Convert
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              When a cell explodes, its orbs burst into orthogonal neighbors,{" "}
              <strong className="text-[#e0530a]">converting enemy orbs</strong> to your color and triggering chain reactions!
            </p>

            {/* SVG Diagram 3: Before -> After */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 84"
                className="w-full max-w-[290px] h-auto"
                aria-label="Explosion converts adjacent opponent orbs into active player color"
              >
                {/* BEFORE */}
                <g transform="translate(10, 4)">
                  <rect width="115" height="66" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.2" />
                  {/* Left: Exploding cell with 2 orbs (corner) */}
                  <rect x="8" y="10" width="45" height="45" rx="6" fill="#fff7ed" stroke="#e0530a" strokeWidth="1.5" />
                  <circle cx="25" cy="27" r="5" fill="#e0530a" />
                  <circle cx="36" cy="36" r="5" fill="#e0530a" />
                  {/* Right: Neighbor owned by Blue */}
                  <rect x="60" y="10" width="45" height="45" rx="6" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.2" />
                  <circle cx="82" cy="32" r="6" fill="#2563eb" />
                  <text x="57" y="62" textAnchor="middle" fill="#6b665f" fontSize="8" fontWeight="700">
                    BEFORE BURST
                  </text>
                </g>

                {/* Arrow */}
                <g transform="translate(133, 30)">
                  <circle cx="16" cy="8" r="10" fill="#1c1917" />
                  <path d="M13 8h6M16 5l3 3-3 3" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {/* AFTER */}
                <g transform="translate(175, 4)">
                  <rect width="115" height="66" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.2" />
                  {/* Left: Empty (lost critical orbs) */}
                  <rect x="8" y="10" width="45" height="45" rx="6" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1.2" />
                  <text x="30" y="36" textAnchor="middle" fill="#9c978e" fontSize="8" fontWeight="600">
                    EMPTY
                  </text>
                  {/* Right: Converted to Orange with +1 orb! */}
                  <rect x="60" y="10" width="45" height="45" rx="6" fill="#fff7ed" stroke="#e0530a" strokeWidth="1.8" />
                  <circle cx="77" cy="32" r="5.5" fill="#e0530a" />
                  <circle cx="89" cy="32" r="5.5" fill="#e0530a" />
                  <text x="57" y="62" textAnchor="middle" fill="#c2410c" fontSize="8" fontWeight="800">
                    CONVERTED!
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Step 4: Eliminate to Win */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Eliminate to Win
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              Once both players have made at least one move, completely wipe out all opponent orbs from the board to win the match.
            </p>

            {/* SVG Diagram 4: Win state */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 52"
                className="w-full max-w-[290px] h-auto"
                aria-label="Wipe out all opponent orbs to win"
              >
                <rect width="298" height="50" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.2" />
                {/* Winner Pill */}
                <g transform="translate(15, 11)">
                  <rect width="125" height="28" rx="6" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
                  <circle cx="16" cy="14" r="6" fill="#e0530a" />
                  <text x="30" y="18" fill="#c2410c" fontSize="10" fontWeight="800">
                    Orange: 12 Orbs
                  </text>
                  <text x="112" y="18" fill="#c2410c" fontSize="12">
                    👑
                  </text>
                </g>

                {/* Loser Pill */}
                <g transform="translate(155, 11)">
                  <rect width="125" height="28" rx="6" fill="#faf9f6" stroke="#eeece6" strokeWidth="1" />
                  <circle cx="16" cy="14" r="6" fill="#94a3b8" />
                  <text x="30" y="18" fill="#64748b" fontSize="10" fontWeight="700">
                    Blue: 0 Orbs
                  </text>
                  <text x="110" y="18" fill="#ef4444" fontSize="11" fontWeight="800">
                    OUT
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Pro Tip Callout */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-start gap-2.5 text-xs text-[#9a3412]">
            <span className="text-base shrink-0 select-none">💡</span>
            <p className="leading-relaxed">
              <strong>Pro Tip:</strong> Corners explode fastest (at just 2 orbs)—claim them early, and watch out for wobbling enemy cells adjacent to your clusters!
            </p>
          </div>
        </div>

        {/* Sticky Footer Action */}
        <div className="p-4 border-t border-[#eeece6] bg-white shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl font-semibold text-sm bg-[#1c1917] hover:bg-[#322f2c] active:bg-black text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
