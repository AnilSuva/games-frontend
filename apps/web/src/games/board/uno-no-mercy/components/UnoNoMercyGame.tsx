"use client";

import { useEffect, useRef, useState } from "react";
import type { GameHostProps } from "@/games/common/types";
import { createResultSoundGuard, getResultSound } from "@/games/common/resultSound";
import { soundManager } from "@/platform/audio";
import { useOnlineUnoNoMercy } from "@/platform/multiplayer/useOnlineUnoNoMercy";
import { UnoGameTable } from "./UnoGameTable";
import { UnoLobbyEntry } from "./UnoLobbyEntry";
import { UnoNoMercyHowToPlayModal } from "./UnoNoMercyHowToPlayModal";
import { UnoWaitingRoom } from "./UnoWaitingRoom";

const DISPLAY_NAME_STORAGE_KEY = "omniplay_uno_display_name";

export function UnoNoMercyGame({
  onReady,
  onLifecycleChange,
  onGameOver,
}: Partial<GameHostProps> = {}) {
  const [displayName, setDisplayName] = useState<string>(() => {
    if (typeof window === "undefined") return "Player";
    try {
      return localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || "Player";
    } catch {
      return "Player";
    }
  });
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  const online = useOnlineUnoNoMercy(displayName);
  const soundGuardRef = useRef(createResultSoundGuard());
  const reportedWinRef = useRef<string | null>(null);

  const handleDisplayNameChange = (name: string) => {
    setDisplayName(name);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
      } catch {
        // ignore storage errors
      }
    }
  };

  // Register platform controller
  useEffect(() => {
    onReady?.({
      restart: () => {
        online.leaveRoom();
      },
      destroy: () => {
        online.leaveRoom();
      },
    });
  }, [onReady, online]);

  // Sync platform lifecycle
  useEffect(() => {
    if (
      online.gameState?.status === "won" ||
      online.gameState?.status === "finished"
    ) {
      onLifecycleChange?.("finished");
    } else if (online.room?.status === "in-progress" && online.gameState) {
      onLifecycleChange?.("playing");
    } else if (online.room) {
      onLifecycleChange?.("configuration");
    } else {
      onLifecycleChange?.("pre-game");
    }
  }, [online.gameState, online.room, onLifecycleChange]);

  // Reset sound guard on new match
  useEffect(() => {
    if (online.gameState?.status === "in_progress") {
      soundGuardRef.current.reset();
      reportedWinRef.current = null;
    }
  }, [online.gameState?.status]);

  // Play win/loss sound and notify GameHost on match completion
  useEffect(() => {
    const gs = online.gameState;
    const isEnded = gs?.status === "won" || gs?.status === "finished";
    const endKey = gs?.winnerId ?? gs?.loserId ?? null;

    if (
      isEnded &&
      endKey &&
      online.myPlayerId &&
      reportedWinRef.current !== endKey
    ) {
      reportedWinRef.current = endKey;

      const syntheticWinner =
        gs.resultReason === "single_loser_mercy"
          ? gs.loserId === online.myPlayerId
            ? "__loser__"
            : online.myPlayerId
          : gs.winnerId;

      const cue = soundGuardRef.current.claim(
        getResultSound({
          mode: "vs-bot",
          winner: syntheticWinner,
          humanPlayer: online.myPlayerId,
        })
      );
      if (cue === "victory") {
        soundManager.playVictory();
      } else if (cue === "lose") {
        soundManager.playLose();
      }
      onGameOver?.({
        winner: gs.winnerId,
        details: { resultReason: gs.resultReason, loserId: gs.loserId },
      });
    }
  }, [online.gameState, online.myPlayerId, onGameOver]);

  const isBusy =
    online.connectionState === "connecting" ||
    online.connectionState === "identifying" ||
    online.connectionState === "creating_room" ||
    online.connectionState === "joining_room";

  return (
    <div className="w-full h-full relative overflow-hidden">
      {online.room?.status === "in-progress" || online.gameState ? (
        online.gameState && online.myPlayerId ? (
          <UnoGameTable
            gameState={online.gameState}
            myPlayerId={online.myPlayerId}
            events={online.events}
            pendingAction={online.pendingAction}
            errorMessage={online.error}
            onPlayCard={online.playCard}
            onDrawCard={online.drawCard}
            onAcceptDrawPenalty={online.acceptDrawPenalty}
            onPassTurn={online.passTurn}
            onChooseWildColor={online.chooseWildColor}
            onChooseSwapTarget={online.chooseSwapTarget}
            onChooseRouletteColor={online.chooseRouletteColor}
            onCallUno={online.callUno}
            onCatchUno={online.catchUno}
            onLeaveRoom={online.leaveRoom}
            onOpenHowToPlay={() => setHowToPlayOpen(true)}
          />
        ) : null
      ) : online.room && online.roomCode ? (
        <UnoWaitingRoom
          roomCode={online.roomCode}
          players={online.players}
          myPlayerId={online.myPlayerId}
          hostPlayerId={online.room.hostPlayerId}
          isHost={online.isHost}
          settings={online.settings}
          errorMessage={online.error}
          onUpdateSettings={online.updateSettings}
          onStartGame={online.startGame}
          onLeaveRoom={online.leaveRoom}
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
        />
      ) : (
        <UnoLobbyEntry
          displayName={displayName}
          onDisplayNameChange={handleDisplayNameChange}
          onCreateRoom={() => online.createRoom(displayName)}
          onJoinRoom={(code) => online.joinRoom(code, displayName)}
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
          isBusy={isBusy}
          errorMessage={online.error}
          kickedReason={online.kickedReason}
          onDismissKicked={online.clearKickedReason}
        />
      )}

      <UnoNoMercyHowToPlayModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
        mercyLimit={online.settings.mercyLimit}
      />
    </div>
  );
}

export default UnoNoMercyGame;
