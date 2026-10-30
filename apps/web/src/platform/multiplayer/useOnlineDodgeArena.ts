"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  DodgeArenaOnlinePlayer,
  OnlineDodgeArenaState,
  ServerEnvelope,
} from "./types";

export interface RemoteDodgeInputData {
  playerId: string;
  playerRole: DodgeArenaOnlinePlayer;
  input: string;
  data?: {
    directionX?: number;
    directionY?: number;
    dx?: number;
    dy?: number;
    sequence?: number;
  };
}

export interface RemoteDodgeGameEventData {
  event: string;
  data?: unknown;
}

export function useOnlineDodgeArena() {
  const [gameState, setGameState] = useState<OnlineDodgeArenaState | null>(null);

  const onRemoteInputRef = useRef<((data: RemoteDodgeInputData) => void) | null>(null);
  const onRemoteEventRef = useRef<((data: RemoteDodgeGameEventData) => void) | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<DodgeArenaOnlinePlayer | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineDodgeArenaState;
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
        onRemoteInputRef.current?.(payload as unknown as RemoteDodgeInputData);
      } else if (payload.type === "game_event" || payload.event) {
        onRemoteEventRef.current?.(payload as unknown as RemoteDodgeGameEventData);
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "dodge-arena",
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
  const myRole: DodgeArenaOnlinePlayer | null =
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
  const isGameOver =
    gameState?.status === "won" ||
    gameState?.status === "draw" ||
    gameState?.status === "abandoned";
  const winner = gameState?.winner ?? null;
  const isDraw = winner === "draw";
  const isWinner = winner !== null && winner !== "draw" && myRole !== null && winner === myRole;
  const isLoser = winner !== null && winner !== "draw" && myRole !== null && winner !== myRole;

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
    isDraw,
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
    setOnRemoteInput: (fn: ((data: RemoteDodgeInputData) => void) | null) => {
      onRemoteInputRef.current = fn;
    },
    setOnRemoteEvent: (fn: ((data: RemoteDodgeGameEventData) => void) | null) => {
      onRemoteEventRef.current = fn;
    },
  };
}
