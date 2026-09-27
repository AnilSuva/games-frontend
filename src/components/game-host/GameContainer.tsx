"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { GameMetadata } from "@/platform/registry/types";
import type { GameLifecycle, GameMode, IGameController } from "@/games/common/types";
import { GameHUD } from "./GameHUD";
import { GameHost } from "./GameHost";
import { PauseModal } from "./PauseModal";

interface GameContainerProps {
  game: GameMetadata;
}

export function GameContainer({ game }: GameContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<IGameController | null>(null);

  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lifecycle, setLifecycle] = useState<GameLifecycle>("pre-game");
  const [selectedMode] = useState<GameMode>(
    game.supportedModes[0] || "local-2p"
  );
  const [turnPlayer, setTurnPlayer] = useState<"X" | "O" | null>(null);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Fallback if blocked
        });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
    setScore(0);
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
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full bg-white rounded-2xl border border-[#e6e3dc] shadow-sm overflow-hidden ${
        isFullscreen ? "h-screen rounded-none border-none" : ""
      }`}
    >
      {/* Platform HUD */}
      <GameHUD
        game={game}
        score={score}
        lifecycle={lifecycle}
        onPause={handlePause}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Active Game Cartridge Frame */}
      <div className="relative flex items-center justify-center p-3 sm:p-6 bg-[#f7f6f2]/50">
        {/* Player turn atmosphere — two-layer composite inset for clear on-device visibility */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out"
          style={{
            boxShadow:
              "inset 0 0 48px 4px rgba(224, 83, 10, 0.15), inset 0 0 120px 20px rgba(224, 83, 10, 0.07)",
            opacity: lifecycle === "playing" && turnPlayer === "X" ? 1 : 0,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out"
          style={{
            boxShadow:
              "inset 0 0 48px 4px rgba(37, 99, 235, 0.15), inset 0 0 120px 20px rgba(37, 99, 235, 0.07)",
            opacity: lifecycle === "playing" && turnPlayer === "O" ? 1 : 0,
          }}
          aria-hidden="true"
        />

        <GameHost
          gameId={game.id}
          mode={selectedMode}
          onReady={handleReady}
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
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
