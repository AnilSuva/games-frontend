"use client";

import { useCallback, useEffect, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  CheckersPlayer,
  OnlineCheckersState,
  RoomDto,
  ServerEnvelope,
} from "./types";
import { createInitialBoard } from "@/games/board/checkers/logic/moves";

export function useOnlineCheckers() {
  const [gameState, setGameState] = useState<OnlineCheckersState | null>(null);

  // Synchronize incoming game-specific envelopes and room updates
  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineCheckersState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineCheckersState);
    } else if (room.status === "in-progress" || room.players.length >= 2) {
      setGameState((prev) => {
        if (prev) return prev;
        const hostPlayer =
          room.players.find((p) => p.seat === 0) || room.players[0];
        const guestPlayer =
          room.players.find((p) => p.seat === 1) || room.players[1];
        const roles: Record<string, CheckersPlayer> = {};
        if (hostPlayer) roles[hostPlayer.playerId] = "orange";
        if (guestPlayer) roles[guestPlayer.playerId] = "blue";
        return {
          board: createInitialBoard(),
          currentPlayer: "orange",
          startingPlayer: "orange",
          status: "in_progress",
          winner: null,
          activePiece: null,
          orangeCaptures: 0,
          blueCaptures: 0,
          moveCount: 0,
          lastMove: null,
          playerRoles: roles,
          rematchRequests: [],
        };
      });
    }
  }, []);

  // Delegate all generic multiplayer transport & room lifecycle to useMultiplayerRoom
  const multiplayer = useMultiplayerRoom({
    gameId: "checkers",
    defaultMaxPlayers: 2,
    onMessage: handleServerMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const { connectionState, setConnectionState } = multiplayer;

  // Synchronize game over state with connectionState
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

  // Local clock tick when match is active (for 1-minute move limit & disconnect grace)
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (gameState?.status !== "in_progress") {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [gameState?.status]);

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

  const turnExpiresAt = gameState?.turnExpiresAt ?? null;
  const turnSecondsRemaining =
    gameState?.status === "in_progress" && !isMatchPaused && turnExpiresAt
      ? Math.max(0, Math.ceil((turnExpiresAt - now) / 1000))
      : null;

  const resultReason =
    gameState?.resultReason ??
    (gameState?.status === "won"
      ? "win"
      : gameState?.status === "draw"
      ? "draw"
      : null);

  // Claim match victory when opponent turn timer expires (AFK protection)
  const claimTimeout = useCallback(() => {
    if (!multiplayer.room || gameState?.status !== "in_progress" || isMatchPaused) return;
    multiplayer.sendMessage("game.event", {
      roomId: multiplayer.room.roomId,
      event: "TIMEOUT",
    });
  }, [multiplayer, gameState?.status, isMatchPaused]);

  // Send Checkers move intent (from, to: 0..63)
  const sendMove = useCallback(
    (from: number, to: number) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        from,
        to,
      });
    },
    [multiplayer, isMatchPaused]
  );

  // Request rematch
  const requestRematch = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.rematch", {
      roomId: multiplayer.room.roomId,
    });
  }, [multiplayer]);

  // Clean room exit & state reset
  const leaveRoom = useCallback(() => {
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

  // Derived properties
  const myRole: CheckersPlayer | null =
    multiplayer.myPlayerId && gameState?.playerRoles?.[multiplayer.myPlayerId]
      ? gameState.playerRoles[multiplayer.myPlayerId]
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "orange"
        : "blue"
      : null;

  const effectiveOpponentConnected =
    multiplayer.isOpponentConnected &&
    !isMatchPaused &&
    (multiplayer.opponentPlayer?.connected ?? true);

  const isMyTurn = Boolean(
    !isMatchPaused &&
      myRole &&
      gameState &&
      gameState.status === "in_progress" &&
      gameState.currentPlayer === myRole
  );

  const winnerRole: CheckersPlayer | null = gameState?.winner ?? null;
  const isWinner = Boolean(myRole && winnerRole === myRole);
  const isLoser = Boolean(myRole && winnerRole && winnerRole !== myRole);
  const isDraw = Boolean(gameState?.status === "draw");

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

  // Auto-claim timeout victory when opponent's 1-minute timer expires
  useEffect(() => {
    if (
      turnSecondsRemaining !== null &&
      turnSecondsRemaining <= 0 &&
      gameState?.status === "in_progress" &&
      !isMatchPaused &&
      !isMyTurn
    ) {
      claimTimeout();
    }
  }, [
    turnSecondsRemaining,
    gameState?.status,
    isMatchPaused,
    isMyTurn,
    claimTimeout,
  ]);

  return {
    connectionState: multiplayer.connectionState,
    myPlayerId: multiplayer.myPlayerId,
    myRole,
    opponentPlayer: multiplayer.opponentPlayer,
    isOpponentConnected: effectiveOpponentConnected,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    turnExpiresAt,
    turnSecondsRemaining,
    resultReason,
    room: multiplayer.room,
    gameState,
    errorMessage: multiplayer.errorMessage,
    isMyTurn,
    winnerRole,
    isWinner,
    isLoser,
    isDraw,
    hasRequestedRematch,
    opponentRequestedRematch,
    connect: multiplayer.connect,
    disconnect,
    exitMatch: disconnect,
    createRoom: multiplayer.createRoom,
    joinRoom: multiplayer.joinRoom,
    sendMove,
    requestRematch,
    claimTimeout,
    leaveRoom,
  };
}
