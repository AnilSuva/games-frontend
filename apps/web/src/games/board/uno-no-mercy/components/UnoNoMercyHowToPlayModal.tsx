"use client";

import { useEffect } from "react";
import { UnoCard } from "./UnoCard";

interface UnoNoMercyHowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  mercyLimit?: number;
}

export function UnoNoMercyHowToPlayModal({
  isOpen,
  onClose,
  mercyLimit = 25,
}: UnoNoMercyHowToPlayModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to Play UNO No Mercy"
    >
      <div
        className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl bg-white border border-[#e6e3dc] shadow-xl p-5 sm:p-6 text-[#1c1917]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e6e3dc] pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              How to Play UNO No Mercy
            </h2>
            <p className="text-xs text-[#6b665f]">
              2–6 Players • Brutal Stacks • Mercy Elimination
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b665f] hover:bg-[#f0eee9] hover:text-[#1c1917] cursor-pointer"
            aria-label="Close guide"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 text-sm">
          {/* 1. Goal & Mercy Rule */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-[#1c1917]">1. Goal &amp; Mercy Rule</h3>
            <p className="text-xs text-[#6b665f] leading-relaxed">
              Empty your hand first—or be the last player standing! If you ever hold{" "}
              <strong className="text-[#1c1917]">{mercyLimit}+ cards</strong> (host
              customizable), the <strong className="text-rose-600">Mercy Rule</strong>{" "}
              eliminates you immediately. In host-enabled{" "}
              <strong className="text-[#1c1917]">One Loser</strong> mode, the first
              player to reach {mercyLimit}+ cards loses immediately and ends the match
              for everyone.
            </p>
          </section>

          {/* 2. No Mercy Action Cards */}
          <section className="space-y-2">
            <h3 className="font-bold text-[#1c1917]">2. No Mercy Action Cards</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g1", color: "red", kind: "draw2" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Draw +2</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g2", color: "blue", kind: "draw4" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Colored +4</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g3", color: "green", kind: "skip_everyone" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Skip Everyone</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g4", color: "yellow", kind: "discard_all" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Discard All</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g5", color: "wild", kind: "wild_reverse_draw4" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Reverse +4</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g6", color: "wild", kind: "wild_color_roulette" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Color Roulette</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g7", color: "wild", kind: "wild_draw6" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Wild +6</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-center">
                <UnoCard size="xs" card={{ id: "g8", color: "wild", kind: "wild_draw10" }} />
                <span className="mt-1.5 text-[11px] font-semibold">Wild +10</span>
              </div>
            </div>
          </section>

          {/* 3. 7-Swap & 0-Pass */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-[#1c1917]">3. 7-Swap &amp; 0-Pass</h3>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc]">
              <UnoCard size="xs" card={{ id: "g9", color: "red", kind: "number", number: 7 }} />
              <UnoCard size="xs" card={{ id: "g10", color: "blue", kind: "number", number: 0 }} />
              <p className="text-xs text-[#6b665f] leading-relaxed">
                Playing <strong className="text-[#1c1917]">7</strong> lets you swap your
                entire hand with any player. Playing{" "}
                <strong className="text-[#1c1917]">0</strong> rotates every active
                player&apos;s hand in the direction of play.
              </p>
            </div>
          </section>

          {/* 4. Stacking & Draw Until Playable */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-[#1c1917]">
              4. Stacking &amp; Draw Until Playable
            </h3>
            <p className="text-xs text-[#6b665f] leading-relaxed">
              Stack any draw card of <strong className="text-[#1c1917]">equal or higher</strong>{" "}
              value (<code className="font-mono">+2 → +4 → +6 → +10</code>) to pass the
              combined penalty forward. When no stack is active, clicking Draw pulls cards
              until you find a playable card (if enabled by the host).
            </p>
          </section>

          {/* 5. UNO!, Disconnect & 2-Min AFK Rule */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-[#1c1917]">
              5. UNO!, Disconnect &amp; 2-Min AFK Rule
            </h3>
            <p className="text-xs text-[#6b665f] leading-relaxed">
              Hit <strong className="text-[#1c1917]">UNO!</strong> when dropping to 1 card
              or opponents can catch you for +2 cards. Disconnecting removes you
              immediately, and taking over <strong className="text-[#1c1917]">2:00</strong>{" "}
              on your turn kicks you for AFK.
            </p>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-semibold hover:bg-[#322f2c] cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
