"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { consumeStartingPlayer, type PlatformPlayer } from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/balance";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { useOnlineBrickBlast } from "@/platform/multiplayer/useOnlineBrickBlast";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";

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
    id: "online",
    label: "Online",
    description: "Play with a Friend",
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

type BrickBlastGameMode = "1v1" | "vs-bot" | "online";

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
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<BrickBlastGameMode>("1v1");
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [botPaddle] = useState<PlatformPlayer>("blue");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlatformPlayer;
    score: number;
  } | null>(null);

  // Online multiplayer integration
  const online = useOnlineBrickBlast();

  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

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

  useEffect(() => {
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange]);

  useEffect(() => {
    void soundManager.preloadResultSounds();
  }, []);

  const handleSelectMode = useCallback(
    (modeId: string) => {
      if (modeId === "1v1") {
        resultSoundGuardRef.current.reset();
        setSelectedMode("1v1");
        setInModeSelection(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        onLifecycleChange?.("playing");
        onScoreUpdate?.(0);
      } else if (modeId === "online") {
        resultSoundGuardRef.current.reset();
        onlineResultSoundGuardRef.current.reset();
        setSelectedMode("online");
        setInModeSelection(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        online.connect();
      }
    },
    [onLifecycleChange, onScoreUpdate, online]
  );

  const handleReturnToModes = useCallback(() => {
    resultSoundGuardRef.current.reset();
    onlineResultSoundGuardRef.current.reset();
    if (selectedMode === "online") {
      online.leaveRoom();
    }
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    sceneRef.current = null;
    setSelectedMode("1v1");
    setInModeSelection(true);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange, online, selectedMode]);

  // Handle online rematch start
  const prevOnlineStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMode !== "online") return;
    const currentStatus = online.gameState?.status;
    const prevStatus = prevOnlineStatusRef.current;
    prevOnlineStatusRef.current = currentStatus ?? null;

    if (prevStatus === "won" && currentStatus === "in_progress") {
      onlineResultSoundGuardRef.current.reset();
      setIsPopupDismissed(false);
      setGameOverResult(null);
      const nextStarter = online.gameState?.startingPlayer || "orange";
      sceneRef.current?.restartMatch(nextStarter, "online", undefined, {
        sendInput: online.sendInput,
        sendGameEvent: online.sendGameEvent,
        sendBallSync: online.sendBallSync,
        sendBrickDestroyed: online.sendBrickDestroyed,
        myRole: online.myRole ?? "orange",
        myPlayerId: online.myPlayerId ?? undefined,
        isHost: online.myRole === "orange",
      });
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    }
  }, [
    selectedMode,
    online.gameState?.status,
    online.gameState?.startingPlayer,
    online.sendInput,
    online.sendGameEvent,
    online.sendBallSync,
    online.sendBrickDestroyed,
    online.myRole,
    online.myPlayerId,
    onLifecycleChange,
    onScoreUpdate,
  ]);

  // Handle online match pause/resume on disconnect
  const wasOnlinePausedRef = useRef(false);
  useEffect(() => {
    if (selectedMode !== "online") return;
    if (online.isMatchPaused) {
      wasOnlinePausedRef.current = true;
      sceneRef.current?.pauseGame();
    } else if (wasOnlinePausedRef.current && online.connectionState === "in_game") {
      wasOnlinePausedRef.current = false;
      sceneRef.current?.resumeGame();
    }
  }, [selectedMode, online.isMatchPaused, online.connectionState]);

  // Handle online game over sound and callback
  useEffect(() => {
    if (selectedMode !== "online" || !online.isGameOver) return;
    const winner = online.gameState?.winner;

    if (online.isWinner) {
      if (onlineResultSoundGuardRef.current.claim("victory") === "victory") {
        soundManager.playVictory();
      }
    } else if (online.isLoser) {
      if (onlineResultSoundGuardRef.current.claim("lose") === "lose") {
        soundManager.playLose();
      }
    }

    if (winner) {
      onGameOver({
        winner: winner === "orange" ? "Orange" : "Blue",
        score:
          online.myRole === "orange"
            ? online.gameState?.scores.orange ?? 0
            : online.gameState?.scores.blue ?? 0,
        details: {
          winnerColor: winner,
          mode: "online",
          game: "brick-blast",
          resultReason: online.gameState?.resultReason,
        },
      });
    }
  }, [
    selectedMode,
    online.isGameOver,
    online.isWinner,
    online.isLoser,
    online.gameState?.winner,
    online.gameState?.scores,
    online.gameState?.resultReason,
    online.myRole,
    onGameOver,
  ]);

  // Stable ref to the current restart handler
  const handleRestartRef = useRef<() => void>(() => {});

  const handleRestart = useCallback(() => {
    if (selectedMode === "online") {
      online.requestRematch();
      return;
    }
    const nextStarter = consumeStartingPlayer("brick-blast");
    resultSoundGuardRef.current.reset();
    setIsPopupDismissed(false);
    setGameOverResult(null);
    sceneRef.current?.restartMatch(nextStarter, selectedMode, botDifficulty, undefined, botPaddle);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [botDifficulty, botPaddle, onLifecycleChange, onScoreUpdate, online, selectedMode]);

  useEffect(() => {
    handleRestartRef.current = handleRestart;
  });

  const handleSelectConfiguredMode = useCallback(
    (modeId: string, value: string) => {
      if (modeId !== "bot") return;
      resultSoundGuardRef.current.reset();
      setSelectedMode("vs-bot");
      setBotDifficulty(value === "easy" || value === "hard" ? value : "medium");
      setInModeSelection(false);
      setIsPopupDismissed(false);
      setGameOverResult(null);
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [onLifecycleChange, onScoreUpdate]
  );

  // Phaser Game instance lifecycle: mounted strictly when in an active game
  const isInOnlineMatch =
    selectedMode === "online" &&
    (online.connectionState === "in_game" || online.connectionState === "game_over") &&
    Boolean(online.gameState);

  const isOnlineLobby = selectedMode === "online" && !isInOnlineMatch;

  useEffect(() => {
    if (inModeSelection || isOnlineLobby) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { BrickBlastScene } = await import("../game/BrickBlastScene");

      const startingPlayer =
        selectedMode === "online"
          ? onlineRef.current.gameState?.startingPlayer || "orange"
          : consumeStartingPlayer("brick-blast");

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

        const localPlayerRole: PlatformPlayer = onlineRef.current.myRole ?? "orange";
        const isHost: boolean = onlineRef.current.myRole === "orange";

        const scene = gameInstance.scene.add("BrickBlastScene", BrickBlastScene, true, {
          startingPlayer,
          mode: selectedMode,
          difficulty: botDifficulty,
          botPaddle,
          localPlayerRole,
          isHost,
          online:
            selectedMode === "online"
              ? {
                  sendInput: (input: string, data?: unknown) =>
                    onlineRef.current.sendInput(input, data as Parameters<typeof onlineRef.current.sendInput>[1]),
                  sendGameEvent: (event: string, data?: unknown) =>
                    onlineRef.current.sendGameEvent(event, data as Parameters<typeof onlineRef.current.sendGameEvent>[1]),
                  sendBallSync: (data: Parameters<typeof onlineRef.current.sendBallSync>[0]) =>
                    onlineRef.current.sendBallSync(data),
                  sendBrickDestroyed: (data: Parameters<typeof onlineRef.current.sendBrickDestroyed>[0]) =>
                    onlineRef.current.sendBrickDestroyed(data),
                  myRole: onlineRef.current.myRole ?? "orange",
                  myPlayerId: onlineRef.current.myPlayerId ?? undefined,
                  isHost,
                }
              : undefined,
          callbacks: {
            onScoreUpdate: (score: number) => {
              if (!isMounted) return;
              callbacksRef.current.onScoreUpdate?.(score);
            },
            onLevelChange: () => {
              // Level transitions are handled internally in Phaser
            },
            onGameOver: (result: { winner: PlatformPlayer; score: number }) => {
              if (!isMounted) return;

              if (selectedMode !== "online") {
                const humanPlayer: PlatformPlayer =
                  selectedMode === "vs-bot" && botPaddle === "orange" ? "blue" : "orange";
                const resultSound = resultSoundGuardRef.current.claim(
                  getResultSound({
                    mode: selectedMode,
                    winner: result.winner,
                    humanPlayer,
                  })
                );
                if (resultSound === "victory") soundManager.playVictory();
                if (resultSound === "lose") soundManager.playLose();

                setGameOverResult(result);
                callbacksRef.current.onGameOver({
                  winner: result.winner === "orange" ? "Orange" : "Blue",
                  score: result.score,
                  details: {
                    winnerColor: result.winner,
                    mode: selectedMode,
                    game: "brick-blast",
                  },
                });
              }
            },
            onLifecycleChange: (status: "playing" | "paused" | "finished") => {
              if (status === "playing" || status === "finished") {
                callbacksRef.current.onLifecycleChange?.(status);
              }
            },
          },
        }) as import("../game/BrickBlastScene").BrickBlastScene;

        sceneRef.current = scene;

        if (selectedMode === "online") {
          onlineRef.current.setRemoteHandlers({
            onRemoteInput: (data) => scene.handleRemoteInput(data),
            onRemoteEvent: (data) => scene.handleRemoteEvent(data),
            onBallSync: (data) => scene.handleBallSync(data),
            onBrickDestroyed: (data) => scene.handleBrickDestroyed(data),
          });
        }

        const controller: IGameController = {
          restart: () => handleRestartRef.current(),
          pause: () => scene.pauseGame(),
          resume: () => scene.resumeGame(),
          destroy: () => {
            gameInstance?.destroy(true);
            phaserGameRef.current = null;
          },
        };

        if (selectedMode === "online") {
          callbacksRef.current.onLifecycleChange?.("playing");
        }
        callbacksRef.current.onReady(controller);
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
  }, [
    inModeSelection,
    isOnlineLobby,
    selectedMode,
    botDifficulty,
    botPaddle,
  ]);

  // Mode Selection Overlay
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

  // Online Match Lobby
  if (isOnlineLobby) {
    return (
      <OnlineMatchLobby
        gameTitle="Brick Blast"
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

  const isOnline = selectedMode === "online";
  const isMatchOver = isOnline ? online.isGameOver : Boolean(gameOverResult);

  const resultMessage = isOnline
    ? online.isWinner
      ? online.gameState?.resultReason === "disconnect_forfeit"
        ? "Opponent forfeited • You won!"
        : "You won!"
      : online.isLoser
      ? online.gameState?.resultReason === "disconnect_forfeit"
        ? "Forfeited"
        : "Opponent won"
      : "Match Over"
    : gameOverResult?.winner === "orange"
    ? "Orange won"
    : gameOverResult?.winner === "blue"
    ? "Blue won"
    : "Match Over";

  const resultAccent = isOnline
    ? online.gameState?.winner === "orange"
      ? "#e0530a"
      : online.gameState?.winner === "blue"
      ? "#2563eb"
      : null
    : gameOverResult?.winner === "orange"
    ? "#e0530a"
    : gameOverResult?.winner === "blue"
    ? "#2563eb"
    : null;

  const rematchText = isOnline
    ? online.hasRequestedRematch && !online.opponentRequestedRematch
      ? "Waiting for opponent..."
      : online.opponentRequestedRematch
      ? "Accept Rematch"
      : "Play Again"
    : "Play Again";

  return (
    <div className="flex flex-col items-center w-full gap-2 select-none">
      {/* Online Status Bar */}
      {isOnline && (
        <div className="w-full max-w-[360px] flex items-center justify-between px-3 py-1.5 bg-white border border-[#e6e3dc] rounded-xl text-xs shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                online.myRole === "orange" ? "bg-[#e0530a]" : "bg-[#2563eb]"
              }`}
            />
            <span className="text-[#1c1917]">
              You ({online.myRole === "orange" ? "Orange" : "Blue"})
            </span>
          </div>

          {online.isMatchPaused && online.disconnectGraceSecondsRemaining !== null ? (
            <span className="text-amber-600 font-semibold animate-pulse text-[11px]">
              Opponent disconnected • Forfeit in {online.disconnectGraceSecondsRemaining}s
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-[#6b665f] text-[11px]">
              <span>vs Opponent ({online.myRole === "orange" ? "Blue" : "Orange"})</span>
            </div>
          )}
        </div>
      )}

      {/* 2-Player Arena Container */}
      <div className="active-board-brick relative aspect-[360/580] overflow-hidden bg-[#faf9f6]">
        <div
          ref={containerRef}
          className="w-full h-full touch-none"
          tabIndex={0}
          aria-label="Brick Blast 2-Player Game Arena"
        />

        {isMatchOver && !isPopupDismissed && (
          <GameResultPopup
            resultText={resultMessage}
            accentColor={resultAccent}
            playAgainText={rematchText}
            onClose={() => setIsPopupDismissed(true)}
            onPlayAgain={() => {
              if (isOnline) {
                soundManager.play("buttonClick");
                online.requestRematch();
              } else {
                handleRestart();
              }
            }}
            onHome={() => {
              if (isOnline) {
                online.leaveRoom();
              }
            }}
          />
        )}
      </div>

      {/* Minimal Bottom Control Bar: Modes & Reset */}
      <div className="w-full max-w-[380px] flex items-center justify-between px-1 min-h-[32px]">
        {!isMatchOver ? (
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

            {!isOnline && (
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
            )}
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
                if (isOnline) {
                  online.requestRematch();
                } else {
                  handleRestart();
                }
              }}
              disabled={isOnline && online.hasRequestedRematch && !online.opponentRequestedRematch}
              className="text-[11px] font-medium text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors cursor-pointer p-1 disabled:opacity-50"
            >
              {rematchText}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
