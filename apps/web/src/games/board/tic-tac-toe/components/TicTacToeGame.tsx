"use client";

import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { createInitialState, ticTacToeReducer } from "../logic/reducer";
import { requestBotMove, type BotDifficulty } from "../bot/botService";
import { consumeStartingPlayer } from "@/games/common/startingPlayer";
import { TicTacToeCell } from "./TicTacToeCell";
import { WinningStrike } from "./WinningStrike";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";

interface SessionConfig {
  mode: "1v1" | "vs-bot";
  difficulty: BotDifficulty;
}

// ─── Mode definitions for the shared GameModeSelector ────────────────────────

const TIC_TAC_TOE_MODES: GameModeOption[] = [
  { id: "1v1", label: "1v1", description: "Local 2-Player" },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Tic-Tac-Toe",
      subtitle: "Bot Difficulty",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      sliderLabel: "Bot Difficulty",
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
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue
    </span>
  </div>
);

export default function TicTacToeGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  // Flag determining whether mode selection overlay is active
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    mode: "1v1",
    difficulty: "medium",
  });

  const [showResultPopup, setShowResultPopup] = useState<boolean>(false);
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  const [state, dispatch] = useReducer(ticTacToeReducer, undefined, createInitialState);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());

  /** Cancels any in-flight bot request and resets the result-sound guard. */
  const cancelBotRequest = useCallback(() => {
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
  }, []);

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  // Initial lifecycle synchronization
  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  // Derived state directly from pure reducer (no cascading setState in effects)
  const isGameOver = state.status === "won" || state.status === "draw";

  // Delayed result popup sequence (1–2s delay after win or draw)
  useEffect(() => {
    if (!isGameOver) return;

    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isGameOver]);

  // Synchronize active player turn to platform frame atmosphere
  useEffect(() => {
    if (inModeSelection || isGameOver) {
      onTurnChange?.(null);
    } else {
      onTurnChange?.(state.currentPlayer);
    }
  }, [inModeSelection, isGameOver, state.currentPlayer, onTurnChange]);

  // Starts a fresh match preserving the current mode and difficulty configuration
  const startFreshMatch = useCallback(() => {
    cancelBotRequest();
    const starter = consumeStartingPlayer("tic-tac-toe");
    const startingPlayer = starter === "orange" ? "X" : "O";
    dispatch({ type: "RESET", startingPlayer });
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [cancelBotRequest, onLifecycleChange, onScoreUpdate]);

  // Mode Selection Handlers (via shared GameModeSelector)
  const handleSelectMode = useCallback(
    (modeId: string) => {
      // Only "1v1" is a direct-select mode; bot flows through handleSelectConfiguredMode
      if (modeId !== "1v1") return;
      cancelBotRequest();
      setSessionConfig({ mode: "1v1", difficulty: "medium" });
      const starter = consumeStartingPlayer("tic-tac-toe");
      const startingPlayer = starter === "orange" ? "X" : "O";
      dispatch({ type: "RESET", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [cancelBotRequest, onLifecycleChange, onScoreUpdate]
  );

  const handleSelectConfiguredMode = useCallback(
    (_modeId: string, configValue: string) => {
      cancelBotRequest();
      setSessionConfig({
        mode: "vs-bot",
        difficulty: configValue as BotDifficulty,
      });
      const starter = consumeStartingPlayer("tic-tac-toe");
      const startingPlayer = starter === "orange" ? "X" : "O";
      dispatch({ type: "RESET", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [cancelBotRequest, onLifecycleChange, onScoreUpdate]
  );

  const handleReturnToModes = useCallback(() => {
    botAbortControllerRef.current?.abort();
    setInModeSelection(true);
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  // Connect platform pause/restart controller
  useEffect(() => {
    const controller: IGameController = {
      restart: startFreshMatch,
    };
    onReady(controller);

    return () => {
      botAbortControllerRef.current?.abort();
    };
  }, [startFreshMatch, onReady]);

  // Synchronize game over to external platform callbacks
  useEffect(() => {
    if (state.status === "won" || state.status === "draw") {
      const resultSound = resultSoundGuardRef.current.claim(
        getResultSound({
          mode: sessionConfig.mode,
          winner: state.winner,
          humanPlayer: "X",
        })
      );
      if (resultSound === "victory") soundManager.playVictory();
      if (resultSound === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score = state.winner === "X" ? 100 : state.winner === "O" ? 0 : 50;
      onScoreUpdate?.(score);
      onGameOver({
        winner: state.winner,
        score,
        details: {
          mode: sessionConfig.mode,
          difficulty: sessionConfig.difficulty,
        },
      });
    }
  }, [state.status, state.winner, sessionConfig, onGameOver, onScoreUpdate, onLifecycleChange]);

  // Bot Turn Automation
  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "vs-bot" ||
      state.status !== "in_progress" ||
      state.currentPlayer !== "O"
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;

    requestBotMove(state.board, "O", {
      difficulty: sessionConfig.difficulty,
      delayMs: 320,
      signal: abortController.signal,
    })
      .then((bestMove) => {
        if (!abortController.signal.aborted && bestMove >= 0) {
          dispatch({ type: "MAKE_MOVE", cellIndex: bestMove });
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Bot calculation error:", err);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [inModeSelection, sessionConfig, state.status, state.currentPlayer, state.board]);

  const handleCellClick = (index: number) => {
    if (inModeSelection || isGameOver) return;
    if (sessionConfig.mode === "vs-bot" && state.currentPlayer === "O") return;
    dispatch({ type: "MAKE_MOVE", cellIndex: index });
  };

  // If in initial mode selection overlay, render clean selection surface
  if (inModeSelection) {
    return (
      <GameModeSelector
        gameTitle="Tic-Tac-Toe"
        modes={TIC_TAC_TOE_MODES}
        onSelectMode={handleSelectMode}
        onSelectConfiguredMode={handleSelectConfiguredMode}
        onScreenChange={(screen) =>
          onLifecycleChange?.(screen === "config" ? "configuration" : "pre-game")
        }
        footer={PLAYER_COLOR_FOOTER}
      />
    );
  }

  const isPlayer1Turn = state.currentPlayer === "X";
  const winningIndices = state.winningLine ? new Set(state.winningLine.line) : null;

  // Concise result text for non-modal game over
  const resultMessage =
    state.status === "won"
      ? state.winner === "X"
        ? "Orange won"
        : "Blue won"
      : "Draw";

  const resultAccent =
    state.status === "draw"
      ? null
      : state.winner === "X"
        ? "#e0530a"
        : "#2563eb";

  return (
    <div className="flex flex-col items-center w-full gap-4 p-2 select-none">
      {/* Screen Reader Live Region */}
      <div className="sr-only" role="status" aria-live="polite">
        {isGameOver
          ? resultMessage
          : `${isPlayer1Turn ? "Player 1 (Orange)" : "Player 2 (Blue)"}'s turn`}
      </div>

      {/* 3x3 Board with SVG Winning Line Strike-Through */}
      <div className="active-board-square relative aspect-square">
        <div
          className="w-full h-full p-2.5 sm:p-3 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm grid grid-cols-3 gap-2.5 sm:gap-3"
          role="grid"
          aria-label="Tic-Tac-Toe Board"
        >
          {state.board.map((cellValue, idx) => (
            <TicTacToeCell
              key={idx}
              index={idx}
              value={cellValue}
              isWinningCell={winningIndices?.has(idx) ?? false}
              winner={state.winner}
              isDisabled={
                state.status !== "in_progress" ||
                (sessionConfig.mode === "vs-bot" && state.currentPlayer === "O")
              }
              onClick={handleCellClick}
            />
          ))}
        </div>

        {/* Animated Winning Strike-Through Line (drawn across winning 3 cells) */}
        {state.winningLine && (
          <WinningStrike
            winningLine={state.winningLine}
            winner={state.winner}
          />
        )}

        {/* Small Result Popup - Appears after ~1.2s delay, dismissible for position analysis */}
        {isGameOver && showResultPopup && !isPopupDismissed && (
          <GameResultPopup
            resultText={resultMessage}
            accentColor={resultAccent}
            onClose={() => setIsPopupDismissed(true)}
            onPlayAgain={startFreshMatch}
          />
        )}
      </div>

      {/* Bottom Actions Area */}
      <div className="w-full max-w-[340px] sm:max-w-[380px] flex items-center justify-between px-1 min-h-[32px]">
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
                startFreshMatch();
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
                startFreshMatch();
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
