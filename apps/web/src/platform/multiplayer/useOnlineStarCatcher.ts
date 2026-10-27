"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineStarCatcherState,
  StarCatcherOnlinePlayer,
  ServerEnvelope,
} from "./types";

export interface RemoteInputData {
  playerId: string;
  playerRole: StarCatcherOnlinePlayer;
  input: string;
  data?: unknown;
}

export interface RemoteGameEventData {
  event: string;
  data?: unknown;
}

export function useOnlineStarCatcher() {
  const [gameState, setGameState] = useState<OnlineStarCatcherState | null>(null);

  const onRemoteInputRef = useRef<((data: RemoteInputData) => void) | null>(null);
  const onRemoteEventRef = useRef<((data: RemoteGameEventData) => void) | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<StarCatcherOnlinePlayer | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineStarCatcherState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "game.event") {
      const payload = envelope.payload as Record<string, unknown>;
      if (payload.type === "player_input") {
        const inputPlayerId = typeof payload.playerId === "string" ? payload.playerId : null;
        const inputPlayerRole = typeof payload.playerRole === "string" ? payload.playerRole : null;
        const myPlayerId = myPlayerIdRef.current;
        const currentRole = myRoleRef.current;
        if (
          (myPlayerId && inputPlayerId === myPlayerId) ||
          (currentRole && inputPlayerRole === currentRole)
        ) {
          return;
        }
        onRemoteInputRef.current?.(payload as unknown as RemoteInputData);
      } else if (payload.type === "game_event" || payload.event) {
        onRemoteEventRef.current?.(payload as unknown as RemoteGameEventData);
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "star-catcher",
    onMessage: handleServerMessage,
  });

  // Local clock tick when disconnect grace countdown is active
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (
      !gameState?.disconnectGraceExpiresAt ||
      gameState.status !== "in_progress"
    ) {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [gameState?.disconnectGraceExpiresAt, gameState?.status]);

  const disconnectGraceExpiresAt = gameState?.disconnectGraceExpiresAt ?? null;
  const isMatchPaused = Boolean(
    disconnectGraceExpiresAt &&
      disconnectGraceExpiresAt > now &&
      gameState?.status === "in_progress"
  );

  const disconnectGraceSecondsRemaining =
    isMatchPaused && disconnectGraceExpiresAt
      ? Math.max(0, Math.ceil((disconnectGraceExpiresAt - now) / 1000))
      : null;

  const sendInput = useCallback(
    (input: string, data?: unknown) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.input", {
        roomId: multiplayer.room.roomId,
        input,
        data,
      });
    },
    [multiplayer, isMatchPaused]
  );

  const sendGameEvent = useCallback(
    (event: string, data?: unknown) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.event", {
        roomId: multiplayer.room.roomId,
        event,
        data,
      });
    },
    [multiplayer, isMatchPaused]
  );

  const requestRematch = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.rematch", {
      roomId: multiplayer.room.roomId,
    });
  }, [multiplayer]);

  const leaveRoom = useCallback(() => {
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

  // Determine current player's role
  const myRole: StarCatcherOnlinePlayer | null =
    multiplayer.myPlayerId && gameState?.playerRoles?.[multiplayer.myPlayerId]
      ? gameState.playerRoles[multiplayer.myPlayerId]
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "orange"
        : "blue"
      : null;

  useEffect(() => {
    myPlayerIdRef.current = multiplayer.myPlayerId;
    myRoleRef.current = myRole;
  }, [multiplayer.myPlayerId, myRole]);

  const sendReady = useCallback(() => {
    sendGameEvent("player_ready");
  }, [sendGameEvent]);

  const isHost = myRole === "orange";
  const isGameOver = gameState?.status === "won" || gameState?.status === "abandoned";
  const winner = gameState?.winner ?? null;
  const isWinner = winner !== null && myRole !== null && winner === myRole;
  const isLoser = winner !== null && myRole !== null && winner !== myRole;

  // Rematch status
  const hasRequestedRematch = Boolean(
    multiplayer.myPlayerId &&
      gameState?.rematchRequests?.includes(multiplayer.myPlayerId)
  );
  const opponentRequestedRematch = Boolean(
    gameState?.rematchRequests &&
      gameState.rematchRequests.length > 0 &&
      !hasRequestedRematch
  );

  return {
    ...multiplayer,
    gameState,
    myRole,
    isHost,
    isGameOver,
    winner,
    isWinner,
    isLoser,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    hasRequestedRematch,
    opponentRequestedRematch,
    sendReady,
    sendInput,
    sendGameEvent,
    requestRematch,
    leaveRoom,
    disconnect,
    setOnRemoteInput: (fn: ((data: RemoteInputData) => void) | null) => {
      onRemoteInputRef.current = fn;
    },
    setOnRemoteEvent: (fn: ((data: RemoteGameEventData) => void) | null) => {
      onRemoteEventRef.current = fn;
    },
  };
}
