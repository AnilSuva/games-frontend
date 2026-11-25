"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  RoomDto,
  ServerEnvelope,
} from "./types";
import type {
  MiniGolfPlayer,
  PhysicsEvent,
  TrajectoryPoint,
  Vector2,
} from "@/games/arcade/mini-golf-duel/game/types";

export interface AuthoritativeShotPayload {
  type: "shot_resolved";
  playerId: string;
  playerRole: MiniGolfPlayer;
  aim: Vector2;
  power: number;
  trajectory: TrajectoryPoint[];
  events: PhysicsEvent[];
  sunk: boolean;
  waterHazard: boolean;
  finalPosition: Vector2;
  strokes: number;
  nextPlayer?: MiniGolfPlayer;
  holeTransition?: {
    nextHoleIndex: number;
    completedHoleIndex: number;
    holeScores: { orange: number[]; blue: number[] };
  };
  matchCompleted?: {
    winner: MiniGolfPlayer | "draw";
    status: "won" | "draw";
    holeScores: { orange: number[]; blue: number[] };
    totalOrange: number;
    totalBlue: number;
  };
}

export interface OnlineMiniGolfState {
  currentHoleIndex: number;
  startingPlayer: MiniGolfPlayer;
  currentPlayer: MiniGolfPlayer;
  status: "waiting" | "in_progress" | "won" | "draw";
  winner: MiniGolfPlayer | "draw" | null;
  resultReason?: string;
  playerRoles: Record<string, MiniGolfPlayer>;
  rematchRequests: string[];
  maxStrokesPerHole: number;
  holeScores: {
    orange: number[];
    blue: number[];
  };
  holeState: {
    orange: {
      strokes: number;
      finished: boolean;
      ballPosition: Vector2;
      lastSafePosition: Vector2;
    };
    blue: {
      strokes: number;
      finished: boolean;
      ballPosition: Vector2;
      lastSafePosition: Vector2;
    };
  };
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
}

export function useOnlineMiniGolf() {
  const [gameState, setGameState] = useState<OnlineMiniGolfState | null>(null);

  const onRemoteShotRef = useRef<((shot: AuthoritativeShotPayload) => void) | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineMiniGolfState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "game.event") {
      const payload = envelope.payload as Record<string, unknown>;
      if (payload.type === "shot_resolved") {
        onRemoteShotRef.current?.(payload as unknown as AuthoritativeShotPayload);
      }
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineMiniGolfState);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "mini-golf-duel",
    defaultMaxPlayers: 2,
    onMessage: handleServerMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const { connectionState, setConnectionState } = multiplayer;

  useEffect(() => {
    if (gameState) {
      if (gameState.status === "won" || gameState.status === "draw") {
        setConnectionState("game_over");
      } else if (
        gameState.status === "in_progress" &&
        connectionState !== "reconnecting"
      ) {
        setConnectionState("in_game");
      }
    }
  }, [gameState, connectionState, setConnectionState]);

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
      gameState?.disconnectedPlayerId !== multiplayer.myPlayerId
  );
  const remainingGraceSeconds = disconnectGraceExpiresAt
    ? Math.max(0, Math.ceil((disconnectGraceExpiresAt - now) / 1000))
    : 0;

  const myPlayerColor: MiniGolfPlayer | null =
    multiplayer.myPlayerId && gameState?.playerRoles
      ? gameState.playerRoles[multiplayer.myPlayerId] ?? null
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "orange"
        : "blue"
      : null;

  const isMyTurn = Boolean(
    myPlayerColor &&
      gameState?.currentPlayer === myPlayerColor &&
      gameState?.status === "in_progress" &&
      !isMatchPaused
  );

  const isWinner = Boolean(
    myPlayerColor &&
      gameState?.status === "won" &&
      gameState.winner === myPlayerColor
  );

  const isLoser = Boolean(
    myPlayerColor &&
      gameState?.status === "won" &&
      gameState.winner &&
      gameState.winner !== "draw" &&
      gameState.winner !== myPlayerColor
  );

  const isDraw = Boolean(
    gameState?.status === "draw" || gameState?.winner === "draw"
  );

  const takeShot = useCallback(
    (aim: Vector2, power: number) => {
      if (!isMyTurn || isMatchPaused || !multiplayer.room) return;
      multiplayer.sendMessage("game.shot", {
        roomId: multiplayer.room.roomId,
        aim,
        power,
      });
    },
    [isMyTurn, isMatchPaused, multiplayer]
  );

  const requestRematch = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.rematch", {
      roomId: multiplayer.room.roomId,
    });
  }, [multiplayer]);

  return {
    ...multiplayer,
    gameState,
    myPlayerColor,
    isMyTurn,
    isWinner,
    isLoser,
    isDraw,
    winnerColor: gameState?.winner ?? null,
    takeShot,
    requestRematch,
    isMatchPaused,
    remainingGraceSeconds,
    disconnectedPlayerId: gameState?.disconnectedPlayerId ?? null,
    setOnRemoteShot: (callback: (shot: AuthoritativeShotPayload) => void) => {
      onRemoteShotRef.current = callback;
    },
  };
}
