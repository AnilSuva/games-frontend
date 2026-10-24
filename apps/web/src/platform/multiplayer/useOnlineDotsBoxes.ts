"use client";

import { useCallback, useEffect, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  DotsBoxesOnlinePlayer,
  OnlineDotsBoxesState,
  RoomDto,
  ServerEnvelope,
} from "./types";
import type { Edge } from "@/games/board/dots-and-boxes/logic/types";

export function useOnlineDotsBoxes() {
  const [gameState, setGameState] = useState<OnlineDotsBoxesState | null>(null);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineDotsBoxesState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineDotsBoxesState);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "dots-and-boxes",
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

  const myPlayerColor: DotsBoxesOnlinePlayer | null =
    multiplayer.myPlayerId && gameState?.playerColors
      ? gameState.playerColors[multiplayer.myPlayerId] ?? null
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

  const claimEdge = useCallback(
    (edge: Edge) => {
      if (!isMyTurn || isMatchPaused || !multiplayer.room) return;
      multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        edge,
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
    claimEdge,
    requestRematch,
    isMatchPaused,
    remainingGraceSeconds,
    disconnectedPlayerId: gameState?.disconnectedPlayerId ?? null,
  };
}
