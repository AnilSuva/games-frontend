"use client";

import { useCallback, useEffect, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineTicTacToeState,
  PlayerMark,
  RoomDto,
  ServerEnvelope,
} from "./types";

export function useOnlineTicTacToe() {
  const [gameState, setGameState] = useState<OnlineTicTacToeState | null>(null);

  // Synchronize incoming game-specific envelopes and room updates
  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineTicTacToeState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineTicTacToeState);
    } else if (room.status === "in-progress" || room.players.length >= 2) {
      setGameState((prev) => {
        if (prev) return prev;
        const hostPlayer =
          room.players.find((p) => p.seat === 0) || room.players[0];
        const guestPlayer =
          room.players.find((p) => p.seat === 1) || room.players[1];
        const marks: Record<string, PlayerMark> = {};
        if (hostPlayer) marks[hostPlayer.playerId] = "X";
        if (guestPlayer) marks[guestPlayer.playerId] = "O";
        return {
          board: Array(9).fill(null),
          currentPlayer: "X",
          startingPlayer: "X",
          status: "in_progress",
          winner: null,
          winningLine: null,
          moveCount: 0,
          playerMarks: marks,
          rematchRequests: [],
        };
      });
    }
  }, []);

  // Delegate all generic multiplayer transport & room lifecycle to useMultiplayerRoom
  const multiplayer = useMultiplayerRoom({
    gameId: "tic-tac-toe",
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

  // Send Tic-Tac-Toe move
  const sendMove = useCallback(
    (position: number) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        position,
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

  // Wrapped leaveRoom and disconnect to also clear Tic-Tac-Toe gameState
  const leaveRoom = useCallback(() => {
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

  // Derived properties
  const myMark: PlayerMark | null =
    multiplayer.myPlayerId && gameState?.playerMarks?.[multiplayer.myPlayerId]
      ? gameState.playerMarks[multiplayer.myPlayerId]
      : multiplayer.room && multiplayer.myPlayerId
      ? multiplayer.room.hostPlayerId === multiplayer.myPlayerId
        ? "X"
        : "O"
      : null;

  const effectiveOpponentConnected =
    multiplayer.isOpponentConnected &&
    !isMatchPaused &&
    (multiplayer.opponentPlayer?.connected ?? true);

  const isMyTurn = Boolean(
    !isMatchPaused &&
      myMark &&
      gameState &&
      gameState.status === "in_progress" &&
      gameState.currentPlayer === myMark
  );

  const winnerMark: PlayerMark | null = gameState?.winner ?? null;
  const isWinner = Boolean(myMark && winnerMark === myMark);
  const isLoser = Boolean(myMark && winnerMark && winnerMark !== myMark);
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
    myMark,
    opponentPlayer: multiplayer.opponentPlayer,
    isOpponentConnected: effectiveOpponentConnected,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    resultReason,
    room: multiplayer.room,
    gameState,
    errorMessage: multiplayer.errorMessage,
    isMyTurn,
    winnerMark,
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
