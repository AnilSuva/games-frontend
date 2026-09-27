"use client";

import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { createInitialState, connectFourReducer } from "../logic/reducer";
import { requestBotMove, terminateBotWorker, type BotDifficulty } from "../bot/botService";
import { consumeStartingPlayer } from "@/games/common/startingPlayer";
import { ConnectFourCell } from "./ConnectFourCell";
import { WinningLine } from "./WinningLine";

interface SessionConfig {
  mode: "1v1" | "vs-bot";
  difficulty: BotDifficulty;
}

const CONNECT_FOUR_MODES: GameModeOption[] = [
  { id: "1v1", label: "1v1", description: "Local 2-Player" },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Connect Four",
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

export default function ConnectFourGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    mode: "1v1",
    difficulty: "medium",
  });

  const [showResultPopup, setShowResultPopup] = useState<boolean>(false);
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  const [state, dispatch] = useReducer(connectFourReducer, undefined, createInitialState);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const columnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    return () => {
      terminateBotWorker();
    };
  }, []);

  const handleColumnKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentCol: number) => {
      let targetCol = currentCol;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        targetCol = Math.max(0, currentCol - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        targetCol = Math.min(6, currentCol + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        targetCol = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        targetCol = 6;
      }

      if (targetCol !== currentCol) {
        columnRefs.current[targetCol]?.focus();
      }
    },
    []
  );

  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  const isGameOver = state.status === "won" || state.status === "draw";

  useEffect(() => {
    if (!isGameOver) return;
    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isGameOver]);

  useEffect(() => {
    if (inModeSelection || isGameOver) {
      onTurnChange?.(null);
    } else {
      onTurnChange?.(state.currentPlayer === "R" ? "X" : "O");
    }
  }, [inModeSelection, isGameOver, state.currentPlayer, onTurnChange]);

  const startFreshMatch = useCallback(() => {
    botAbortControllerRef.current?.abort();
    const starter = consumeStartingPlayer("connect-four");
    const startingPlayer = starter === "orange" ? "R" : "Y";
    dispatch({ type: "RESET", startingPlayer });
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [onLifecycleChange, onScoreUpdate]);

  const handleSelectMode = useCallback(
    (modeId: string) => {
      botAbortControllerRef.current?.abort();
      if (modeId === "1v1") {
        setSessionConfig({ mode: "1v1", difficulty: "medium" });
      }
      const starter = consumeStartingPlayer("connect-four");
      const startingPlayer = starter === "orange" ? "R" : "Y";
      dispatch({ type: "RESET", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [onLifecycleChange, onScoreUpdate]
  );

  const handleSelectConfiguredMode = useCallback(
    (_modeId: string, configValue: string) => {
      botAbortControllerRef.current?.abort();
      setSessionConfig({
        mode: "vs-bot",
        difficulty: configValue as BotDifficulty,
      });
      const starter = consumeStartingPlayer("connect-four");
      const startingPlayer = starter === "orange" ? "R" : "Y";
      dispatch({ type: "RESET", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [onLifecycleChange, onScoreUpdate]
  );

  const handleReturnToModes = useCallback(() => {
    botAbortControllerRef.current?.abort();
    setInModeSelection(true);
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  useEffect(() => {
    const controller: IGameController = {
      restart: startFreshMatch,
    };
    onReady(controller);
    return () => {
      botAbortControllerRef.current?.abort();
    };
  }, [startFreshMatch, onReady]);

  useEffect(() => {
    if (state.status === "won" || state.status === "draw") {
      onLifecycleChange?.("finished");
      const score = state.status === "draw" ? 50 : state.winner === "R" ? 100 : 0;
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

  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "vs-bot" ||
      state.status !== "in_progress" ||
      state.currentPlayer !== "Y"
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;

    requestBotMove(state.board, state.columnCounts, "Y", {
      difficulty: sessionConfig.difficulty,
      delayMs: 300,
      signal: abortController.signal,
    })
      .then((bestMove) => {
        if (!abortController.signal.aborted && bestMove >= 0) {
          dispatch({ type: "DROP", column: bestMove });
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
  }, [inModeSelection, sessionConfig, state.status, state.currentPlayer, state.board, state.columnCounts]);

  const handleColumnClick = (column: number) => {
    if (inModeSelection || isGameOver) return;
    if (sessionConfig.mode === "vs-bot" && state.currentPlayer === "Y") return;
    dispatch({ type: "DROP", column });
  };

  if (inModeSelection) {
    return (
      <GameModeSelector
        gameTitle="Connect Four"
        modes={CONNECT_FOUR_MODES}
        onSelectMode={handleSelectMode}
        onSelectConfiguredMode={handleSelectConfiguredMode}
        onScreenChange={(screen) =>
          onLifecycleChange?.(screen === "config" ? "configuration" : "pre-game")
        }
        footer={PLAYER_COLOR_FOOTER}
      />
    );
  }

  const winningIndices = state.winningLine ? new Set(state.winningLine.line) : null;

  const resultMessage =
    state.status === "won"
      ? state.winner === "R"
        ? "Orange won"
        : "Blue won"
      : "Draw";

  const resultAccent =
    state.status === "draw"
      ? null
      : state.winner === "R"
        ? "#e0530a"
        : "#2563eb";

  return (
    <div className="flex flex-col items-center w-full gap-4 p-2 select-none">
      <div className="sr-only" role="status" aria-live="polite">
        {isGameOver
          ? resultMessage
          : `Player ${state.currentPlayer === "R" ? "1 (Orange)" : "2 (Blue)"}'s turn`}
      </div>

      <div className="relative w-full max-w-[360px] sm:max-w-[400px]">
        <div
          className="w-full p-2 sm:p-3 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm aspect-[7/6]"
          role="region"
          aria-label="Connect Four Board"
        >
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 h-full">
            {Array.from({ length: 7 }).map((_, col) => {
              const count = state.columnCounts[col];
              const isColFull = count >= 6;
              const isDisabled =
                state.status !== "in_progress" ||
                (sessionConfig.mode === "vs-bot" && state.currentPlayer === "Y") ||
                isColFull;

              return (
                <button
                  key={col}
                  ref={(el) => {
                    columnRefs.current[col] = el;
                  }}
                  type="button"
                  onClick={() => handleColumnClick(col)}
                  onKeyDown={(e) => handleColumnKeyDown(e, col)}
                  disabled={isDisabled}
                  aria-label={`Column ${col + 1}${isColFull ? ", full" : `, ${count} of 6 discs filled`}`}
                  className="flex flex-col justify-between h-full p-0 bg-transparent border-0 rounded-xl cursor-pointer disabled:cursor-not-allowed group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] focus-visible:ring-offset-2 transition-transform"
                >
                  {Array.from({ length: 6 }).map((_, row) => {
                    const idx = row * 7 + col;
                    const value = state.board[idx];
                    const isWinningCell = winningIndices?.has(idx) ?? false;

                    return (
                      <ConnectFourCell
                        key={row}
                        value={value}
                        isWinningCell={isWinningCell}
                      />
                    );
                  })}
                </button>
              );
            })}
          </div>
        </div>

        {state.winningLine && (
          <WinningLine
            winningLine={state.winningLine}
            winner={state.winner}
          />
        )}

        {isGameOver && showResultPopup && !isPopupDismissed && (
          <GameResultPopup
            resultText={resultMessage}
            accentColor={resultAccent}
            onClose={() => setIsPopupDismissed(true)}
            onPlayAgain={startFreshMatch}
          />
        )}
      </div>

      <div className="w-full max-w-[360px] sm:max-w-[400px] flex items-center justify-between px-1 min-h-[32px]">
        {!isGameOver ? (
          <div className="w-full flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleReturnToModes}
              className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
            >
              ← Modes
            </button>

            <button
              type="button"
              onClick={startFreshMatch}
              className="px-3.5 py-1 text-xs font-medium text-[#6b665f] sm:hover:text-[#1c1917] bg-white sm:hover:bg-[#faf9f6] active:bg-[#f0eee9] border border-[#e6e3dc] rounded-lg transition shadow-xs cursor-pointer"
            >
              Reset
            </button>
          </div>
        ) : isPopupDismissed ? (
          <div className="w-full flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleReturnToModes}
              className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
            >
              ← Modes
            </button>

            <button
              type="button"
              onClick={startFreshMatch}
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