"use client";

import Link from "next/link";
import type { GameLifecycle } from "@/games/common/types";
import { soundManager } from "@/platform/audio";

interface GameHUDProps {
  lifecycle?: GameLifecycle;
  onPause?: () => void;
  onRestart?: () => void;
  showReset?: boolean;
  showPause?: boolean;
}

export function GameHUD({ lifecycle = "pre-game", onPause, onRestart, showReset, showPause }: GameHUDProps) {
  const canReset = showReset ?? (lifecycle !== "pre-game" && lifecycle !== "configuration");
  const canPause = showPause ?? (lifecycle === "playing" && Boolean(onPause));
  return (
    <header className="active-game-header flex h-14 shrink-0 items-center justify-between border-b border-[#e6e3dc] px-3 sm:px-5" role="banner">
      <div className="flex items-center gap-2">
        <Link href="/" onClick={() => soundManager.play("buttonClick")} className="grid h-10 w-10 place-items-center rounded-lg text-[#6b665f] hover:bg-black/5" aria-label="Back to games">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-[#1c1917]" aria-label="OmniPlay home">
          <span className="flex gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#e0530a]"/><i className="h-2.5 w-2.5 rounded-full bg-[#2563eb]"/></span>
          OmniPlay
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {canReset && onRestart && <button type="button" onClick={() => { soundManager.play("buttonClick"); onRestart(); }} className="min-h-10 rounded-lg px-3 py-2 text-xs font-medium text-[#1c1917] transition-colors hover:bg-black/5 active:bg-black/10" aria-label="Reset game">Reset</button>}
        {canPause && onPause && <button type="button" onClick={() => { soundManager.play("buttonClick"); onPause(); }} className="min-h-10 rounded-lg border border-[#e6e3dc] px-3 py-2 text-xs font-medium text-[#1c1917] transition-colors hover:bg-black/5 active:bg-black/10" aria-label="Pause game">Pause</button>}
      </div>
    </header>
  );
}
