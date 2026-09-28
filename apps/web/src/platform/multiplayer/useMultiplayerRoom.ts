"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMultiplayerWsUrl } from "./config";
import {
  formatRoomErrorMessage,
  getStoredRoomInfo,
  getStoredSessionToken,
  nextRequestId,
  setStoredRoomInfo,
  setStoredSessionToken,
} from "./storage";
import type {
  ClientEnvelope,
  ConnectionState,
  RoomDto,
  RoomPlayerDto,
  ServerEnvelope,
} from "./types";

const CONNECTION_TIMEOUT_MS = 10_000;
const ROOM_OPERATION_TIMEOUT_MS = 8_000;

export interface UseMultiplayerRoomOptions {
  gameId: string;
  defaultMaxPlayers?: number;
  onMessage?: (envelope: ServerEnvelope) => void;
  onRoomUpdated?: (room: RoomDto, reason?: string) => void;
}

export function useMultiplayerRoom({
  gameId,
  defaultMaxPlayers = 2,
  onMessage,
  onRoomUpdated,
}: UseMultiplayerRoomOptions) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpponentConnected, setIsOpponentConnected] = useState<boolean>(true);

  const socketRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<RoomDto | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const manualDisconnectRef = useRef<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const connectRef = useRef<(() => void) | null>(null);
  const onMessageRef = useRef(onMessage);
  const onRoomUpdatedRef = useRef(onRoomUpdated);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onRoomUpdatedRef.current = onRoomUpdated;
  }, [onRoomUpdated]);

  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const roomTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const clearRoomTimeout = useCallback(() => {
    if (roomTimeoutRef.current) {
      clearTimeout(roomTimeoutRef.current);
      roomTimeoutRef.current = null;
    }
  }, []);

  const startRoomTimeout = useCallback(
    (operation: "create" | "join") => {
      clearRoomTimeout();
      roomTimeoutRef.current = setTimeout(() => {
        setConnectionState("connected");
        const msg =
          operation === "create"
            ? "Room creation timed out. Please try again."
            : "Unable to join room. Request timed out. Please try again.";
        setErrorMessage(msg);
      }, ROOM_OPERATION_TIMEOUT_MS);
    },
    [clearRoomTimeout]
  );

  const sendMessage = useCallback(
    <T>(type: string, payload: T): string | null => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return null;
      }
      const requestId = nextRequestId();
      const envelope: ClientEnvelope<T> = {
        version: 1,
        type,
        requestId,
        payload,
      };
      ws.send(JSON.stringify(envelope));
      return requestId;
    },
    []
  );

  const handleServerEnvelope = useCallback(
    (envelope: ServerEnvelope) => {
      // Forward to custom game listener first
      onMessageRef.current?.(envelope);

      switch (envelope.type) {
        case "session.ready": {
          clearConnectionTimeout();
          const payload = envelope.payload as {
            playerId: string;
            sessionToken: string;
          };
          setMyPlayerId(payload.playerId);
          setStoredSessionToken(payload.sessionToken);

          if (pendingActionRef.current) {
            setStoredRoomInfo(null);
            setConnectionState("connected");
            const action = pendingActionRef.current;
            pendingActionRef.current = null;
            action();
          } else {
            const storedRoom = getStoredRoomInfo();
            if (storedRoom) {
              setConnectionState("reconnecting");
              sendMessage("room.reconnect", {
                roomCode: storedRoom.roomCode,
                reconnectToken: storedRoom.reconnectToken,
              });
            } else {
              setConnectionState("connected");
            }
          }
          break;
        }

        case "room.created": {
          clearRoomTimeout();
          const payload = envelope.payload as {
            room: RoomDto;
            reconnectToken: string;
          };
          setRoom(payload.room);
          setStoredRoomInfo({
            roomId: payload.room.roomId,
            roomCode: payload.room.roomCode,
            reconnectToken: payload.reconnectToken,
          });
          setConnectionState("waiting_for_opponent");
          setErrorMessage(null);
          break;
        }

        case "room.joined": {
          clearRoomTimeout();
          const payload = envelope.payload as {
            room: RoomDto;
            reconnectToken: string;
          };
          setRoom(payload.room);
          setStoredRoomInfo({
            roomId: payload.room.roomId,
            roomCode: payload.room.roomCode,
            reconnectToken: payload.reconnectToken,
          });

          if (payload.room.players.length >= 2) {
            setConnectionState("in_game");
          } else {
            setConnectionState("waiting_for_opponent");
          }
          setErrorMessage(null);
          break;
        }

        case "room.updated": {
          const payload = envelope.payload as {
            room: RoomDto;
            reason?: string;
          };
          setRoom(payload.room);
          onRoomUpdatedRef.current?.(payload.room, payload.reason);

          if (payload.reason === "player_disconnected") {
            setIsOpponentConnected(false);
          } else if (
            payload.reason === "player_reconnected" ||
            payload.reason === "player_joined"
          ) {
            setIsOpponentConnected(true);
          } else if (payload.reason === "player_left") {
            setIsOpponentConnected(false);
          }
          break;
        }

        case "room.left": {
          clearRoomTimeout();
          setRoom(null);
          setStoredRoomInfo(null);
          setConnectionState("connected");
          break;
        }

        case "room.error": {
          clearRoomTimeout();
          const payload = envelope.payload as {
            code: string;
            message: string;
          };
          const friendlyMessage = formatRoomErrorMessage(
            payload.code,
            payload.message
          );
          setErrorMessage(friendlyMessage);

          if (
            payload.code === "RECONNECT_EXPIRED" ||
            payload.code === "INVALID_SESSION"
          ) {
            setStoredRoomInfo(null);
            setRoom(null);
          }

          setConnectionState("connected");
          break;
        }
      }
    },
    [clearConnectionTimeout, clearRoomTimeout, sendMessage]
  );

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnectionState((prev) =>
      prev === "disconnected" || prev === "connection_failed"
        ? "connecting"
        : prev
    );
    setErrorMessage(null);
    manualDisconnectRef.current = false;

    clearConnectionTimeout();
    connectionTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && socketRef.current.readyState !== WebSocket.OPEN) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
        socketRef.current = null;
      }
      clearRoomTimeout();
      pendingActionRef.current = null;
      setConnectionState("connection_failed");
      setErrorMessage(
        "Unable to connect to the multiplayer server. Please try again."
      );
    }, CONNECTION_TIMEOUT_MS);

    const wsUrl = getMultiplayerWsUrl();
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState("identifying");
      const existingToken = getStoredSessionToken();
      sendMessage("session.identify", {
        sessionToken: existingToken ?? undefined,
        displayName: "Player",
      });
    };

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as ServerEnvelope;
        handleServerEnvelope(envelope);
      } catch (err) {
        console.error("Malformed message from server:", err);
      }
    };

    ws.onclose = (event) => {
      clearConnectionTimeout();
      clearRoomTimeout();
      socketRef.current = null;

      if (manualDisconnectRef.current) {
        setConnectionState("disconnected");
        return;
      }

      // Check if we were in an active match and should attempt reconnect
      const storedRoom = getStoredRoomInfo();
      if (storedRoom && reconnectAttemptsRef.current < 5) {
        setConnectionState("reconnecting");
        reconnectAttemptsRef.current++;
        const delay = Math.min(
          1000 * Math.pow(1.5, reconnectAttemptsRef.current),
          5000
        );
        setTimeout(() => {
          if (!manualDisconnectRef.current) {
            connectRef.current?.();
          }
        }, delay);
      } else {
        pendingActionRef.current = null;
        setConnectionState(
          event.code === 1000 ? "disconnected" : "connection_failed"
        );
        if (storedRoom && reconnectAttemptsRef.current >= 5) {
          setStoredRoomInfo(null);
          setErrorMessage("Connection to match lost. Grace period expired.");
        } else if (event.code !== 1000) {
          setErrorMessage(
            "Unable to connect to the multiplayer server. Please try again."
          );
        }
      }
    };

    ws.onerror = () => {
      // WebSocket close handler fires immediately after error
    };
  }, [
    clearConnectionTimeout,
    clearRoomTimeout,
    handleServerEnvelope,
    sendMessage,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Clean disconnect & leave active room
  const disconnect = useCallback(() => {
    clearConnectionTimeout();
    clearRoomTimeout();
    manualDisconnectRef.current = true;
    pendingActionRef.current = null;

    const ws = socketRef.current;
    const storedRoom = getStoredRoomInfo();
    const targetRoomId = room?.roomId ?? storedRoom?.roomId;

    if (ws && ws.readyState === WebSocket.OPEN && targetRoomId) {
      try {
        const envelope: ClientEnvelope<{ roomId: string }> = {
          version: 1,
          type: "room.leave",
          requestId: nextRequestId(),
          payload: { roomId: targetRoomId },
        };
        ws.send(JSON.stringify(envelope));
      } catch {
        // Safe if socket send fails
      }
    }

    setStoredRoomInfo(null);

    if (ws) {
      try {
        ws.close(1000, "User departed");
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    setConnectionState("disconnected");
    setRoom(null);
    setErrorMessage(null);
  }, [clearConnectionTimeout, clearRoomTimeout, room]);

  // Create room
  const createRoom = useCallback(
    (options?: { maxPlayers?: number }) => {
      setErrorMessage(null);
      const doCreate = () => {
        setConnectionState("creating_room");
        startRoomTimeout("create");
        sendMessage("room.create", {
          gameId,
          maxPlayers: options?.maxPlayers ?? defaultMaxPlayers,
        });
      };

      if (connectionState === "connected") {
        doCreate();
      } else {
        setConnectionState("creating_room");
        startRoomTimeout("create");
        pendingActionRef.current = doCreate;
        connect();
      }
    },
    [
      connectionState,
      connect,
      defaultMaxPlayers,
      gameId,
      sendMessage,
      startRoomTimeout,
    ]
  );

  // Join room
  const joinRoom = useCallback(
    (roomCode: string) => {
      const cleanCode = roomCode.trim().toUpperCase();
      if (cleanCode.length === 0) {
        setErrorMessage("Please enter a room code");
        return;
      }
      setErrorMessage(null);

      const doJoin = () => {
        setConnectionState("joining_room");
        startRoomTimeout("join");
        sendMessage("room.join", {
          roomCode: cleanCode,
        });
      };

      if (connectionState === "connected") {
        doJoin();
      } else {
        setConnectionState("joining_room");
        startRoomTimeout("join");
        pendingActionRef.current = doJoin;
        connect();
      }
    },
    [connectionState, connect, sendMessage, startRoomTimeout]
  );

  // Leave room while keeping connection active
  const leaveRoom = useCallback(() => {
    clearRoomTimeout();
    const storedRoom = getStoredRoomInfo();
    const targetRoomId = room?.roomId ?? storedRoom?.roomId;
    if (targetRoomId) {
      sendMessage("room.leave", { roomId: targetRoomId });
    }
    setStoredRoomInfo(null);
    setRoom(null);
    setErrorMessage(null);
    setConnectionState("connected");
  }, [clearRoomTimeout, room, sendMessage]);

  // Auto-cleanup on unmount (e.g. user navigates Home or away from the game)
  useEffect(() => {
    return () => {
      clearConnectionTimeout();
      clearRoomTimeout();
      manualDisconnectRef.current = true;

      const ws = socketRef.current;
      const storedRoom = getStoredRoomInfo();
      const targetRoomId = roomRef.current?.roomId ?? storedRoom?.roomId;

      if (ws && ws.readyState === WebSocket.OPEN && targetRoomId) {
        try {
          const envelope: ClientEnvelope<{ roomId: string }> = {
            version: 1,
            type: "room.leave",
            requestId: nextRequestId(),
            payload: { roomId: targetRoomId },
          };
          ws.send(JSON.stringify(envelope));
        } catch {
          // ignore
        }
      }

      setStoredRoomInfo(null);

      if (ws) {
        try {
          ws.close(1000, "Component unmounted");
        } catch {
          // ignore
        }
        socketRef.current = null;
      }
    };
  }, [clearConnectionTimeout, clearRoomTimeout]);

  const opponentPlayer: RoomPlayerDto | null =
    room && myPlayerId
      ? room.players.find((p) => p.playerId !== myPlayerId) ?? null
      : null;

  return {
    connectionState,
    myPlayerId,
    room,
    opponentPlayer,
    errorMessage,
    isOpponentConnected,
    connect,
    disconnect,
    exitMatch: disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    setConnectionState,
    setErrorMessage,
  };
}
