"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps } from "@/games/common/types";
import { GameModeSelector, type GameModeOption } from "@/components/game-ui/GameModeSelector";
import { GameResultPopup } from "@/components/game-ui/GameResultPopup";
import { soundManager } from "@/platform/audio";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { useOnlineMiniGolf } from "@/platform/multiplayer/useOnlineMiniGolf";
import { GAME_HEIGHT, GAME_WIDTH, MAX_STROKES_PER_HOLE, TOTAL_HOLES } from "../config/constants";
import { COURSES } from "../game/courses";
import type {
  BotDifficulty,
  MiniGolfGameMode,
  MiniGolfPlayer,
  MiniGolfScoreCard,
} from "../game/types";

const MINI_GOLF_MODES: GameModeOption[] = [
  { id: "1v1", label: "Local 1v1" },
  {
    id: "bot",
    label: "You vs Bot",
    config: {
      title: "Select Difficulty",
      subtitle: "Bot aiming precision, putting power, and bank shots",
      values: ["easy", "medium", "hard"],
      defaultValue: "medium",
      startLabel: "Tee Off",
    },
  },
  {
    id: "online",
    label: "Online",
  },
];

const PLAYER_COLOR_FOOTER = (
  <div className="flex items-center justify-center gap-3 text-xs text-[#6b665f]">
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#e0530a] shadow-xs" />
      Orange (Player 1)
    </span>
    <span>vs</span>
    <span className="flex items-center gap-1.5 font-medium">
      <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shadow-xs" />
      Blue (Player 2)
    </span>
  </div>
);

