"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import {
  cloneGrid,
  countOrbs,
  createEmptyGrid,
  createInitialState,
  isValidMove,
  resolveMove,
} from "../logic/rules";
import type {
  Cell,
  ChainReactionState,
  MoveLocation,
  Player,
} from "../logic/types";
import { requestBotMove, type BotDifficulty } from "../bot";
import {
  advanceStartingPlayer,
  consumeStartingPlayer,
} from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { useOnlineChainReaction } from "@/platform/multiplayer/useOnlineChainReaction";
import { ChainReactionBoard, type FlyingOrbData } from "./ChainReactionBoard";
import { ChainReactionHeader } from "./ChainReactionHeader";
import { ChainReactionHowToPlayModal } from "./ChainReactionHowToPlayModal";

interface SessionConfig {
  mode: "1v1" | "vs-bot" | "online";
  difficulty: BotDifficulty;
}

const CHAIN_REACTION_MODES: GameModeOption[] = [
  { id: "1v1", label: "Local 1v1" },
  {
    id: "bot",
    label: "You vs Bot",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot calculation depth",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Start Game",
    },
  },
  { id: "online", label: "Online" },
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

export default function ChainReactionGame({
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
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);

  // Local game state (for 1v1 and vs-bot)
  const [localState, setLocalState] = useState<ChainReactionState>(() =>
    createInitialState(consumeStartingPlayer("chain-reaction") === "orange" ? "X" : "O")
  );

  // Display grid for step-by-step cascade playback
  const [displayGrid, setDisplayGrid] = useState<Cell[][]>(() => localState.grid);
  const [isAnimatingCascade, setIsAnimatingCascade] = useState<boolean>(false);
  const [flyingOrbs, setFlyingOrbs] = useState<FlyingOrbData[]>([]);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const [isPendingOnlineMove, setIsPendingOnlineMove] = useState<boolean>(false);

  // Online multiplayer integration
  const online = useOnlineChainReaction();

  const generationRef = useRef<number>(0);
  const botAbortControllerRef = useRef<AbortController | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());
  const isPausedRef = useRef<boolean>(false);

  // Move synchronization refs for online cascade playback
  const lastRenderedMoveNumberRef = useRef<number>(0);
  const previousBoardRef = useRef<Cell[][]>(localState.grid);
  const pendingMoveRef = useRef<boolean>(false);

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  useEffect(() => {
    onLifecycleChange?.("pre-game");
  }, [onLifecycleChange]);

  const isLocalGameOver = localState.status === "finished";
  const isOnlineGameOver =
    sessionConfig.mode === "online" &&
    (online.gameState?.status === "won" || online.gameState?.status === "abandoned");
  const isGameOver = sessionConfig.mode === "online" ? isOnlineGameOver : isLocalGameOver;

  // Result popup delay
  useEffect(() => {
    if (!isGameOver) return;

    const timer = setTimeout(() => {
      setShowResultPopup(true);
    }, 1100);

    return () => clearTimeout(timer);
  }, [isGameOver]);

  // Turn atmosphere synchronization with platform shell
  useEffect(() => {
    if (inModeSelection || isGameOver || isAnimatingCascade) {
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
      onTurnChange?.(localState.currentPlayer);
    }
  }, [
    inModeSelection,
    isGameOver,
    isAnimatingCascade,
    sessionConfig.mode,
    localState.currentPlayer,
    online.gameState,
    online.connectionState,
    isOnlineGameOver,
    onTurnChange,
  ]);

  // Local/Bot game over sound and scoring observer
  useEffect(() => {
    if (sessionConfig.mode === "online") return;

    if (localState.status === "finished" && localState.winner) {
      const soundType = resultSoundGuardRef.current.claim(
        getResultSound({
          mode: sessionConfig.mode,
          winner: localState.winner,
          humanPlayer: "X",
        })
      );

      if (soundType === "victory") soundManager.playVictory();
      if (soundType === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score =
        localState.winner === "X"
          ? 100
          : localState.winner === "O"
          ? sessionConfig.mode === "vs-bot"
            ? 0
            : 100
          : 50;

      onScoreUpdate?.(score);
      onGameOver?.({
        winner: localState.winner === "X" ? "Orange" : "Blue",
        score,
        details: {
          mode: sessionConfig.mode,
          difficulty: sessionConfig.difficulty,
          movesPlayed: localState.movesPlayed,
        },
      });
    }
  }, [
    sessionConfig,
    localState.status,
    localState.winner,
    localState.movesPlayed,
    onGameOver,
    onScoreUpdate,
    onLifecycleChange,
  ]);

  // Online game over sound and scoring observer
  useEffect(() => {
    if (sessionConfig.mode !== "online" || !online.gameState) return;

    if (online.gameState.status === "won" || online.gameState.status === "abandoned") {
      const soundType = online.isWinner ? "victory" : online.isLoser ? "lose" : null;
      const claimed = onlineResultSoundGuardRef.current.claim(soundType);

      if (claimed === "victory") soundManager.playVictory();
      if (claimed === "lose") soundManager.playLose();

      onLifecycleChange?.("finished");
      const score = online.isWinner ? 100 : 0;
      onScoreUpdate?.(score);
      onGameOver?.({
        winner: online.winnerMark === "X" ? "Orange" : "Blue",
        score,
        details: {
          mode: "online",
          winner: online.winnerMark,
          resultReason: online.resultReason,
        },
      });
    }
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

  // Execute sequential cascade waves for a board state
  const playCascadeAnimation = useCallback(
    async (
      initialBoard: Cell[][],
      actingPlayer: Player,
      row: number,
      col: number,
      targetFinalBoard: Cell[][],
      onComplete?: () => void
    ) => {
      const currentGen = generationRef.current;
      const dummyState: ChainReactionState = {
        grid: cloneGrid(initialBoard),
        currentPlayer: actingPlayer,
        startingPlayer: "X",
        status: "playing",
        winner: null,
        movesPlayed: 2, // Enable cascade propagation checks
        playerMoves: { X: 1, O: 1 },
        lastMove: null,
      };

      const { waves } = resolveMove(dummyState, row, col);

      soundManager.play("dropBall");

      if (waves.length === 0) {
        setDisplayGrid(cloneGrid(targetFinalBoard));
        onComplete?.();
        return;
      }

      setIsAnimatingCascade(true);

      // Show intermediate placed orb
      const placedGrid = cloneGrid(initialBoard);
      placedGrid[row][col].count += 1;
      placedGrid[row][col].owner = actingPlayer;
      setDisplayGrid(placedGrid);

      await new Promise<void>((r) => setTimeout(r, 120));
      if (generationRef.current !== currentGen) return;

      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        if (generationRef.current !== currentGen) return;

        const orbs: FlyingOrbData[] = [];
        const affectedCells = new Set<string>();

        wave.explosions.forEach((exp, expIdx) => {
          affectedCells.add(`${exp.fromRow},${exp.fromCol}`);
          exp.targets.forEach((target, targetIdx) => {
            affectedCells.add(`${target.row},${target.col}`);
            orbs.push({
              id: `wave-${wave.waveIndex}-exp-${expIdx}-tgt-${targetIdx}`,
              fromRow: exp.fromRow,
              fromCol: exp.fromCol,
              toRow: target.row,
              toCol: target.col,
              player: wave.player,
            });
          });
        });

        setFlyingOrbs(orbs);
        setFlashingCells(affectedCells);
        soundManager.play("tileBreak");

        await new Promise<void>((r) => setTimeout(r, 200));
        if (generationRef.current !== currentGen) return;

        setDisplayGrid(wave.board);
        setFlyingOrbs([]);

        await new Promise<void>((r) => setTimeout(r, 40));
        if (generationRef.current !== currentGen) return;
      }

      setFlashingCells(new Set());
      setFlyingOrbs([]);
      setIsAnimatingCascade(false);
      setDisplayGrid(cloneGrid(targetFinalBoard));
      onComplete?.();
    },
    []
  );

  // Online state synchronization and sequential move playback observer
  useEffect(() => {
    if (sessionConfig.mode !== "online" || !online.gameState) return;

    const serverState = online.gameState;

    // A. Fresh game or rematch: moveNumber === 0
    if (serverState.moveNumber === 0) {
      if (lastRenderedMoveNumberRef.current !== 0) {
        lastRenderedMoveNumberRef.current = 0;
        previousBoardRef.current = cloneGrid(serverState.board);
        generationRef.current += 1;
        const timer = setTimeout(() => {
          setIsAnimatingCascade(false);
          setFlyingOrbs([]);
          setFlashingCells(new Set());
          setDisplayGrid(serverState.board);
          pendingMoveRef.current = false;
          setIsPendingOnlineMove(false);
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    // B. Sequential move received: moveNumber === lastRendered + 1
    if (
      serverState.moveNumber === lastRenderedMoveNumberRef.current + 1 &&
      serverState.lastMove
    ) {
      lastRenderedMoveNumberRef.current = serverState.moveNumber;
      pendingMoveRef.current = false;
      setIsPendingOnlineMove(false);

      const lastMove = serverState.lastMove;
      const initialBoard = cloneGrid(previousBoardRef.current);
      previousBoardRef.current = cloneGrid(serverState.board);

      void playCascadeAnimation(
        initialBoard,
        lastMove.player,
        lastMove.row,
        lastMove.col,
        serverState.board
      );
      return;
    }

    // C. Non-sequential jump / reconnect / resync
    if (serverState.moveNumber !== lastRenderedMoveNumberRef.current) {
      generationRef.current += 1;
      lastRenderedMoveNumberRef.current = serverState.moveNumber;
      previousBoardRef.current = cloneGrid(serverState.board);
      const timer = setTimeout(() => {
        setIsAnimatingCascade(false);
        setFlyingOrbs([]);
        setFlashingCells(new Set());
        setDisplayGrid(serverState.board);
        pendingMoveRef.current = false;
        setIsPendingOnlineMove(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sessionConfig.mode, online.gameState, playCascadeAnimation]);

  // Execute local / vs-bot move
  const executeLocalMove = useCallback(
    async (row: number, col: number) => {
      if (!isValidMove(localState, row, col)) return;

      const currentGen = generationRef.current;
      const { finalState, waves } = resolveMove(localState, row, col);

      soundManager.play("dropBall");

      if (waves.length === 0) {
        setLocalState(finalState);
        setDisplayGrid(finalState.grid);
        return;
      }

      setIsAnimatingCascade(true);

      const initialPlacedGrid = cloneGrid(localState.grid);
      initialPlacedGrid[row][col].count += 1;
      initialPlacedGrid[row][col].owner = localState.currentPlayer;
      setDisplayGrid(initialPlacedGrid);

      await new Promise<void>((r) => setTimeout(r, 120));
      if (generationRef.current !== currentGen) return;

      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        if (generationRef.current !== currentGen) return;

        const orbs: FlyingOrbData[] = [];
        const affectedCells = new Set<string>();

        wave.explosions.forEach((exp, expIdx) => {
          affectedCells.add(`${exp.fromRow},${exp.fromCol}`);
          exp.targets.forEach((target, targetIdx) => {
            affectedCells.add(`${target.row},${target.col}`);
            orbs.push({
              id: `wave-${wave.waveIndex}-exp-${expIdx}-tgt-${targetIdx}`,
              fromRow: exp.fromRow,
              fromCol: exp.fromCol,
              toRow: target.row,
              toCol: target.col,
              player: wave.player,
            });
          });
        });

        setFlyingOrbs(orbs);
        setFlashingCells(affectedCells);
        soundManager.play("tileBreak");

        await new Promise<void>((r) => setTimeout(r, 200));
        if (generationRef.current !== currentGen) return;

        setDisplayGrid(wave.board);
        setFlyingOrbs([]);

        await new Promise<void>((r) => setTimeout(r, 40));
        if (generationRef.current !== currentGen) return;
      }

      setFlashingCells(new Set());
      setFlyingOrbs([]);
      setIsAnimatingCascade(false);
      setLocalState(finalState);
      setDisplayGrid(finalState.grid);
    },
    [localState]
  );

  // Player click handler
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (inModeSelection || isGameOver || isAnimatingCascade || isPausedRef.current) return;

      if (sessionConfig.mode === "online") {
        if (
          !online.isMyTurn ||
          pendingMoveRef.current ||
          online.isMatchPaused ||
          !online.gameState
        ) {
          return;
        }

        const cell = online.gameState.board[row]?.[col];
        if (!cell || (cell.owner !== null && cell.owner !== online.myMark)) {
          return;
        }

        pendingMoveRef.current = true;
        setIsPendingOnlineMove(true);
        online.placeOrb(row, col);
        return;
      }

      if (sessionConfig.mode === "vs-bot" && localState.currentPlayer !== "X") {
        return;
      }

      void executeLocalMove(row, col);
    },
    [
      inModeSelection,
      isGameOver,
      isAnimatingCascade,
      sessionConfig.mode,
      online,
      localState.currentPlayer,
      executeLocalMove,
    ]
  );

  // Bot Turn Loop
  useEffect(() => {
    if (
      inModeSelection ||
      sessionConfig.mode !== "vs-bot" ||
      localState.status !== "playing" ||
      localState.currentPlayer !== "O" ||
      isAnimatingCascade ||
      isPausedRef.current
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;
    const currentGen = generationRef.current;

    requestBotMove(localState, {
      difficulty: sessionConfig.difficulty,
      signal: abortController.signal,
    })
      .then((move: MoveLocation | null) => {
        if (
          !move ||
          abortController.signal.aborted ||
          generationRef.current !== currentGen
        ) {
          return;
        }
        void executeLocalMove(move.row, move.col);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Bot move calculation error:", err);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [
    inModeSelection,
    sessionConfig,
    localState,
    isAnimatingCascade,
    executeLocalMove,
  ]);

  // Restart match handler
  const handleRestart = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();

    if (sessionConfig.mode === "online") {
      online.requestRematch();
      return;
    }

    const nextStarter = advanceStartingPlayer("chain-reaction") === "orange" ? "X" : "O";
    const newState = createInitialState(nextStarter);

    setLocalState(newState);
    setDisplayGrid(newState.grid);
    previousBoardRef.current = cloneGrid(newState.grid);
    lastRenderedMoveNumberRef.current = 0;
    setIsAnimatingCascade(false);
    setFlyingOrbs([]);
    setFlashingCells(new Set());
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    onLifecycleChange?.("playing");
  }, [sessionConfig.mode, online, onLifecycleChange]);

  // Mode Selection Handlers
  const handleSelect1v1 = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();

    setSessionConfig({ mode: "1v1", difficulty: "medium" });
    const starter = consumeStartingPlayer("chain-reaction") === "orange" ? "X" : "O";
    const newState = createInitialState(starter);

    setLocalState(newState);
    setDisplayGrid(newState.grid);
    previousBoardRef.current = cloneGrid(newState.grid);
    lastRenderedMoveNumberRef.current = 0;
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    onLifecycleChange?.("playing");
  }, [onLifecycleChange]);

  const handleSelectBot = useCallback(
    (difficulty: string) => {
      generationRef.current += 1;
      botAbortControllerRef.current?.abort();
      resultSoundGuardRef.current.reset();

      const diff = (difficulty as BotDifficulty) || "medium";
      setSessionConfig({ mode: "vs-bot", difficulty: diff });

      const starter = consumeStartingPlayer("chain-reaction") === "orange" ? "X" : "O";
      const newState = createInitialState(starter);

      setLocalState(newState);
      setDisplayGrid(newState.grid);
      previousBoardRef.current = cloneGrid(newState.grid);
      lastRenderedMoveNumberRef.current = 0;
      setInModeSelection(false);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      setIsHowToPlayOpen(false);
      onLifecycleChange?.("playing");
    },
    [onLifecycleChange]
  );

  const handleSelectOnline = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
    onlineResultSoundGuardRef.current.reset();

    setSessionConfig({ mode: "online", difficulty: "medium" });
    setInModeSelection(false);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    setDisplayGrid(createEmptyGrid());
    previousBoardRef.current = createEmptyGrid();
    lastRenderedMoveNumberRef.current = 0;
    pendingMoveRef.current = false;
    setIsPendingOnlineMove(false);
    onLifecycleChange?.("configuration");
    online.connect();
  }, [online, onLifecycleChange]);

  const handleReturnToModes = useCallback(() => {
    generationRef.current += 1;
    botAbortControllerRef.current?.abort();
    resultSoundGuardRef.current.reset();
    onlineResultSoundGuardRef.current.reset();

    if (sessionConfig.mode === "online") {
      online.leaveRoom();
      online.disconnect();
    }

    pendingMoveRef.current = false;
    setIsPendingOnlineMove(false);

    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    setIsHowToPlayOpen(false);
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [sessionConfig.mode, online, onLifecycleChange, onTurnChange]);

  // Register Controller with Platform Shell
  useEffect(() => {
    const controller: IGameController = {
      pause: () => {
        isPausedRef.current = true;
        botAbortControllerRef.current?.abort();
      },
      resume: () => {
        isPausedRef.current = false;
      },
      restart: () => {
        handleRestart();
      },
      destroy: () => {
        generationRef.current += 1;
        botAbortControllerRef.current?.abort();
        if (sessionConfig.mode === "online") {
          online.leaveRoom();
          online.disconnect();
        }
      },
    };
    onReady?.(controller);
  }, [onReady, handleRestart, sessionConfig.mode, online]);

  // Derived counts
  const orbCounts = useMemo(() => countOrbs(displayGrid), [displayGrid]);

  // 1. Mode Selection View
  if (inModeSelection) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <GameModeSelector
          gameTitle="Chain Reaction"
          subtitle="Explosive tactical orb cascades"
          modes={CHAIN_REACTION_MODES}
          onSelectMode={(modeId) => {
            if (modeId === "1v1") handleSelect1v1();
            if (modeId === "online") handleSelectOnline();
          }}
          onSelectConfiguredMode={(_, val) => handleSelectBot(val)}
          onHowToPlay={() => setIsHowToPlayOpen(true)}
          footer={PLAYER_COLOR_FOOTER}
        />
        <ChainReactionHowToPlayModal
          isOpen={isHowToPlayOpen}
          onClose={() => setIsHowToPlayOpen(false)}
        />
      </div>
    );
  }

  // 2. Online Match Lobby View
  const isOnlineLobby =
    sessionConfig.mode === "online" &&
    (online.connectionState === "disconnected" ||
      online.connectionState === "connecting" ||
      online.connectionState === "identifying" ||
      online.connectionState === "connected" ||
      online.connectionState === "creating_room" ||
      online.connectionState === "joining_room" ||
      online.connectionState === "waiting_for_opponent" ||
      online.connectionState === "connection_failed" ||
      !online.gameState);

  if (isOnlineLobby) {
    return (
      <OnlineMatchLobby
        gameTitle="Chain Reaction"
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

  // Active game player & turn metadata
  const currentActivePlayer =
    sessionConfig.mode === "online"
      ? online.gameState?.currentPlayer ?? "X"
      : localState.currentPlayer;

  const currentMovesPlayed =
    sessionConfig.mode === "online"
      ? online.gameState?.movesPlayed ?? 0
      : localState.movesPlayed;

  const onlineResultText = online.isWinner
    ? online.gameState?.resultReason === "disconnect_forfeit"
      ? "Opponent Forfeited — You Won!"
      : "You Won!"
    : online.isLoser
    ? online.gameState?.resultReason === "disconnect_forfeit"
      ? "Match Forfeited"
      : "Opponent Won!"
    : "Match Ended";

  const localResultText =
    localState.winner === "X"
      ? sessionConfig.mode === "vs-bot"
        ? "You Won!"
        : "Orange Won!"
      : sessionConfig.mode === "vs-bot"
      ? "Bot Won!"
      : "Blue Won!";

  // 3. Active Game Stage
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 select-none">
      {/* Online Match Header & Disconnect Status */}
      {sessionConfig.mode === "online" ? (
        <div className="w-full max-w-[400px] mx-auto mb-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[#6b665f] px-3 py-1.5 bg-white rounded-xl border border-[#e6e3dc] shadow-xs">
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  online.myMark === "X" ? "bg-[#e0530a]" : "bg-[#2563eb]"
                }`}
              />
              <span>You: {online.myMark === "X" ? "Orange (X)" : "Blue (O)"}</span>
            </div>

            <div>
              {online.isMatchPaused ? (
                <span className="text-[#e0530a] font-medium animate-pulse">
                  Opponent Reconnecting...
                </span>
              ) : (
                <span className="font-semibold text-[#1c1917]">
                  {online.isMyTurn ? "Your Turn" : "Opponent's Turn"}
                </span>
              )}
            </div>
          </div>

          {online.disconnectGraceSecondsRemaining !== null && !isOnlineGameOver && (
            <div className="p-2 bg-[#fff7ed] border border-[#fed7aa] rounded-xl text-center text-xs text-[#c2410c] font-medium animate-pulse">
              Opponent disconnected • Forfeit in 00:
              {String(online.disconnectGraceSecondsRemaining).padStart(2, "0")}
            </div>
          )}
        </div>
      ) : (
        <ChainReactionHeader
          currentPlayer={currentActivePlayer}
          counts={orbCounts}
          movesPlayed={currentMovesPlayed}
          mode={sessionConfig.mode}
          humanPlayer="X"
        />
      )}

      {/* Main 6x8 Board */}
      <ChainReactionBoard
        grid={displayGrid}
        currentPlayer={currentActivePlayer}
        onCellClick={handleCellClick}
        disabled={
          isAnimatingCascade ||
          isGameOver ||
          (sessionConfig.mode === "online" &&
            (!online.isMyTurn || online.isMatchPaused || isPendingOnlineMove))
        }
        lastMove={
          sessionConfig.mode === "online"
            ? online.gameState?.lastMove ?? null
            : localState.lastMove
        }
        flashingCells={flashingCells}
        flyingOrbs={flyingOrbs}
        humanPlayer={
          sessionConfig.mode === "vs-bot"
            ? "X"
            : sessionConfig.mode === "online"
            ? online.myMark ?? undefined
            : undefined
        }
      />

      {/* Online Room Code Footer */}
      {sessionConfig.mode === "online" && online.room && (
        <div className="mt-2 text-center text-[11px] font-mono text-[#9c978e]">
          Room Code:{" "}
          <span className="font-bold text-[#1c1917] tracking-wider">
            {online.room.roomCode}
          </span>
        </div>
      )}

      {/* Result Popup Overlay */}
      {isGameOver && showResultPopup && !isPopupDismissed && (
        <GameResultPopup
          resultText={sessionConfig.mode === "online" ? onlineResultText : localResultText}
          accentColor={
            sessionConfig.mode === "online"
              ? online.winnerMark === "X"
                ? "#e0530a"
                : "#2563eb"
              : localState.winner === "X"
              ? "#e0530a"
              : "#2563eb"
          }
          playAgainText={
            sessionConfig.mode === "online"
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
