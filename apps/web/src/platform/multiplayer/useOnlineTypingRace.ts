"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineTypingRaceState,
  PlayerRaceStats,
  ServerEnvelope,
  TypingRaceOnlinePlayer,
} from "./types";

export interface RemoteEventData {
  event: string;
  data?: unknown;
}

export function useOnlineTypingRace() {
  const [gameState, setGameState] = useState<OnlineTypingRaceState | null>(null);

  const onRemoteEventRef = useRef<((data: RemoteEventData) => void) | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<TypingRaceOnlinePlayer | null>(null);
  const lastSendProgressTimeRef = useRef<number>(0);
  const pendingProgressRef = useRef<{ text: string; totalKeystrokes: number } | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineTypingRaceState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "game.event") {
      const payload = envelope.payload as Record<string, unknown>;
      if (payload.type === "game_event" || payload.event) {
        onRemoteEventRef.current?.(payload as unknown as RemoteEventData);
      }

      // Live real-time streaming updates from opponent/player inputs
      if (payload.type === "player_input" && payload.data) {
        const inputData = payload.data as {
          role?: TypingRaceOnlinePlayer;
          stats?: PlayerRaceStats;
        };
        if (inputData.role && inputData.stats) {
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: {
                ...prev.players,
                [inputData.role!]: inputData.stats!,
              },
            };
          });
        }
      }

      // Immediate game over event handling
      if (payload.event === "game_over" && payload.data) {
        const gameOverData = payload.data as {
          winner?: TypingRaceOnlinePlayer;
          finalStats?: Record<TypingRaceOnlinePlayer, PlayerRaceStats>;
        };
        if (gameOverData.winner) {
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: "won",
              winner: gameOverData.winner ?? null,
              players: gameOverData.finalStats || prev.players,
            };
          });
        }
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "typing-race",
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

  // Determine current player's role
  const myRole: TypingRaceOnlinePlayer | null =
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

  // Send player ready event
  const sendReady = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.event", {
      roomId: multiplayer.room.roomId,
      event: "player_ready",
      data: {},
    });
  }, [multiplayer]);

  // Send countdown start event (host authoritative)
  const sendCountdownStart = useCallback(
    (countdownStartAt: number, raceStartAt: number) => {
      if (!multiplayer.room) return;
      multiplayer.sendMessage("game.event", {
        roomId: multiplayer.room.roomId,
        event: "countdown_start",
        data: { countdownStartAt, raceStartAt },
      });
    },
    [multiplayer]
  );

  // Send typing progress updates (throttled to max 10 updates/sec to prevent spamming WebSocket)
  const flushProgress = useCallback(
    (text: string, totalKeystrokes: number) => {
      if (!multiplayer.room || isMatchPaused) return;
      lastSendProgressTimeRef.current = Date.now();
      pendingProgressRef.current = null;
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      multiplayer.sendMessage("game.input", {
        roomId: multiplayer.room.roomId,
        input: "progress",
        data: {
          text,
          totalKeystrokes,
        },
      });
    },
    [multiplayer, isMatchPaused]
  );

  const sendProgress = useCallback(
    (text: string, totalKeystrokes: number) => {
      const nowTime = Date.now();
      const timeSinceLast = nowTime - lastSendProgressTimeRef.current;
      const isComplete = gameState?.passageText && text.length >= gameState.passageText.length;

      // Send immediately if complete or if enough time has passed (~100ms)
      if (isComplete || timeSinceLast >= 100) {
        flushProgress(text, totalKeystrokes);
      } else {
        pendingProgressRef.current = { text, totalKeystrokes };
        if (!progressTimerRef.current) {
          progressTimerRef.current = setTimeout(() => {
            if (pendingProgressRef.current) {
              flushProgress(
                pendingProgressRef.current.text,
                pendingProgressRef.current.totalKeystrokes
              );
            }
          }, 100 - timeSinceLast);
        }
      }
    },
    [flushProgress, gameState]
  );

  const requestRematch = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.rematch", {
      roomId: multiplayer.room.roomId,
    });
  }, [multiplayer]);

  const leaveRoom = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
    }
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
    }
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

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
    sendCountdownStart,
    sendProgress,
    requestRematch,
    leaveRoom,
    disconnect,
    setOnRemoteEvent: (fn: ((data: RemoteEventData) => void) | null) => {
      onRemoteEventRef.current = fn;
    },
  };
}
