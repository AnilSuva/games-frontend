"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import type {
  OnlineUnoNoMercyState,
  RoomDto,
  ServerEnvelope,
  UnoAction,
  UnoCardColor,
  UnoGameEventPayload,
  UnoSettings,
} from "./types";

const DEFAULT_UNO_SETTINGS: UnoSettings = {
  startingHandSize: 7,
  mercyLimit: 25,
  maxPlayers: 6,
  turnTimeoutMs: 120_000,
  drawUntilPlayable: true,
  endOnFirstMercyLoss: false,
};

export function useOnlineUnoNoMercy(displayName?: string) {
  const [gameState, setGameState] = useState<OnlineUnoNoMercyState | null>(null);
  const [events, setEvents] = useState<UnoGameEventPayload[]>([]);
  const [kickedReason, setKickedReason] = useState<"afk_timeout" | "disconnected" | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  const myPlayerIdRef = useRef<string | null>(null);

  const handleMessage = useCallback((envelope: ServerEnvelope) => {
    switch (envelope.type) {
      case "session.ready": {
        const payload = envelope.payload as { playerId: string };
        myPlayerIdRef.current = payload.playerId;
        break;
      }

      case "game.state": {
        const payload = envelope.payload as {
          roomId: string;
          version: number;
          gameState: OnlineUnoNoMercyState;
        };
        setGameState(payload.gameState);
        setPendingAction(false);
        break;
      }

      case "game.event": {
        const ev = envelope.payload as UnoGameEventPayload;
        setEvents((prev) => [...prev.slice(-14), ev]);
        if (
          ev.type === "player_kicked_afk" &&
          ev.playerId &&
          ev.playerId === myPlayerIdRef.current
        ) {
          setKickedReason("afk_timeout");
          setPendingAction(false);
        }
        break;
      }

      case "room.left": {
        const payload = envelope.payload as { roomId: string; reason?: string };
        if (payload.reason === "afk_timeout") {
          setKickedReason("afk_timeout");
        }
        setGameState(null);
        setPendingAction(false);
        break;
      }

      case "room.error": {
        setPendingAction(false);
        break;
      }
    }
  }, []);

  const handleRoomUpdated = useCallback((updatedRoom: RoomDto) => {
    if (updatedRoom.status === "waiting") {
      setGameState(null);
    }
  }, []);

  const multiplayer = useMultiplayerRoom({
    gameId: "uno-no-mercy",
    defaultMaxPlayers: 6,
    displayName,
    onMessage: handleMessage,
    onRoomUpdated: handleRoomUpdated,
  });

  const {
    connectionState,
    myPlayerId,
    room,
    errorMessage,
    createRoom: baseCreateRoom,
    joinRoom: baseJoinRoom,
    leaveRoom: baseLeaveRoom,
    updateRoomSettings,
    startGame: baseStartGame,
    sendMessage,
    setErrorMessage,
  } = multiplayer;

  const isHost = Boolean(room && myPlayerId && room.hostPlayerId === myPlayerId);

  const settings: UnoSettings = useMemo(() => {
    const raw = (room?.settings ?? {}) as Partial<UnoSettings>;
    return {
      startingHandSize: raw.startingHandSize ?? DEFAULT_UNO_SETTINGS.startingHandSize,
      mercyLimit: raw.mercyLimit ?? DEFAULT_UNO_SETTINGS.mercyLimit,
      maxPlayers: raw.maxPlayers ?? room?.maxPlayers ?? DEFAULT_UNO_SETTINGS.maxPlayers,
      turnTimeoutMs: raw.turnTimeoutMs ?? DEFAULT_UNO_SETTINGS.turnTimeoutMs,
      drawUntilPlayable: raw.drawUntilPlayable ?? DEFAULT_UNO_SETTINGS.drawUntilPlayable,
      endOnFirstMercyLoss: raw.endOnFirstMercyLoss ?? DEFAULT_UNO_SETTINGS.endOnFirstMercyLoss,
    };
  }, [room?.settings, room?.maxPlayers]);

  const sendUnoAction = useCallback(
    (action: UnoAction) => {
      if (!room?.roomId) return null;
      setPendingAction(true);
      const reqId = sendMessage("game.move", {
        roomId: room.roomId,
        action,
      });
      if (!reqId) {
        setPendingAction(false);
      }
      return reqId;
    },
    [room?.roomId, sendMessage]
  );

  const createRoom = useCallback(
    (playerDisplayName?: string, initialSettings?: Partial<UnoSettings>) => {
      setKickedReason(null);
      setEvents([]);
      setGameState(null);
      baseCreateRoom({
        maxPlayers: initialSettings?.maxPlayers ?? 6,
        displayName: playerDisplayName,
        settings: initialSettings,
      });
    },
    [baseCreateRoom]
  );

  const joinRoom = useCallback(
    (roomCode: string, playerDisplayName?: string) => {
      setKickedReason(null);
      setEvents([]);
      setGameState(null);
      baseJoinRoom(roomCode, { displayName: playerDisplayName });
    },
    [baseJoinRoom]
  );

  const updateSettings = useCallback(
    (patch: Partial<UnoSettings>) => {
      if (!isHost) return null;
      return updateRoomSettings({ ...settings, ...patch });
    },
    [isHost, settings, updateRoomSettings]
  );

  const startGame = useCallback(() => {
    if (!isHost) return null;
    setEvents([]);
    return baseStartGame();
  }, [isHost, baseStartGame]);

  const leaveRoom = useCallback(() => {
    setGameState(null);
    setEvents([]);
    setPendingAction(false);
    baseLeaveRoom();
  }, [baseLeaveRoom]);

  const playCard = useCallback(
    (cardId: string, chosenColor?: UnoCardColor) =>
      sendUnoAction({ type: "PLAY_CARD", cardId, chosenColor }),
    [sendUnoAction]
  );

  const drawCard = useCallback(
    () => sendUnoAction({ type: "DRAW_CARD" }),
    [sendUnoAction]
  );

  const acceptDrawPenalty = useCallback(
    () => sendUnoAction({ type: "ACCEPT_DRAW_PENALTY" }),
    [sendUnoAction]
  );

  const passTurn = useCallback(
    () => sendUnoAction({ type: "PASS_TURN" }),
    [sendUnoAction]
  );

  const chooseWildColor = useCallback(
    (color: UnoCardColor) => sendUnoAction({ type: "CHOOSE_WILD_COLOR", color }),
    [sendUnoAction]
  );

  const chooseSwapTarget = useCallback(
    (targetPlayerId: string) =>
      sendUnoAction({ type: "CHOOSE_SWAP_TARGET", targetPlayerId }),
    [sendUnoAction]
  );

  const chooseRouletteColor = useCallback(
    (color: UnoCardColor) =>
      sendUnoAction({ type: "CHOOSE_ROULETTE_COLOR", color }),
    [sendUnoAction]
  );

  const callUno = useCallback(
    () => sendUnoAction({ type: "CALL_UNO" }),
    [sendUnoAction]
  );

  const catchUno = useCallback(
    (targetPlayerId: string) =>
      sendUnoAction({ type: "CATCH_UNO", targetPlayerId }),
    [sendUnoAction]
  );

  const clearKickedReason = useCallback(() => setKickedReason(null), []);
  const clearError = useCallback(() => setErrorMessage(null), [setErrorMessage]);

  return {
    connectionState,
    roomCode: room?.roomCode ?? null,
    room,
    players: room?.players ?? [],
    isHost,
    myPlayerId,
    settings,
    gameState,
    events,
    kickedReason,
    error: errorMessage,
    pendingAction,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    playCard,
    drawCard,
    acceptDrawPenalty,
    passTurn,
    chooseWildColor,
    chooseSwapTarget,
    chooseRouletteColor,
    callUno,
    catchUno,
    leaveRoom,
    clearKickedReason,
    clearError,
  };
}
