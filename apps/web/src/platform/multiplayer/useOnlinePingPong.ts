"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlinePingPongState,
  PingPongPlayer,
  ServerEnvelope,
} from "./types";
import type { BallSyncPayload } from "@/games/arcade/ping-pong/game/types";

export interface RemoteInputData {
  playerId: string;
  playerRole: PingPongPlayer;
  input: string;
  data?: unknown;
}

export interface RemoteGameEventData {
  event: string;
  data?: unknown;
}

export function useOnlinePingPong() {
  const [gameState, setGameState] = useState<OnlinePingPongState | null>(null);

  const onRemoteInputRef = useRef<((data: RemoteInputData) => void) | null>(null);
  const onRemoteEventRef = useRef<((data: RemoteGameEventData) => void) | null>(null);
  const onBallSyncRef = useRef<((data: BallSyncPayload) => void) | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<PingPongPlayer | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlinePingPongState;
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
        const eventName =
          (payload.event as string) ||
          ((payload.data as { event?: string })?.event as string) ||
          "";
        const eventData = payload.data;

        if (eventName === "ball_sync") {
          onBallSyncRef.current?.(eventData as BallSyncPayload);
        }

        onRemoteEventRef.current?.(payload as unknown as RemoteGameEventData);
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "ping-pong",
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

  const sendBallSync = useCallback(
    (data: BallSyncPayload) => {
      sendGameEvent("ball_sync", data);
    },
    [sendGameEvent]
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
  const myRole: PingPongPlayer | null =
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
    gameState?.rematchRequests?.some(
      (pid) => pid !== multiplayer.myPlayerId
    )
  );

  const setRemoteHandlers = useCallback(
    (handlers: {
      onRemoteInput?: (data: RemoteInputData) => void;
      onRemoteEvent?: (data: RemoteGameEventData) => void;
      onBallSync?: (data: BallSyncPayload) => void;
    }) => {
      onRemoteInputRef.current = handlers.onRemoteInput || null;
      onRemoteEventRef.current = handlers.onRemoteEvent || null;
      onBallSyncRef.current = handlers.onBallSync || null;
    },
    []
  );

  return {
    connectionState: multiplayer.connectionState,
    room: multiplayer.room,
    gameState,
    myPlayerId: multiplayer.myPlayerId,
    myRole,
    isHost,
    isGameOver,
    winner,
    isWinner,
    isLoser,
    scores: gameState?.scores ?? { orange: 0, blue: 0 },
    errorMessage: multiplayer.errorMessage,
    hasRequestedRematch,
    opponentRequestedRematch,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    connect: multiplayer.connect,
    disconnect,
    createRoom: multiplayer.createRoom,
    joinRoom: multiplayer.joinRoom,
    leaveRoom,
    sendInput,
    sendGameEvent,
    sendBallSync,
    requestRematch,
    setRemoteHandlers,
  };
}
