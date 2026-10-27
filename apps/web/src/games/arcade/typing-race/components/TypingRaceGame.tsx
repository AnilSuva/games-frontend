"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";
import { soundManager } from "@/platform/audio";
import { useOnlineTypingRace } from "@/platform/multiplayer/useOnlineTypingRace";
import type { PlayerRaceStats } from "@/platform/multiplayer/types";
import type { GameHostProps } from "@/games/common/types";
import { RaceTrack } from "./RaceTrack";
import { RaceStats } from "./RaceStats";
import { TypingPassage } from "./TypingPassage";

const EMPTY_STATS: PlayerRaceStats = {
  correctChars: 0,
  totalTypedChars: 0,
  totalKeystrokes: 0,
  errorCount: 0,
  wpm: 0,
  accuracy: 100,
  progress: 0,
  isFinished: false,
};

export function TypingRaceGame({
  onGameOver,
  onReady,
}: Partial<GameHostProps> = {}) {
  const online = useOnlineTypingRace();
  const [localTypedText, setLocalTypedText] = useState("");
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [isRacing, setIsRacing] = useState(false);

  const prevCountdownRef = useRef<string | null>(null);
  const playedEndSoundRef = useRef<string | null>(null);
  const hasSentReadyPassageIdRef = useRef<string | null>(null);

  const {
    room,
    connectionState,
    errorMessage,
    gameState,
    myRole,
    isWinner,
    isGameOver,
    winner,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    hasRequestedRematch,
    opponentRequestedRematch,
    createRoom,
    joinRoom,
    leaveRoom,
    sendReady,
    sendProgress,
    requestRematch,
  } = online;

  const orangeStats = gameState?.players?.orange ?? EMPTY_STATS;
  const blueStats = gameState?.players?.blue ?? EMPTY_STATS;
  const myStats = myRole === "orange" ? orangeStats : blueStats;
  const opponentStats = myRole === "orange" ? blueStats : orangeStats;

  // Real-time optimistic progress calculation for instant local car response
  const localMatching = useMemo(() => {
    if (!gameState?.passageText) return 0;
    let match = 0;
    const maxLen = Math.min(localTypedText.length, gameState.passageText.length);
    for (let i = 0; i < maxLen; i++) {
      if (localTypedText[i] === gameState.passageText[i]) {
        match++;
      } else {
        break;
      }
    }
    return match;
  }, [localTypedText, gameState?.passageText]);

  const localProgress = gameState?.passageText?.length
    ? localMatching / gameState.passageText.length
    : 0;

  // Signal platform readiness
  useEffect(() => {
    onReady?.({
      restart: () => {
        requestRematch();
      },
    });
  }, [onReady, requestRematch]);

  // Handshake: Automatically send ready when match is active and component is mounted
  useEffect(() => {
    if (
      room?.status === "in-progress" &&
      room.players.length >= 2 &&
      gameState?.passageId &&
      hasSentReadyPassageIdRef.current !== gameState.passageId
    ) {
      hasSentReadyPassageIdRef.current = gameState.passageId;
      playedEndSoundRef.current = null;
      setLocalTypedText("");
      setIsRacing(false);
      sendReady();
    }
  }, [room?.status, room?.players.length, gameState?.passageId, sendReady]);

  // Synchronized Countdown based on server authoritative timestamps
  useEffect(() => {
    if (!gameState?.raceStartAt || gameState.status !== "in_progress") {
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const raceStartAt = gameState.raceStartAt!;
      const diffMs = raceStartAt - now;

      let nextCountdown: string | null = null;
      let nextRacing = false;

      if (diffMs > 2000) {
        nextCountdown = "3";
      } else if (diffMs > 1000) {
        nextCountdown = "2";
      } else if (diffMs > 0) {
        nextCountdown = "1";
      } else if (diffMs > -900) {
        nextCountdown = "GO!";
        nextRacing = true;
      } else {
        nextCountdown = null;
        nextRacing = true;
      }

      if (nextCountdown !== prevCountdownRef.current) {
        if (nextCountdown === "3" || nextCountdown === "2" || nextCountdown === "1") {
          soundManager.play("dropBall");
        } else if (nextCountdown === "GO!") {
          soundManager.play("buttonClick");
        }
        prevCountdownRef.current = nextCountdown;
      }

      setCountdownText(nextCountdown);
      setIsRacing(nextRacing);
    }, 50);

    return () => clearInterval(timer);
  }, [gameState?.raceStartAt, gameState?.status]);

  // Game over sound effect trigger and platform callback
  useEffect(() => {
    if (isGameOver && winner && playedEndSoundRef.current !== winner) {
      playedEndSoundRef.current = winner;
      if (isWinner) {
        soundManager.play("victory");
      } else {
        soundManager.play("lose");
      }
      onGameOver?.({
        winner: winner ?? null,
      });
    }
  }, [isGameOver, isWinner, winner, onGameOver]);

  // Handle typing change from TypingPassage component
  const handleTypedChange = useCallback(
    (newTypedText: string, totalKeystrokes: number) => {
      setLocalTypedText(newTypedText);
      sendProgress(newTypedText, totalKeystrokes);
    },
    [sendProgress]
  );

  // Are both players present in the room?
  const isMatchReady = Boolean(
    room &&
      room.status === "in-progress" &&
      room.players.length >= 2 &&
      gameState
  );

  // Is opponent still loading their client?
  const isWaitingForOpponentReady =
    isMatchReady &&
    gameState &&
    gameState.readyPlayers.length < 2 &&
    !gameState.raceStartAt;

  // Rematch action
  const handleRematchClick = () => {
    soundManager.play("buttonClick");
    requestRematch();
  };

  // Leave / return action
  const handleLeaveClick = () => {
    soundManager.play("buttonClick");
    leaveRoom();
  };

  // If not yet matched in an active 2-player room, show OnlineMatchLobby
  if (!isMatchReady) {
    return (
      <OnlineMatchLobby
        gameTitle="Typing Race"
        subtitle="High-speed 2-player typing sprint to the checkered flag"
        connectionState={connectionState}
        room={room}
        errorMessage={errorMessage}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onLeaveRoom={leaveRoom}
        onReturnToModes={() => {
          leaveRoom();
        }}
      />
    );
  }

  const roleAccent = myRole === "orange" ? "text-orange-400" : "text-blue-400";
  const rivalRole = myRole === "orange" ? "blue" : "orange";
  const rivalRoleAccent = rivalRole === "orange" ? "text-orange-400" : "text-blue-400";

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 py-2 px-3 sm:px-6 select-none font-sans">
      {/* 1. Header Bar with Match Meta and Abandon Button */}
      <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={handleLeaveClick}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Return to Catalog"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Typing Race</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono font-normal">
                #{room?.roomCode}
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>You: <strong className={`capitalize ${roleAccent}`}>{myRole}</strong></span>
              <span>•</span>
              <span>Rival: <strong className={`capitalize ${rivalRoleAccent}`}>{rivalRole}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Reconnecting Badge */}
          {isMatchPaused && (
            <div className="px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Opponent DC ({disconnectGraceSecondsRemaining}s)
            </div>
          )}

          <button
            onClick={handleLeaveClick}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 text-slate-400 text-xs font-medium border border-slate-700 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* 2. Dual-Lane Asphalt Race Track (Upper Section) */}
      <div className="w-full">
        <RaceTrack
          orangeStats={orangeStats}
          blueStats={blueStats}
          myRole={myRole}
          winner={winner}
          isRacing={isRacing}
          localProgress={localProgress}
        />
      </div>

      {/* 3. Live HUD Performance Metrics (Middle Section) */}
      <div className="w-full">
        <RaceStats
          myStats={myStats}
          opponentStats={opponentStats}
          myRole={myRole}
          totalWords={gameState?.wordCount ?? 45}
        />
      </div>

      {/* 4. Interactive Typing Passage & Typing Area (Lower Section) */}
      <div className="w-full">
        <TypingPassage
          key={gameState?.passageId ?? "passage"}
          passageText={gameState?.passageText ?? ""}
          typedText={localTypedText}
          onTypedChange={handleTypedChange}
          isRacing={isRacing && !isGameOver}
          isPaused={isMatchPaused}
          isCompleted={myStats.isFinished}
          myRole={myRole}
        />
      </div>

      {/* 5. Synchronized Countdown Overlay (3, 2, 1, GO!) */}
      {countdownText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-none transition-all">
          <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
            <div
              className={`font-black font-mono tracking-tighter drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] ${
                countdownText === "GO!"
                  ? "text-7xl sm:text-9xl text-emerald-400 animate-bounce"
                  : "text-8xl sm:text-[11rem] text-amber-400"
              }`}
            >
              {countdownText}
            </div>
            <p className="mt-2 text-slate-300 text-sm sm:text-lg font-medium tracking-widest uppercase">
              {countdownText === "GO!" ? "Pedal to the metal!" : "Get ready to type!"}
            </p>
          </div>
        </div>
      )}

      {/* 6. Waiting for Opponent Handshake Overlay */}
      {isWaitingForOpponentReady && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <h3 className="text-white font-bold text-lg">Synchronizing Racers...</h3>
            <p className="text-slate-400 text-xs text-center max-w-xs">
              Waiting for your rival to load the race track. Countdown will begin simultaneously on both devices.
            </p>
          </div>
        </div>
      )}

      {/* 7. Disconnect Grace Period Alert Overlay */}
      {isMatchPaused && disconnectGraceSecondsRemaining !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl bg-slate-900 border border-rose-500/50 shadow-2xl text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
              <svg className="w-6 h-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Rival Connection Lost</h3>
              <p className="text-slate-300 text-sm mt-1">
                Waiting for reconnection. The race is paused for both players.
              </p>
            </div>
            <div className="font-mono text-3xl font-extrabold text-amber-400">
              {disconnectGraceSecondsRemaining}s
            </div>
            <p className="text-xs text-slate-500">
              If your opponent does not return within the grace period, you will automatically win by forfeit.
            </p>
          </div>
        </div>
      )}

      {/* 8. Match Result Modal Popup */}
      {isGameOver && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center">
            {/* Winner Badge Trophy / Icon */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
                isWinner
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {isWinner ? (
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 3h12v2H6V3zm14 4h-2.1c-.5-2.3-2.6-4-5.9-4-3.3 0-5.4 1.7-5.9 4H4c-1.1 0-2 .9-2 2v2c0 3.3 2.7 6 6 6h.2c1.2 1.8 3.2 3 5.8 3s4.6-1.2 5.8-3H20c3.3 0 6-2.7 6-6V9c0-1.1-.9-2-2-2z" />
                </svg>
              ) : (
                <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {isWinner ? "Victory!" : "Runner-Up"}
            </h2>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              {isWinner
                ? "You crossed the finish line first with superior speed and precision!"
                : `${winner.toUpperCase()} finished ahead. Brush up on your keystrokes and rematch!`}
            </p>

            {/* Performance Stats Breakdown Table */}
            <div className="w-full grid grid-cols-2 gap-3 mb-6 font-mono text-left">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Your Time</span>
                <span className="text-xl font-bold text-amber-400">
                  {myStats.finishTimeMs ? `${(myStats.finishTimeMs / 1000).toFixed(1)}s` : "--"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Rival Time</span>
                <span className="text-xl font-bold text-slate-300">
                  {opponentStats.finishTimeMs ? `${(opponentStats.finishTimeMs / 1000).toFixed(1)}s` : opponentStats.isFinished ? "Done" : "Racing..."}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Your Speed</span>
                <span className="text-xl font-bold text-emerald-400">{myStats.wpm} <span className="text-xs text-slate-400">WPM</span></span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Rival Speed</span>
                <span className="text-xl font-bold text-slate-300">{opponentStats.wpm} <span className="text-xs text-slate-400">WPM</span></span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Your Accuracy</span>
                <span className="text-xl font-bold text-cyan-400">{myStats.accuracy}%</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Rival Accuracy</span>
                <span className="text-xl font-bold text-slate-300">{opponentStats.accuracy}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleRematchClick}
                disabled={hasRequestedRematch}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  hasRequestedRematch
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-98"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                <span>
                  {hasRequestedRematch
                    ? "Rematch Requested (Waiting for Rival)..."
                    : opponentRequestedRematch
                    ? "Rival Requested Rematch — Accept!"
                    : "Play Again (Rematch)"}
                </span>
              </button>

              <button
                onClick={handleLeaveClick}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors"
              >
                Exit to Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TypingRaceGame;
