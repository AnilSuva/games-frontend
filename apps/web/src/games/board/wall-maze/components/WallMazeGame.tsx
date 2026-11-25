"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { consumeStartingPlayer } from "@/games/common/startingPlayer";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { soundManager } from "@/platform/audio";
import { useOnlineWallMaze } from "@/platform/multiplayer/useOnlineWallMaze";
import type { OnlineWallMazeState } from "@/platform/multiplayer/types";
import {
  applyAction,
  createInitialState,
  getValidPawnMoves,
  validateWallPlacement,
} from "../logic/rules";
import type {
  WallMazeAction,
  WallMazeState,
  WallOrientation,
  WallValidationReason,
} from "../logic/types";
import { requestBotMove, type BotDifficulty } from "../bot";
import { WallMazeBoard, type InteractionMode } from "./WallMazeBoard";
import { WallMazeHeader } from "./WallMazeHeader";
import { WallMazeHowToPlayModal } from "./WallMazeHowToPlayModal";

interface SessionConfig {
  mode: "local-2p" | "pvp-bot" | "online-2p";
  difficulty: BotDifficulty;
}

const WALL_MAZE_MODES: GameModeOption[] = [
  { id: "local-2p", label: "Local 2P" },
  {
    id: "pvp-bot",
    label: "You vs Bot",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot lookahead & wall strategy",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Match",
    },
  },
  { id: "online-2p", label: "Online 2P" },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center gap-3 text-xs text-[#6b665f]">
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange (P1)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue (P2)
    </span>
  </div>
);

const INVALID_REASON_LABELS: Record<WallValidationReason, string> = {
  game_over: "Match has ended",
  no_walls_left: "No walls remaining",
  out_of_bounds: "Out of bounds",
  overlap: "Overlaps existing wall",
  crossing: "Crosses existing wall",
  blocks_path: "Blocks all paths",
};

