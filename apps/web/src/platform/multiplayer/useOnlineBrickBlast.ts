"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  BrickBlastPlayer,
  OnlineBrickBlastState,
  RoomDto,
  ServerEnvelope,
} from "./types";

export interface RemoteInputData {
  playerId: string;
  playerRole: BrickBlastPlayer;
  input: string;
  data?: unknown;
}

export interface RemoteGameEventData {
  event: string;
  data?: unknown;
}

export function useOnlineBrickBlast() {
  const [gameState, setGameState] = useState<OnlineBrickBlastState | null>(null);

  const onRemoteInputRef = useRef<((data: RemoteInputData) => void) | null>(null);
  const onRemoteEventRef = useRef<((data: RemoteGameEventData) => void) | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineBrickBlastState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "game.event") {
      const payload = envelope.payload as Record<string, unknown>;
      if (payload.type === "player_input") {
        onRemoteInputRef.current?.(payload as unknown as RemoteInputData);
      } else if (payload.type === "game_event" || payload.event) {
        onRemoteEventRef.current?.(payload as unknown as RemoteGameEventData);
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineBrickBlastState);
    } else if (room.status === "in-progress" || room.players.length >= 2) {
      setGameState((prev) => {
        if (prev) return prev;
        const hostPlayer =
          room.players.find((p) => p.seat === 0) || room.players[0];
        const guestPlayer =
          room.players.find((p) => p.seat === 1) || room.players[1];
        const roles: Record<string, BrickBlastPlayer> = {};
        if (hostPlayer) roles[hostPlayer.playerId] = "orange";
        if (guestPlayer) roles[guestPlayer.playerId] = "blue";
        return {
          status: "in_progress",
          currentLevel: 1,
          startingPlayer: "orange",
          serverPlayer: "orange",
          scores: { orange: 0, blue: 0 },
          winner: null,
          playerRoles: roles,
          rematchRequests: [],
        };
      });
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "brick-blast",
    defaultMaxPlayers: 2,
    onMessage: handleServerMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const { connectionState, setConnectionState } = multiplayer;

  // Synchronize game over state with connectionState
  useEffect(() => {
    if (gameState) {
      if (gameState.status === "won") {
        setConnectionState("game_over");
      } else if (
        gameState.status === "in_progress" &&
        connectionState !== "reconnecting"
      ) {
        setConnectionState("in_game");
      }
    }
  }, [gameState, connectionState, setConnectionState]);

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

  // Send player input intent (throttled / coalesced by caller)
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

  // Send game event (level complete, game over, ball serve)
  const sendGameEvent = useCallback(
    (event: string, data?: unknown) => {
      if (!multiplayer.room) return;
      multiplayer.sendMessage("game.event", {
        roomId: multiplayer.room.roomId,
        event,
        data,
      });
    },
    [multiplayer]
  );

  // Request rematch
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

  // Handler registration for Phaser scene
  const setRemoteHandlers = useCallback(
    (handlers: {
      onRemoteInput?: (data: RemoteInputData) => void;
      onRemoteEvent?: (data: RemoteGameEventData) => void;
    }) => {
      onRemoteInputRef.current = handlers.onRemoteInput ?? null;
      onRemoteEventRef.current = handlers.onRemoteEvent ?? null;
    },
    []
  );

  // Derived properties
  const myRole: BrickBlastPlayer | null =
    multiplayer.myPlayerId && gameState?.playerRoles?.[multiplayer.myPlayerId]
      ? gameState.playerRoles[multiplayer.myPlayerId]
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "orange"
        : "blue"
      : null;

  const opponentRole: BrickBlastPlayer | null =
    myRole === "orange" ? "blue" : myRole === "blue" ? "orange" : null;

  const effectiveOpponentConnected =
    multiplayer.isOpponentConnected &&
    !isMatchPaused &&
    (multiplayer.opponentPlayer?.connected ?? true);

  const winner: BrickBlastPlayer | null = gameState?.winner ?? null;
  const isGameOver = Boolean(
    gameState?.status === "won" ||
      gameState?.status === "abandoned" ||
      multiplayer.connectionState === "game_over"
  );
  const isWinner = Boolean(myRole && winner === myRole);
  const isLoser = Boolean(myRole && winner && winner !== myRole);

  const hasRequestedRematch = Boolean(
    multiplayer.myPlayerId &&
      gameState?.rematchRequests?.includes(multiplayer.myPlayerId)
  );

  const opponentRequestedRematch = Boolean(
    multiplayer.opponentPlayer &&
      gameState?.rematchRequests?.includes(
        multiplayer.opponentPlayer.playerId
      )
  );

  return {
    connectionState: multiplayer.connectionState,
    myPlayerId: multiplayer.myPlayerId,
    myRole,
    opponentRole,
    opponentPlayer: multiplayer.opponentPlayer,
    isOpponentConnected: effectiveOpponentConnected,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    resultReason: gameState?.resultReason ?? (gameState?.status === "won" ? "win" : null),
    room: multiplayer.room,
    gameState,
    errorMessage: multiplayer.errorMessage,
    winner,
    isGameOver,
    isWinner,
    isLoser,
    hasRequestedRematch,
    opponentRequestedRematch,
    connect: multiplayer.connect,
    disconnect,
    exitMatch: disconnect,
    createRoom: multiplayer.createRoom,
    joinRoom: multiplayer.joinRoom,
    sendInput,
    sendGameEvent,
    requestRematch,
    leaveRoom,
    setRemoteHandlers,
  };
}
