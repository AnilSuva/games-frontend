"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { soundManager } from "@/platform/audio";
import { lightFingersAudio } from "../audio/lightFingersAudio";
import { createInitialState, gameReducer } from "../logic/gameLogic";
import { BotBrain } from "../bot/botBrain";
import { LightFingersCanvas } from "./LightFingersCanvas";
import type { LightFingersState, LightFingersMode, PlayerId } from "../logic/types";
import type { BotDifficulty } from "../config/constants";

const LIGHT_FINGERS_MODES: GameModeOption[] = [
  {
    id: "1v1",
    label: "1v1",
    description: "Local 2-Player (Same Screen Duel)",
  },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot reaction speed and max simultaneous fingers",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Game",
    },
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center justify-center gap-3 text-[11px] text-[#9c978e]">
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue Vault (Top)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange Vault (Bottom)
    </span>
  </div>
);

export default function LightFingersGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  // Mode selection state
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<LightFingersMode>("1v1");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  // Active game state
  const [gameState, setGameState] = useState<LightFingersState>(() =>
    createInitialState("1v1", "medium")
  );

  const gameStateRef = useRef<LightFingersState>(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const botBrainRef = useRef<BotBrain>(new BotBrain("medium"));
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

  // Pre-game lifecycle notification
  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  // Restart match handler
  const handleRestart = useCallback(() => {
    soundManager.play("buttonClick");
    const freshState = createInitialState(selectedMode, difficulty);
    botBrainRef.current.reset(difficulty);
    setGameState(freshState);
    gameStateRef.current = freshState;
    setIsPopupDismissed(false);
    callbacksRef.current.onLifecycleChange?.("playing");
  }, [selectedMode, difficulty]);

  // Expose controller to platform
  useEffect(() => {
    const controller: IGameController = {
      restart: handleRestart,
      pause: () => {},
      resume: () => {},
    };
    onReady(controller);
  }, [onReady, handleRestart]);

  // Start selected match
  const handleStartGame = useCallback(
    (modeId: string, diffSetting?: string) => {
      soundManager.play("buttonClick");
      const mode = modeId as LightFingersMode;
      const diff = (diffSetting as BotDifficulty) || "medium";

      setSelectedMode(mode);
      setDifficulty(diff);
      setInModeSelection(false);
      setIsPopupDismissed(false);

      botBrainRef.current.reset(diff);
      const freshState = createInitialState(mode, diff);
      setGameState(freshState);
      gameStateRef.current = freshState;
      callbacksRef.current.onLifecycleChange?.("playing");
    },
    []
  );

  // Core Simulation Loop (60 FPS)
  useEffect(() => {
    if (inModeSelection) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const currentState = gameStateRef.current;
      if (currentState.status === "playing") {
        let stateAfterTick = gameReducer(currentState, { type: "TICK", dt });

        // Process audio events
        if (stateAfterTick.recentEvents && stateAfterTick.recentEvents.length > 0) {
          for (const ev of stateAfterTick.recentEvents) {
            if (ev.kind === "coin_collected") {
              lightFingersAudio.playCoinSound();
            } else if (ev.kind === "banknote_collected") {
              lightFingersAudio.playBanknoteSound();
            } else if (ev.kind === "banknote_ripped") {
              lightFingersAudio.playRipSound();
            } else if (ev.kind === "item_grabbed") {
              lightFingersAudio.playGrabSound();
            }
          }
        }

        // Run Bot AI if in bot mode
        if (stateAfterTick.mode === "bot" && stateAfterTick.status === "playing") {
          const botActions = botBrainRef.current.update(stateAfterTick, dt);
          for (const action of botActions) {
            stateAfterTick = gameReducer(stateAfterTick, action);
          }
        }

        // Check for Game Over transition
        if (stateAfterTick.status === "finished" && currentState.status === "playing") {
          callbacksRef.current.onLifecycleChange?.("finished");
          callbacksRef.current.onScoreUpdate?.(
            Math.max(stateAfterTick.score.orange, stateAfterTick.score.blue)
          );

          if (stateAfterTick.mode === "bot") {
            if (stateAfterTick.winner === "orange") {
              lightFingersAudio.playVictory();
            } else {
              lightFingersAudio.playDefeat();
            }
          } else {
            lightFingersAudio.playVictory();
          }

          callbacksRef.current.onGameOver({
            winner: stateAfterTick.winner || "draw",
            score: Math.max(stateAfterTick.score.orange, stateAfterTick.score.blue),
            details: {
              orangeScore: stateAfterTick.score.orange,
              blueScore: stateAfterTick.score.blue,
              mode: stateAfterTick.mode,
              difficulty: stateAfterTick.difficulty,
            },
          });
        }

        setGameState(stateAfterTick);
        gameStateRef.current = stateAfterTick;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [inModeSelection]);

  // Pointer input dispatches
  const handlePointerDown = useCallback((playerId: PlayerId, touchId: number, x: number, y: number) => {
    setGameState((prev) => {
      const next = gameReducer(prev, {
        type: "POINTER_DOWN",
        playerId,
        touchId,
        x,
        y,
      });
      gameStateRef.current = next;
      return next;
    });
  }, []);

  const handlePointerMove = useCallback((playerId: PlayerId, touchId: number, x: number, y: number) => {
    setGameState((prev) => {
      const next = gameReducer(prev, {
        type: "POINTER_MOVE",
        playerId,
        touchId,
        x,
        y,
      });
      gameStateRef.current = next;
      return next;
    });
  }, []);

  const handlePointerUp = useCallback((playerId: PlayerId, touchId: number) => {
    setGameState((prev) => {
      const next = gameReducer(prev, {
        type: "POINTER_UP",
        playerId,
        touchId,
      });
      gameStateRef.current = next;
      return next;
    });
  }, []);

  const handleReturnToModes = useCallback(() => {
    setInModeSelection(true);
    setIsPopupDismissed(false);
    callbacksRef.current.onLifecycleChange?.("pre-game");
  }, []);

  // Mode Selection Overlay
  if (inModeSelection) {
    return (
      <div className="relative w-full h-full min-h-[500px] flex items-center justify-center p-4">
        <GameModeSelector
          gameTitle="Light Fingers"
          modes={LIGHT_FINGERS_MODES}
          onSelectMode={(modeId) => handleStartGame(modeId as LightFingersMode)}
          onSelectConfiguredMode={(modeId, configValue) =>
            handleStartGame(modeId as LightFingersMode, configValue as BotDifficulty)
          }
          footer={PLAYER_COLOR_FOOTER}
        />
      </div>
    );
  }

  // Result titles
  let winnerTitle = "Round Over";
  if (gameState.status === "finished") {
    if (gameState.mode === "bot") {
      winnerTitle = gameState.winner === "orange" ? "You Won!" : "Bot Won!";
    } else {
      winnerTitle =
        gameState.winner === "orange"
          ? "Orange Won!"
          : gameState.winner === "blue"
          ? "Blue Won!"
          : "It's a Draw!";
    }
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 bg-[#f4f3ef] overflow-hidden select-none">
      <LightFingersCanvas
        state={gameState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Footer controls: Modes & Reset */}
      <footer className="w-full flex items-center justify-between text-xs text-[#78746d] mt-2 px-2 max-w-[560px]">
        <button
          type="button"
          onClick={handleReturnToModes}
          className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Modes
        </button>

        <span className="text-[11px] font-medium">
          {selectedMode === "1v1"
            ? "Split Touch 1v1 • First to 15"
            : `Bot (${difficulty}) • First to 15`}
        </span>

        <button
          type="button"
          onClick={handleRestart}
          className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Reset
        </button>
      </footer>

      {/* Result Popup */}
      {gameState.status === "finished" && !isPopupDismissed && (
        <GameResultPopup
          resultText={winnerTitle}
          accentColor={
            gameState.winner === "orange"
              ? "#e0530a"
              : gameState.winner === "blue"
              ? "#2563eb"
              : null
          }
          onPlayAgain={handleRestart}
          onClose={() => setIsPopupDismissed(true)}
          onHome={handleReturnToModes}
        />
      )}
    </div>
  );
}
