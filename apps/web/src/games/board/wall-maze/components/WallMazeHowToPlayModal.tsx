"use client";

import { useEffect } from "react";
import { soundManager } from "@/platform/audio";

interface WallMazeHowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WallMazeHowToPlayModal({
  isOpen,
  onClose,
}: WallMazeHowToPlayModalProps) {
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
      aria-labelledby="wall-maze-guide-title"
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
              id="wall-maze-guide-title"
              className="text-lg sm:text-xl font-bold text-[#1c1917] tracking-tight"
            >
              How to Play
            </h2>
            <p className="text-xs text-[#6b665f] font-medium">
              Wall Maze (Quoridor) Rules &amp; Tactics
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
          {/* Step 1: Race to the Opposite Side */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Race to the Opposite Side
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              <strong className="text-[#e0530a]">Orange</strong> starts at the bottom and races to any square on the <strong className="text-[#1c1917]">top edge</strong>.{" "}
              <strong className="text-[#2563eb]">Blue</strong> starts at the top and races to the <strong className="text-[#1c1917]">bottom edge</strong>.
            </p>

            {/* SVG Diagram 1 */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 280 94"
                className="w-full max-w-[270px] h-auto"
                aria-label="Orange races up to top strip and Blue races down to bottom strip"
              >
                <rect x="65" y="6" width="150" height="82" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.5" />
                {/* Top Orange Goal Strip */}
                <rect x="71" y="10" width="138" height="7" rx="3.5" fill="#e0530a" fillOpacity="0.22" stroke="#e0530a" strokeWidth="1" />
                <text x="140" y="15.5" textAnchor="middle" fill="#c2410c" fontSize="5.5" fontWeight="800">
                  ORANGE GOAL ▲
                </text>
                {/* Bottom Blue Goal Strip */}
                <rect x="71" y="77" width="138" height="7" rx="3.5" fill="#2563eb" fillOpacity="0.22" stroke="#2563eb" strokeWidth="1" />
                <text x="140" y="82.5" textAnchor="middle" fill="#1d4ed8" fontSize="5.5" fontWeight="800">
                  BLUE GOAL ▼
                </text>

                {/* Grid Lines */}
                <line x1="115" y1="20" x2="115" y2="74" stroke="#eeece6" strokeWidth="1" />
                <line x1="165" y1="20" x2="165" y2="74" stroke="#eeece6" strokeWidth="1" />
                <line x1="75" y1="38" x2="205" y2="38" stroke="#eeece6" strokeWidth="1" />
                <line x1="75" y1="56" x2="205" y2="56" stroke="#eeece6" strokeWidth="1" />

                {/* Orange Pawn & Up Arrow */}
                <path d="M98 62 V24" stroke="#e0530a" strokeWidth="2.2" strokeDasharray="3 2" strokeLinecap="round" />
                <path d="M93 29l5-6 5 6" fill="none" stroke="#e0530a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="98" cy="65" r="8" fill="#e0530a" stroke="#ffffff" strokeWidth="2" />

                {/* Blue Pawn & Down Arrow */}
                <path d="M182 32 V70" stroke="#2563eb" strokeWidth="2.2" strokeDasharray="3 2" strokeLinecap="round" />
                <path d="M177 65l5 6 5-6" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="182" cy="29" r="8" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Step 2: Move or Jump */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Move or Jump
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              Step 1 square orthogonally. If facing the opponent pawn,{" "}
              <strong className="text-[#1c1917]">jump straight over them</strong>—or step{" "}
              <strong className="text-[#1c1917]">diagonally</strong> if a wall or edge sits directly behind them.
            </p>

            {/* SVG Diagram 2: Straight Jump vs Diagonal Side-Step */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 96"
                className="w-full max-w-[290px] h-auto"
                aria-label="Straight jump over opponent or diagonal side-step when blocked behind"
              >
                {/* Left: Straight Jump */}
                <g transform="translate(8, 4)">
                  <rect width="132" height="86" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.3" />
                  {/* 3 vertical cells */}
                  <rect x="46" y="7" width="40" height="20" rx="4" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.2" />
                  <rect x="46" y="31" width="40" height="20" rx="4" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1" />
                  <rect x="46" y="55" width="40" height="20" rx="4" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1" />
                  {/* Jump arc */}
                  <path d="M66 65 C36 52 36 30 66 17" fill="none" stroke="#e0530a" strokeWidth="2" strokeDasharray="3 2" />
                  <circle cx="66" cy="17" r="4" fill="#e0530a" />
                  <circle cx="66" cy="41" r="7" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="66" cy="65" r="7" fill="#e0530a" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="66" y="83" textAnchor="middle" fill="#6b665f" fontSize="7.5" fontWeight="700">
                    STRAIGHT JUMP
                  </text>
                </g>

                {/* Right: Diagonal Side-Step */}
                <g transform="translate(160, 4)">
                  <rect width="132" height="86" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.3" />
                  {/* Top cell + Left/Right cells + Bottom cell */}
                  <rect x="46" y="7" width="40" height="20" rx="4" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1" />
                  <rect x="14" y="31" width="28" height="20" rx="4" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.2" />
                  <rect x="46" y="31" width="40" height="20" rx="4" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1" />
                  <rect x="90" y="31" width="28" height="20" rx="4" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.2" />
                  <rect x="46" y="55" width="40" height="20" rx="4" fill="#faf9f6" stroke="#e6e3dc" strokeWidth="1" />

                  {/* Blocking Wall behind Blue */}
                  <rect x="34" y="26.5" width="64" height="5" rx="2.5" fill="#1c1917" />

                  {/* Diagonal arrows */}
                  <path d="M62 61 L30 43" fill="none" stroke="#e0530a" strokeWidth="1.8" strokeDasharray="3 2" />
                  <path d="M70 61 L102 43" fill="none" stroke="#e0530a" strokeWidth="1.8" strokeDasharray="3 2" />
                  <circle cx="28" cy="41" r="3.5" fill="#e0530a" />
                  <circle cx="104" cy="41" r="3.5" fill="#e0530a" />

                  <circle cx="66" cy="41" r="7" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="66" cy="65" r="7" fill="#e0530a" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="66" y="83" textAnchor="middle" fill="#6b665f" fontSize="7.5" fontWeight="700">
                    WALL BEHIND → DIAGONAL
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Step 3: Drop Walls to Detour */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Drop Walls to Detour
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              Instead of moving, spend 1 of your <strong className="text-[#1c1917]">10 walls</strong> (2 squares wide) to block corridors and force your opponent into a longer detour.
            </p>

            {/* SVG Diagram 3: 2-cell wall forcing detour */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 280 78"
                className="w-full max-w-[270px] h-auto"
                aria-label="A 2-cell wall forces the opponent to take a longer detour"
              >
                <rect x="35" y="4" width="210" height="70" rx="8" fill="#ffffff" stroke="#e6e3dc" strokeWidth="1.3" />
                {/* 4x2 grid hint */}
                <rect x="65" y="12" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="103" y="12" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="141" y="12" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="179" y="12" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />

                <rect x="65" y="42" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="103" y="42" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="141" y="42" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />
                <rect x="179" y="42" width="32" height="22" rx="4" fill="#faf9f6" stroke="#e6e3dc" />

                {/* 2-cell charcoal wall */}
                <rect x="102" y="35.5" width="72" height="5" rx="2.5" fill="#1c1917" />

                {/* Blue pawn & detour path around the wall */}
                <circle cx="119" cy="23" r="6.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                <path
                  d="M128 23 H195 V53 H157"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeDasharray="4 2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M162 49l-6 4 6 4" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Step 4: Never Seal Them Off */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#faf9f6] border border-[#e6e3dc] space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1c1917] text-white text-xs font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1c1917]">
                Never Seal Them Off
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6b665f] leading-relaxed">
              Walls may not overlap or cross each other, and you{" "}
              <strong className="text-[#dc2626]">cannot completely trap</strong> a player—both pawns must always have at least one open path to their goal.
            </p>

            {/* SVG Diagram 4 */}
            <div className="pt-1 flex justify-center">
              <svg
                viewBox="0 0 300 72"
                className="w-full max-w-[290px] h-auto"
                aria-label="Open winding path is legal while completely sealing off a player is illegal"
              >
                {/* Legal Winding Path */}
                <g transform="translate(10, 4)">
                  <rect width="130" height="62" rx="8" fill="#ffffff" stroke="#10b981" strokeWidth="1.4" />
                  <rect x="20" y="18" width="52" height="5" rx="2.5" fill="#1c1917" />
                  <rect x="52" y="36" width="56" height="5" rx="2.5" fill="#1c1917" />
                  <circle cx="34" cy="10" r="5.5" fill="#2563eb" />
                  <path d="M42 10 H92 V29 H36 V48" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3.5 2" strokeLinecap="round" />
                  <text x="65" y="57" textAnchor="middle" fill="#059669" fontSize="8" fontWeight="800">
                    DETOUR OPEN (OK)
                  </text>
                </g>

                {/* Illegal Seal-off */}
                <g transform="translate(160, 4)">
                  <rect width="130" height="62" rx="8" fill="#ffffff" stroke="#ef4444" strokeWidth="1.4" />
                  <rect x="35" y="10" width="5" height="28" rx="2.5" fill="#1c1917" />
                  <rect x="88" y="10" width="5" height="28" rx="2.5" fill="#1c1917" />
                  <rect x="37" y="34" width="54" height="5" rx="2.5" fill="#ef4444" />
                  <circle cx="64" cy="21" r="6" fill="#2563eb" />
                  {/* Forbidden X */}
                  <line x1="56" y1="13" x2="72" y2="29" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="72" y1="13" x2="56" y2="29" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
                  <text x="65" y="57" textAnchor="middle" fill="#dc2626" fontSize="8" fontWeight="800">
                    SEALED OFF (ILLEGAL)
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Pro Tip Callout */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-start gap-2.5 text-xs text-[#9a3412]">
            <span className="text-base shrink-0 select-none">💡</span>
            <p className="leading-relaxed">
              <strong>Pro Tip:</strong> Save a few walls for the endgame—a single well-timed detour wall when your rival is 2 steps from winning can flip the race! On desktop, press <kbd className="px-1 py-0.5 rounded bg-white border border-[#fed7aa] font-mono text-[10px]">R</kbd> or right-click to rotate walls.
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
