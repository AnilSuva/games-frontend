"use client";

import React, { Suspense, useMemo } from "react";
import { getGameMetadata } from "@/platform/registry";
import { CARTRIDGE_MAP } from "@/platform/registry/cartridges";
import type { GameHostProps, GameLifecycle, GameMode, GameResult, IGameController } from "@/games/common/types";

interface GameHostComponentProps {
  gameId: string;
  mode: GameMode;
  onGameOver: (result: GameResult) => void;
  onScoreUpdate?: (score: number) => void;
  onReady: (controller: IGameController) => void;
  onLifecycleChange?: (lifecycle: GameLifecycle) => void;
  onTurnChange?: (player: "X" | "O" | null) => void;
}

function GameLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] text-[#6b665f] gap-2.5">
      <div className="w-6 h-6 rounded-full border-2 border-[#1c1917] border-t-transparent animate-spin" />
      <span className="text-[11px] font-medium tracking-wide text-[#9c978e]">Mounting game...</span>
    </div>
  );
}

export function GameHost({
  gameId,
  mode,
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostComponentProps) {
  const metadata = useMemo(() => getGameMetadata(gameId), [gameId]);
  const Cartridge = CARTRIDGE_MAP[gameId];

  if (!metadata) {
    return (
      <div className="p-8 text-center text-[#e0530a]">
        <p className="text-xs font-semibold">Game cartridge not found in registry.</p>
      </div>
    );
  }

  if (metadata.status === "coming-soon" || !Cartridge) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[320px] p-6 text-center text-[#6b665f]">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#e6e3dc] flex items-center justify-center text-[#1c1917] mb-3 text-lg">
          ⏳
        </div>
        <h2 className="text-base font-semibold text-[#1c1917] mb-1">{metadata.title}</h2>
        <p className="text-xs text-[#6b665f] max-w-xs leading-relaxed">
          This game cartridge is currently under active development. Check back soon.
        </p>
      </div>
    );
  }

  const hostProps: GameHostProps = {
    mode,
    onGameOver,
    onScoreUpdate,
    onReady,
    onLifecycleChange,
    onTurnChange,
  };

  return (
    <Suspense fallback={<GameLoadingFallback />}>
      <Cartridge {...hostProps} />
    </Suspense>
  );
}
