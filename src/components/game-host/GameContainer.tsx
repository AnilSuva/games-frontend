"use client";

import { useRef, useState, useCallback } from "react";
import type { GameMetadata } from "@/platform/registry/types";
import type { GameLifecycle, GameMode, IGameController } from "@/games/common/types";
import { GameHUD } from "./GameHUD";
import { GameHost } from "./GameHost";
import { PauseModal } from "./PauseModal";

interface GameContainerProps {
  game: GameMetadata;
}

export function GameContainer({ game }: GameContainerProps) {
  const controllerRef = useRef<IGameController | null>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [lifecycle, setLifecycle] = useState<GameLifecycle>("pre-game");
  const [selectedMode] = useState<GameMode>(
    game.supportedModes[0] || "local-2p"
  );
  const [turnPlayer, setTurnPlayer] = useState<"X" | "O" | null>(null);

  // Pause / Resume callbacks
  const handlePause = useCallback(() => {
    setIsPaused(true);
    controllerRef.current?.pause?.();
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    controllerRef.current?.resume?.();
  }, []);

  const handleRestart = useCallback(() => {
    setIsPaused(false);
    controllerRef.current?.restart();
  }, []);

  const handleGameOver = useCallback(() => {
    // Game cartridges handle their integrated end-of-game display directly
  }, []);

  const handleReady = useCallback((controller: IGameController) => {
    controllerRef.current = controller;
  }, []);

  const handleLifecycleChange = useCallback((newLifecycle: GameLifecycle) => {
    setLifecycle(newLifecycle);
  }, []);

  return (
    <div className="active-game-shell relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f7f6f2]">
      <GameHUD lifecycle={lifecycle} onPause={handlePause} onRestart={handleRestart} />

      {/* Active Game Cartridge Frame */}
      <div className="active-game-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {/* Player turn atmosphere — two-layer composite inset for clear on-device visibility */}
        <div
          className="active-turn-atmosphere active-turn-orange absolute inset-0 pointer-events-none transition-opacity duration-[450ms] ease-out"
          style={{
            boxShadow:
              "inset 0 0 36px 2px rgba(224, 83, 10, 0.07), inset 0 0 80px 10px rgba(224, 83, 10, 0.035)",
            opacity: lifecycle === "playing" && turnPlayer === "X" ? 1 : 0,
          }}
          aria-hidden="true"
        />
        <div
          className="active-turn-atmosphere active-turn-blue absolute inset-0 pointer-events-none transition-opacity duration-[450ms] ease-out"
          style={{
            boxShadow:
              "inset 0 0 36px 2px rgba(37, 99, 235, 0.07), inset 0 0 80px 10px rgba(37, 99, 235, 0.035)",
            opacity: lifecycle === "playing" && turnPlayer === "O" ? 1 : 0,
          }}
          aria-hidden="true"
        />

        <GameHost
          gameId={game.id}
          mode={selectedMode}
          onReady={handleReady}
          onGameOver={handleGameOver}
          onLifecycleChange={handleLifecycleChange}
          onTurnChange={setTurnPlayer}
        />
      </div>

      {/* Pause Modal */}
      <PauseModal
        isOpen={isPaused}
        onResume={handleResume}
        onRestart={handleRestart}
      />
    </div>
  );
}
