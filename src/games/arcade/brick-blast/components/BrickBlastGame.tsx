"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { consumeStartingPlayer, type PlatformPlayer } from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/balance";

const BRICK_BLAST_MODES: GameModeOption[] = [
  { id: "1v1", label: "1v1", description: "Local 2-Player" },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Brick Blast Bot",
      subtitle: "Choose your opponent difficulty",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Match",
    },
  },
  {
    id: "multiplayer",
    label: "Multiplayer",
    disabled: true,
    disabledBadge: "Coming Soon",
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center gap-3 text-[11px] text-[#9c978e]">
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

export default function BrickBlastGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/BrickBlastScene").BrickBlastScene | null>(null);

  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<"1v1" | "vs-bot">("1v1");
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showResultPopup, setShowResultPopup] = useState<boolean>(false);
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlatformPlayer;
    score: number;
  } | null>(null);

  useEffect(() => {
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange]);

  const handleSelectMode = useCallback(
    (modeId: string) => {
      if (modeId === "1v1") {
        setSelectedMode("1v1");
        setInModeSelection(false);
        setShowResultPopup(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        onLifecycleChange?.("playing");
        onScoreUpdate?.(0);
      }
    },
    [onLifecycleChange, onScoreUpdate]
  );

  const handleReturnToModes = useCallback(() => {
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    sceneRef.current = null;
    setSelectedMode("1v1");
    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange]);

  const handleRestart = useCallback(() => {
    const nextStarter = consumeStartingPlayer("brick-blast");
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    sceneRef.current?.restartMatch(nextStarter, selectedMode, botDifficulty);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [botDifficulty, onLifecycleChange, onScoreUpdate, selectedMode]);

  const handleSelectConfiguredMode = useCallback((modeId: string, value: string) => {
    if (modeId !== "bot") return;
    setSelectedMode("vs-bot");
    setBotDifficulty(value === "easy" || value === "hard" ? value : "medium");
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [onLifecycleChange, onScoreUpdate]);

  // Phaser Game instance lifecycle: mounted strictly when NOT in mode selection
  useEffect(() => {
    if (inModeSelection) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { BrickBlastScene } = await import("../game/BrickBlastScene");

      const startingPlayer = consumeStartingPlayer("brick-blast");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
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

        const scene = gameInstance.scene.add("BrickBlastScene", BrickBlastScene, true, {
          startingPlayer,
          mode: selectedMode,
          difficulty: botDifficulty,
          callbacks: {
            onScoreUpdate: (score: number) => {
              if (!isMounted) return;
              onScoreUpdate?.(score);
            },
            onLevelChange: () => {
              // Level transitions are handled internally in Phaser
            },
            onGameOver: (result: { winner: PlatformPlayer; score: number }) => {
              if (!isMounted) return;
              setGameOverResult(result);
              setShowResultPopup(true);
              onGameOver({
                winner: result.winner === "orange" ? "Orange" : "Blue",
                score: result.score,
                details: {
                  winnerColor: result.winner,
                  mode: selectedMode,
                  game: "brick-blast",
                },
              });
            },
            onLifecycleChange,
          },
        }) as import("../game/BrickBlastScene").BrickBlastScene;

        sceneRef.current = scene;

        const controller: IGameController = {
          restart: handleRestart,
          pause: () => scene.pauseGame(),
          resume: () => scene.resumeGame(),
          destroy: () => {
            gameInstance?.destroy(true);
            phaserGameRef.current = null;
          },
        };

        onReady(controller);
      });
    }

    initPhaser();

    return () => {
      isMounted = false;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [inModeSelection, selectedMode, botDifficulty, handleRestart, onGameOver, onLifecycleChange, onReady, onScoreUpdate]);

  if (inModeSelection) {
    return (
      <GameModeSelector
        gameTitle="Brick Blast"
        modes={BRICK_BLAST_MODES}
        onSelectMode={handleSelectMode}
        onSelectConfiguredMode={handleSelectConfiguredMode}
        onScreenChange={(screen) =>
          onLifecycleChange?.(screen === "config" ? "configuration" : "pre-game")
        }
        footer={PLAYER_COLOR_FOOTER}
      />
    );
  }

  const isGameOver = Boolean(gameOverResult);

  const resultMessage =
    gameOverResult?.winner === "orange"
      ? "Orange won"
      : gameOverResult?.winner === "blue"
      ? "Blue won"
      : "Match Over";

  const resultAccent =
    gameOverResult?.winner === "orange"
      ? "#e0530a"
      : gameOverResult?.winner === "blue"
      ? "#2563eb"
      : null;

  return (
    <div className="flex flex-col items-center w-full gap-2 select-none">
      {/* 2-Player Arena Container (maximizes vertical mobile viewport, zero clutter) */}
      <div className="relative w-full max-w-[380px] h-[calc(100dvh-130px)] sm:h-[600px] max-h-[640px] aspect-[360/580] rounded-2xl overflow-hidden border border-[#e6e3dc] shadow-sm bg-[#faf9f6]">
        <div
          ref={containerRef}
          className="w-full h-full touch-none"
          tabIndex={0}
          aria-label="Brick Blast 2-Player Game Arena"
        />

        {showResultPopup && !isPopupDismissed && (
          <GameResultPopup
            resultText={resultMessage}
            accentColor={resultAccent}
            onClose={() => setIsPopupDismissed(true)}
            onPlayAgain={handleRestart}
          />
        )}
      </div>

      {/* Minimal Bottom Control Bar: Modes & Reset */}
      <div className="w-full max-w-[380px] flex items-center justify-between px-1 min-h-[32px]">
        {!isGameOver ? (
          <div className="w-full flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                handleReturnToModes();
              }}
              className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
            >
              ← Modes
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                handleRestart();
              }}
              className="px-3.5 py-1 text-xs font-medium text-[#6b665f] sm:hover:text-[#1c1917] bg-white sm:hover:bg-[#faf9f6] active:bg-[#f0eee9] border border-[#e6e3dc] rounded-lg transition shadow-xs cursor-pointer"
            >
              Reset
            </button>
          </div>
        ) : isPopupDismissed ? (
          <div className="w-full flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                handleReturnToModes();
              }}
              className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
            >
              ← Modes
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                handleRestart();
              }}
              className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
            >
              Play Again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
