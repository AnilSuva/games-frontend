"use client";

import { useCallback, useEffect, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineConnectFourState,
  PlayerDisc,
  RoomDto,
  ServerEnvelope,
} from "./types";

export function useOnlineConnectFour() {
  const [gameState, setGameState] = useState<OnlineConnectFourState | null>(null);

  // Synchronize incoming game-specific envelopes and room updates
  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineConnectFourState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineConnectFourState);
    } else if (room.status === "in-progress" || room.players.length >= 2) {
      setGameState((prev) => {
        if (prev) return prev;
        const hostPlayer =
          room.players.find((p) => p.seat === 0) || room.players[0];
        const guestPlayer =
          room.players.find((p) => p.seat === 1) || room.players[1];
        const discs: Record<string, PlayerDisc> = {};
        if (hostPlayer) discs[hostPlayer.playerId] = "R";
        if (guestPlayer) discs[guestPlayer.playerId] = "Y";
        return {
          board: Array(42).fill(null),
          columnCounts: [0, 0, 0, 0, 0, 0, 0],
          currentPlayer: "R",
          startingPlayer: "R",
          status: "in_progress",
          winner: null,
          winningLine: null,
          lastMove: null,
          moveCount: 0,
          playerDiscs: discs,
          rematchRequests: [],
        };
      });
    }
  }, []);

  // Delegate all generic multiplayer transport & room lifecycle to useMultiplayerRoom
  const multiplayer = useMultiplayerRoom({
    gameId: "connect-four",
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

  const resultReason =
    gameState?.resultReason ??
    (gameState?.status === "won"
      ? "win"
      : gameState?.status === "draw"
      ? "draw"
      : null);

  // Send Connect Four move intent (column: 0..6)
  const sendMove = useCallback(
    (column: number) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        column,
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
  const myDisc: PlayerDisc | null =
    multiplayer.myPlayerId && gameState?.playerDiscs?.[multiplayer.myPlayerId]
      ? gameState.playerDiscs[multiplayer.myPlayerId]
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "R"
        : "Y"
      : null;

  const effectiveOpponentConnected =
    multiplayer.isOpponentConnected &&
    !isMatchPaused &&
    (multiplayer.opponentPlayer?.connected ?? true);

  const isMyTurn = Boolean(
    !isMatchPaused &&
      myDisc &&
      gameState &&
      gameState.status === "in_progress" &&
      gameState.currentPlayer === myDisc
  );

  const winnerDisc: PlayerDisc | null = gameState?.winner ?? null;
  const isWinner = Boolean(myDisc && winnerDisc === myDisc);
  const isLoser = Boolean(myDisc && winnerDisc && winnerDisc !== myDisc);
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

  return {
    connectionState: multiplayer.connectionState,
    myPlayerId: multiplayer.myPlayerId,
    myDisc,
    opponentPlayer: multiplayer.opponentPlayer,
    isOpponentConnected: effectiveOpponentConnected,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    resultReason,
    room: multiplayer.room,
    gameState,
    errorMessage: multiplayer.errorMessage,
    isMyTurn,
    winnerDisc,
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
    leaveRoom,
  };
}
