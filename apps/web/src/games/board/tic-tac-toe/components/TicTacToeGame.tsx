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
import { useOnlineTicTacToe } from "@/platform/multiplayer/useOnlineTicTacToe";
import { OnlineLobby } from "./OnlineLobby";

interface SessionConfig {
  mode: "1v1" | "vs-bot" | "online";
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
    id: "online",
    label: "Online",
    description: "Play with a Friend",
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
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  // Online multiplayer hook
  const online = useOnlineTicTacToe();

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

  // Derived state directly from pure reducer (for local & bot modes)
  const isGameOver = state.status === "won" || state.status === "draw";

  // Derived state for online mode
  const isOnlineGameOver =
    sessionConfig.mode === "online" &&
    (online.gameState?.status === "won" || online.gameState?.status === "draw");

  // Delayed result popup sequence (1–2s delay after win or draw)
  useEffect(() => {
    const gameOver = sessionConfig.mode === "online" ? isOnlineGameOver : isGameOver;
    if (!gameOver) return;

    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isGameOver, isOnlineGameOver, sessionConfig.mode]);

  // Synchronize active player turn to platform frame atmosphere
  useEffect(() => {
    if (inModeSelection) {
      onTurnChange?.(null);
      return;
    }

    if (sessionConfig.mode === "online") {
      if (online.gameState && online.connectionState === "in_game" && !isOnlineGameOver) {
        onTurnChange?.(online.gameState.currentPlayer);
      } else {
        onTurnChange?.(null);
      }
    } else {
      if (isGameOver) {
        onTurnChange?.(null);
      } else {
        onTurnChange?.(state.currentPlayer);
      }
    }
  }, [
    inModeSelection,
    isGameOver,
    isOnlineGameOver,
    state.currentPlayer,
    sessionConfig.mode,
    online.gameState,
    online.connectionState,
    onTurnChange,
  ]);