export default function MiniGolfGame({
  onGameOver,
  onScoreUpdate,
  onReady,
  onLifecycleChange,
  onTurnChange,
}: GameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<import("../game/MiniGolfScene").MiniGolfScene | null>(null);
  const resultSoundGuardRef = useRef(createResultSoundGuard());
  const onlineResultSoundGuardRef = useRef(createResultSoundGuard());

  const [inModeSelection, setInModeSelection] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<MiniGolfGameMode>("1v1");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(false);

  // Local match state
  const [localCurrentHole, setLocalCurrentHole] = useState<number>(0);
  const [localCurrentTurn, setLocalCurrentTurn] = useState<MiniGolfPlayer | null>("orange");
  const [localScores, setLocalScores] = useState<MiniGolfScoreCard>({ orange: [], blue: [] });
  const [localLiveStrokes] = useState<{ orange: number; blue: number }>({
    orange: 0,
    blue: 0,
  });

  const [localGameOverResult, setLocalGameOverResult] = useState<{
    winner: MiniGolfPlayer | "draw";
    totalOrange: number;
    totalBlue: number;
    scores: MiniGolfScoreCard;
  } | null>(null);

  // Online Multiplayer Hook
  const online = useOnlineMiniGolf();
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  const callbacksRef = useRef({
    onGameOver,
    onScoreUpdate,
    onReady,
    onLifecycleChange,
    onTurnChange,
  });
  useEffect(() => {
    callbacksRef.current = {
      onGameOver,
      onScoreUpdate,
      onReady,
      onLifecycleChange,
      onTurnChange,
    };
  });

  useEffect(() => {
    onLifecycleChange?.("pre-game");
    onTurnChange?.(null);
  }, [onLifecycleChange, onTurnChange]);

  const handleAudioPlay = useCallback(
    (
      sound:
        | "hit"
        | "swing"
        | "bounce"
        | "bumper"
        | "water"
        | "sink"
        | "lipout"
        | "holeComplete"
        | "scorecard"
        | "victory"
        | "defeat"
    ) => {
      switch (sound) {
        case "swing":
          soundManager.play("golfSwing");
          break;
        case "hit":
          soundManager.play("golfHit");
          break;
        case "bounce":
        case "lipout":
          soundManager.play("golfWall");
          break;
        case "bumper":
          soundManager.play("golfBumper");
          break;
        case "water":
          soundManager.play("golfWater");
          break;
        case "sink":
          soundManager.play("golfSink");
          break;
        case "holeComplete":
          soundManager.play("golfHoleComplete");
          break;
        case "scorecard":
          soundManager.play("golfScorecard");
          break;
        case "victory":
          soundManager.play("golfVictory");
          break;
        case "defeat":
          soundManager.play("golfDefeat");
          break;
      }
    },
    []
  );

  // Instantiate Phaser when entering gameplay
  useEffect(() => {
    if (inModeSelection) return;
    if (
      selectedMode === "online" &&
      online.connectionState !== "in_game" &&
      online.connectionState !== "game_over"
    ) {
      return;
    }

    let isMounted = true;
    let gameInstance: Phaser.Game | null = null;

    async function initPhaser() {
      if (!containerRef.current || !isMounted) return;

      const Phaser = (await import("phaser")).default;
      const { MiniGolfScene } = await import("../game/MiniGolfScene");

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        backgroundColor: "#1c1917",
        transparent: false,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          activePointers: 2,
        },
      };

      gameInstance = new Phaser.Game(config);
      phaserGameRef.current = gameInstance;

      gameInstance.events.once("ready", () => {
        if (!isMounted || !gameInstance) return;

        const scene = new MiniGolfScene();
        gameInstance.scene.add("MiniGolfScene", scene, true, {
          mode: selectedMode,
          botDifficulty,
          localPlayerRole: onlineRef.current.myPlayerColor ?? "orange",
          callbacks: {
            onScoreUpdate: (newScores: MiniGolfScoreCard) => {
              if (!isMounted) return;
              setLocalScores({ ...newScores });
              const currentTotal = newScores.orange.reduce((a, b) => a + b, 0);
              callbacksRef.current.onScoreUpdate?.(currentTotal);
            },
            onTurnChange: (player: MiniGolfPlayer | null) => {
              if (!isMounted) return;
              setLocalCurrentTurn(player);
              callbacksRef.current.onTurnChange?.(
                player === "orange" ? "X" : player === "blue" ? "O" : null
              );
            },
            onHoleChange: (holeIdx: number) => {
              if (!isMounted) return;
              setLocalCurrentHole(holeIdx);
            },
            onGameOver: (result: {
              winner: MiniGolfPlayer | "draw";
              scores: MiniGolfScoreCard;
              totalOrange: number;
              totalBlue: number;
            }) => {
              if (!isMounted) return;
              setLocalGameOverResult(result);

              const sound = resultSoundGuardRef.current.claim(
                getResultSound({
                  mode: selectedMode === "online" ? "1v1" : selectedMode,
                  winner: result.winner === "draw" ? null : result.winner,
                  humanPlayer: "orange",
                })
              );
              if (sound) {
                soundManager.play(sound === "victory" ? "golfVictory" : "golfDefeat");
              }

              callbacksRef.current.onGameOver({
                winner:
                  result.winner === "draw"
                    ? "draw"
                    : result.winner === "orange"
                    ? "Orange"
                    : "Blue",
                score: result.winner === "orange" ? result.totalOrange : result.totalBlue,
                details: {
                  game: "mini-golf-duel",
                  mode: selectedMode,
                  difficulty: botDifficulty,
                  scores: result.scores,
                },
              });
            },
            onShotIntent: (shot: { aim: { x: number; y: number }; power: number }) => {
              if (selectedMode === "online") {
                onlineRef.current.takeShot(shot.aim, shot.power);
              }
            },
            onAudioPlay: handleAudioPlay,
          },
        });

        sceneRef.current = scene;

        callbacksRef.current.onReady({
          restart: () => {
            if (selectedMode === "online") {
              onlineRef.current.requestRematch();
            } else {
              scene.restartMatch();
              setLocalScores({ orange: [], blue: [] });
              setLocalGameOverResult(null);
              setIsPopupDismissed(false);
            }
          },
        });

        callbacksRef.current.onLifecycleChange?.("playing");
      });
    }

    initPhaser();

    return () => {
      isMounted = false;
      if (gameInstance) {
        gameInstance.destroy(true);
        phaserGameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [inModeSelection, selectedMode, botDifficulty, online.connectionState, handleAudioPlay]);

  // Synchronize remote authoritative shots in online mode
  useEffect(() => {
    if (selectedMode !== "online") return;

    online.setOnRemoteShot((shotData) => {
      sceneRef.current?.playAuthoritativeShot(
        shotData.playerRole,
        shotData.trajectory,
        shotData.events,
        shotData.finalPosition,
        shotData.sunk,
        shotData.waterHazard
      );
    });
  }, [selectedMode, online]);

  // Synchronize scene with authoritative server state
  useEffect(() => {
    if (selectedMode !== "online" || !online.gameState) return;

    const gs = online.gameState;
    sceneRef.current?.syncAuthoritativeState(
      gs.currentHoleIndex,
      gs.currentPlayer,
      gs.holeState.orange.ballPosition,
      gs.holeState.blue.ballPosition,
      gs.holeState.orange.finished,
      gs.holeState.blue.finished
    );
  }, [selectedMode, online.gameState]);

  // Handle online game over events and sounds
  useEffect(() => {
    if (selectedMode !== "online" || !online.gameState) return;

    const gs = online.gameState;
    if (gs.status === "won" || gs.status === "draw") {
      const orangeTotal = gs.holeScores.orange.reduce((a, b) => a + b, 0);
      const blueTotal = gs.holeScores.blue.reduce((a, b) => a + b, 0);

      const sound = onlineResultSoundGuardRef.current.claim(
        getResultSound({
          mode: "1v1",
          winner:
            gs.winner === "draw"
              ? null
              : gs.winner === online.myPlayerColor
              ? "orange"
              : "blue",
          humanPlayer: "orange",
        })
      );
      if (sound) {
        soundManager.play(sound === "victory" ? "golfVictory" : "golfDefeat");
      }

      callbacksRef.current.onGameOver({
        winner:
          gs.winner === "draw"
            ? "draw"
            : gs.winner === "orange"
            ? "Orange"
            : "Blue",
        score: gs.winner === "orange" ? orangeTotal : blueTotal,
        details: {
          game: "mini-golf-duel",
          mode: "online",
          scores: gs.holeScores,
        },
      });
    }
  }, [selectedMode, online.gameState, online.myPlayerColor]);

  const handleModeSelect = (modeId: string, configValue?: string) => {
    if (modeId === "1v1") {
      setSelectedMode("1v1");
      setInModeSelection(false);
    } else if (modeId === "bot") {
      setSelectedMode("vs-bot");
      setBotDifficulty((configValue as BotDifficulty) || "medium");
      setInModeSelection(false);
    } else if (modeId === "online") {
      setSelectedMode("online");
      setInModeSelection(false);
    }
  };

  const handleRematch = () => {
    setIsPopupDismissed(false);
    setLocalGameOverResult(null);
    if (selectedMode === "online") {
      online.requestRematch();
    } else {
      setLocalScores({ orange: [], blue: [] });
      sceneRef.current?.restartMatch();
    }
  };

  const isOnlineActive = selectedMode === "online" && Boolean(online.gameState);

  const currentHole = isOnlineActive
    ? online.gameState!.currentHoleIndex
    : localCurrentHole;

  const currentTurn = isOnlineActive
    ? online.gameState!.currentPlayer
    : localCurrentTurn;

  const scores = isOnlineActive
    ? online.gameState!.holeScores
    : localScores;

  const liveStrokes = isOnlineActive
    ? {
        orange: online.gameState!.holeState.orange.strokes,
        blue: online.gameState!.holeState.blue.strokes,
      }
    : localLiveStrokes;

  const gameOverResult =
    isOnlineActive &&
    (online.gameState!.status === "won" || online.gameState!.status === "draw")
      ? {
          winner: online.gameState!.winner ?? ("draw" as const),
          totalOrange: online.gameState!.holeScores.orange.reduce((a, b) => a + b, 0),
          totalBlue: online.gameState!.holeScores.blue.reduce((a, b) => a + b, 0),
          scores: online.gameState!.holeScores,
        }
      : localGameOverResult;

  const currentCourse = COURSES[currentHole] || COURSES[0];
  const orangeTotalStrokes = scores.orange.reduce((a, b) => a + b, 0);
  const blueTotalStrokes = scores.blue.reduce((a, b) => a + b, 0);
  const totalPar = COURSES.reduce((sum, c) => sum + c.par, 0);

  // Helper function to format score relative to par
  const formatHoleScore = (score: number | undefined, par: number) => {
    if (score === undefined) return "-";
    const diff = score - par;
    let colorClass = "text-stone-300";
    if (diff < 0) colorClass = "text-emerald-400 font-bold"; // Birdie or better
    else if (diff === 0) colorClass = "text-stone-100 font-semibold"; // Par
    else if (diff === 1) colorClass = "text-amber-400"; // Bogey
    else colorClass = "text-rose-400 font-bold"; // Double Bogey+
    return <span className={colorClass}>{score}</span>;
  };

  return (
    <div className="relative flex flex-col items-center justify-between w-full h-full min-h-0 overflow-hidden bg-[#18181b] select-none p-2 sm:p-4">
      {/* 1. Mode Selection Overlay */}
      {inModeSelection && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#f7f6f2]">
          <GameModeSelector
            gameTitle="Mini Golf Duel"
            subtitle="Precision putting and tactical bank shots on 3 challenging courses"
            modes={MINI_GOLF_MODES}
            onSelectMode={(modeId: string) => handleModeSelect(modeId)}
            onSelectConfiguredMode={(modeId: string, val: string) =>
              handleModeSelect(modeId, val)
            }
            footer={PLAYER_COLOR_FOOTER}
          />
        </div>
      )}

      {/* 2. Online Match Lobby Overlay */}
      {!inModeSelection &&
        selectedMode === "online" &&
        online.connectionState !== "in_game" &&
        online.connectionState !== "game_over" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#f7f6f2]">
            <OnlineMatchLobby
              gameTitle="Mini Golf Duel"
              connectionState={online.connectionState}
              room={online.room}
              errorMessage={online.errorMessage}
              onCreateRoom={() => online.createRoom()}
              onJoinRoom={(code) => online.joinRoom(code)}
              onLeaveRoom={() => {
                online.leaveRoom();
                setInModeSelection(true);
              }}
              onReturnToModes={() => {
                online.leaveRoom();
                setInModeSelection(true);
              }}
            />
          </div>
        )}

      {/* 3. Live Active Game Stage */}
      {!inModeSelection && (
        <div className="relative flex flex-col items-center justify-between w-full h-full max-w-[420px] mx-auto min-h-0 gap-2">
          {/* Top Tournament Header HUD */}
          <div className="w-full flex items-center justify-between px-3 py-2 bg-[#27272a] border border-[#3f3f46] rounded-xl shadow-lg text-xs text-stone-200">
            {/* Course Name & Par Info */}
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                <span className="text-emerald-400">⛳ Hole {currentHole + 1}/{TOTAL_HOLES}</span>
                <span className="text-stone-400 font-normal">&bull;</span>
                <span>{currentCourse.name}</span>
              </span>
              <span className="text-[11px] text-stone-400 mt-0.5">
                Par {currentCourse.par} &bull; Stroke Cap: {MAX_STROKES_PER_HOLE}
              </span>
            </div>

            {/* Turn Status Badge */}
            <div className="flex items-center gap-2">
              {currentTurn && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm transition-all ${
                    currentTurn === "orange"
                      ? "bg-[#e0530a]/25 border border-[#e0530a] text-[#ff8c42]"
                      : "bg-[#2563eb]/25 border border-[#2563eb] text-[#93c5fd]"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-sm ${
                      currentTurn === "orange" ? "bg-[#e0530a]" : "bg-[#2563eb]"
                    }`}
                  />
                  {selectedMode === "online"
                    ? currentTurn === online.myPlayerColor
                      ? "Your Putt"
                      : "Opponent Putting"
                    : selectedMode === "vs-bot" && currentTurn === "blue"
                    ? "Bot Aiming..."
                    : `${currentTurn === "orange" ? "Orange" : "Blue"} to Putt`}
                </div>
              )}
            </div>
          </div>

          {/* Disconnect Grace Timer Banner */}
          {selectedMode === "online" && online.isMatchPaused && (
            <div className="w-full px-3 py-1.5 bg-rose-500/20 border border-rose-500 rounded-lg text-xs font-semibold text-rose-300 flex items-center justify-between animate-pulse">
              <span>Opponent reconnecting...</span>
              <span>Forfeit in {online.remainingGraceSeconds}s</span>
            </div>
          )}

          {/* Phaser Canvas Container */}
          <div
            ref={containerRef}
            className="relative flex-1 w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-[#3f3f46] bg-[#1c1917] touch-none"
            style={{ touchAction: "none" }}
          />

          {/* Elegant Tournament Scorecard Panel */}
          <div className="w-full px-3 py-2 bg-[#27272a] border border-[#3f3f46] rounded-xl shadow-lg text-xs">
            <div className="grid grid-cols-6 text-center text-[11px] font-semibold text-stone-400 pb-1.5 border-b border-[#3f3f46]">
              <span className="text-left pl-1">Player</span>
              <span>H1 (P{COURSES[0].par})</span>
              <span>H2 (P{COURSES[1].par})</span>
              <span>H3 (P{COURSES[2].par})</span>
              <span className="text-amber-400">Tot</span>
              <span className="text-stone-300">+/-</span>
            </div>

            {/* Orange Score Row */}
            <div className="grid grid-cols-6 text-center py-1 items-center font-medium">
              <span className="flex items-center gap-1.5 font-bold text-[#e0530a] text-left pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e0530a] shadow-xs" />
                Orange
              </span>
              <span>
                {formatHoleScore(
                  scores.orange[0] ?? (currentHole === 0 ? liveStrokes.orange : undefined),
                  COURSES[0].par
                )}
              </span>
              <span>
                {formatHoleScore(
                  scores.orange[1] ?? (currentHole === 1 ? liveStrokes.orange : undefined),
                  COURSES[1].par
                )}
              </span>
              <span>
                {formatHoleScore(
                  scores.orange[2] ?? (currentHole === 2 ? liveStrokes.orange : undefined),
                  COURSES[2].par
                )}
              </span>
              <span className="font-bold text-white text-sm">{orangeTotalStrokes}</span>
              <span className="text-[11px] font-semibold text-stone-300">
                {orangeTotalStrokes > 0
                  ? orangeTotalStrokes - totalPar === 0
                    ? "E"
                    : orangeTotalStrokes - totalPar > 0
                    ? `+${orangeTotalStrokes - totalPar}`
                    : `${orangeTotalStrokes - totalPar}`
                  : "-"}
              </span>
            </div>

            {/* Blue Score Row */}
            <div className="grid grid-cols-6 text-center py-1 items-center font-medium border-t border-[#3f3f46]/60">
              <span className="flex items-center gap-1.5 font-bold text-[#2563eb] text-left pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shadow-xs" />
                Blue
              </span>
              <span>
                {formatHoleScore(
                  scores.blue[0] ?? (currentHole === 0 ? liveStrokes.blue : undefined),
                  COURSES[0].par
                )}
              </span>
              <span>
                {formatHoleScore(
                  scores.blue[1] ?? (currentHole === 1 ? liveStrokes.blue : undefined),
                  COURSES[1].par
                )}
              </span>
              <span>
                {formatHoleScore(
                  scores.blue[2] ?? (currentHole === 2 ? liveStrokes.blue : undefined),
                  COURSES[2].par
                )}
              </span>
              <span className="font-bold text-white text-sm">{blueTotalStrokes}</span>
              <span className="text-[11px] font-semibold text-stone-300">
                {blueTotalStrokes > 0
                  ? blueTotalStrokes - totalPar === 0
                    ? "E"
                    : blueTotalStrokes - totalPar > 0
                    ? `+${blueTotalStrokes - totalPar}`
                    : `${blueTotalStrokes - totalPar}`
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Game Result Popup */}
      {gameOverResult && !isPopupDismissed && (
        <GameResultPopup
          resultText={
            gameOverResult.winner === "draw"
              ? "Match Drawn!"
              : selectedMode === "online"
              ? online.isWinner
                ? "Tournament Champion!"
                : "Defeat"
              : `${gameOverResult.winner === "orange" ? "Orange" : "Blue"} Wins the Duel!`
          }
          accentColor={
            gameOverResult.winner === "orange"
              ? "#e0530a"
              : gameOverResult.winner === "blue"
              ? "#2563eb"
              : null
          }
          playAgainText="Rematch"
          onPlayAgain={handleRematch}
          onClose={() => setIsPopupDismissed(true)}
        />
      )}
    </div>
  );
}
