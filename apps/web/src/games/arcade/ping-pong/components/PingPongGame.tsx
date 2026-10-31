"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { type PlatformPlayer } from "@/games/common/startingPlayer";
import { soundManager } from "@/platform/audio";
import { GAME_WIDTH, GAME_HEIGHT, WINNING_SCORE } from "../config/constants";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { useOnlinePingPong } from "@/platform/multiplayer/useOnlinePingPong";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import type { BallSyncPayload, PingPongScore } from "../game/types";

const PING_PONG_MODES: GameModeOption[] = [
  { id: "1v1", label: "Local 1v1" },
  {
    id: "bot",
    label: "You vs Bot",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot reaction speed and spin anticipation",
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
      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
      Blue (Top)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-[#e0530a]" />
      Orange (Bottom)
    </span>
  </div>
);

type PingPongGameMode = "1v1" | "vs-bot" | "online";

export default function PingPongGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/PingPongScene").PingPongScene | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  // Strict pre-game hidden state: Phaser is NEVER initialized until a mode is chosen
  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<PingPongGameMode>("1v1");
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);
  const [scores, setScores] = useState<{ host: number; guest: number }>({ host: 0, guest: 0 });
  const [gameOverResult, setGameOverResult] = useState<{
    winner: PlatformPlayer;
    score: number;
  } | null>(null);

  // Online multiplayer integration
  const online = useOnlinePingPong();

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
        setScores({ host: 0, guest: 0 });
        onLifecycleChange?.("playing");
        onScoreUpdate?.(0);
      } else if (modeId === "online") {
        resultSoundGuardRef.current.reset();
        onlineResultSoundGuardRef.current.reset();
        setSelectedMode("online");
        setInModeSelection(false);
        setIsPopupDismissed(false);
        setGameOverResult(null);
        setScores({ host: 0, guest: 0 });
        online.connect();
      }
    },
    [onLifecycleChange, onScoreUpdate, online]
  );

  const handleSelectConfiguredMode = useCallback(
    (modeId: string, value: string) => {
      if (modeId !== "bot") return;
      resultSoundGuardRef.current.reset();
      setSelectedMode("vs-bot");
      setBotDifficulty(value === "easy" || value === "hard" ? value : "medium");
      setInModeSelection(false);
      setIsPopupDismissed(false);
      setGameOverResult(null);
      setScores({ host: 0, guest: 0 });
      onLifecycleChange?.("playing");
      onScoreUpdate?.(0);
    },
    [onLifecycleChange, onScoreUpdate]
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
    setScores({ host: 0, guest: 0 });
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange, online, selectedMode]);

  // Restart match handler
  const handleRestartRef = useRef<() => void>(() => {});

  const handleRestart = useCallback(() => {
    if (selectedMode === "online") {
      online.requestRematch();
      return;
    }
    resultSoundGuardRef.current.reset();
    setIsPopupDismissed(false);
    setGameOverResult(null);
    setScores({ host: 0, guest: 0 });
    sceneRef.current?.restartMatch(selectedMode, botDifficulty);
    onLifecycleChange?.("playing");
    onScoreUpdate?.(0);
  }, [botDifficulty, onLifecycleChange, onScoreUpdate, online, selectedMode]);

  useEffect(() => {
    handleRestartRef.current = handleRestart;
  });

  // Online rematch start
  const prevOnlineStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMode !== "online") return;
    const currentStatus = online.gameState?.status;
    const prevStatus = prevOnlineStatusRef.current;
    prevOnlineStatusRef.current = currentStatus ?? null;

    if (prevStatus === "won" && currentStatus === "in_progress") {
      setIsPopupDismissed(false);
      setGameOverResult(null);
      setScores({ host: 0, guest: 0 });
      onlineResultSoundGuardRef.current.reset();
      sceneRef.current?.restartMatch("online", undefined, {
        sendInput: online.sendInput,
        sendGameEvent: online.sendGameEvent,
        sendBallSync: online.sendBallSync,
        myRole: online.myRole ?? "orange",
        myPlayerId: online.myPlayerId ?? undefined,
        isHost: online.isHost,
      });
      callbacksRef.current.onLifecycleChange?.("playing");
      callbacksRef.current.onScoreUpdate?.(0);
    }
  }, [selectedMode, online.gameState?.status, online]);

  // Online result sounds & game over handling
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
          game: "ping-pong",
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

  // Determine whether Phaser instance should be mounted
  const isInOnlineMatch =
    selectedMode === "online" &&
    (online.connectionState === "in_game" || online.connectionState === "game_over") &&
    Boolean(online.gameState);

  const isOnlineLobby = !inModeSelection && selectedMode === "online" && !isInOnlineMatch;

  useEffect(() => {
    // STRICT LIFECYCLE: Do not initialize Phaser if still picking mode or waiting in lobby
    if (inModeSelection || isOnlineLobby) return;

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { PingPongScene } = await import("../game/PingPongScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: "#f4d07b",
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
        const isHost: boolean = onlineRef.current.isHost;

        const onScoreChange = (hostScore: number, guestScore: number) => {
          if (!isMounted) return;
          setScores({ host: hostScore, guest: guestScore });
          callbacksRef.current.onScoreUpdate?.(hostScore);
        };

        const onGameOverHandler = (result: { winner: PlatformPlayer; score: number }) => {
          if (!isMounted) return;

          if (selectedMode !== "online") {
            const humanPlayer: PlatformPlayer = "orange";
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
                game: "ping-pong",
              },
            });
          }
        };

        // Bridge Phaser score & game over events to React DOM via Game Registry
        gameInstance.registry.set("onScoreChange", onScoreChange);
        gameInstance.registry.set("onGameOver", onGameOverHandler);

        const scene = gameInstance.scene.add("PingPongScene", PingPongScene, true, {
          mode: selectedMode,
          difficulty: botDifficulty,
          localPlayerRole,
          isHost,
          onScoreChange,
          onGameOver: onGameOverHandler,
          online:
            selectedMode === "online"
              ? {
                  sendInput: (input: string, data?: unknown) => onlineRef.current.sendInput(input, data),
                  sendGameEvent: (event: string, data?: unknown) => onlineRef.current.sendGameEvent(event, data),
                  sendBallSync: (data: BallSyncPayload) => onlineRef.current.sendBallSync(data),
                  myRole: onlineRef.current.myRole ?? "orange",
                  myPlayerId: onlineRef.current.myPlayerId ?? undefined,
                  isHost,
                }
              : undefined,
          callbacks: {
            onScoreChange,
            onGameOver: onGameOverHandler,
            onScoreUpdate: (score: number) => {
              if (!isMounted) return;
              callbacksRef.current.onScoreUpdate?.(score);
            },
            onScoresChange: (nextScores: PingPongScore) => {
              if (!isMounted) return;
              setScores({
                host: nextScores.host ?? nextScores.orange,
                guest: nextScores.guest ?? nextScores.blue,
              });
            },
            onLifecycleChange: (status: "playing" | "paused" | "finished") => {
              if (status === "playing" || status === "finished") {
                callbacksRef.current.onLifecycleChange?.(status);
              }
            },
          },
        }) as import("../game/PingPongScene").PingPongScene;

        sceneRef.current = scene;

        if (selectedMode === "online") {
          onlineRef.current.setRemoteHandlers({
            onRemoteInput: (data) => scene.handleRemoteInput(data),
            onRemoteEvent: (data) => scene.handleRemoteEvent(data),
            onBallSync: (data) => scene.handleBallSync(data),
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
  }, [inModeSelection, isOnlineLobby, selectedMode, botDifficulty]);

  // Clean unmount
  useEffect(() => {
    return () => {
      onlineRef.current.disconnect();
    };
  }, []);

  // 1. Mode Selection Screen (Phaser Canvas strictly NOT mounted)
  if (inModeSelection) {
    return (
      <div className="relative flex flex-col items-center justify-center w-full min-h-[500px] p-3 sm:p-4 select-none">
        <GameModeSelector
          gameTitle="Ping Pong"
          modes={PING_PONG_MODES}
          footer={PLAYER_COLOR_FOOTER}
          onSelectMode={handleSelectMode}
          onSelectConfiguredMode={handleSelectConfiguredMode}
          onScreenChange={(screen) =>
            onLifecycleChange?.(screen === "config" ? "configuration" : "pre-game")
          }
        />
      </div>
    );
  }

  // 2. Online Lobby Screen (Waiting for opponent)
  if (!inModeSelection && isOnlineLobby) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        <OnlineMatchLobby
          gameTitle="Ping Pong"
          subtitle="Top-down 2-player table tennis"
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

  // 3. Active Game Screen
  const showResultPopup =
    selectedMode === "online" ? online.isGameOver : gameOverResult !== null;

  const currentWinner =
    selectedMode === "online" ? online.winner : gameOverResult?.winner ?? null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none max-w-lg mx-auto p-2 sm:p-3">
      {/* ─── Scoreboard HUD ─────────────────────────────────────────── */}
      <header className="w-full flex items-center justify-between bg-white/90 backdrop-blur-md border border-[#eeece6] px-3.5 py-2 rounded-2xl shadow-sm mb-2">
        {/* Blue Side */}
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#2563eb] shadow-sm" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#1a1917] leading-none">
              Blue {selectedMode === "vs-bot" ? "(Bot)" : ""}
            </span>
            <span className="text-xs font-bold text-[#2563eb] mt-0.5">
              Score: {scores.guest}
            </span>
          </div>
        </div>

        {/* Center Target Info */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-[#78746d] uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
            First to {WINNING_SCORE}
          </span>
          {online.isMatchPaused && (
            <span className="text-[10px] font-semibold text-amber-700 mt-1 animate-pulse">
              Reconnecting ({online.disconnectGraceSecondsRemaining}s)
            </span>
          )}
        </div>

        {/* Orange Side */}
        <div className="flex items-center gap-2 text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-[#1a1917] leading-none">
              Orange
            </span>
            <span className="text-xs font-bold text-[#e0530a] mt-0.5">
              Score: {scores.host}
            </span>
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-[#e0530a] shadow-sm" />
        </div>
      </header>

      {/* ─── Phaser Game Canvas Container ───────────────────────────── */}
      <main className="w-full flex-1 flex items-center justify-center p-1">
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border-4 border-black bg-[#f4d07b]"
          style={{ aspectRatio: `${GAME_WIDTH}/${GAME_HEIGHT}`, maxHeight: "82vh" }}
        />
      </main>

      {/* ─── Footer Controls ────────────────────────────────────────── */}
      <footer className="w-full flex items-center justify-between text-xs text-[#78746d] mt-2 px-2">
        <button
          type="button"
          onClick={handleReturnToModes}
          className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Modes
        </button>

        <span className="text-[11px] font-medium">
          {selectedMode === "1v1"
            ? "Split Touch 1v1"
            : selectedMode === "vs-bot"
            ? `Bot (${botDifficulty})`
            : `Online (${online.myRole ?? "Spectating"})`}
        </span>

        <button
          type="button"
          onClick={handleRestart}
          className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#1a1917] font-medium border border-[#eeece6] transition-colors shadow-sm"
        >
          Reset
        </button>
      </footer>

      {/* ─── Result Popup ───────────────────────────────────────────── */}
      {showResultPopup && !isPopupDismissed && (
        <GameResultPopup
          resultText={
            selectedMode === "online" && online.gameState?.resultReason === "disconnect_forfeit"
              ? online.isWinner
                ? "Opponent Forfeited"
                : "Match Forfeited"
              : currentWinner === "orange"
              ? "Orange Won!"
              : currentWinner === "blue"
              ? "Blue Won!"
              : "Match Finished"
          }
          accentColor={
            currentWinner === "orange"
              ? "#e0530a"
              : currentWinner === "blue"
              ? "#2563eb"
              : null
          }
          onPlayAgain={handleRestart}
          onClose={() => setIsPopupDismissed(true)}
          onHome={handleReturnToModes}
          playAgainText={
            selectedMode === "online"
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
