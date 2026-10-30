"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard } from "@/games/common/resultSound";
import { useOnlineDodgeArena } from "@/platform/multiplayer/useOnlineDodgeArena";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/balance";
import type { DodgeArenaScene } from "../game/DodgeArenaScene";
import { dodgeAudio } from "../game/audio";
import type { BotDifficulty, DodgePlayerColor, GameMode } from "../logic/types";

const DODGE_ARENA_MODES: GameModeOption[] = [
  {
    id: "1v1",
    label: "Local 1v1",
    description: "Shared screen survival duel (WASD & Arrows / Split-Touch / Mouse)",
  },
  {
    id: "bot",
    label: "vs Bot",
    description: "Challenge AI computer with intelligent hazard evasion",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot reaction speed and evasion intelligence",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Enter Arena",
    },
  },
  {
    id: "online",
    label: "Online 1v1",
    description: "Real-time multiplayer duel with server synchronization",
  },
];

function HeartIcon({ filled, color }: { filled: boolean; color: "orange" | "blue" }) {
  const fillColor = color === "orange" ? "#f97316" : "#3b82f6";
  const glow =
    color === "orange"
      ? "drop-shadow(0 0 6px rgba(249,115,22,0.85))"
      : "drop-shadow(0 0 6px rgba(59,130,246,0.85))";

  return (
    <svg
      className={`w-3.5 h-3.5 transition-all duration-300 ${
        filled ? "scale-105" : "opacity-25 scale-90"
      }`}
      style={{ filter: filled ? glow : "none" }}
      viewBox="0 0 24 24"
      fill={filled ? fillColor : "none"}
      stroke={filled ? fillColor : "#64748b"}
      strokeWidth={2}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function DodgeArenaGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DodgeArenaScene | null>(null);

  // Pre-game state
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<GameMode>("1v1");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  // Match HUD state
  const [lives, setLives] = useState<{ orange: number; blue: number }>({ orange: 3, blue: 3 });
  const [currentWave, setCurrentWave] = useState<number>(1);
  const [matchSeconds, setMatchSeconds] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMatchStarted, setIsMatchStarted] = useState<boolean>(false);
  const [gameOverResult, setGameOverResult] = useState<DodgePlayerColor | "draw" | null>(null);

  // Online Ready Handshake
  const [isPhaserReady, setIsPhaserReady] = useState<boolean>(false);
  const [isRemoteReadyEvent, setIsRemoteReadyEvent] = useState<boolean>(false);

  const online = useOnlineDodgeArena();
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  const callbacksRef = useRef({ onGameOver, onScoreUpdate, onReady, onLifecycleChange });
  useEffect(() => {
    callbacksRef.current = { onGameOver, onScoreUpdate, onReady, onLifecycleChange };
  });

  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchClockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (matchClockIntervalRef.current) {
      clearInterval(matchClockIntervalRef.current);
      matchClockIntervalRef.current = null;
    }
  }, []);

  // Snappy countdown runner (750ms per tick)
  const startCountdown = useCallback((onFinish: () => void) => {
    let count = 3;
    setCountdown(count);
    dodgeAudio.playCountdown(false);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        dodgeAudio.playCountdown(false);
      } else if (count === 0) {
        setCountdown(0); // "GO!"
        dodgeAudio.playCountdown(true);
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        setIsMatchStarted(true);
        onFinish();
      }
    }, 750);
  }, []);

  // Skip instructions / countdown on user tap
  const handleStartImmediately = useCallback(() => {
    if (isMatchStarted || selectedMode === "online") return;
    clearTimers();
    setCountdown(null);
    setIsMatchStarted(true);
    sceneRef.current?.startMatch();
  }, [clearTimers, isMatchStarted, selectedMode]);

  // Start match clock timer
  useEffect(() => {
    if (!isMatchStarted || gameOverResult !== null) {
      if (matchClockIntervalRef.current) {
        clearInterval(matchClockIntervalRef.current);
        matchClockIntervalRef.current = null;
      }
      return;
    }

    matchClockIntervalRef.current = setInterval(() => {
      setMatchSeconds((sec) => sec + 1);
    }, 1000);

    return () => {
      if (matchClockIntervalRef.current) {
        clearInterval(matchClockIntervalRef.current);
        matchClockIntervalRef.current = null;
      }
    };
  }, [isMatchStarted, gameOverResult]);

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
        setLives({ orange: 3, blue: 3 });
        setCurrentWave(1);
        setMatchSeconds(0);
        setIsPhaserReady(false);
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
        setLives({ orange: 3, blue: 3 });
        setCurrentWave(1);
        setMatchSeconds(0);
        setIsPhaserReady(false);
        setIsRemoteReadyEvent(false);
        setCountdown(null);
        setIsMatchStarted(false);
        callbacksRef.current.onLifecycleChange?.("playing");
      }
    },
    [online]
  );

  const handleSelectConfiguredMode = useCallback((modeId: string, configValue: string) => {
    soundManager.play("buttonClick");
    setSelectedMode(modeId as GameMode);
    setDifficulty(configValue as BotDifficulty);
    setInModeSelection(false);
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setLives({ orange: 3, blue: 3 });
    setCurrentWave(1);
    setMatchSeconds(0);
    setIsPhaserReady(false);
    setIsRemoteReadyEvent(false);
    setCountdown(null);
    setIsMatchStarted(false);
    callbacksRef.current.onLifecycleChange?.("playing");
  }, []);

  const handleBackToModeSelect = useCallback(() => {
    soundManager.play("buttonClick");
    onlineResultSoundGuardRef.current.reset();
    clearTimers();
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
    setLives({ orange: 3, blue: 3 });
    setCurrentWave(1);
    setMatchSeconds(0);
    setIsPhaserReady(false);
    setIsRemoteReadyEvent(false);
    setCountdown(null);
    setIsMatchStarted(false);
    callbacksRef.current.onLifecycleChange?.("pre-game");
  }, [clearTimers, online, selectedMode]);

  // Restart Handler
  const handleRestart = useCallback(() => {
    soundManager.play("buttonClick");
    if (selectedMode === "online") {
      online.requestRematch();
      return;
    }
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setLives({ orange: 3, blue: 3 });
    setCurrentWave(1);
    setMatchSeconds(0);
    setIsMatchStarted(false);
    clearTimers();
    startCountdown(() => {
      sceneRef.current?.restartGame(selectedMode, difficulty);
      callbacksRef.current.onLifecycleChange?.("playing");
    });
  }, [clearTimers, difficulty, online, selectedMode, startCountdown]);

  // Expose IGameController
  useEffect(() => {
    const controller: IGameController = {
      restart: handleRestart,
      pause: () => {
        sceneRef.current?.pauseGame();
      },
      resume: () => {
        sceneRef.current?.resumeGame();
      },
      destroy: () => {
        if (phaserGameRef.current) {
          phaserGameRef.current.destroy(true);
          phaserGameRef.current = null;
        }
        sceneRef.current = null;
      },
    };
    callbacksRef.current.onReady(controller);
  }, [handleRestart]);

  // Phaser Initialization Lifecycle
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
      const { DodgeArenaScene } = await import("../game/DodgeArenaScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        backgroundColor: "#0f172a",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
        },
        input: {
          activePointers: 3,
        },
      };

      gameInstance = new Phaser.Game(config);
      phaserGameRef.current = gameInstance;

      gameInstance.events.once("ready", () => {
        if (!isMounted || !gameInstance) return;

        const sceneData = {
          mode: selectedMode,
          difficulty,
          localPlayerRole: onlineRef.current.myRole ?? "orange",
          isHost: onlineRef.current.isHost,
          seed: onlineRef.current.gameState?.seed,
          online: {
            sendInput: (dx: number, dy: number, seq: number) => {
              onlineRef.current.sendInput("move", { directionX: dx, directionY: dy, sequence: seq });
            },
            sendGameEvent: (event: string, data?: unknown) => {
              onlineRef.current.sendGameEvent(event, data);
            },
            myRole: onlineRef.current.myRole ?? "orange",
            isHost: onlineRef.current.isHost,
          },
          callbacks: {
            onLivesUpdate: (updatedLives: { orange: number; blue: number }) => {
              setLives(updatedLives);
            },
            onWaveUpdate: (wave: number) => {
              setCurrentWave(wave);
            },
            onGameOver: (winner: DodgePlayerColor | "draw") => {
              setGameOverResult(winner);
              callbacksRef.current.onGameOver({
                winner: winner === "draw" ? "draw" : winner === "orange" ? "Orange" : "Blue",
                score: 0,
                details: { winner, mode: selectedMode },
              });
              callbacksRef.current.onLifecycleChange?.("finished");
            },
          },
        };

        const scene = gameInstance.scene.add(
          "DodgeArenaScene",
          DodgeArenaScene,
          true,
          sceneData
        ) as DodgeArenaScene;
        sceneRef.current = scene;
        setIsPhaserReady(true);
        if (selectedMode === "online") {
          onlineRef.current.sendReady();
        }
      });
    }

    void initPhaser();

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
      }
      phaserGameRef.current = null;
      sceneRef.current = null;
    };
  }, [inModeSelection, isOnlineLobby, selectedMode, difficulty]);

  // Non-online countdown trigger once Phaser is ready
  useEffect(() => {
    if (selectedMode === "online" || !isPhaserReady || isMatchStarted || countdown !== null) {
      return;
    }
    startCountdown(() => {
      sceneRef.current?.startMatch();
    });
  }, [selectedMode, isPhaserReady, isMatchStarted, countdown, startCountdown]);

  // Listen for opponent ready and remote input
  useEffect(() => {
    if (selectedMode !== "online") return;

    online.setOnRemoteInput((data) => {
      const dx = data.data?.directionX ?? data.data?.dx ?? 0;
      const dy = data.data?.directionY ?? data.data?.dy ?? 0;
      sceneRef.current?.applyRemoteInput(data.playerRole, { dx, dy });
    });

    online.setOnRemoteEvent((data) => {
      if (data.event === "player_ready") {
        setIsRemoteReadyEvent(true);
      } else if (data.event === "countdown_start") {
        startCountdown(() => {
          sceneRef.current?.startMatch();
        });
      }
    });

    return () => {
      online.setOnRemoteInput(null);
      online.setOnRemoteEvent(null);
    };
  }, [selectedMode, online, startCountdown]);

  // Host triggers synchronized online countdown
  const opponentPlayerId =
    online.room?.players.find((p) => p.playerId !== online.myPlayerId)?.playerId ?? null;
  const isRemoteReady = Boolean(
    isRemoteReadyEvent ||
      (opponentPlayerId && online.gameState?.readyPlayers?.includes(opponentPlayerId))
  );

  useEffect(() => {
    if (selectedMode !== "online") return;
    if (!isPhaserReady || !isRemoteReady) return;
    if (countdown !== null || isMatchStarted) return;

    if (online.isHost) {
      online.sendGameEvent("countdown_start");
      startCountdown(() => {
        sceneRef.current?.startMatch();
      });
    }
  }, [selectedMode, isPhaserReady, isRemoteReady, countdown, isMatchStarted, online, startCountdown]);

  // Rematch trigger in online mode
  const prevOnlineStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMode !== "online") return;
    const currentStatus = online.gameState?.status;
    const prevStatus = prevOnlineStatusRef.current;
    prevOnlineStatusRef.current = currentStatus ?? null;

    if (
      (prevStatus === "won" || prevStatus === "draw" || prevStatus === "abandoned") &&
      currentStatus === "in_progress"
    ) {
      setIsPopupDismissed(false);
      setGameOverResult(null);
      setLives({ orange: 3, blue: 3 });
      setCurrentWave(1);
      setMatchSeconds(0);
      clearTimers();
      setIsMatchStarted(false);
      setCountdown(null);
      setIsRemoteReadyEvent(false);

      sceneRef.current?.restartGame("online", undefined, online.gameState?.seed);
      online.sendReady();
      callbacksRef.current.onLifecycleChange?.("playing");
    }
  }, [clearTimers, online.gameState?.status, online.gameState?.seed, online, selectedMode]);

  // Online pause/resume on disconnect grace
  useEffect(() => {
    if (selectedMode !== "online") return;
    if (online.isMatchPaused) {
      sceneRef.current?.pauseGame();
    } else {
      sceneRef.current?.resumeGame();
    }
  }, [selectedMode, online.isMatchPaused]);

  // Format Timer mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const bluePlayerLabel = (() => {
    if (selectedMode === "bot") return "Bot";
    if (selectedMode === "online") {
      return online.myRole === "blue" ? "You (Blue)" : "Opponent";
    }
    return "Blue";
  })();

  const orangePlayerLabel = (() => {
    if (selectedMode === "bot") return "You";
    if (selectedMode === "online") {
      return online.myRole === "orange" ? "You (Orange)" : "Opponent";
    }
    return "Orange";
  })();

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-[#070a14] p-1.5 sm:p-3">
      {/* 1. Mode Selection Screen */}
      {inModeSelection && (
        <div className="w-full max-w-sm px-4 py-6 z-20">
          <GameModeSelector
            gameTitle="Dodge Arena"
            modes={DODGE_ARENA_MODES}
            onSelectMode={handleSelectMode}
            onSelectConfiguredMode={handleSelectConfiguredMode}
          />
        </div>
      )}

      {/* 2. Online Lobby Screen */}
      {isOnlineLobby && (
        <div className="w-full max-w-sm px-4 py-6 z-20">
          <OnlineMatchLobby
            gameTitle="Dodge Arena"
            connectionState={online.connectionState}
            room={online.room}
            errorMessage={online.errorMessage}
            onCreateRoom={online.createRoom}
            onJoinRoom={online.joinRoom}
            onLeaveRoom={online.leaveRoom}
            onReturnToModes={handleBackToModeSelect}
          />
        </div>
      )}

      {/* 3. In-Game Centered Aspect-Ratio Arena & Overlays */}
      {!inModeSelection && !isOnlineLobby && (
        <div
          className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_0_35px_rgba(0,0,0,0.85)] ring-1 ring-white/10 bg-[#0f172a]"
          style={{
            width:
              "min(calc(100% - 0.5rem), calc((100dvh - 5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 480 / 640), 480px)",
            aspectRatio: "480 / 640",
            maxHeight: "100%",
          }}
        >
          {/* Top Integrated HUD */}
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
            {/* Blue Player Lives (Guest / Top) */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
              <span className="text-[11px] font-bold text-blue-300 mr-0.5">{bluePlayerLabel}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((num) => (
                  <HeartIcon key={num} filled={lives.blue >= num} color="blue" />
                ))}
              </div>
            </div>

            {/* Match Clock & Wave Badge */}
            <div className="flex flex-col items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1 shadow-md">
              <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase font-mono">
                Wave {currentWave}
              </span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {formatTime(matchSeconds)}
              </span>
            </div>

            {/* Orange Player Lives (Host / Bottom) */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-md">
              <div className="flex items-center gap-1">
                {[3, 2, 1].map((num) => (
                  <HeartIcon key={num} filled={lives.orange >= num} color="orange" />
                ))}
              </div>
              <span className="text-[11px] font-bold text-orange-300 ml-0.5">
                {orangePlayerLabel}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
            </div>
          </div>

          {/* Quick Nav Bar (Modes & Reset buttons) */}
          <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
            <button
              type="button"
              onClick={handleBackToModeSelect}
              className="pointer-events-auto px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-600/80 text-[10px] font-semibold text-slate-300 hover:text-white shadow-xs transition active:scale-95 cursor-pointer backdrop-blur-md"
              aria-label="Change Mode"
            >
              ← Modes
            </button>

            {selectedMode !== "online" && (
              <button
                type="button"
                onClick={handleRestart}
                className="pointer-events-auto px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-600/80 text-[10px] font-semibold text-slate-300 hover:text-white shadow-xs transition active:scale-95 cursor-pointer backdrop-blur-md"
                aria-label="Reset Match"
              >
                Reset
              </button>
            )}
          </div>

          {/* Disconnect Grace Period Overlay */}
          {online.isMatchPaused && online.disconnectGraceSecondsRemaining !== null && (
            <div className="absolute top-14 z-40 bg-amber-950/95 border border-amber-500/80 rounded-xl px-4 py-2 text-center text-amber-200 shadow-xl max-w-xs animate-pulse">
              <p className="text-xs font-semibold">Opponent disconnected</p>
              <p className="text-[11px] text-amber-300/80">
                Waiting to reconnect: {online.disconnectGraceSecondsRemaining}s
              </p>
            </div>
          )}

          {/* Gameplay Instructions & Objective Overlay */}
          {!isMatchStarted && (
            <div
              className="absolute inset-0 z-35 flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 cursor-pointer"
              onClick={handleStartImmediately}
            >
              <div
                className="relative w-full max-w-xs rounded-2xl bg-slate-900/95 border border-slate-700/80 p-4 shadow-2xl text-center flex flex-col items-center pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Tag */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 tracking-wider uppercase mb-2">
                  <span>Survival Arena</span>
                </div>

                <h2 className="text-base font-black text-white tracking-wide uppercase">
                  Dodge Arena
                </h2>

                {/* Short Objective */}
                <p className="text-xs text-slate-300 mt-1 mb-3 font-medium leading-relaxed">
                  Avoid the hazards. Survive longer than your opponent!
                </p>

                {/* Controls Guide */}
                <div className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-left mb-3 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs">🖥️</span>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Desktop
                      </p>
                      <p className="text-[11px] text-slate-200 font-medium">
                        WASD / Arrow Keys / Click &amp; Hold Mouse
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-700/50" />
                  <div className="flex items-start gap-2">
                    <span className="text-xs">📱</span>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Mobile
                      </p>
                      <p className="text-[11px] text-slate-200 font-medium">
                        Touch / Virtual Joystick
                      </p>
                    </div>
                  </div>
                  {selectedMode === "1v1" && (
                    <>
                      <div className="h-px bg-slate-700/50" />
                      <p className="text-[10px] text-amber-300 font-semibold text-center">
                        Orange (Bottom Half) • Blue (Top Half)
                      </p>
                    </>
                  )}
                </div>

                {/* Countdown / Start Prompt */}
                <div className="flex flex-col items-center gap-1">
                  {countdown !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Match starts in:</span>
                      <span className="text-xl font-black text-amber-400 font-mono animate-pulse">
                        {countdown === 0 ? "GO!" : countdown}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono animate-pulse">
                      Priming Arena...
                    </span>
                  )}
                  {selectedMode !== "online" && (
                    <button
                      type="button"
                      onClick={handleStartImmediately}
                      className="mt-1 text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      Tap here to start immediately
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Large Countdown Overlay when instruction is dismissed */}
          {countdown !== null && isMatchStarted && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="text-6xl font-black text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.9)] animate-pulse font-mono">
                {countdown === 0 ? "GO!" : countdown}
              </div>
            </div>
          )}

          {/* Phaser Canvas Container */}
          <div
            ref={containerRef}
            className="w-full h-full touch-none select-none"
            tabIndex={0}
            aria-label="Dodge Arena Canvas"
          />

          {/* Result Popup */}
          {gameOverResult !== null && !isPopupDismissed && (
            <GameResultPopup
              resultText={
                gameOverResult === "draw"
                  ? "Draw Game"
                  : gameOverResult === "orange"
                  ? "Orange Won!"
                  : "Blue Won!"
              }
              accentColor={
                gameOverResult === "draw"
                  ? null
                  : gameOverResult === "orange"
                  ? "#f97316"
                  : "#3b82f6"
              }
              playAgainText={
                selectedMode === "online" && online.opponentRequestedRematch
                  ? "Accept Rematch"
                  : "Play Again"
              }
              onPlayAgain={handleRestart}
              onClose={() => setIsPopupDismissed(true)}
              onHome={handleBackToModeSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}
