"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { soundManager } from "@/platform/audio";
import { GAME_WIDTH, GAME_HEIGHT, WINNING_SCORE } from "../config/constants";
import type { BotDifficulty, GameMode, PlayerRole, StarCatcherScore } from "../game/types";

const STAR_CATCHER_MODES: GameModeOption[] = [
  {
    id: "1v1",
    label: "1v1",
    description: "Local 2-Player (Split Screen Space Duel)",
  },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot steering precision and hazard avoidance",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Launch Ship",
    },
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center justify-center gap-3 text-[11px] text-[#9c978e]">
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue Ship (Top)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange Ship (Bottom)
    </span>
  </div>
);

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-all duration-200 ${
        filled ? "text-[#f59e0b] scale-110 drop-shadow-xs" : "text-[#d6d3d1] opacity-35"
      }`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.5 : 2}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function StarCatcherGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/StarCatcherScene").StarCatcherScene | null>(null);

  // Pre-game state
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<GameMode>("1v1");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  // Live HUD state
  const [scores, setScores] = useState<StarCatcherScore>({ orange: 0, blue: 0 });
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlayerRole;
    score: StarCatcherScore;
  } | null>(null);

  const callbacksRef = useRef({
    onGameOver,
    onScoreUpdate,
    onReady,
    onLifecycleChange,
  });
  useEffect(() => {
    callbacksRef.current = {
      onGameOver,
      onScoreUpdate,
      onReady,
      onLifecycleChange,
    };
  });

  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  // Mode Selection Handlers
  const handleSelectMode = useCallback((modeId: string) => {
    soundManager.play("buttonClick");
    setSelectedMode(modeId as GameMode);
    setDifficulty("medium");
    setInModeSelection(false);
  }, []);

  const handleSelectConfiguredMode = useCallback(
    (modeId: string, configValue: string) => {
      soundManager.play("buttonClick");
      setSelectedMode(modeId as GameMode);
      setDifficulty(configValue as BotDifficulty);
      setInModeSelection(false);
    },
    []
  );

  const handleBackToModeSelect = useCallback(() => {
    soundManager.play("buttonClick");
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    sceneRef.current = null;
    setInModeSelection(true);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ orange: 0, blue: 0 });
    callbacksRef.current.onLifecycleChange?.("pre-game");
  }, []);

  // Restart Handler
  const handleRestart = useCallback(() => {
    soundManager.play("buttonClick");
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ orange: 0, blue: 0 });
    sceneRef.current?.restartGame(selectedMode, difficulty);
    callbacksRef.current.onLifecycleChange?.("playing");
    callbacksRef.current.onScoreUpdate?.(0);
  }, [difficulty, selectedMode]);

  const handleRestartRef = useRef(handleRestart);
  useEffect(() => {
    handleRestartRef.current = handleRestart;
  });

  // Phaser Initialization when mode is chosen
  useEffect(() => {
    if (inModeSelection) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { StarCatcherScene } = await import("../game/StarCatcherScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        backgroundColor: "#090d16",
        transparent: false,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          activePointers: 3,
        },
      };

      gameInstance = new Phaser.Game(config);
      phaserGameRef.current = gameInstance;

      gameInstance.events.once("ready", () => {
        if (!isMounted || !gameInstance) return;

        const onScoreUpdateHandler = (newScores: StarCatcherScore) => {
          if (!isMounted) return;
          setScores({ ...newScores });
          callbacksRef.current.onScoreUpdate?.(newScores.orange);
        };

        const onGameOverHandler = (
          winner: PlayerRole,
          finalScores: StarCatcherScore
        ) => {
          if (!isMounted) return;
          setGameOverResult({ winner, score: finalScores });
          callbacksRef.current.onGameOver({
            winner: winner === "orange" ? "Orange" : "Blue",
            score: winner === "orange" ? finalScores.orange : finalScores.blue,
            details: {
              game: "star-catcher",
              mode: selectedMode,
              difficulty,
              scores: finalScores,
            },
          });
        };

        const scene = gameInstance.scene.add(
          "StarCatcherScene",
          StarCatcherScene,
          true,
          {
            mode: selectedMode,
            difficulty,
            callbacks: {
              onScoreUpdate: onScoreUpdateHandler,
              onStarCollected: () => {},
              onGameOver: onGameOverHandler,
            },
          }
        ) as import("../game/StarCatcherScene").StarCatcherScene;

        sceneRef.current = scene;

        const controller: IGameController = {
          restart: () => handleRestartRef.current(),
          pause: () => scene.pauseGame(),
          resume: () => scene.resumeGame(),
          destroy: () => {
            gameInstance?.destroy(true);
            phaserGameRef.current = null;
          },
        };

        callbacksRef.current.onLifecycleChange?.("playing");
        callbacksRef.current.onReady(controller);
      });
    }

    initPhaser();

    const resizeObserver = new ResizeObserver(() => {
      if (phaserGameRef.current) {
        phaserGameRef.current.scale.refresh();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (gameInstance) {
        gameInstance.destroy(true);
        phaserGameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [inModeSelection, selectedMode, difficulty]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-[#f7f6f2] p-2 sm:p-3">
      {/* 1. Mode Selection Screen */}
      {inModeSelection && (
        <GameModeSelector
          gameTitle="Star Catcher"
          modes={STAR_CATCHER_MODES}
          onSelectMode={handleSelectMode}
          onSelectConfiguredMode={handleSelectConfiguredMode}
          onScreenChange={(screen) =>
            callbacksRef.current.onLifecycleChange?.(
              screen === "config" ? "configuration" : "pre-game"
            )
          }
          footer={PLAYER_COLOR_FOOTER}
        />
      )}

      {/* 2. Active Game HUD & Canvas Frame */}
      {!inModeSelection && (
        <div
          className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border border-[#2a374a] shadow-md bg-[#090d16]"
          style={{
            width:
              "min(calc(100% - 0.5rem), calc((100dvh - 4.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 360 / 600), 420px)",
            aspectRatio: "360 / 600",
            maxHeight: "100%",
          }}
        >
          {/* Top Player HUD (Blue / Top) */}
          <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Blue Star Count & Player Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#111827]/90 border border-[#374151] shadow-xs backdrop-blur-xs">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#60a5fa] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                {selectedMode === "bot" ? "Bot" : "P2"}
              </span>
              <div className="h-3 w-px bg-[#374151]" />
              <div className="flex items-center gap-0.5">
                {Array.from({ length: WINNING_SCORE }).map((_, i) => (
                  <StarIcon key={i} filled={i < scores.blue} />
                ))}
              </div>
            </div>

            {/* Center: Target / Difficulty Badge */}
            <div className="px-2.5 py-1 rounded-full bg-[#111827]/90 border border-[#374151] shadow-xs backdrop-blur-xs text-[10px] font-semibold text-[#9ca3af] tracking-tight">
              {selectedMode === "bot"
                ? `BOT • ${difficulty.toUpperCase()}`
                : "FIRST TO 5"}
            </div>

            {/* Blue Score & Mode Button */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827]/90 border border-[#374151] shadow-xs backdrop-blur-xs">
                <span className="text-xs font-bold text-[#f3f4f6] font-mono leading-none">
                  {scores.blue}
                </span>
              </div>

              <button
                type="button"
                onClick={handleBackToModeSelect}
                className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-[#111827]/90 hover:bg-[#1f2937] active:bg-[#374151] border border-[#374151] text-[11px] font-semibold text-[#9ca3af] hover:text-[#f3f4f6] shadow-xs transition active:scale-95 cursor-pointer"
                aria-label="Change Mode"
              >
                Mode
              </button>
            </div>
          </div>

          {/* Bottom Player HUD (Orange / Bottom) */}
          <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Orange Star Count & Player Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#111827]/90 border border-[#374151] shadow-xs backdrop-blur-xs">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#fb923c] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                {selectedMode === "bot" ? "You" : "P1"}
              </span>
              <div className="h-3 w-px bg-[#374151]" />
              <div className="flex items-center gap-0.5">
                {Array.from({ length: WINNING_SCORE }).map((_, i) => (
                  <StarIcon key={i} filled={i < scores.orange} />
                ))}
              </div>
            </div>

            {/* Desktop Controls Hint */}
            <div className="hidden sm:inline px-2.5 py-1 rounded-full bg-[#111827]/85 border border-[#374151] shadow-xs backdrop-blur-xs text-[10px] font-medium text-[#9ca3af] font-mono">
              [WASD / Drag] Fly
            </div>

            {/* Target Stars notice & Orange Score Pill */}
            <div className="flex items-center gap-1.5">
              <div className="hidden xs:flex items-center px-2.5 py-1 rounded-full bg-[#111827]/80 border border-[#374151] text-[10px] font-semibold text-[#9ca3af]">
                Goal: {WINNING_SCORE}
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827]/90 border border-[#374151] shadow-xs backdrop-blur-xs">
                <span className="text-xs font-bold text-[#f3f4f6] font-mono leading-none">
                  {scores.orange}
                </span>
              </div>
            </div>
          </div>

          {/* Phaser Canvas Container */}
          <div
            ref={containerRef}
            className="w-full h-full touch-none select-none"
            tabIndex={0}
            aria-label="Star Catcher Game Arena"
          />

          {/* Game Over Result Popup */}
          {gameOverResult && !isPopupDismissed && (
            <GameResultPopup
              resultText={`${
                gameOverResult.winner === "orange" ? "Orange" : "Blue"
              } Won (${gameOverResult.score.orange} - ${gameOverResult.score.blue})`}
              accentColor={gameOverResult.winner === "orange" ? "#e0530a" : "#2563eb"}
              onPlayAgain={handleRestart}
              onClose={() => setIsPopupDismissed(true)}
              onHome={handleBackToModeSelect}
              playAgainText="Play Again"
            />
          )}
        </div>
      )}
    </div>
  );
}