  // Starts a fresh match preserving the current mode and difficulty configuration
  const startFreshMatch = useCallback(() => {
    if (sessionConfig.mode === "online") {
      online.requestRematch();
      return;
    }
    cancelBotRequest();
    const starter = consumeStartingPlayer("tic-tac-toe");
    const startingPlayer = starter === "orange" ? "X" : "O";
    dispatch({ type: "RESET", startingPlayer });
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [cancelBotRequest, onLifecycleChange, onScoreUpdate, sessionConfig.mode, online]);

  // Mode Selection Handlers (via shared GameModeSelector)
  const handleSelectMode = useCallback(
    (modeId: string) => {
      if (modeId === "1v1") {
        cancelBotRequest();
        online.disconnect();
        setSessionConfig({ mode: "1v1", difficulty: "medium" });
        const starter = consumeStartingPlayer("tic-tac-toe");
        const startingPlayer = starter === "orange" ? "X" : "O";
        dispatch({ type: "RESET", startingPlayer });
        setInModeSelection(false);
        setShowResultPopup(false);
        setIsPopupDismissed(false);
        onLifecycleChange?.("playing");
        onScoreUpdate?.(0);
        return;
      }

      if (modeId === "online") {
        cancelBotRequest();
        setSessionConfig({ mode: "online", difficulty: "medium" });
        setInModeSelection(false);
        setShowResultPopup(false);
        setIsPopupDismissed(false);
        onLifecycleChange?.("playing");
        onScoreUpdate?.(0);
        online.connect();
        return;
      }
    },
    [cancelBotRequest, onLifecycleChange, onScoreUpdate, online]
  );

  const handleSelectConfiguredMode = useCallback(
    (_modeId: string, configValue: string) => {
      cancelBotRequest();
      online.disconnect();
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
    [cancelBotRequest, onLifecycleChange, onScoreUpdate, online]
  );

  const handleReturnToModes = useCallback(() => {
    botAbortControllerRef.current?.abort();
    online.disconnect();
    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange, online]);

  const handleHomeExit = useCallback(() => {
    online.exitMatch();
  }, [online]);

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

  // Synchronize local / bot game over to external platform callbacks
  useEffect(() => {
    if (sessionConfig.mode === "online") return;

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

  // Synchronize online game over and sound behavior
  useEffect(() => {
    if (sessionConfig.mode !== "online" || !online.gameState) return;
    const status = online.gameState.status;

    if (status === "won") {
      const isWinner = online.isWinner;
      const soundType = isWinner ? "victory" : "lose";
      const sound = onlineResultSoundGuardRef.current.claim(soundType);
      if (sound === "victory") soundManager.playVictory();
      if (sound === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score = isWinner ? 100 : 0;
      onScoreUpdate?.(score);
      onGameOver({
        winner: online.winnerMark,
        score,
        details: {
          mode: "online",
          resultReason: online.resultReason ?? "win",
        },
      });
    } else if (status === "draw") {
      // Draw: no result sound
      onLifecycleChange?.("finished");
      onScoreUpdate?.(50);
      onGameOver({
        winner: null,
        score: 50,
        details: { mode: "online" },
      });
    } else if (status === "in_progress") {
      onlineResultSoundGuardRef.current.reset();
      onLifecycleChange?.("playing");
    }
  }, [
    sessionConfig.mode,
    online.gameState?.status,
    online.isWinner,
    online.winnerMark,
    onGameOver,
    onScoreUpdate,
    onLifecycleChange,
    online.gameState,
    online.resultReason,
  ]);

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

  // ─── ONLINE MODE LOBBY / BOARD RENDERING ───────────────────────────────────

  if (sessionConfig.mode === "online") {
    const isInOnlineMatch =
      (online.connectionState === "in_game" || online.connectionState === "game_over") &&
      Boolean(online.gameState);

    if (!isInOnlineMatch) {
      return (
        <OnlineLobby
          connectionState={online.connectionState}
          room={online.room}
          errorMessage={online.errorMessage}
          onCreateRoom={online.createRoom}
          onJoinRoom={online.joinRoom}
          onLeaveRoom={online.leaveRoom}
          onReturnToModes={handleReturnToModes}
        />
      );
    }

    const onlineWinningIndices = online.gameState?.winningLine
      ? new Set(online.gameState.winningLine.line)
      : null;

    const isDisconnectForfeit = online.resultReason === "disconnect_forfeit";

    const onlineResultMessage =
      online.gameState?.status === "won"
        ? online.isWinner
          ? isDisconnectForfeit
            ? "Opponent forfeit (disconnected)"
            : "You won!"
          : isDisconnectForfeit
          ? "You forfeit (disconnected)"
          : "Opponent won"
        : "Draw";

    const onlineResultAccent =
      online.gameState?.status === "draw"
        ? null
        : online.winnerMark === "X"
        ? "#e0530a"
        : "#2563eb";

    return (
      <div className="flex flex-col items-center w-full gap-3 p-2 select-none">
        {/* Screen Reader Live Region */}
        <div className="sr-only" role="status" aria-live="polite">
          {isOnlineGameOver
            ? onlineResultMessage
            : `${online.isMyTurn ? "Your" : "Opponent's"} turn`}
        </div>

        {/* Online Header: Player identity, turn indicator, opponent status */}
        <div className="flex items-center justify-between w-full max-w-[340px] sm:max-w-[380px] px-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: online.myMark === "X" ? "#e0530a" : "#2563eb",
              }}
            />
            <span className="text-[#1c1917] font-semibold">
              You: {online.myMark === "X" ? "Orange (X)" : "Blue (O)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!online.isOpponentConnected ? (
              <span className="text-[11px] text-[#e0530a] font-medium animate-pulse">
                Opponent disconnected
              </span>
            ) : online.gameState?.status === "in_progress" ? (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  online.isMyTurn
                    ? "bg-[#fef3c7] text-[#92400e]"
                    : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                {online.isMyTurn ? "Your Turn" : "Opponent's Turn"}
              </span>
            ) : null}
          </div>
        </div>

        {/* Opponent Disconnected 30-Second Forfeit Countdown Banner */}
        {online.disconnectGraceSecondsRemaining !== null && !isOnlineGameOver && (
          <div className="w-full max-w-[340px] sm:max-w-[380px] px-3 py-2 bg-[#fff7ed] border border-[#fed7aa] rounded-xl flex items-center justify-between text-xs text-[#c2410c] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ea580c] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ea580c]" />
              </span>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-[#9a3412]">Opponent disconnected</span>
                <span className="text-[11px] text-[#c2410c]">Waiting for reconnect...</span>
              </div>
            </div>
            <div className="font-mono text-xs font-bold tracking-wider text-[#ea580c] bg-white px-2 py-1 rounded-lg border border-[#fed7aa] shadow-2xs">
              00:{String(online.disconnectGraceSecondsRemaining).padStart(2, "0")}
            </div>
          </div>
        )}

        {/* 3x3 Board with SVG Winning Line Strike-Through */}
        <div className="active-board-square relative aspect-square">
          <div
            className="w-full h-full p-2.5 sm:p-3 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm grid grid-cols-3 gap-2.5 sm:gap-3"
            role="grid"
            aria-label="Tic-Tac-Toe Board"
          >
            {online.gameState?.board.map((cellValue, idx) => (
              <TicTacToeCell
                key={idx}
                index={idx}
                value={cellValue}
                isWinningCell={onlineWinningIndices?.has(idx) ?? false}
                winner={online.winnerMark}
                isDisabled={
                  online.gameState?.status !== "in_progress" ||
                  !online.isMyTurn ||
                  !online.isOpponentConnected ||
                  online.isMatchPaused ||
                  cellValue !== null
                }
                onClick={(i) => {
                  if (online.isMyTurn && !online.isMatchPaused && online.gameState?.board[i] === null) {
                    soundManager.play("buttonClick");
                    online.sendMove(i);
                  }
                }}
              />
            ))}
          </div>

          {/* Animated Winning Strike-Through Line */}
          {online.gameState?.winningLine && (
            <WinningStrike
              winningLine={online.gameState.winningLine}
              winner={online.winnerMark}
            />
          )}

          {/* Result Popup - Appears after delay */}
          {isOnlineGameOver && showResultPopup && !isPopupDismissed && (
            <GameResultPopup
              resultText={onlineResultMessage}
              accentColor={onlineResultAccent}
              onClose={() => setIsPopupDismissed(true)}
              onPlayAgain={() => {
                soundManager.play("buttonClick");
                online.requestRematch();
              }}
              onHome={handleHomeExit}
              playAgainText={
                online.hasRequestedRematch
                  ? "Waiting for opponent..."
                  : online.opponentRequestedRematch
                  ? "Accept Rematch"
                  : "Play Again"
              }
            />
          )}
        </div>

        {/* Bottom Actions Area */}
        <div className="w-full max-w-[340px] sm:max-w-[380px] flex items-center justify-between px-1 min-h-[32px]">
          {!isOnlineGameOver ? (
            <div className="w-full flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  soundManager.play("buttonClick");
                  online.leaveRoom();
                  handleReturnToModes();
                }}
                className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
              >
                ← Leave Room
              </button>

              <span className="text-[11px] font-mono text-[#9c978e]">
                Room: {online.room?.roomCode}
              </span>
            </div>
          ) : isPopupDismissed ? (
            <div className="w-full flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  soundManager.play("buttonClick");
                  online.leaveRoom();
                  handleReturnToModes();
                }}
                className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
              >
                ← Leave Room
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.play("buttonClick");
                  online.requestRematch();
                }}
                className="text-[11px] text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1"
              >
                {online.hasRequestedRematch
                  ? "Waiting for opponent..."
                  : online.opponentRequestedRematch
                  ? "Accept Rematch"
                  : "Play Again"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── LOCAL 1v1 & BOT MODE BOARD RENDERING ──────────────────────────────────

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

