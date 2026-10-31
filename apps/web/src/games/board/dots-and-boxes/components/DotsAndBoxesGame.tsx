"use client";

import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { createInitialState, dotsBoxesReducer } from "../logic/reducer";
import { requestBotMove, type BotDifficulty } from "../bot/botService";
import { consumeStartingPlayer } from "@/games/common/startingPlayer";
import { DotsAndBoxesBoard } from "./DotsAndBoxesBoard";
import { ScoreHeader } from "./ScoreHeader";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { useOnlineDotsBoxes } from "@/platform/multiplayer/useOnlineDotsBoxes";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import type { Edge, PlatformPlayer } from "../logic/types";
import { canClaimEdge } from "../logic/moves";

interface SessionConfig {
  mode: "1v1" | "vs-bot" | "online";
  difficulty: BotDifficulty;
}

const DOTS_BOXES_MODES: GameModeOption[] = [
  { id: "1v1", label: "Local 1v1" },
  {
    id: "bot",
    label: "You vs Bot",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot calculation depth",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Match",
    },
  },
  {
    id: "online",
    label: "Online",
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center gap-3 text-xs text-[#6b665f]">
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue
    </span>
  </div>
);

export default function DotsAndBoxesGame({
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

  const [state, dispatch] = useReducer(dotsBoxesReducer, undefined, createInitialState);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  // Online multiplayer hook
  const online = useOnlineDotsBoxes();

  const cancelBotRequest = useCallback(() => {
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
  }, []);

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  const isGameOver = state.status === "completed";
  const isOnlineGameOver =
    sessionConfig.mode === "online" &&
    (online.gameState?.status === "won" || online.gameState?.status === "draw");

  // Delayed result popup
  useEffect(() => {
    const gameOver = sessionConfig.mode === "online" ? isOnlineGameOver : isGameOver;
    if (!gameOver) return;

    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isGameOver, isOnlineGameOver, sessionConfig.mode]);

  // Turn synchronization
  useEffect(() => {
    if (inModeSelection) {
      onTurnChange?.(null);
      return;
    }

    if (sessionConfig.mode === "online") {
      if (online.gameState && online.connectionState === "in_game" && !isOnlineGameOver) {
        onTurnChange?.(online.gameState.currentPlayer === "orange" ? "X" : "O");
      } else {
        onTurnChange?.(null);
      }
    } else {
      if (isGameOver) {
        onTurnChange?.(null);
      } else {
        onTurnChange?.(state.currentPlayer === "orange" ? "X" : "O");
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

  // Online result sound observer
  useEffect(() => {
    if (sessionConfig.mode !== "online" || !online.gameState) return;

    if (online.gameState.status === "won" || online.gameState.status === "draw") {
      const soundType = online.isWinner ? "victory" : online.isLoser ? "lose" : null;
      const claimed = onlineResultSoundGuardRef.current.claim(soundType);
      if (claimed === "victory") soundManager.playVictory();
      if (claimed === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score = online.isDraw
        ? 50
        : online.isWinner
        ? 100
        : 0;
      onScoreUpdate?.(score);
      onGameOver?.({
        winner:
          online.winnerColor === "orange"
            ? "Orange"
            : online.winnerColor === "blue"
            ? "Blue"
            : "Draw",
        score,
        details: {
          mode: "online",
          winnerColor: online.winnerColor,
        },
      });
    }
  }, [
    sessionConfig.mode,
    online.gameState,
    online.isWinner,
    online.isLoser,
    online.isDraw,
    online.winnerColor,
    onLifecycleChange,
    onScoreUpdate,
    onGameOver,
  ]);

  // Local & Bot result sound observer
  useEffect(() => {
    if (sessionConfig.mode === "online") return;

    if (state.status === "completed") {
      const resultSound = resultSoundGuardRef.current.claim(
        getResultSound({
          mode: sessionConfig.mode,
          winner: state.winner === "orange" ? "X" : state.winner === "blue" ? "O" : "draw",
          humanPlayer: "X",
        })
      );
      if (resultSound === "victory") soundManager.playVictory();
      if (resultSound === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score =
        state.winner === "draw"
          ? 50
          : state.winner === "orange"
          ? 100
          : 0;
      onScoreUpdate?.(score);
      onGameOver?.({
        winner:
          state.winner === "orange"
            ? "Orange"
            : state.winner === "blue"
            ? "Blue"
            : "Draw",
        score,
        details: {
          mode: sessionConfig.mode,
          difficulty: sessionConfig.difficulty,
          scores: state.scores,
        },
      });
    }
  }, [
    state.status,
    state.winner,
    state.scores,
    sessionConfig,
    onGameOver,
    onScoreUpdate,
    onLifecycleChange,
  ]);

  // Claim edge move handler
  const handleClaimEdge = useCallback(
    (edge: Edge) => {
      if (inModeSelection || isGameOver) return;

      if (sessionConfig.mode === "online") {
        online.claimEdge(edge);
        return;
      }

      if (!canClaimEdge(state, edge)) return;

      // Check if move will complete a box before applying to pick appropriate sound
      dispatch({ type: "CLAIM_EDGE", edge });

      setTimeout(() => {
        soundManager.play("buttonClick");
      }, 0);
    },
    [inModeSelection, isGameOver, sessionConfig.mode, online, state]
  );

  // Play box completion sound when boxes scored
  const prevScoredTotalRef = useRef<number>(0);
  useEffect(() => {
    const currentScored = state.scores.orange + state.scores.blue;
    if (currentScored > prevScoredTotalRef.current) {
      soundManager.play("tileBreak");
    }
    prevScoredTotalRef.current = currentScored;
  }, [state.scores.orange, state.scores.blue]);

  // Bot move loop
  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "vs-bot" ||
      state.status !== "in_progress" ||
      state.currentPlayer !== "blue"
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;

    requestBotMove(state, {
      difficulty: sessionConfig.difficulty,
      signal: abortController.signal,
    })
      .then((move) => {
        if (!abortController.signal.aborted && move) {
          dispatch({ type: "CLAIM_EDGE", edge: move });
          soundManager.play("buttonClick");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Bot error:", err);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [inModeSelection, sessionConfig.mode, sessionConfig.difficulty, state]);

  // Fresh match starter
  const startFreshMatch = useCallback(() => {
    if (sessionConfig.mode === "online") {
      online.requestRematch();
      return;
    }

    cancelBotRequest();
    resultSoundGuardRef.current.reset();

    const starter = consumeStartingPlayer("dots-and-boxes");
    const startingPlayer: PlatformPlayer = starter === "orange" ? "orange" : "blue";

    dispatch({ type: "RESTART_GAME", startingPlayer });
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    prevScoredTotalRef.current = 0;
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [cancelBotRequest, online, sessionConfig.mode, onLifecycleChange, onScoreUpdate]);

  const handleSelectMode = useCallback(
    (modeId: string) => {
      cancelBotRequest();
      resultSoundGuardRef.current.reset();
      onlineResultSoundGuardRef.current.reset();

      if (modeId === "online") {
        setSessionConfig({ mode: "online", difficulty: "medium" });
        setInModeSelection(false);
        setShowResultPopup(false);
        setIsPopupDismissed(false);
        online.connect();
        return;
      }

      if (modeId === "1v1") {
        setSessionConfig({ mode: "1v1", difficulty: "medium" });
      }

      const starter = consumeStartingPlayer("dots-and-boxes");
      const startingPlayer: PlatformPlayer = starter === "orange" ? "orange" : "blue";

      dispatch({ type: "RESTART_GAME", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      prevScoredTotalRef.current = 0;
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [cancelBotRequest, online, onLifecycleChange, onScoreUpdate]
  );

  const handleSelectConfiguredMode = useCallback(
    (_modeId: string, configValue: string) => {
      cancelBotRequest();
      resultSoundGuardRef.current.reset();
      onlineResultSoundGuardRef.current.reset();

      setSessionConfig({
        mode: "vs-bot",
        difficulty: configValue as BotDifficulty,
      });

      const starter = consumeStartingPlayer("dots-and-boxes");
      const startingPlayer: PlatformPlayer = starter === "orange" ? "orange" : "blue";

      dispatch({ type: "RESTART_GAME", startingPlayer });
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      prevScoredTotalRef.current = 0;
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [cancelBotRequest, onLifecycleChange, onScoreUpdate]
  );

  const handleReturnToModes = useCallback(() => {
    cancelBotRequest();
    onlineResultSoundGuardRef.current.reset();
    resultSoundGuardRef.current.reset();
    if (sessionConfig.mode === "online") {
      online.leaveRoom();
    }
    setSessionConfig({ mode: "1v1", difficulty: "medium" });
    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    prevScoredTotalRef.current = 0;
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [cancelBotRequest, online, sessionConfig.mode, onLifecycleChange, onTurnChange]);

  const handleHomeExit = useCallback(() => {
    online.disconnect();
    handleReturnToModes();
  }, [online, handleReturnToModes]);

  const startFreshMatchRef = useRef(startFreshMatch);
  useEffect(() => {
    startFreshMatchRef.current = startFreshMatch;
  });

  useEffect(() => {
    const controller: IGameController = {
      restart: () => startFreshMatchRef.current(),
    };
    onReady?.(controller);
  }, [onReady]);

  // Online active match data extraction
  const onlineBoardState = online.gameState
    ? {
        config: online.gameState.config,
        horizontalEdges: online.gameState.horizontalEdges,
        verticalEdges: online.gameState.verticalEdges,
        boxes: online.gameState.boxes,
        scores: online.gameState.scores,
        currentPlayer: online.gameState.currentPlayer,
        status:
          online.gameState.status === "won" || online.gameState.status === "draw"
            ? ("completed" as const)
            : ("in_progress" as const),
        winner: online.gameState.winner,
        lastMove: online.gameState.lastMove
          ? {
              edge: online.gameState.lastMove.edge,
              edgeId: `${online.gameState.lastMove.edge.type}:${online.gameState.lastMove.edge.row}:${online.gameState.lastMove.edge.col}` as `${"h" | "v"}:${number}:${number}`,
              player: online.gameState.lastMove.player,
              completedBoxes: online.gameState.lastMove.completedBoxes,
            }
          : null,
        moveCount: online.gameState.moveCount,
        consecutiveBoxesThisTurn: online.gameState.consecutiveBoxesThisTurn,
      }
    : null;

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-[500px] p-3 sm:p-4 select-none">
      {/* 1. Mode Selection Overlay */}
      {inModeSelection && (
        <GameModeSelector
          gameTitle="Dots and Boxes"
          modes={DOTS_BOXES_MODES}
          footer={PLAYER_COLOR_FOOTER}
          onSelectMode={handleSelectMode}
          onSelectConfiguredMode={handleSelectConfiguredMode}
        />
      )}

      {/* 2. Online Match Lobby */}
      {!inModeSelection && sessionConfig.mode === "online" && online.connectionState !== "in_game" && !onlineBoardState && (
        <OnlineMatchLobby
          gameTitle="Dots and Boxes"
          connectionState={online.connectionState}
          room={online.room}
          errorMessage={online.errorMessage}
          onCreateRoom={online.createRoom}
          onJoinRoom={online.joinRoom}
          onLeaveRoom={online.leaveRoom}
          onReturnToModes={handleReturnToModes}
        />
      )}

      {/* 3. Gameplay View (Local / Bot / Active Online Match) */}
      {!inModeSelection &&
        (sessionConfig.mode !== "online" ||
          online.connectionState === "in_game" ||
          onlineBoardState) && (
          <div className="w-full max-w-[480px] flex flex-col items-center animate-in fade-in duration-300">
            {/* Header / Score Badges */}
            <ScoreHeader
              state={sessionConfig.mode === "online" && onlineBoardState ? onlineBoardState : state}
              mode={sessionConfig.mode}
              botDifficulty={sessionConfig.difficulty}
              myOnlinePlayer={sessionConfig.mode === "online" ? online.myPlayerColor : undefined}
            />

            {/* Board */}
            <DotsAndBoxesBoard
              state={sessionConfig.mode === "online" && onlineBoardState ? onlineBoardState : state}
              onClaimEdge={handleClaimEdge}
              disabled={
                sessionConfig.mode === "online"
                  ? !online.isMyTurn || online.isMatchPaused
                  : state.status === "completed" ||
                    (sessionConfig.mode === "vs-bot" && state.currentPlayer === "blue")
              }
              humanPlayer={
                sessionConfig.mode === "vs-bot"
                  ? "orange"
                  : sessionConfig.mode === "online"
                  ? online.myPlayerColor ?? undefined
                  : undefined
              }
            />

            {/* Online match paused indicator */}
            {sessionConfig.mode === "online" && online.isMatchPaused && (
              <div className="mt-3 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-medium text-center">
                Opponent disconnected. Waiting {online.remainingGraceSeconds}s for reconnection...
              </div>
            )}
          </div>
        )}

      {/* 4. Match Result Popup */}
      {showResultPopup && !isPopupDismissed && (
        <GameResultPopup
          resultText={
            sessionConfig.mode === "online"
              ? online.isDraw
                ? "Match Draw!"
                : online.isWinner
                ? "You Won!"
                : "You Lost!"
              : state.winner === "draw"
              ? "Match Draw!"
              : state.winner === "orange"
              ? "Orange Won!"
              : "Blue Won!"
          }
          accentColor={
            sessionConfig.mode === "online"
              ? online.isDraw
                ? null
                : online.winnerColor === "orange"
                ? "#e0530a"
                : "#2563eb"
              : state.winner === "orange"
              ? "#e0530a"
              : state.winner === "blue"
              ? "#2563eb"
              : null
          }
          onPlayAgain={startFreshMatch}
          onClose={() => setIsPopupDismissed(true)}
          onHome={handleHomeExit}
        />
      )}
    </div>
  );
}