export default function WallMazeGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    mode: "local-2p",
    difficulty: "medium",
  });

  const [gameState, setGameState] = useState<WallMazeState>(() =>
    createInitialState("X")
  );
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("move");
  const [wallOrientation, setWallOrientation] = useState<WallOrientation>("h");
  const [ghostWall, setGhostWall] = useState<{ row: number; col: number } | null>(
    null
  );
  const [lastInputType, setLastInputType] = useState<string>("mouse");
  const [invalidShakeKey, setInvalidShakeKey] = useState<number>(0);

  const [showResultPopup, setShowResultPopup] = useState<boolean>(false);
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [resumeTick, setResumeTick] = useState<number>(0);

  const generationRef = useRef<number>(0);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());
  const isPausedRef = useRef<boolean>(false);
  const gameStateRef = useRef<WallMazeState>(gameState);
  const prevOnlineMoveCountRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleOnlineStateSync = useCallback(
    (nextState: OnlineWallMazeState) => {
      if (nextState.moveCount === 0) {
        if (prevOnlineMoveCountRef.current !== 0) {
          prevOnlineMoveCountRef.current = 0;
        }
        setInteractionMode("move");
        setGhostWall(null);
        setShowResultPopup(false);
        setIsPopupDismissed(false);
        if (nextState.status === "in_progress") {
          onlineResultSoundGuardRef.current.reset();
        }
        return;
      }

      if (nextState.moveCount > prevOnlineMoveCountRef.current) {
        prevOnlineMoveCountRef.current = nextState.moveCount;
        setInteractionMode("move");
        setGhostWall(null);

        if (nextState.lastAction?.type === "MOVE_PAWN") {
          soundManager.play("checkersSlide");
        } else if (nextState.lastAction?.type === "PLACE_WALL") {
          soundManager.play("golfWall");
        }
      } else if (nextState.moveCount < prevOnlineMoveCountRef.current) {
        prevOnlineMoveCountRef.current = nextState.moveCount;
        setInteractionMode("move");
        setGhostWall(null);
      }
    },
    []
  );

  const handleOnlineActionError = useCallback(() => {
    soundManager.play("tileBreak");
    setInteractionMode("move");
    setGhostWall(null);
  }, []);

  const online = useOnlineWallMaze({
    onStateSync: handleOnlineStateSync,
    onActionError: handleOnlineActionError,
  });

  const isOnlineLobby =
    sessionConfig.mode === "online-2p" &&
    (!online.gameState ||
      online.connectionState === "disconnected" ||
      online.connectionState === "connecting" ||
      online.connectionState === "identifying" ||
      online.connectionState === "creating_room" ||
      online.connectionState === "joining_room" ||
      online.connectionState === "waiting_for_opponent" ||
      online.connectionState === "connection_failed");

  const isLocalGameOver =
    sessionConfig.mode !== "online-2p" && gameState.status === "finished";
  const isOnlineGameOver =
    sessionConfig.mode === "online-2p" &&
    (online.gameState?.status === "won" ||
      online.gameState?.status === "abandoned");
  const isGameOver =
    sessionConfig.mode === "online-2p" ? isOnlineGameOver : isLocalGameOver;

  const isBotTurn =
    !inModeSelection &&
    !isGameOver &&
    sessionConfig.mode === "pvp-bot" &&
    gameState.currentPlayer === "O";

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  // Synchronize platform lifecycle when online match begins
  useEffect(() => {
    if (sessionConfig.mode !== "online-2p" || inModeSelection) return;
    if (isOnlineLobby) {
      onLifecycleChange?.("configuration");
    } else if (online.gameState?.status === "in_progress") {
      onLifecycleChange?.("playing");
    }
  }, [
    sessionConfig.mode,
    inModeSelection,
    isOnlineLobby,
    online.gameState?.status,
    onLifecycleChange,
  ]);

  // Turn atmosphere synchronization
  useEffect(() => {
    if (inModeSelection || isGameOver) {
      onTurnChange?.(null);
      return;
    }

    if (sessionConfig.mode === "online-2p") {
      if (
        online.gameState &&
        online.gameState.status === "in_progress" &&
        !isOnlineLobby &&
        !online.isMatchPaused
      ) {
        onTurnChange?.(online.gameState.currentPlayer);
      } else {
        onTurnChange?.(null);
      }
      return;
    }

    onTurnChange?.(gameState.currentPlayer);
  }, [
    inModeSelection,
    isGameOver,
    sessionConfig.mode,
    gameState.currentPlayer,
    online.gameState,
    online.isMatchPaused,
    isOnlineLobby,
    onTurnChange,
  ]);

  // Result popup slight delay so pawn finishes sliding to goal row
  useEffect(() => {
    if (!isGameOver) return;
    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 520);
    return () => clearTimeout(timer);
  }, [isGameOver]);

  // Local / Bot game over sound & platform callback
  useEffect(() => {
    if (sessionConfig.mode === "online-2p") return;
    if (gameState.status !== "finished" || !gameState.winner) return;

    const soundType = resultSoundGuardRef.current.claim(
      getResultSound({
        mode: sessionConfig.mode === "pvp-bot" ? "vs-bot" : "1v1",
        winner: gameState.winner,
        humanPlayer: "X",
      })
    );

    if (soundType === "victory") soundManager.playVictory();
    if (soundType === "lose") soundManager.playLose();

    onLifecycleChange?.("finished");

    const score =
      gameState.winner === "X"
        ? 100
        : sessionConfig.mode === "pvp-bot"
        ? 0
        : 100;

    onScoreUpdate?.(score);
    onGameOver?.({
      winner: gameState.winner === "X" ? "Orange" : "Blue",
      score,
      details: {
        mode: sessionConfig.mode,
        difficulty: sessionConfig.difficulty,
        moveCount: gameState.moveCount,
      },
    });
  }, [
    gameState.status,
    gameState.winner,
    gameState.moveCount,
    sessionConfig,
    onGameOver,
    onScoreUpdate,
    onLifecycleChange,
  ]);

  // Online game over sound & platform callback
  useEffect(() => {
    if (sessionConfig.mode !== "online-2p" || !online.gameState) return;
    if (
      online.gameState.status !== "won" &&
      online.gameState.status !== "abandoned"
    ) {
      return;
    }

    const soundType = online.isWinner
      ? "victory"
      : online.isLoser
      ? "lose"
      : null;
    const claimed = onlineResultSoundGuardRef.current.claim(soundType);

    if (claimed === "victory") soundManager.playVictory();
    if (claimed === "lose") soundManager.playLose();

    onLifecycleChange?.("finished");
    const score = online.isWinner ? 100 : 0;
    onScoreUpdate?.(score);
    onGameOver?.({
      winner:
        online.winnerMark === "X"
          ? "Orange"
          : online.winnerMark === "O"
          ? "Blue"
          : null,
      score,
      details: {
        mode: "online-2p",
        winner: online.winnerMark,
        resultReason: online.resultReason,
        moveCount: online.gameState.moveCount,
      },
    });
  }, [
    sessionConfig.mode,
    online.gameState,
    online.isWinner,
    online.isLoser,
    online.winnerMark,
    online.resultReason,
    onGameOver,
    onScoreUpdate,
    onLifecycleChange,
  ]);

  // Apply action for local/bot OR dispatch authoritative online move
  const commitAction = useCallback(
    (action: WallMazeAction) => {
      if (sessionConfig.mode === "online-2p") {
        if (action.type === "MOVE_PAWN") {
          online.movePawn(action.row, action.col);
        } else {
          online.placeWall(action.row, action.col, action.orientation);
        }
        return;
      }

      const prev = gameStateRef.current;
      const next = applyAction(prev, action);
      if (next === prev) return;

      gameStateRef.current = next;
      setGameState(next);

      if (action.type === "MOVE_PAWN") {
        soundManager.play("checkersSlide");
      } else {
        soundManager.play("golfWall");
      }

      if (action.type === "PLACE_WALL") {
        setInteractionMode("move");
        setGhostWall(null);
      }
    },
    [sessionConfig.mode, online]
  );

  // Bot turn execution with generation & abort safety
  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "pvp-bot" ||
      gameState.status !== "playing" ||
      gameState.currentPlayer !== "O" ||
      isPausedRef.current
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;
    const currentGen = generationRef.current;
    setIsBotThinking(true);

    requestBotMove(gameState, {
      difficulty: sessionConfig.difficulty,
      signal: abortController.signal,
    })
      .then((action) => {
        if (
          !action ||
          abortController.signal.aborted ||
          generationRef.current !== currentGen
        ) {
          return;
        }
        setIsBotThinking(false);
        commitAction(action);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Wall Maze bot error:", err);
          setIsBotThinking(false);
        }
      });

    return () => {
      abortController.abort();
      setIsBotThinking(false);
    };
  }, [
    inModeSelection,
    sessionConfig,
    gameState,
    resumeTick,
    commitAction,
  ]);

  // Unified board state for local/bot and authoritative online games
  const activeState: WallMazeState = useMemo(() => {
    if (sessionConfig.mode === "online-2p" && online.gameState) {
      const s = online.gameState;
      return {
        pawns: s.pawns,
        walls: s.walls,
        wallsLeft: s.wallsLeft,
        currentPlayer: s.currentPlayer,
        startingPlayer: s.startingPlayer,
        status: s.status === "in_progress" ? "playing" : "finished",
        winner: s.winner,
        moveCount: s.moveCount,
        lastAction: s.lastAction
          ? s.lastAction.type === "PLACE_WALL"
            ? {
                type: "PLACE_WALL",
                row: s.lastAction.row,
                col: s.lastAction.col,
                orientation: s.lastAction.orientation ?? "h",
              }
            : {
                type: "MOVE_PAWN",
                row: s.lastAction.row,
                col: s.lastAction.col,
              }
          : null,
      };
    }
    return gameState;
  }, [sessionConfig.mode, online.gameState, gameState]);

  const isHumanTurn =
    sessionConfig.mode === "online-2p"
      ? Boolean(
          !inModeSelection &&
            !isOnlineLobby &&
            !isGameOver &&
            online.isMyTurn &&
            !online.pendingAction &&
            !online.isMatchPaused &&
            online.isOpponentConnected
        )
      : !inModeSelection && !isGameOver && !isBotTurn;

  // Keyboard shortcuts: R rotates wall, Esc exits wall mode
  useEffect(() => {
    if (!isHumanTurn) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        if (interactionMode === "wall") {
          e.preventDefault();
          soundManager.play("buttonClick");
          setWallOrientation((prev) => (prev === "h" ? "v" : "h"));
        }
      } else if (e.key === "Escape" && interactionMode === "wall") {
        e.preventDefault();
        soundManager.play("buttonClick");
        setInteractionMode("move");
        setGhostWall(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHumanTurn, interactionMode]);

  const validPawnMoves = useMemo(
    () =>
      isHumanTurn
        ? getValidPawnMoves(activeState, activeState.currentPlayer)
        : [],
    [isHumanTurn, activeState]
  );

  const ghostValidation = useMemo(() => {
    if (!ghostWall || interactionMode !== "wall" || !isHumanTurn) {
      return null;
    }
    return validateWallPlacement(
      activeState,
      ghostWall.row,
      ghostWall.col,
      wallOrientation
    );
  }, [ghostWall, interactionMode, isHumanTurn, activeState, wallOrientation]);

  const startFreshMatch = useCallback(
    (nextMode: "local-2p" | "pvp-bot", nextDiff: BotDifficulty) => {
      generationRef.current += 1;
      botAbortControllerRef.current?.abort();
      resultSoundGuardRef.current.reset();
      soundManager.prepareResultSounds();
      isPausedRef.current = false;

      const starter = consumeStartingPlayer("wall-maze") === "orange" ? "X" : "O";
      const initial = createInitialState(starter);
      setSessionConfig({ mode: nextMode, difficulty: nextDiff });
      gameStateRef.current = initial;
      setGameState(initial);
      setInteractionMode("move");
      setWallOrientation("h");
      setGhostWall(null);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      setIsHowToPlayOpen(false);
      setIsBotThinking(false);
      setInModeSelection(false);
      onLifecycleChange?.("playing");
    },
    [onLifecycleChange]
  );

  const handleSelectOnline = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
    onlineResultSoundGuardRef.current.reset();
    soundManager.prepareResultSounds();
    isPausedRef.current = false;
    prevOnlineMoveCountRef.current = 0;

    setSessionConfig({ mode: "online-2p", difficulty: "medium" });
    setInteractionMode("move");
    setWallOrientation("h");
    setGhostWall(null);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    setIsBotThinking(false);
    setInModeSelection(false);
    onLifecycleChange?.("configuration");
    online.connect();
  }, [online, onLifecycleChange]);

  const handleRestart = useCallback(() => {
    if (sessionConfig.mode === "online-2p") {
      if (isOnlineGameOver) {
        online.requestRematch();
      }
      return;
    }
    startFreshMatch(sessionConfig.mode, sessionConfig.difficulty);
  }, [
    sessionConfig.mode,
    sessionConfig.difficulty,
    isOnlineGameOver,
    online,
    startFreshMatch,
  ]);

  const handleReturnToModes = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
    onlineResultSoundGuardRef.current.reset();
    isPausedRef.current = false;
    prevOnlineMoveCountRef.current = 0;

    if (sessionConfig.mode === "online-2p") {
      online.leaveRoom();
      online.disconnect();
    }

    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    setIsBotThinking(false);
    setGhostWall(null);
    setInteractionMode("move");
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [sessionConfig.mode, online, onLifecycleChange, onTurnChange]);

  // Register controller with platform shell
  useEffect(() => {
    const controller: IGameController = {
      pause: () => {
        isPausedRef.current = true;
        botAbortControllerRef.current?.abort();
      },
      resume: () => {
        isPausedRef.current = false;
        setResumeTick((t) => t + 1);
      },
      restart: () => {
        handleRestart();
      },
      destroy: () => {
        generationRef.current += 1;
        botAbortControllerRef.current?.abort();
        if (sessionConfig.mode === "online-2p") {
          online.leaveRoom();
          online.disconnect();
        }
      },
    };
    onReady?.(controller);
  }, [onReady, handleRestart, sessionConfig.mode, online]);

  // Cell click (Move Mode)
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isHumanTurn || isPausedRef.current || interactionMode !== "move") {
        return;
      }
      commitAction({ type: "MOVE_PAWN", row, col });
    },
    [isHumanTurn, interactionMode, commitAction]
  );

  // Wall preview update
  const handleWallPreview = useCallback(
    (row: number | null, col: number | null, pointerType: string) => {
      if (!isHumanTurn || interactionMode !== "wall") return;
      setLastInputType(pointerType);
      if (row === null || col === null) {
        setGhostWall(null);
      } else {
        setGhostWall({ row, col });
      }
    },
    [isHumanTurn, interactionMode]
  );

  const attemptPlaceWall = useCallback(
    (row: number, col: number) => {
      const check = validateWallPlacement(
        activeState,
        row,
        col,
        wallOrientation
      );
      if (check.valid) {
        commitAction({
          type: "PLACE_WALL",
          row,
          col,
          orientation: wallOrientation,
        });
      } else {
        soundManager.play("tileBreak");
        setInvalidShakeKey((k) => k + 1);
        setGhostWall({ row, col });
      }
    },
    [activeState, wallOrientation, commitAction]
  );

  // Wall tap or desktop click
  const handleWallTapOrPlace = useCallback(
    (row: number, col: number, pointerType: string) => {
      if (!isHumanTurn || isPausedRef.current || interactionMode !== "wall") {
        return;
      }
      setLastInputType(pointerType);

      if (pointerType === "touch") {
        if (
          ghostWall &&
          ghostWall.row === row &&
          ghostWall.col === col &&
          ghostValidation?.valid
        ) {
          attemptPlaceWall(row, col);
        } else {
          soundManager.play("buttonClick");
          setGhostWall({ row, col });
          const check = validateWallPlacement(
            activeState,
            row,
            col,
            wallOrientation
          );
          if (!check.valid) {
            setInvalidShakeKey((k) => k + 1);
          }
        }
        return;
      }

      attemptPlaceWall(row, col);
    },
    [
      isHumanTurn,
      interactionMode,
      ghostWall,
      ghostValidation,
      activeState,
      wallOrientation,
      attemptPlaceWall,
    ]
  );

  const handleToggleOrientation = useCallback(() => {
    if (!isHumanTurn) return;
    soundManager.play("buttonClick");
    setWallOrientation((prev) => (prev === "h" ? "v" : "h"));
  }, [isHumanTurn]);

  const handleSwitchInteractionMode = useCallback(
    (nextMode: InteractionMode) => {
      if (!isHumanTurn) return;
      if (
        nextMode === "wall" &&
        activeState.wallsLeft[activeState.currentPlayer] <= 0
      ) {
        soundManager.play("tileBreak");
        return;
      }
      soundManager.play("buttonClick");
      setInteractionMode(nextMode);
      setGhostWall(null);
    },
    [isHumanTurn, activeState.wallsLeft, activeState.currentPlayer]
  );

  // 1. Mode Selection View
  if (inModeSelection) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <GameModeSelector
          gameTitle="Wall Maze"
          subtitle="Outmaneuver your rival through shifting walls"
          modes={WALL_MAZE_MODES}
          onScreenChange={(screen) => {
            onLifecycleChange?.(
              screen === "config" ? "configuration" : "pre-game"
            );
          }}
          onSelectMode={(modeId) => {
            if (modeId === "local-2p") {
              startFreshMatch("local-2p", "medium");
            } else if (modeId === "online-2p") {
              handleSelectOnline();
            }
          }}
          onSelectConfiguredMode={(_, val) => {
            startFreshMatch("pvp-bot", (val as BotDifficulty) || "medium");
          }}
          onHowToPlay={() => setIsHowToPlayOpen(true)}
          footer={PLAYER_COLOR_FOOTER}
        />
        <WallMazeHowToPlayModal
          isOpen={isHowToPlayOpen}
          onClose={() => setIsHowToPlayOpen(false)}
        />
      </div>
    );
  }

  // 2. Online Match Lobby View
  if (isOnlineLobby) {
    return (
      <OnlineMatchLobby
        gameTitle="Wall Maze"
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

  const activePlayerWallsLeft =
    sessionConfig.mode === "online-2p" && online.myMark
      ? activeState.wallsLeft[online.myMark]
      : activeState.wallsLeft[activeState.currentPlayer];

  // Status feedback text (fixed 1-line bar to prevent layout shift)
  let statusText = "";
  let statusTone: "neutral" | "error" | "valid" = "neutral";

  if (isGameOver) {
    if (sessionConfig.mode === "online-2p") {
      statusText = online.isWinner
        ? online.resultReason === "disconnect_forfeit"
          ? "Opponent forfeited — You win!"
          : "You reached the goal!"
        : online.resultReason === "disconnect_forfeit"
        ? "Match forfeited"
        : "Opponent reached the goal!";
    } else {
      statusText =
        activeState.winner === "X"
          ? sessionConfig.mode === "pvp-bot"
            ? "You reached the goal!"
            : "Orange reached the goal!"
          : sessionConfig.mode === "pvp-bot"
          ? "Bot reached the goal!"
          : "Blue reached the goal!";
    }
  } else if (sessionConfig.mode === "online-2p" && online.moveError) {
    statusText = online.moveError;
    statusTone = "error";
  } else if (sessionConfig.mode === "online-2p" && online.isMatchPaused) {
    statusText = `Opponent disconnected — forfeit in ${
      online.disconnectGraceSecondsRemaining ?? 0
    }s`;
    statusTone = "error";
  } else if (sessionConfig.mode === "online-2p" && online.pendingAction) {
    statusText = "Syncing move with server...";
  } else if (sessionConfig.mode === "online-2p" && !online.isMyTurn) {
    statusText = "Waiting for opponent's move...";
  } else if (isBotTurn) {
    statusText = "Bot is planning its next move...";
  } else if (interactionMode === "wall") {
    if (
      ghostWall &&
      ghostValidation &&
      !ghostValidation.valid &&
      ghostValidation.reason
    ) {
      statusText = `Invalid: ${INVALID_REASON_LABELS[ghostValidation.reason]}`;
      statusTone = "error";
    } else if (ghostWall && ghostValidation?.valid) {
      statusText =
        lastInputType === "touch"
          ? "Tap Confirm or tap spot again to lock wall"
          : "Click to place wall • R or Right-click to rotate";
      statusTone = "valid";
    } else {
      statusText = "Tap or hover grid intersections to preview wall";
    }
  } else {
    const turnLabel =
      sessionConfig.mode === "pvp-bot" || sessionConfig.mode === "online-2p"
        ? "Your turn"
        : activeState.currentPlayer === "X"
        ? "Orange's turn"
        : "Blue's turn";
    statusText = `${turnLabel} — Tap a highlighted square or Place Wall`;
  }

  const onlineResultText = online.isWinner
    ? online.resultReason === "disconnect_forfeit"
      ? "Opponent Forfeited — You Won!"
      : "You Won!"
    : online.isLoser
    ? online.resultReason === "disconnect_forfeit"
      ? "Match Forfeited"
      : "Opponent Won!"
    : "Match Ended";

  const localResultText =
    activeState.winner === "X"
      ? sessionConfig.mode === "pvp-bot"
        ? "You Won!"
        : "Orange Won!"
      : sessionConfig.mode === "pvp-bot"
      ? "Bot Won!"
      : "Blue Won!";

  // 3. Active Game Stage (Strict 100dvh fit, zero scroll)
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-3 py-1.5 select-none touch-none overflow-hidden">
      <div
        className="w-full flex flex-col items-center justify-center gap-1.5 sm:gap-2"
        style={{
          width:
            sessionConfig.mode === "online-2p"
              ? "min(92vw, calc(100dvh - 260px), 440px)"
              : "min(92vw, calc(100dvh - 224px), 460px)",
        }}
      >
        {/* Online Seat Badge & Room Strip */}
        {sessionConfig.mode === "online-2p" && (
          <div className="w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-white border border-[#e6e3dc] shadow-2xs text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-[#1c1917] min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  online.myMark === "X" ? "bg-[#e0530a]" : "bg-[#2563eb]"
                }`}
              />
              <span className="truncate">
                {online.myMark === "X"
                  ? "You are Orange — Reach Top ▲"
                  : "You are Blue — Reach Bottom ▼"}
              </span>
            </div>
            {online.connectionState === "reconnecting" ? (
              <span className="text-[10px] font-semibold text-[#e0530a] animate-pulse shrink-0">
                Reconnecting...
              </span>
            ) : online.room ? (
              <span className="text-[10px] font-mono text-[#6b665f] shrink-0">
                Room:{" "}
                <strong className="text-[#1c1917]">{online.room.roomCode}</strong>
              </span>
            ) : null}
          </div>
        )}

        {/* Compact Header */}
        <WallMazeHeader
          currentPlayer={activeState.currentPlayer}
          wallsLeft={activeState.wallsLeft}
          mode={sessionConfig.mode}
          localPlayerSeat={
            sessionConfig.mode === "online-2p"
              ? online.myMark ?? "X"
              : "X"
          }
          isBotThinking={isBotThinking}
        />

        {/* 9x9 Board + 8x8 Wall Channels */}
        <WallMazeBoard
          pawns={activeState.pawns}
          walls={activeState.walls}
          currentPlayer={activeState.currentPlayer}
          validPawnMoves={validPawnMoves}
          interactionMode={interactionMode}
          wallOrientation={wallOrientation}
          ghostWall={ghostWall}
          ghostValidation={ghostValidation}
          invalidShakeKey={invalidShakeKey}
          lastAction={activeState.lastAction}
          localPlayerSeat={
            sessionConfig.mode === "online-2p"
              ? online.myMark ?? undefined
              : undefined
          }
          disabled={!isHumanTurn}
          onCellClick={handleCellClick}
          onWallPreview={handleWallPreview}
          onWallTapOrPlace={handleWallTapOrPlace}
          onToggleOrientation={handleToggleOrientation}
        />

        {/* Fixed-Height Status Strip + Bottom Control Dock */}
        <div className="w-full flex flex-col gap-1.5 pt-0.5">
          <div
            role="status"
            aria-live="polite"
            className={`w-full h-6 px-2.5 rounded-lg flex items-center justify-center text-[11px] font-medium truncate transition-colors ${
              statusTone === "error"
                ? "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                : statusTone === "valid"
                ? "bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]"
                : "bg-white/70 text-[#6b665f] border border-[#e6e3dc]/80"
            }`}
          >
            <span className="truncate">{statusText}</span>
          </div>

          {/* Bottom Action Dock */}
          {interactionMode === "move" ? (
            <div className="w-full h-11 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isHumanTurn}
                onClick={() => handleSwitchInteractionMode("move")}
                className="h-full rounded-xl bg-[#1c1917] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      activeState.currentPlayer === "X" ? "#e0530a" : "#2563eb",
                  }}
                />
                Move Pawn
              </button>

              <button
                type="button"
                disabled={!isHumanTurn || activePlayerWallsLeft <= 0}
                onClick={() => handleSwitchInteractionMode("wall")}
                className="h-full rounded-xl bg-white hover:bg-[#faf9f6] active:bg-[#f0eee9] border border-[#e6e3dc] hover:border-[#1c1917] text-[#1c1917] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span className="w-3.5 h-1 rounded-full bg-[#1c1917]" />
                Place Wall ({activePlayerWallsLeft})
              </button>
            </div>
          ) : (
            <div className="w-full h-11 grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!isHumanTurn}
                onClick={() => handleSwitchInteractionMode("move")}
                className="h-full rounded-xl bg-white hover:bg-[#faf9f6] active:bg-[#f0eee9] border border-[#e6e3dc] text-[#1c1917] text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                ← Move
              </button>

              <button
                type="button"
                disabled={!isHumanTurn}
                onClick={handleToggleOrientation}
                aria-label={`Rotate wall orientation, currently ${
                  wallOrientation === "h" ? "horizontal" : "vertical"
                }`}
                className="h-full rounded-xl bg-[#faf9f6] hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] hover:border-[#1c1917] text-[#1c1917] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <span
                  className={`rounded-full bg-[#1c1917] transition-transform ${
                    wallOrientation === "h" ? "w-4 h-1" : "w-1 h-4"
                  }`}
                />
                <span>{wallOrientation === "h" ? "Horiz (R)" : "Vert (R)"}</span>
              </button>

              <button
                type="button"
                disabled={!isHumanTurn || !ghostWall || !ghostValidation?.valid}
                onClick={() => {
                  if (ghostWall && ghostValidation?.valid) {
                    attemptPlaceWall(ghostWall.row, ghostWall.col);
                  }
                }}
                className={`h-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all shadow-xs ${
                  isHumanTurn && ghostWall && ghostValidation?.valid
                    ? "bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] text-white cursor-pointer"
                    : "bg-[#eeece6] text-[#9c978e] cursor-not-allowed"
                }`}
              >
                Confirm Wall
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Result Popup Overlay */}
      {isGameOver && showResultPopup && !isPopupDismissed && (
        <GameResultPopup
          resultText={
            sessionConfig.mode === "online-2p"
              ? onlineResultText
              : localResultText
          }
          accentColor={
            sessionConfig.mode === "online-2p"
              ? online.winnerMark === "X"
                ? "#e0530a"
                : "#2563eb"
              : activeState.winner === "X"
              ? "#e0530a"
              : "#2563eb"
          }
          playAgainText={
            sessionConfig.mode === "online-2p"
              ? online.hasRequestedRematch
                ? "Waiting for Opponent..."
                : online.opponentRequestedRematch
                ? "Accept Rematch"
                : "Rematch"
              : "Play Again"
          }
          onPlayAgain={handleRestart}
          onClose={() => setIsPopupDismissed(true)}
          onHome={handleReturnToModes}
        />
      )}
    </div>
  );
}
