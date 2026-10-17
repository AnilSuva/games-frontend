"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { soundManager } from "@/platform/audio";
import { GAME_WIDTH, GAME_HEIGHT, WINNING_SCORE } from "../config/constants";
import type { KnifeThrowerInventory, KnifeThrowerScore, PlayerRole } from "../game/types";

const KNIFE_THROWER_MODES: GameModeOption[] = [
  {
    id: "1v1",
    label: "1v1",
    description: "Local 2-Player (Split Screen Duel)",
  },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot reaction speed and precision",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Duel",
    },
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center justify-center gap-3 text-[11px] text-[#9c978e]">
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue (Top)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange (Bottom)
    </span>
  </div>
);

type KnifeThrowerMode = "1v1" | "bot";
type DifficultyTier = "easy" | "medium" | "hard";

export default function KnifeThrowerGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/KnifeThrowerScene").KnifeThrowerScene | null>(null);

  // Strict pre-game hidden state: Phaser is NEVER initialized until a mode is chosen
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<KnifeThrowerMode>("1v1");
  const [difficulty, setDifficulty] = useState<DifficultyTier>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  // Live HUD state
  const [scores, setScores] = useState<KnifeThrowerScore>({ orange: 0, blue: 0 });
  const [inventories, setInventories] = useState<KnifeThrowerInventory>({ orange: 7, blue: 7 });
  const [maxKnives, setMaxKnives] = useState<number>(7);
  const [currentSet, setCurrentSet] = useState<number>(0);
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlayerRole;
    score: KnifeThrowerScore;
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
    setSelectedMode(modeId as KnifeThrowerMode);
    setDifficulty("medium");
    setInModeSelection(false);
  }, []);

  const handleSelectConfiguredMode = useCallback(
    (modeId: string, configValue: string) => {
      soundManager.play("buttonClick");
      setSelectedMode(modeId as KnifeThrowerMode);
      setDifficulty(configValue as DifficultyTier);
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
    setMaxKnives(7);
    setCurrentSet(0);
    callbacksRef.current.onLifecycleChange?.("pre-game");
  }, []);

  // Restart Handler
  const handleRestart = useCallback(() => {
    soundManager.play("buttonClick");
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ orange: 0, blue: 0 });
    setMaxKnives(7);
    setCurrentSet(0);
    sceneRef.current?.restartGame(selectedMode, difficulty);
    callbacksRef.current.onLifecycleChange?.("playing");
    callbacksRef.current.onScoreUpdate?.(0);
  }, [difficulty, selectedMode]);

  const handleRestartRef = useRef(handleRestart);
  useEffect(() => {
    handleRestartRef.current = handleRestart;
  });

  // Phaser Initialization when mode selection completes
  useEffect(() => {
    if (inModeSelection) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { KnifeThrowerScene } = await import("../game/KnifeThrowerScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        backgroundColor: "#faf9f6",
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

        const onScoreChangeHandler = (newScores: KnifeThrowerScore) => {
          if (!isMounted) return;
          setScores(newScores);
          callbacksRef.current.onScoreUpdate?.(newScores.orange);
        };

        const onInventoryChangeHandler = (
          newInventories: KnifeThrowerInventory,
          max?: number
        ) => {
          if (!isMounted) return;
          setInventories({ ...newInventories });
          if (typeof max === "number" && max > 0) {
            setMaxKnives(max);
          }
        };

        const onSetChangeHandler = (setIndex: number) => {
          if (!isMounted) return;
          setCurrentSet(setIndex);
        };

        const onGameOverHandler = (result: {
          winner: PlayerRole;
          score: KnifeThrowerScore;
        }) => {
          if (!isMounted) return;
          setGameOverResult(result);
          callbacksRef.current.onGameOver({
            winner: result.winner === "orange" ? "Orange" : "Blue",
            score: result.winner === "orange" ? result.score.orange : result.score.blue,
            details: {
              game: "knife-thrower",
              mode: selectedMode,
              difficulty,
              scores: result.score,
            },
          });
        };

        const scene = gameInstance.scene.add(
          "KnifeThrowerScene",
          KnifeThrowerScene,
          true,
          {
            mode: selectedMode,
            difficulty,
            callbacks: {
              onScoreChange: onScoreChangeHandler,
              onKnifeInventoryChange: onInventoryChangeHandler,
              onSetChange: onSetChangeHandler,
              onGameOver: onGameOverHandler,
              onLifecycleChange: (status: "playing" | "finished") => {
                callbacksRef.current.onLifecycleChange?.(status);
              },
            },
          }
        ) as import("../game/KnifeThrowerScene").KnifeThrowerScene;

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
          gameTitle="Knife Thrower"
          modes={KNIFE_THROWER_MODES}
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
          className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border border-[#e6e3dc] shadow-sm bg-[#faf9f6]"
          style={{
            width:
              "min(calc(100% - 0.5rem), calc((100dvh - 4.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 360 / 580), 420px)",
            aspectRatio: "360 / 580",
            maxHeight: "100%",
          }}
        >
          {/* Top Player HUD (Blue / Top) */}
          <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Blue Inventory & Player Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/95 border border-[#e6e3dc] shadow-xs backdrop-blur-xs">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#2563eb] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                {selectedMode === "bot" ? "Bot" : "P2"}
              </span>
              <div className="h-3 w-px bg-[#e6e3dc]" />
              <div className="flex items-center gap-1">
                {Array.from({ length: maxKnives }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-t-sm rounded-b-[1px] border transition-all duration-150 ${
                      i < inventories.blue
                        ? "bg-[#2563eb] border-[#1d4ed8] shadow-2xs"
                        : "bg-[#f5f5f4] border-[#e7e5e4] opacity-30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Center: Set Progression Badge */}
            <div className="px-2.5 py-1 rounded-full bg-white/95 border border-[#e6e3dc] shadow-xs backdrop-blur-xs text-[10px] font-semibold text-[#57534e] tracking-tight">
              {selectedMode === "bot"
                ? `Set ${currentSet + 1} • ${difficulty.toUpperCase()}`
                : `Set ${currentSet + 1}`}
            </div>

            {/* Blue Score Pill & Mode Button */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-[#e6e3dc] shadow-xs backdrop-blur-xs">
                <span className="text-xs font-bold text-[#1c1917] font-mono leading-none">
                  {scores.blue}
                </span>
              </div>

              <button
                type="button"
                onClick={handleBackToModeSelect}
                className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white active:bg-[#f5f5f4] border border-[#e6e3dc] text-[11px] font-semibold text-[#57534e] hover:text-[#1c1917] shadow-xs transition active:scale-95 cursor-pointer"
                aria-label="Change Mode"
              >
                Mode
              </button>
            </div>
          </div>

          {/* Bottom Player HUD (Orange / Bottom) */}
          <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Orange Inventory & Player Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/95 border border-[#e6e3dc] shadow-xs backdrop-blur-xs">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#e0530a] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
                {selectedMode === "bot" ? "You" : "P1"}
              </span>
              <div className="h-3 w-px bg-[#e6e3dc]" />
              <div className="flex items-center gap-1">
                {Array.from({ length: maxKnives }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-b-sm rounded-t-[1px] border transition-all duration-150 ${
                      i < inventories.orange
                        ? "bg-[#e0530a] border-[#c2410c] shadow-2xs"
                        : "bg-[#f5f5f4] border-[#e7e5e4] opacity-30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop Throw Hint */}
            <div className="hidden sm:inline px-2.5 py-1 rounded-full bg-white/90 border border-[#e6e3dc] shadow-xs backdrop-blur-xs text-[10px] font-medium text-[#78746d] font-mono">
              [Space] Throw
            </div>

            {/* Target Score Notice & Orange Score Pill */}
            <div className="flex items-center gap-1.5">
              <div className="hidden xs:flex items-center px-2.5 py-1 rounded-full bg-white/85 border border-[#e6e3dc] text-[10px] font-semibold text-[#78746d]">
                First to {WINNING_SCORE}
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-[#e6e3dc] shadow-xs backdrop-blur-xs">
                <span className="text-xs font-bold text-[#1c1917] font-mono leading-none">
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
            aria-label="Knife Thrower Game Arena"
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
