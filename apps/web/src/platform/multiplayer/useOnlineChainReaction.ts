"use client";

import { useCallback, useEffect, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  ChainReactionOnlinePlayer,
  OnlineChainReactionState,
  RoomDto,
  ServerEnvelope,
} from "./types";

export function useOnlineChainReaction() {
  const [gameState, setGameState] = useState<OnlineChainReactionState | null>(null);

  // Synchronize incoming game-specific envelopes and room updates
  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineChainReactionState;
      };
      setGameState(payload.gameState);
    } else if (envelope.type === "room.left") {
      setGameState(null);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      setGameState(room.gameState as OnlineChainReactionState);
    }
  }, []);

  // Delegate transport & room lifecycle to useMultiplayerRoom
  const multiplayer = useMultiplayerRoom({
    gameId: "chain-reaction",
    defaultMaxPlayers: 2,
    onMessage: handleServerMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const { connectionState, setConnectionState } = multiplayer;

  // Synchronize game over state with connectionState
  useEffect(() => {
    if (gameState) {
      if (gameState.status === "won" || gameState.status === "abandoned") {
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
    (gameState?.status === "won" ? "win" : null);

  // Send Chain Reaction move
  const placeOrb = useCallback(
    (row: number, col: number) => {
      if (!multiplayer.room || isMatchPaused) return;
      multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        row,
        col,
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

  // Wrapped leaveRoom and disconnect to also clear Chain Reaction gameState
  const leaveRoom = useCallback(() => {
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

  // Derived properties
  const myMark: ChainReactionOnlinePlayer | null =
    multiplayer.myPlayerId && gameState?.playerRoles?.[multiplayer.myPlayerId]
      ? gameState.playerRoles[multiplayer.myPlayerId]
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

  const winnerMark: ChainReactionOnlinePlayer | null = gameState?.winner ?? null;
  const isWinner = Boolean(myMark && winnerMark === myMark);
  const isLoser = Boolean(myMark && winnerMark && winnerMark !== myMark);

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
    hasRequestedRematch,
    opponentRequestedRematch,
    connect: multiplayer.connect,
    disconnect,
    exitMatch: disconnect,
    createRoom: multiplayer.createRoom,
    joinRoom: multiplayer.joinRoom,
    placeOrb,
    requestRematch,
    leaveRoom,
  };
}
