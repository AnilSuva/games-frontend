"use client";

import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { createInitialState, checkersReducer } from "../logic/reducer";
import {
  EMPTY,
  type CheckersState,
  type Piece,
  type PlatformPlayer,
} from "../logic/types";
import {
  getPiecePlayer,
  getValidMoves,
  getValidMovesForSquare,
  isKing,
  toIndex,
} from "../logic/moves";
import { requestBotMove, type BotDifficulty } from "../bot/botService";
import { consumeStartingPlayer } from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import {
  createResultSoundGuard,
  getResultSound,
  type ResultSound,
} from "@/games/common/resultSound";
import { useOnlineCheckers } from "@/platform/multiplayer/useOnlineCheckers";

interface AnimatingMove {
  from: number;
  to: number;
  id: number;
}

interface SessionConfig {
  mode: "1v1" | "vs-bot" | "online";
  difficulty: BotDifficulty;
}

const CHECKERS_MODES: GameModeOption[] = [
  { id: "1v1", label: "1v1", description: "Local 2-Player" },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Checkers",
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
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#e0530a] shadow-sm" />
      Orange (Starts)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shadow-sm" />
      Blue
    </span>
  </div>
);

function CrownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}

export default function CheckersGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    mode: "1v1",
    difficulty: "medium",
  });

  const [showResultPopup, setShowResultPopup] = useState<boolean>(false);
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  const [state, dispatch] = useReducer(checkersReducer, undefined, createInitialState);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);

  const botAbortControllerRef = useRef<AbortController | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  // Online multiplayer integration
  const online = useOnlineCheckers();
  const lastProcessedMoveCountRef = useRef<number>(0);

  // Moving piece animation state
  const [animatingMove, setAnimatingMove] = useState<AnimatingMove | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveCounterRef = useRef<number>(0);

  const triggerSlideAnimation = useCallback((from: number, to: number, moveId?: number) => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
    }
    const id = moveId ?? ++moveCounterRef.current;
    setAnimatingMove({ from, to, id });
    try {
      soundManager.play("checkersSlide");
    } catch {
      // Audio error ignored
    }
    animTimerRef.current = setTimeout(() => {
      setAnimatingMove(null);
    }, 280);
  }, []);

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

  const isOnlineMode = sessionConfig.mode === "online";

  // Derive active game state depending on mode
  const currentBoard: readonly Piece[] = isOnlineMode
    ? (online.gameState?.board as readonly Piece[] | undefined) ?? state.board
    : state.board;

  const currentPlayer: PlatformPlayer = isOnlineMode
    ? online.gameState?.currentPlayer ?? "orange"
    : state.currentPlayer;

  const currentStatus = isOnlineMode
    ? online.gameState?.status ?? "waiting"
    : state.status;

  const currentWinner = isOnlineMode
    ? online.gameState?.winner ?? null
    : state.winner;

  const currentActivePiece = isOnlineMode
    ? online.gameState?.activePiece ?? null
    : state.activePiece;

  const currentOrangeCaptures = isOnlineMode
    ? online.gameState?.orangeCaptures ?? 0
    : state.orangeCaptures;

  const currentBlueCaptures = isOnlineMode
    ? online.gameState?.blueCaptures ?? 0
    : state.blueCaptures;

  const currentLastMove = isOnlineMode
    ? online.gameState?.lastMove ?? null
    : state.lastMove;

  // Perspective inversion: Blue player plays from bottom perspective in online mode
  const isFlippedPerspective = isOnlineMode && online.myRole === "blue";

  // Active state wrapper to pass to move generator
  const activeState: CheckersState = {
    board: currentBoard,
    currentPlayer,
    status: currentStatus === "in_progress" ? "in_progress" : currentStatus === "won" ? "won" : "draw",
    winner: currentWinner,
    activePiece: currentActivePiece,
    orangeCaptures: currentOrangeCaptures,
    blueCaptures: currentBlueCaptures,
    moveCount: isOnlineMode ? (online.gameState?.moveCount ?? 0) : state.moveCount,
    lastMove: currentLastMove,
  };

  const validMoves = getValidMoves(activeState);
  const hasForcedJumps = validMoves.length > 0 && validMoves[0].isJump;

  // Valid moves available specifically for selected square
  const validDestinations = selectedSquare !== null
    ? getValidMovesForSquare(activeState, selectedSquare)
    : [];

  const validDestinationIndices = new Set(validDestinations.map((m) => m.to));

  // Determine if local player is allowed to interact
  const isInteractionLocked = Boolean(
    inModeSelection ||
    currentStatus !== "in_progress" ||
    (sessionConfig.mode === "vs-bot" && currentPlayer === "blue") ||
    (isOnlineMode && (!online.isMyTurn || online.isMatchPaused))
  );

  // Handle local and bot move execution
  const executeLocalMove = useCallback(
    (from: number, to: number) => {
      triggerSlideAnimation(from, to);
      dispatch({ type: "MOVE", from, to });
      setSelectedSquare(null);
    },
    [triggerSlideAnimation]
  );

  // Handle square clicks
  const handleSquareClick = (index: number) => {
    if (isInteractionLocked) return;

    const piece = currentBoard[index];
    const isMyPiece = piece !== EMPTY && getPiecePlayer(piece) === currentPlayer;

    // 1. If clicking a highlighted destination for currently selected piece -> execute move!
    if (selectedSquare !== null && validDestinationIndices.has(index)) {
      if (isOnlineMode) {
        triggerSlideAnimation(selectedSquare, index);
        online.sendMove(selectedSquare, index);
        setSelectedSquare(null);
      } else {
        executeLocalMove(selectedSquare, index);
      }
      return;
    }

    // 2. If in multi-jump sequence, cannot select any piece other than activePiece
    if (currentActivePiece !== null) {
      if (index === currentActivePiece) {
        setSelectedSquare(index);
      }
      return;
    }

    // 3. If clicking a piece belonging to current player that has legal moves
    if (isMyPiece) {
      const movesForThisPiece = getValidMovesForSquare(activeState, index);
      if (movesForThisPiece.length > 0) {
        setSelectedSquare(index);
        return;
      }
    }

    // 4. Clicked outside valid targets or non-movable piece
    setSelectedSquare(null);
  };

  // Bot automation loop for vs-bot mode
  useEffect(() => {
    if (
      sessionConfig.mode !== "vs-bot" ||
      inModeSelection ||
      state.status !== "in_progress" ||
      state.currentPlayer !== "blue"
    ) {
      return;
    }

    const abortController = new AbortController();
    botAbortControllerRef.current = abortController;

    void requestBotMove(state, "blue", {
      difficulty: sessionConfig.difficulty,
      delayMs: 380,
      signal: abortController.signal,
    })
      .then((botMove) => {
        if (abortController.signal.aborted || !botMove) return;
        executeLocalMove(botMove.from, botMove.to);
      })
      .catch(() => {
        // Aborted naturally
      });

    return () => {
      abortController.abort();
    };
  }, [
    sessionConfig.mode,
    sessionConfig.difficulty,
    inModeSelection,
    state,
    executeLocalMove,
  ]);

  // Online move observer: plays checkersSlide and animates piece when opponent moves
  useEffect(() => {
    if (!isOnlineMode || !online.gameState) {
      lastProcessedMoveCountRef.current = 0;
      return;
    }
    const currentMoveCount = online.gameState.moveCount;
    if (currentMoveCount > lastProcessedMoveCountRef.current) {
      const isInitial = lastProcessedMoveCountRef.current === 0;
      lastProcessedMoveCountRef.current = currentMoveCount;
      if (!isInitial && online.gameState.lastMove) {
        const { from, to } = online.gameState.lastMove;
        triggerSlideAnimation(from, to, currentMoveCount);
      }
    }
  }, [isOnlineMode, online.gameState, triggerSlideAnimation]);

  // Online result sound trigger
  useEffect(() => {
    if (!isOnlineMode || !online.gameState) return;
    const { status, winner } = online.gameState;

    if (status === "won" || status === "draw") {
      const soundType: ResultSound | null =
        status === "won"
          ? online.myRole === winner
            ? "victory"
            : "lose"
          : null;
      const claimed = onlineResultSoundGuardRef.current.claim(soundType);
      if (claimed === "victory") soundManager.playVictory();
      if (claimed === "lose") soundManager.playLose();
    } else {
      onlineResultSoundGuardRef.current.reset();
    }
  }, [isOnlineMode, online.gameState, online.myRole]);

  // Local result sound trigger
  useEffect(() => {
    if (isOnlineMode) return;

    if (state.status === "won" || state.status === "draw") {
      const soundType = getResultSound({
        mode: sessionConfig.mode === "vs-bot" ? "vs-bot" : "1v1",
        winner: state.winner,
        humanPlayer: "orange",
      });
      const claimed = resultSoundGuardRef.current.claim(soundType);
      if (claimed === "victory") soundManager.playVictory();
      if (claimed === "lose") soundManager.playLose();
    } else {
      resultSoundGuardRef.current.reset();
    }
  }, [isOnlineMode, state.status, state.winner, sessionConfig.mode]);

  // Handle local match game over popup
  useEffect(() => {
    if (isOnlineMode) return;

    if (state.status === "won" || state.status === "draw") {
      const timer = setTimeout(() => {
        setShowResultPopup(true);
        setIsPopupDismissed(false);
      }, 700);
      onLifecycleChange?.("finished");
      onGameOver?.({
        winner: state.winner ?? "draw",
        score: state.winner === "orange" ? state.orangeCaptures * 100 : state.blueCaptures * 100,
        details: {
          moveCount: state.moveCount,
          orangeCaptures: state.orangeCaptures,
          blueCaptures: state.blueCaptures,
        },
      });
      return () => clearTimeout(timer);
    }
  }, [
    isOnlineMode,
    state.status,
    state.winner,
    state.moveCount,
    state.orangeCaptures,
    state.blueCaptures,
    onGameOver,
    onLifecycleChange,
  ]);

  // Handle online match game over popup
  useEffect(() => {
    if (!isOnlineMode || !online.gameState) return;
    const { status, winner, orangeCaptures, blueCaptures, moveCount } = online.gameState;

    if (status === "won" || status === "draw") {
      const timer = setTimeout(() => {
        setShowResultPopup(true);
        setIsPopupDismissed(false);
      }, 700);
      onLifecycleChange?.("finished");
      onGameOver?.({
        winner: winner ?? "draw",
        score: winner === "orange" ? orangeCaptures * 100 : blueCaptures * 100,
        details: { moveCount, orangeCaptures, blueCaptures },
      });
      return () => clearTimeout(timer);
    }
  }, [isOnlineMode, online.gameState, onGameOver, onLifecycleChange]);

  // Reset or start new match
  const startFreshMatch = useCallback(
    (startingRole?: PlatformPlayer) => {
      cancelBotRequest();
      const starter = startingRole ?? consumeStartingPlayer("checkers");
      dispatch({ type: "RESET", startingPlayer: starter });
      setSelectedSquare(null);
      setShowResultPopup(false);
      setIsPopupDismissed(false);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [cancelBotRequest, onLifecycleChange, onScoreUpdate]
  );

  // Mode Selection Handlers
  const handleSelectSimpleMode = useCallback(
    (modeId: string) => {
      cancelBotRequest();

      if (modeId === "1v1") {
        online.disconnect();
        setSessionConfig({ mode: "1v1", difficulty: "medium" });
        setInModeSelection(false);
        startFreshMatch();
        return;
      }

      if (modeId === "online") {
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
    [cancelBotRequest, online, startFreshMatch, onLifecycleChange, onScoreUpdate]
  );

  const handleSelectConfiguredMode = useCallback(
    (_modeId: string, configValue: string) => {
      cancelBotRequest();
      online.disconnect();
      setSessionConfig({
        mode: "vs-bot",
        difficulty: configValue as BotDifficulty,
      });
      setInModeSelection(false);
      startFreshMatch();
    },
    [cancelBotRequest, online, startFreshMatch]
  );

  const handleReturnToModes = useCallback(() => {
    cancelBotRequest();
    online.leaveRoom();
    setSessionConfig({ mode: "1v1", difficulty: "medium" });
    setInModeSelection(true);
    setShowResultPopup(false);
    setIsPopupDismissed(false);
    onLifecycleChange?.("pre-game");
  }, [cancelBotRequest, online, onLifecycleChange]);

  // Connect platform pause/restart controller
  const startFreshMatchRef = useRef(startFreshMatch);
  useEffect(() => {
    startFreshMatchRef.current = startFreshMatch;
  });

  useEffect(() => {
    const controller: IGameController = {
      restart: () => startFreshMatchRef.current(),
    };
    onReady(controller);
  }, [onReady]);

  // Clean up on cartridge unmount
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  useEffect(() => {
    return () => {
      cancelBotRequest();
      onlineRef.current.disconnect();
    };
  }, [cancelBotRequest]);

  // Mode selection screen: board and HUD remain unrendered until mode is chosen
  if (inModeSelection) {
    return (
      <GameModeSelector
        gameTitle="Checkers"
        modes={CHECKERS_MODES}
        footer={PLAYER_COLOR_FOOTER}
        onSelectMode={handleSelectSimpleMode}
        onSelectConfiguredMode={handleSelectConfiguredMode}
        onScreenChange={(screen) =>
          onLifecycleChange?.(screen === "config" ? "configuration" : "pre-game")
        }
      />
    );
  }

  // Online match lobby screen when not yet in-game
  if (
    isOnlineMode &&
    (!online.gameState ||
      (online.connectionState !== "in_game" &&
        online.connectionState !== "game_over"))
  ) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        <OnlineMatchLobby
          gameTitle="Checkers"
          subtitle="Play classic 8x8 Checkers with a friend"
          connectionState={online.connectionState}
          room={online.room}
          errorMessage={online.errorMessage}
          onCreateRoom={() => online.createRoom()}
          onJoinRoom={(code) => online.joinRoom(code)}
          onLeaveRoom={() => online.leaveRoom()}
          onReturnToModes={handleReturnToModes}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between max-w-xl mx-auto p-3 sm:p-4 select-none">
      {/* ─── Header Status & Captures Banner ──────────────────────────── */}
      <header className="w-full flex items-center justify-between bg-white/80 backdrop-blur-md border border-[#eeece6] px-3.5 py-2.5 rounded-2xl shadow-sm mb-3">
        {/* Blue Side Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded-full bg-[#2563eb] shadow-sm transition-transform ${
              currentPlayer === "blue" ? "scale-125 ring-2 ring-blue-300" : "opacity-80"
            }`}
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#1a1917] leading-none">
              Blue {sessionConfig.mode === "vs-bot" ? "(Bot)" : ""}
            </span>
            <span className="text-[10px] text-[#78746d] mt-0.5">
              Captured: {currentBlueCaptures}
            </span>
          </div>
        </div>

        {/* Center Match Status */}
        <div className="flex flex-col items-center">
          {hasForcedJumps && currentStatus === "in_progress" && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide animate-pulse">
              Jump Required
            </span>
          )}
          {currentActivePiece !== null && (
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 mt-0.5">
              Multi-Jump Active
            </span>
          )}
          {currentStatus === "in_progress" && !hasForcedJumps && currentActivePiece === null && (
            <span className="text-xs font-medium text-[#78746d]">
              {currentPlayer === "orange" ? "Orange's Turn" : "Blue's Turn"}
            </span>
          )}
          {/* Online 1-Minute Move Timer */}
          {isOnlineMode && currentStatus === "in_progress" && !online.isMatchPaused && online.turnSecondsRemaining !== null && (
            <div
              className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border mt-1 shadow-sm transition-colors ${
                online.turnSecondsRemaining <= 10
                  ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                  : "bg-stone-50 text-stone-700 border-stone-200"
              }`}
            >
              <span className="text-[10px]">⏱</span>
              <span>
                {Math.floor(online.turnSecondsRemaining / 60)}:
                {String(online.turnSecondsRemaining % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Orange Side Status */}
        <div className="flex items-center gap-2 text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-[#1a1917] leading-none">
              Orange
            </span>
            <span className="text-[10px] text-[#78746d] mt-0.5">
              Captured: {currentOrangeCaptures}
            </span>
          </div>
          <div
            className={`w-3.5 h-3.5 rounded-full bg-[#e0530a] shadow-sm transition-transform ${
              currentPlayer === "orange" ? "scale-125 ring-2 ring-orange-300" : "opacity-80"
            }`}
          />
        </div>
      </header>

      {/* ─── Disconnect Grace Warning Banner (Online Mode) ─────────────── */}
      {isOnlineMode && online.isMatchPaused && (
        <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-800 px-3 py-2 rounded-xl text-xs text-center font-medium mb-2 animate-pulse">
          Opponent disconnected. Forfeiting in {online.disconnectGraceSecondsRemaining}s...
        </div>
      )}

      {/* ─── Move Slide Animation Keyframes ───────────────────────────── */}
      <style>{`
        @keyframes checkersSlide {
          0% {
            transform: translate(var(--slide-x), var(--slide-y)) scale(1.06);
          }
          100% {
            transform: translate(0, 0) scale(1);
          }
        }
        .animate-checkers-slide {
          animation: checkersSlide 280ms cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
          will-change: transform;
        }
      `}</style>

      {/* ─── 8x8 Board Container ────────────────────────────────────────── */}
      <main className="w-full flex-1 flex items-center justify-center p-1 sm:p-2">
        <div className="w-full aspect-square max-w-[440px] bg-[#3a2f2d] p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl shadow-xl border-4 border-[#2b2220]">
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg overflow-hidden border border-[#2b2220]">
            {Array.from({ length: 64 }, (_, renderIndex) => {
              // Handle perspective flipping for Blue in online mode
              const rawRow = Math.floor(renderIndex / 8);
              const rawCol = renderIndex % 8;

              const r = isFlippedPerspective ? 7 - rawRow : rawRow;
              const c = isFlippedPerspective ? 7 - rawCol : rawCol;
              const squareIndex = toIndex(r, c);

              const isDarkSquare = (r + c) % 2 === 1;
              const piece = currentBoard[squareIndex];
              const piecePlayer = getPiecePlayer(piece);
              const isPieceKing = isKing(piece);

              const isSelected = selectedSquare === squareIndex;
              const isTarget = validDestinationIndices.has(squareIndex);
              const isTargetJump = isTarget && validDestinations.find((m) => m.to === squareIndex)?.isJump;
              const isLastMoveSource = currentLastMove?.from === squareIndex;
              const isLastMoveDest = currentLastMove?.to === squareIndex;

              const isMovablePiece =
                !isInteractionLocked &&
                piece !== EMPTY &&
                piecePlayer === currentPlayer &&
                (currentActivePiece === null || currentActivePiece === squareIndex) &&
                getValidMovesForSquare(activeState, squareIndex).length > 0;

              const isCurrentlySliding = animatingMove !== null && animatingMove.to === squareIndex;
              let slideStyle: React.CSSProperties | undefined;
              if (isCurrentlySliding && animatingMove) {
                const fromR = Math.floor(animatingMove.from / 8);
                const fromC = animatingMove.from % 8;
                const toR = Math.floor(animatingMove.to / 8);
                const toC = animatingMove.to % 8;

                const fromRenderedRow = isFlippedPerspective ? 7 - fromR : fromR;
                const fromRenderedCol = isFlippedPerspective ? 7 - fromC : fromC;
                const toRenderedRow = isFlippedPerspective ? 7 - toR : toR;
                const toRenderedCol = isFlippedPerspective ? 7 - toC : toC;

                const deltaXPercent = (fromRenderedCol - toRenderedCol) * 100;
                const deltaYPercent = (fromRenderedRow - toRenderedRow) * 100;

                slideStyle = {
                  ["--slide-x" as string]: `${deltaXPercent}%`,
                  ["--slide-y" as string]: `${deltaYPercent}%`,
                };
              }

              return (
                <button
                  key={renderIndex}
                  type="button"
                  onClick={() => handleSquareClick(squareIndex)}
                  disabled={isInteractionLocked && !isTarget}
                  aria-label={`Square row ${r + 1} column ${c + 1}`}
                  className={`relative flex items-center justify-center transition-colors ${
                    isDarkSquare
                      ? isSelected
                        ? "bg-[#6b472e]"
                        : isLastMoveSource || isLastMoveDest
                        ? "bg-[#614532]"
                        : "bg-[#543b2b]"
                      : "bg-[#e8dec8]"
                  } ${isTarget ? "cursor-pointer" : isMovablePiece ? "cursor-pointer" : "cursor-default"}`}
                >
                  {/* Square Move Destination Indicator */}
                  {isTarget && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div
                        className={`rounded-full transition-transform animate-pulse ${
                          isTargetJump
                            ? "w-5 h-5 sm:w-6 sm:h-6 bg-amber-400/90 ring-4 ring-amber-300/60 shadow-lg"
                            : "w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400/80 ring-2 ring-emerald-300/40"
                        }`}
                      />
                    </div>
                  )}

                  {/* Piece Representation */}
                  {piece !== EMPTY && (
                    <div
                      key={isCurrentlySliding ? `sliding-${animatingMove?.id}` : undefined}
                      style={slideStyle}
                      className={`relative w-[82%] h-[82%] rounded-full flex items-center justify-center shadow-md ${
                        isCurrentlySliding
                          ? "animate-checkers-slide z-30 shadow-2xl"
                          : "transition-transform duration-150"
                      } ${
                        piecePlayer === "orange"
                          ? "bg-gradient-to-b from-[#ff6b2b] to-[#c23e00] text-amber-100 border-2 border-[#ff8c57]"
                          : "bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-blue-100 border-2 border-[#60a5fa]"
                      } ${
                        isSelected
                          ? "scale-110 ring-4 ring-amber-400 z-20 shadow-xl"
                          : isMovablePiece
                          ? "hover:scale-105 active:scale-95 ring-2 ring-white/60"
                          : ""
                      }`}
                    >
                      {/* Inner Circular Grooves for Realistic Checker Token */}
                      <div className="w-[66%] h-[66%] rounded-full border border-white/30 flex items-center justify-center pointer-events-none">
                        {isPieceKing && (
                          <CrownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200 drop-shadow" />
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* ─── Footer Controls ───────────────────────────────────────────── */}
      <footer className="w-full flex items-center justify-between text-xs text-[#78746d] mt-2 px-2">
        <button
          type="button"
          onClick={handleReturnToModes}
          className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Modes
        </button>

        <span className="text-[11px] font-medium">
          {sessionConfig.mode === "1v1"
            ? "Local Match"
            : sessionConfig.mode === "vs-bot"
            ? `Bot (${sessionConfig.difficulty})`
            : `Online (${online.myRole ?? "Spectating"})`}
        </span>

        <button
          type="button"
          onClick={() => startFreshMatch()}
          className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Reset
        </button>
      </footer>

      {/* ─── Result Popup ──────────────────────────────────────────────── */}
      {showResultPopup && !isPopupDismissed && (
        <GameResultPopup
          resultText={
            isOnlineMode && online.resultReason === "timeout"
              ? online.isWinner
                ? "Won on Time!"
                : "Timed Out"
              : isOnlineMode && online.resultReason === "disconnect_forfeit"
              ? online.isWinner
                ? "Opponent Forfeited"
                : "Match Forfeited"
              : currentWinner === "orange"
              ? "Orange Won!"
              : currentWinner === "blue"
              ? "Blue Won!"
              : "Match Draw"
          }
          accentColor={
            currentWinner === "orange"
              ? "#e0530a"
              : currentWinner === "blue"
              ? "#2563eb"
              : null
          }
          onPlayAgain={() => {
            soundManager.play("buttonClick");
            if (isOnlineMode) {
              online.requestRematch();
            } else {
              startFreshMatch();
            }
          }}
          onClose={() => setIsPopupDismissed(true)}
          onHome={handleReturnToModes}
          playAgainText={
            isOnlineMode
              ? online.hasRequestedRematch
                ? "Waiting for opponent..."
                : online.opponentRequestedRematch
                ? "Accept Rematch"
                : "Request Rematch"
              : "Play Again"
          }
        />
      )}
    </div>
  );
}
