"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineWallMazeState,
  RoomDto,
  ServerEnvelope,
  WallMazeOnlineOrientation,
  WallMazeOnlinePlayer,
} from "./types";

export interface UseOnlineWallMazeOptions {
  onStateSync?: (nextState: OnlineWallMazeState) => void;
  onActionError?: (message: string) => void;
}

export function useOnlineWallMaze(options: UseOnlineWallMazeOptions = {}) {
  const [gameState, setGameState] = useState<OnlineWallMazeState | null>(null);
  const [pendingAction, setPendingAction] = useState<boolean>(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const onStateSyncRef = useRef(options.onStateSync);
  const onActionErrorRef = useRef(options.onActionError);

  useEffect(() => {
    onStateSyncRef.current = options.onStateSync;
  }, [options.onStateSync]);

  useEffect(() => {
    onActionErrorRef.current = options.onActionError;
  }, [options.onActionError]);

  const handleServerMessage = useCallback((envelope: ServerEnvelope) => {
    if (envelope.type === "game.state") {
      const payload = envelope.payload as {
        roomId: string;
        version: number;
        gameState: OnlineWallMazeState;
      };
      setPendingAction(false);
      setMoveError(null);
      setGameState(payload.gameState);
      onStateSyncRef.current?.(payload.gameState);
    } else if (envelope.type === "room.left") {
      setPendingAction(false);
      setMoveError(null);
      setGameState(null);
    } else if (envelope.type === "room.error") {
      const payload = envelope.payload as {
        code?: string;
        message?: string;
      };
      const message = payload.message || "Action rejected by server";
      setPendingAction(false);
      setMoveError(message);
      onActionErrorRef.current?.(message);
    }
  }, []);

  const handleRoomUpdated = useCallback((room: RoomDto) => {
    if (room.gameState) {
      const nextState = room.gameState as OnlineWallMazeState;
      setPendingAction(false);
      setGameState(nextState);
      onStateSyncRef.current?.(nextState);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "wall-maze",
    defaultMaxPlayers: 2,
    onMessage: handleServerMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const { connectionState, setConnectionState } = multiplayer;

  // Synchronize game over / active state with connectionState
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

  // Local clock tick while disconnect grace countdown is active
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

  const myMark: WallMazeOnlinePlayer | null =
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

  const movePawn = useCallback(
    (row: number, col: number) => {
      if (
        !multiplayer.room ||
        !isMyTurn ||
        isMatchPaused ||
        pendingAction ||
        !effectiveOpponentConnected
      ) {
        return;
      }

      setPendingAction(true);
      setMoveError(null);
      const sentId = multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        action: { type: "MOVE_PAWN", row, col },
      });

      if (!sentId) {
        setPendingAction(false);
        setMoveError("Connection unavailable. Please wait...");
      }
    },
    [
      multiplayer,
      isMyTurn,
      isMatchPaused,
      pendingAction,
      effectiveOpponentConnected,
    ]
  );

  const placeWall = useCallback(
    (row: number, col: number, orientation: WallMazeOnlineOrientation) => {
      if (
        !multiplayer.room ||
        !isMyTurn ||
        isMatchPaused ||
        pendingAction ||
        !effectiveOpponentConnected
      ) {
        return;
      }

      setPendingAction(true);
      setMoveError(null);
      const sentId = multiplayer.sendMessage("game.move", {
        roomId: multiplayer.room.roomId,
        action: { type: "PLACE_WALL", row, col, orientation },
      });

      if (!sentId) {
        setPendingAction(false);
        setMoveError("Connection unavailable. Please wait...");
      }
    },
    [
      multiplayer,
      isMyTurn,
      isMatchPaused,
      pendingAction,
      effectiveOpponentConnected,
    ]
  );

  const requestRematch = useCallback(() => {
    if (!multiplayer.room) return;
    multiplayer.sendMessage("game.rematch", {
      roomId: multiplayer.room.roomId,
    });
  }, [multiplayer]);

  const leaveRoom = useCallback(() => {
    setPendingAction(false);
    setMoveError(null);
    setGameState(null);
    multiplayer.leaveRoom();
  }, [multiplayer]);

  const disconnect = useCallback(() => {
    setPendingAction(false);
    setMoveError(null);
    setGameState(null);
    multiplayer.disconnect();
  }, [multiplayer]);

  const clearMoveError = useCallback(() => {
    setMoveError(null);
  }, []);

  const winnerMark: WallMazeOnlinePlayer | null = gameState?.winner ?? null;
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
    moveError,
    pendingAction,
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
    movePawn,
    placeWall,
    requestRematch,
    leaveRoom,
    clearMoveError,
  };
}
