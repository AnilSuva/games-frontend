"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard } from "@/games/common/resultSound";
import { useOnlineStarCatcher } from "@/platform/multiplayer/useOnlineStarCatcher";
import { GAME_WIDTH, GAME_HEIGHT, WINNING_SCORE } from "../config/constants";
import type {
  BotDifficulty,
  GameMode,
  PlayerRole,
  ShipState,
  StarCatcherScore,
} from "../game/types";

const STAR_CATCHER_MODES: GameModeOption[] = [
  {
    id: "1v1",
    label: "1v1",
    description: "Local 2-Player (Split-Screen Space Duel)",
  },
  {
    id: "bot",
    label: "Bot",
    description: "vs AI Computer",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot steering precision and hazard avoidance",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Launch Ship",
    },
  },
  {
    id: "online",
    label: "Online 1v1",
    description: "Live 2-Player Match (Room Code & Link)",
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center justify-center gap-4 text-[11px] text-[#9c978e]">
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
      Blue Ship (Top)
    </span>
    <span className="text-white/30">•</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
      Orange Ship (Bottom)
    </span>
  </div>
);

function StarIcon({ filled, color = "orange" }: { filled: boolean; color?: "orange" | "blue" }) {
  const glowClass =
    color === "orange"
      ? "text-[#fbbf24] drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]"
      : "text-[#60a5fa] drop-shadow-[0_0_6px_rgba(96,165,250,0.9)]";

  return (
    <svg
      className={`w-3.5 h-3.5 transition-all duration-300 ${
        filled
          ? `${glowClass} scale-110`
          : "text-slate-600/40 opacity-40 scale-95"
      }`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.5 : 2}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function StarCatcherGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/StarCatcherScene").StarCatcherScene | null>(null);

  // Pre-game state
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<GameMode>("1v1");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Online Ready Handshake & Synchronized Countdown
  const [isPhaserReady, setIsPhaserReady] = useState<boolean>(false);
  const [isLocalReady, setIsLocalReady] = useState<boolean>(false);
  const [isRemoteReadyEvent, setIsRemoteReadyEvent] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMatchStarted, setIsMatchStarted] = useState<boolean>(false);
  const countdownTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Live HUD state
  const [scores, setScores] = useState<StarCatcherScore>({ orange: 0, blue: 0 });
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlayerRole;
    score: StarCatcherScore;
  } | null>(null);

  // Online Multiplayer integration
  const online = useOnlineStarCatcher();
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

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
  }, [onLifecycleChange]);

  const clearCountdownTimers = useCallback(() => {
    countdownTimerRef.current.forEach((t) => clearTimeout(t));
    countdownTimerRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearCountdownTimers();
    };
  }, [clearCountdownTimers]);

  // Synchronized 3-2-1-Launch sequence
  const startCountdown = useCallback(
    (starPos?: { x: number; y: number }) => {
      clearCountdownTimers();
      setCountdown(3);
      soundManager.play("dropBall");

      const t1 = setTimeout(() => {
        setCountdown(2);
        soundManager.play("dropBall");
      }, 1000);

      const t2 = setTimeout(() => {
        setCountdown(1);
        soundManager.play("dropBall");
      }, 2000);

      const t3 = setTimeout(() => {
        setCountdown(0);
        soundManager.play("buttonClick");
        setIsMatchStarted(true);
        sceneRef.current?.startOnlineMatch(starPos);
      }, 3000);

      const t4 = setTimeout(() => {
        setCountdown(null);
      }, 3700);

      countdownTimerRef.current = [t1, t2, t3, t4];
    },
    [clearCountdownTimers]
  );

  const startCountdownRef = useRef(startCountdown);
  useEffect(() => {
    startCountdownRef.current = startCountdown;
  }, [startCountdown]);

  // Track opponent's ready state from server authoritative gameState or live event
  const opponentPlayerId = online.room?.players.find(
    (p) => p.playerId !== online.myPlayerId
  )?.playerId;

  const isRemoteReady =
    isRemoteReadyEvent ||
    Boolean(
      opponentPlayerId &&
        online.gameState?.readyPlayers?.includes(opponentPlayerId)
    );

  // Host triggers synchronized countdown when BOTH sides are fully rendered & ready
  useEffect(() => {
    if (selectedMode !== "online") return;
    if (!isLocalReady || !isRemoteReady) return;
    if (countdown !== null || isMatchStarted) return;

    if (online.isHost) {
      const starPos = {
        x: Math.floor(Math.random() * (GAME_WIDTH - 120) + 60),
        y: Math.floor(Math.random() * (GAME_HEIGHT - 240) + 120),
      };
      online.sendGameEvent("countdown_start", { starPos });
      startCountdownRef.current(starPos);
    }
  }, [
    selectedMode,
    isLocalReady,
    isRemoteReady,
    countdown,
    isMatchStarted,
    online.isHost,
    online,
  ]);

  // Mode Selection Handlers
  const handleSelectMode = useCallback(
    (modeId: string) => {
      soundManager.play("buttonClick");
      if (modeId === "online") {
        onlineResultSoundGuardRef.current.reset();
        setSelectedMode("online");
        setInModeSelection(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        setScores({ orange: 0, blue: 0 });
        setHasInteracted(false);
        setIsPhaserReady(false);
        setIsLocalReady(false);
        setIsRemoteReadyEvent(false);
        setCountdown(null);
        setIsMatchStarted(false);
        online.connect();
      } else {
        setSelectedMode(modeId as GameMode);
        setDifficulty("medium");
        setInModeSelection(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        setScores({ orange: 0, blue: 0 });
        setHasInteracted(false);
        setIsPhaserReady(false);
        setIsLocalReady(false);
        setIsRemoteReadyEvent(false);
        setCountdown(null);
        setIsMatchStarted(true);
        callbacksRef.current.onLifecycleChange?.("playing");
      }
    },
    [online]
  );

  const handleSelectConfiguredMode = useCallback(
    (modeId: string, configValue: string) => {
      soundManager.play("buttonClick");
      setSelectedMode(modeId as GameMode);
      setDifficulty(configValue as BotDifficulty);
      setInModeSelection(false);
      setIsPopupDismissed(false);
      setGameOverResult(null);
      setScores({ orange: 0, blue: 0 });
      setHasInteracted(false);
      setIsPhaserReady(false);
      setIsLocalReady(false);
      setIsRemoteReadyEvent(false);
      setCountdown(null);
      setIsMatchStarted(true);
      callbacksRef.current.onLifecycleChange?.("playing");
    },
    []
  );

  const handleBackToModeSelect = useCallback(() => {
    soundManager.play("buttonClick");
    onlineResultSoundGuardRef.current.reset();
    clearCountdownTimers();
    if (selectedMode === "online") {
      online.leaveRoom();
    }
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    sceneRef.current = null;
    setInModeSelection(true);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ orange: 0, blue: 0 });
    setHasInteracted(false);
    setIsPhaserReady(false);
    setIsLocalReady(false);
    setIsRemoteReadyEvent(false);
    setCountdown(null);
    setIsMatchStarted(false);
    callbacksRef.current.onLifecycleChange?.("pre-game");
  }, [clearCountdownTimers, online, selectedMode]);

  // Clean unmount
  useEffect(() => {
    return () => {
      onlineRef.current.disconnect();
    };
  }, []);

  // Restart / Rematch Handler
  const handleRestart = useCallback(() => {
    soundManager.play("buttonClick");
    if (selectedMode === "online") {
      online.requestRematch();
      return;
    }
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ orange: 0, blue: 0 });
    sceneRef.current?.restartGame(selectedMode, difficulty);
    callbacksRef.current.onLifecycleChange?.("playing");
    callbacksRef.current.onScoreUpdate?.(0);
  }, [difficulty, online, selectedMode]);

  const handleRestartRef = useRef(handleRestart);
  useEffect(() => {
    handleRestartRef.current = handleRestart;
  });

  // Online Rematch Trigger
  const prevOnlineStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMode !== "online") return;
    const currentStatus = online.gameState?.status;
    const prevStatus = prevOnlineStatusRef.current;
    prevOnlineStatusRef.current = currentStatus ?? null;

    if (
      (prevStatus === "won" || prevStatus === "abandoned") &&
      currentStatus === "in_progress"
    ) {
      setIsPopupDismissed(false);
      setGameOverResult(null);
      setScores({ orange: 0, blue: 0 });
      onlineResultSoundGuardRef.current.reset();
      clearCountdownTimers();
      setIsMatchStarted(false);
      setCountdown(null);
      setIsLocalReady(true);
      setIsRemoteReadyEvent(false);

      sceneRef.current?.restartGame(
        "online",
        undefined,
        online.myRole ?? "orange"
      );
      online.sendReady();
      callbacksRef.current.onLifecycleChange?.("playing");
      callbacksRef.current.onScoreUpdate?.(0);
    }
  }, [clearCountdownTimers, selectedMode, online.gameState?.status, online]);

  // Online Result Sounds & Game Over Notification
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
      callbacksRef.current.onGameOver({
        winner: winner === "orange" ? "Orange" : "Blue",
        score:
          online.myRole === "orange"
            ? online.gameState?.scores.orange ?? 0
            : online.gameState?.scores.blue ?? 0,
        details: {
          winnerColor: winner,
          mode: "online",
          game: "star-catcher",
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
  ]);

  // Handle Disconnect Grace Pause in Online Mode
  useEffect(() => {
    if (selectedMode !== "online") return;
    if (online.isMatchPaused) {
      sceneRef.current?.pauseGame();
    } else {
      sceneRef.current?.resumeGame();
    }
  }, [selectedMode, online.isMatchPaused]);

  // Determine whether match is live vs waiting in lobby
  const isInOnlineMatch =
    selectedMode === "online" &&
    (online.connectionState === "in_game" || online.connectionState === "game_over") &&
    Boolean(online.gameState);

  const isOnlineLobby = selectedMode === "online" && !isInOnlineMatch;

  // Phaser Initialization when match is ready
  useEffect(() => {
    if (inModeSelection || isOnlineLobby) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { StarCatcherScene } = await import("../game/StarCatcherScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        backgroundColor: "#070a12",
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

        const myRole: PlayerRole =
          selectedMode === "online"
            ? onlineRef.current.myRole ?? "orange"
            : "orange";

        const onScoreUpdateHandler = (newScores: StarCatcherScore) => {
          if (!isMounted) return;
          setScores({ ...newScores });
          callbacksRef.current.onScoreUpdate?.(newScores.orange);
        };

        const onGameOverHandler = (
          winner: PlayerRole,
          finalScores: StarCatcherScore
        ) => {
          if (!isMounted) return;
          setGameOverResult({ winner, score: finalScores });

          if (selectedMode !== "online") {
            callbacksRef.current.onGameOver({
              winner: winner === "orange" ? "Orange" : "Blue",
              score: winner === "orange" ? finalScores.orange : finalScores.blue,
              details: {
                game: "star-catcher",
                mode: selectedMode,
                difficulty,
                scores: finalScores,
              },
            });
          } else if (onlineRef.current.isHost) {
            onlineRef.current.sendGameEvent("game_over", {
              winner,
              scores: finalScores,
            });
          }
        };

        const scene = gameInstance.scene.add(
          "StarCatcherScene",
          StarCatcherScene,
          true,
          {
            mode: selectedMode,
            difficulty,
            myRole,
            callbacks: {
              onScoreUpdate: onScoreUpdateHandler,
              onStarCollected: (collector: PlayerRole, newScores: StarCatcherScore) => {
                if (selectedMode === "online" && onlineRef.current.isHost) {
                  onlineRef.current.sendGameEvent("star_collected", {
                    collector,
                    scores: newScores,
                  });
                  onlineRef.current.sendGameEvent("score_update", {
                    collector,
                    scores: newScores,
                  });
                }
              },
              onGameOver: onGameOverHandler,
              onLocalShipSync: (shipState: ShipState) => {
                if (selectedMode === "online") {
                  onlineRef.current.sendInput("ship_sync", shipState);
                }
              },
              onStarSpawn: (pos: { x: number; y: number }) => {
                if (selectedMode === "online" && onlineRef.current.isHost) {
                  onlineRef.current.sendGameEvent("star_spawn", pos);
                }
              },
              onBlackHoleSpawn: (pos: { x: number; y: number }) => {
                if (selectedMode === "online" && onlineRef.current.isHost) {
                  onlineRef.current.sendGameEvent("black_hole_spawn", pos);
                }
              },
              onBlackHoleDespawn: () => {
                if (selectedMode === "online" && onlineRef.current.isHost) {
                  onlineRef.current.sendGameEvent("black_hole_despawn");
                }
              },
              onSceneReady: () => {
                if (!isMounted) return;
                setIsPhaserReady(true);
                if (selectedMode === "online") {
                  setIsLocalReady(true);
                  onlineRef.current.sendReady();
                } else {
                  setIsMatchStarted(true);
                }
              },
            },
          }
        ) as import("../game/StarCatcherScene").StarCatcherScene;

        sceneRef.current = scene;

        if (selectedMode === "online") {
          onlineRef.current.setOnRemoteInput((data) => {
            if (data.input === "ship_sync" && data.data) {
              scene.handleRemoteShipSync(data.data as ShipState);
            }
          });

          onlineRef.current.setOnRemoteEvent((eventData) => {
            if (eventData.event === "player_ready") {
              setIsRemoteReadyEvent(true);
            } else if (eventData.event === "countdown_start") {
              setIsRemoteReadyEvent(true);
              const d = eventData.data as { starPos?: { x: number; y: number } } | undefined;
              startCountdownRef.current(d?.starPos);
            } else if (eventData.event === "star_spawn" && eventData.data) {
              scene.handleRemoteStarSpawn(
                eventData.data as { x: number; y: number }
              );
            } else if (eventData.event === "star_collected" && eventData.data) {
              const d = eventData.data as {
                collector: PlayerRole;
                scores: StarCatcherScore;
              };
              scene.handleRemoteStarCollected(d.collector, d.scores);
            } else if (eventData.event === "black_hole_spawn" && eventData.data) {
              scene.handleRemoteBlackHoleSpawn(
                eventData.data as { x: number; y: number }
              );
            } else if (eventData.event === "black_hole_despawn") {
              scene.handleRemoteBlackHoleDespawn();
            }
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

        callbacksRef.current.onLifecycleChange?.("playing");
        callbacksRef.current.onReady(controller);
      });
    }

    initPhaser();

    const resizeObserver = new ResizeObserver(() => {
      if (phaserGameRef.current) {
        phaserGameRef.current.scale.refresh();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (gameInstance) {
        gameInstance.destroy(true);
        phaserGameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [inModeSelection, isOnlineLobby, selectedMode, difficulty]);

  // Active display scores
  const displayScores: StarCatcherScore =
    selectedMode === "online" && online.gameState?.scores
      ? online.gameState.scores
      : scores;

  // Dynamic match alert badge text
  const matchAlertText = (() => {
    if (selectedMode === "online" && !isMatchStarted) {
      if (countdown !== null) return `LAUNCH IN ${countdown}s`;
      if (!isRemoteReady) return "SYNCING RIVAL...";
      return "PRIMING SHIPS...";
    }
    if (displayScores.orange === 4 && displayScores.blue === 4) return "FINAL MATCH POINT! ⚡";
    if (displayScores.orange === 4) return "ORANGE MATCH POINT! 🎯";
    if (displayScores.blue === 4) return "BLUE MATCH POINT! 🎯";
    if (displayScores.orange > 0 && displayScores.orange === displayScores.blue) {
      return `TIED ${displayScores.orange} - ${displayScores.blue}`;
    }
    if (selectedMode === "bot") return `BOT • ${difficulty.toUpperCase()}`;
    if (selectedMode === "online") return `ROOM ${online.room?.roomCode ?? "ONLINE"}`;
    return "FIRST TO 5 STARS";
  })();

  // 1. Mode Selection Screen
  if (inModeSelection) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-[#07090e] p-2 sm:p-4">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-orange-600/10 blur-[100px]" />
        </div>
        <GameModeSelector
          gameTitle="Star Catcher"
          modes={STAR_CATCHER_MODES}
          onSelectMode={handleSelectMode}
          onSelectConfiguredMode={handleSelectConfiguredMode}
          onScreenChange={(screen) =>
            callbacksRef.current.onLifecycleChange?.(
              screen === "config" ? "configuration" : "pre-game"
            )
          }
          footer={PLAYER_COLOR_FOOTER}
        />
      </div>
    );
  }

  // 2. Online Lobby Screen
  if (isOnlineLobby) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-[#07090e]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-orange-600/10 blur-[100px]" />
        </div>
        <OnlineMatchLobby
          gameTitle="Star Catcher"
          subtitle="Real-time cosmic dogfight for stellar cores"
          connectionState={online.connectionState}
          room={online.room}
          errorMessage={online.errorMessage}
          onCreateRoom={() => online.createRoom()}
          onJoinRoom={(code) => online.joinRoom(code)}
          onLeaveRoom={() => online.leaveRoom()}
          onReturnToModes={handleBackToModeSelect}
        />
      </div>
    );
  }

  // 3. Active Game Screen
  const showResultPopup =
    selectedMode === "online" ? online.isGameOver : gameOverResult !== null;

  const winnerRole =
    selectedMode === "online"
      ? (online.winner as PlayerRole | null) ?? gameOverResult?.winner ?? null
      : gameOverResult?.winner ?? null;

  const resultPopupText = (() => {
    if (selectedMode === "online") {
      if (online.gameState?.status === "abandoned") {
        return online.isWinner
          ? "Opponent Forfeited — Victory!"
          : "Match Abandoned";
      }
      if (winnerRole) {
        return online.isWinner
          ? `Victory! You Won! (${displayScores.orange} - ${displayScores.blue})`
          : `Defeat! Opponent Won! (${displayScores.orange} - ${displayScores.blue})`;
      }
    }
    return `${
      winnerRole === "orange" ? "Orange Ship" : "Blue Ship"
    } Victorious! (${displayScores.orange} - ${displayScores.blue})`;
  })();

  const resultPopupAccentColor =
    selectedMode === "online"
      ? online.isWinner
        ? "#10b981"
        : "#ef4444"
      : winnerRole === "orange"
      ? "#e0530a"
      : "#2563eb";

  const playAgainButtonText = (() => {
    if (selectedMode !== "online") return "Play Again";
    if (online.hasRequestedRematch) return "Waiting for Opponent...";
    if (online.opponentRequestedRematch) return "Accept Rematch";
    return "Rematch";
  })();

  const topPlayerLabel = (() => {
    if (selectedMode === "bot") return "Bot";
    if (selectedMode === "online") {
      return online.myRole === "blue" ? "You (Blue)" : "Opponent";
    }
    return "P2";
  })();

  const bottomPlayerLabel = (() => {
    if (selectedMode === "bot") return "You";
    if (selectedMode === "online") {
      return online.myRole === "orange" ? "You (Orange)" : "Opponent";
    }
    return "P1";
  })();

  const controlsHint = (() => {
    if (selectedMode === "online") {
      if (!isMatchStarted) return "Engines Primed";
      return online.myRole === "blue"
        ? "[WASD / Drag] Blue Ship"
        : "[WASD / Drag] Orange Ship";
    }
    return "[WASD / Drag] Fly";
  })();

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-[#07090e] p-2 sm:p-4">
      {/* Ambient Cosmic Radial Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-orange-600/10 blur-[100px]" />
      </div>

      <div
        className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border border-slate-700/60 shadow-[0_0_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10 bg-[#070a12]"
        style={{
          width:
            "min(calc(100% - 0.5rem), calc((100dvh - 4.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 360 / 600), 420px)",
          aspectRatio: "360 / 600",
          maxHeight: "100%",
        }}
        onPointerDown={() => setHasInteracted(true)}
      >
        {/* Loading Overlay while Phaser bundle and textures are compiling on device */}
        {selectedMode === "online" && !isPhaserReady && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07090e] p-6 text-center select-none">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-blue-500/30 border-b-blue-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
            <span className="text-xs font-bold tracking-widest text-slate-200 uppercase font-mono">
              Initializing Arena...
            </span>
            <span className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
              Compiling starfighters &amp; cosmic systems
            </span>
          </div>
        )}

        {/* Sync Barrier: Waiting for opponent to finish rendering */}
        {selectedMode === "online" && isPhaserReady && (!isLocalReady || !isRemoteReady) && (
          <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-6 text-center select-none">
            <div className="flex flex-col items-center p-5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl max-w-xs text-center">
              <div className="relative w-10 h-10 mb-3 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                Syncing Starfighters
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Waiting for opponent to finish rendering...
              </span>
              <div className="flex items-center justify-center gap-3 mt-4 text-[11px] font-mono">
                <span
                  className={`flex items-center gap-1.5 font-semibold ${
                    isLocalReady ? "text-emerald-400" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLocalReady ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                    }`}
                  />
                  You: {isLocalReady ? "Ready ✓" : "Loading"}
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`flex items-center gap-1.5 font-semibold ${
                    isRemoteReady ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRemoteReady ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"
                    }`}
                  />
                  Rival: {isRemoteReady ? "Ready ✓" : "Rendering"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Synchronized Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 z-28 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] select-none pointer-events-none">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-300 font-mono mb-1 drop-shadow-md">
                Match Starts In
              </span>
              <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider drop-shadow-[0_0_25px_rgba(251,191,36,0.9)] text-amber-400 animate-pulse">
                {countdown === 0 ? "LAUNCH!" : countdown}
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-2">
                {countdown === 0 ? "Engines Engaged!" : "All Systems Nominal"}
              </span>
            </div>
          </div>
        )}

        {/* Disconnect Grace Banner */}
        {selectedMode === "online" && online.isMatchPaused && (
          <div className="absolute inset-x-4 top-16 z-30 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-md animate-pulse">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Opponent Disconnected
            </span>
            <span className="text-[11px] text-slate-300 mt-0.5">
              Waiting for reconnection... Forfeit in {online.disconnectGraceSecondsRemaining}s
            </span>
          </div>
        )}

        {/* Top Player HUD (Blue / Top) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
          {/* Blue Star Count & Player Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-md backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)] animate-pulse" />
              {topPlayerLabel}
            </span>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1">
              {Array.from({ length: WINNING_SCORE }).map((_, i) => (
                <StarIcon key={i} filled={i < displayScores.blue} color="blue" />
              ))}
            </div>
          </div>

          {/* Center Status / Lead Badge */}
          <div className="px-2.5 py-1 rounded-full bg-slate-900/85 border border-slate-700/80 shadow-xs backdrop-blur-md text-[10px] font-bold text-slate-300 font-mono tracking-tight">
            {matchAlertText}
          </div>

          {/* Blue Score & Quick Mode Selector */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-blue-500/20 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.25)] backdrop-blur-md">
              <span className="text-xs font-black text-blue-300 font-mono leading-none drop-shadow-[0_0_6px_rgba(96,165,250,0.8)]">
                {displayScores.blue}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBackToModeSelect}
              className="pointer-events-auto px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-600/80 text-[10px] font-semibold text-slate-300 hover:text-white shadow-xs transition active:scale-95 cursor-pointer backdrop-blur-md"
              aria-label="Change Mode"
            >
              Mode
            </button>
          </div>
        </div>

        {/* Bottom Player HUD (Orange / Bottom) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
          {/* Orange Star Count & Player Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-md backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] animate-pulse" />
              {bottomPlayerLabel}
            </span>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1">
              {Array.from({ length: WINNING_SCORE }).map((_, i) => (
                <StarIcon key={i} filled={i < displayScores.orange} color="orange" />
              ))}
            </div>
          </div>

          {/* Desktop Controls Hint */}
          <div className="hidden sm:inline px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/70 shadow-xs backdrop-blur-md text-[10px] font-medium text-slate-400 font-mono">
            {controlsHint}
          </div>

          {/* Target Stars notice & Orange Score Pill */}
          <div className="flex items-center gap-1.5">
            <div className="hidden xs:flex items-center px-2 py-1 rounded-full bg-slate-900/75 border border-slate-700/60 text-[10px] font-semibold text-slate-400">
              Target: {WINNING_SCORE}
            </div>

            <div className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-orange-500/20 border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.25)] backdrop-blur-md">
              <span className="text-xs font-black text-orange-300 font-mono leading-none drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]">
                {displayScores.orange}
              </span>
            </div>
          </div>
        </div>

        {/* Initial Mobile Touch Prompt */}
        {!hasInteracted && selectedMode !== "online" && (
          <div className="absolute inset-x-8 bottom-16 pointer-events-none z-10 flex flex-col items-center justify-center animate-pulse">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-orange-500/40 text-orange-300 text-[11px] font-semibold shadow-lg backdrop-blur-md tracking-wide">
              ✦ Touch &amp; Drag Anywhere to Steer ✦
            </div>
          </div>
        )}

        {/* Phaser Canvas Container */}
        <div
          ref={containerRef}
          className="w-full h-full touch-none select-none"
          tabIndex={0}
          aria-label="Star Catcher Game Arena"
        />

        {/* Game Over Result Popup */}
        {showResultPopup && !isPopupDismissed && (
          <GameResultPopup
            resultText={resultPopupText}
            accentColor={resultPopupAccentColor}
            onPlayAgain={handleRestart}
            onClose={() => setIsPopupDismissed(true)}
            onHome={handleBackToModeSelect}
            playAgainText={playAgainButtonText}
          />
        )}
      </div>
    </div>
  );
}
