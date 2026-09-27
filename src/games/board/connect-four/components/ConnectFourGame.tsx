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
import { soundManager } from "@/platform/audio";
import { getLandingRow, isColumnFull, isValidColumn } from "../logic/rules";
import {
  calculateRowGeometry,
  createInitialDropPhysics,
  stepDropPhysics,
} from "../logic/dropPhysics";
import type { Player } from "../logic/types";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";

interface SessionConfig {
  mode: "1v1" | "vs-bot";
  difficulty: BotDifficulty;
}

interface ActiveDrop {
  column: number;
  targetRow: number;
  player: Player;
  targetY: number;
  startY: number;
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
  const [activeDrop, setActiveDrop] = useState<ActiveDrop | null>(null);
  const [dropStartY, setDropStartY] = useState<number>(0);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [focusedCol, setFocusedCol] = useState<number | null>(null);

  const isDropActiveRef = useRef<boolean>(false);
  const fallingDiscRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const columnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resultSoundGuardRef = useRef(createResultSoundGuard());

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  useEffect(() => {
    return () => {
      terminateBotWorker();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
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

  const executeMove = useCallback(
    (col: number) => {
      if (inModeSelection || isGameOver) return;
      if (isDropActiveRef.current) return;
      if (!isValidColumn(col) || isColumnFull(state.columnCounts, col)) return;

      const targetRow = getLandingRow(state.columnCounts, col);
      if (targetRow < 0) return;

      // Mark drop active immediately to prevent duplicate moves/clicks
      isDropActiveRef.current = true;

      // Play drop-ball sound exactly once for each valid move
      soundManager.play("dropBall");

      // Measure column geometry for physics
      const colEl = columnRefs.current[col];
      const columnHeight = colEl?.clientHeight ?? 300;
      const cellDiameter =
        colEl?.firstElementChild?.clientHeight ?? Math.round(columnHeight / 7);

      const { startY, getTargetY } = calculateRowGeometry(columnHeight, cellDiameter);
      const targetY = getTargetY(targetRow);

      setDropStartY(startY);
      setActiveDrop({
        column: col,
        targetRow,
        player: state.currentPlayer,
        targetY,
        startY,
      });
    },
    [inModeSelection, isGameOver, state.columnCounts, state.currentPlayer]
  );

  // Active falling disc animation loop (60 FPS, direct transform update, no React re-render per frame)
  useEffect(() => {
    if (!activeDrop) return;

    let physicsState = createInitialDropPhysics(activeDrop.startY);
    let lastTime = performance.now();

    if (fallingDiscRef.current) {
      fallingDiscRef.current.style.transform = `translate3d(0, ${physicsState.y}px, 0)`;
    }

    const animate = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      physicsState = stepDropPhysics(physicsState, activeDrop.targetY, dt);

      if (fallingDiscRef.current) {
        fallingDiscRef.current.style.transform = `translate3d(0, ${physicsState.y}px, 0)`;
      }

      if (!physicsState.isFinished) {
        animFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        const completedCol = activeDrop.column;
        animFrameIdRef.current = null;
        isDropActiveRef.current = false;
        setActiveDrop(null);
        dispatch({ type: "DROP", column: completedCol });
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      isDropActiveRef.current = false;
    };
  }, [activeDrop]);

  const startFreshMatch = useCallback(() => {
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    isDropActiveRef.current = false;
    setActiveDrop(null);

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
      resultSoundGuardRef.current.reset();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      isDropActiveRef.current = false;
      setActiveDrop(null);

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
      resultSoundGuardRef.current.reset();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      isDropActiveRef.current = false;
      setActiveDrop(null);

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
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    isDropActiveRef.current = false;
    setActiveDrop(null);

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
      const resultSound = resultSoundGuardRef.current.claim(
        getResultSound({
          mode: sessionConfig.mode,
          winner: state.winner,
          humanPlayer: "R",
        })
      );
      if (resultSound === "victory") soundManager.playVictory();
      if (resultSound === "lose") soundManager.playLose();

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

  // Bot move synchronization: only triggers when it is bot's turn AND no disc is currently dropping
  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "vs-bot" ||
      state.status !== "in_progress" ||
      state.currentPlayer !== "Y" ||
      activeDrop !== null
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
          executeMove(bestMove);
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
  }, [
    inModeSelection,
    sessionConfig,
    state.status,
    state.currentPlayer,
    state.board,
    state.columnCounts,
    activeDrop,
    executeMove,
  ]);

  const handleColumnClick = (column: number) => {
    if (inModeSelection || isGameOver || isDropActiveRef.current) return;
    if (sessionConfig.mode === "vs-bot" && state.currentPlayer === "Y") return;
    executeMove(column);
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

      <div className="active-board-connect relative">
        {/* Layer 1: Base board with interactive buttons and static discs (z-0) */}
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
                  onMouseEnter={() => setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  onFocus={() => setFocusedCol(col)}
                  onBlur={() => setFocusedCol(null)}
                  disabled={isDisabled}
                  aria-label={`Column ${col + 1}${isColFull ? ", full" : `, ${count} of 6 discs filled`}`}
                  className="flex flex-col justify-between h-full p-0 bg-transparent border-0 rounded-xl cursor-pointer disabled:cursor-not-allowed group focus-visible:outline-none transition-transform"
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

        {/* Layer 2: Falling Disc Overlay (z-10, pointer-events-none, overflow-visible) */}
        {activeDrop && (
          <div className="absolute inset-0 p-2 sm:p-3 pointer-events-none z-10 overflow-visible">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 h-full">
              {Array.from({ length: 7 }).map((_, col) => (
                <div key={col} className="relative h-full">
                  {col === activeDrop.column && (
                    <div
                      ref={fallingDiscRef}
                      className={`absolute top-0 left-0 w-full aspect-square rounded-full ${
                        activeDrop.player === "R"
                          ? "bg-[#e0530a] shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                          : "bg-[#2563eb] shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                      }`}
                      style={{
                        transform: `translate3d(0, ${dropStartY}px, 0)`,
                        willChange: "transform",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Layer 3: Foreground Board Plate with Circular Cutouts (z-20, pointer-events-none, rounded-2xl) */}
        <div className="absolute inset-0 p-2 sm:p-3 pointer-events-none z-20 rounded-2xl border border-[#e6e3dc]">
          {/* Edge border plates covering padding perimeter cleanly without overlapping discs */}
          <div className="absolute top-0 left-0 right-0 h-2 sm:h-3 bg-[#faf9f6] rounded-t-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-2 sm:h-3 bg-[#faf9f6] rounded-b-2xl pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-0 w-2 sm:w-3 bg-[#faf9f6] rounded-l-2xl pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-2 sm:w-3 bg-[#faf9f6] rounded-r-2xl pointer-events-none" />

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 h-full">
            {Array.from({ length: 7 }).map((_, col) => {
              const isColHovered =
                hoveredCol === col &&
                state.status === "in_progress" &&
                !(sessionConfig.mode === "vs-bot" && state.currentPlayer === "Y") &&
                state.columnCounts[col] < 6 &&
                !activeDrop;

              const isColFocused = focusedCol === col;

              return (
                <div
                  key={col}
                  className={`flex flex-col justify-between h-full rounded-xl transition-all duration-150 ${
                    isColFocused ? "ring-2 ring-[#1c1917] ring-offset-1" : ""
                  } ${isColHovered ? "bg-[#1c1917]/[0.02]" : ""}`}
                >
                  {Array.from({ length: 6 }).map((_, row) => {
                    const idx = row * 7 + col;
                    const isWinningCell = winningIndices?.has(idx) ?? false;

                    return (
                      <div
                        key={row}
                        className="relative w-full aspect-square"
                        style={{
                          background:
                            "radial-gradient(circle closest-side, transparent 0%, transparent 100%, #faf9f6 100.5%)",
                          boxShadow: "0 0 0 3px #faf9f6",
                        }}
                      >
                        <div
                          className={`w-full h-full rounded-full border-2 border-[#e6e3dc]/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] transition-all duration-150 ${
                            isWinningCell ? "ring-2 ring-[#1c1917] ring-offset-1" : ""
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Winning line (z-30) */}
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
