"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMultiplayerWsUrl } from "./config";
import type {
  ClientEnvelope,
  ConnectionState,
  OnlineTicTacToeState,
  PlayerMark,
  RoomDto,
  RoomPlayerDto,
  ServerEnvelope,
} from "./types";

const SESSION_TOKEN_KEY = "omniplay_session_token";
const ACTIVE_ROOM_KEY = "omniplay_active_room";

// Sensible timeout thresholds per specification
const CONNECTION_TIMEOUT_MS = 10_000;
const ROOM_OPERATION_TIMEOUT_MS = 8_000;

interface StoredRoomInfo {
  roomId: string;
  roomCode: string;
  reconnectToken: string;
}

function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or access issues
  }
}

function getStoredRoomInfo(): StoredRoomInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_ROOM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredRoomInfo(info: StoredRoomInfo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (info) {
      sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(info));
    } else {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function formatRoomErrorMessage(code: string, rawMessage?: string): string {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "Room not found. Please check the 6-character room code.";
    case "ROOM_FULL":
      return "This room is already full.";
    case "INVALID_ROOM_STATE":
      return "This match is no longer available to join.";
    case "RATE_LIMITED":
      return "Too many requests. Please slow down and try again.";
    case "RECONNECT_EXPIRED":
    case "INVALID_SESSION":
      return "The previous match has ended or expired.";
    case "UNAUTHORIZED":
      return "Multiplayer session expired. Reconnecting...";
    default:
      return rawMessage || "An error occurred. Please try again.";
  }
}

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  return `req_${Date.now()}_${requestCounter}`;
}

export function useOnlineTicTacToe() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDto | null>(null);
  const [gameState, setGameState] = useState<OnlineTicTacToeState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpponentConnected, setIsOpponentConnected] = useState<boolean>(true);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const manualDisconnectRef = useRef<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const handleServerMessageRef = useRef<((envelope: ServerEnvelope) => void) | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  // Request-specific timeout references
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

  // Send message helper
  const sendMessage = useCallback(<T>(type: string, payload: T): string | null => {
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
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnectionState((prev) =>
      prev === "disconnected" || prev === "connection_failed" ? "connecting" : prev
    );
    setErrorMessage(null);
    manualDisconnectRef.current = false;

    // Start connection timeout (10 seconds)
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
      setErrorMessage("Unable to connect to the multiplayer server. Please try again.");
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
        handleServerMessageRef.current?.(envelope);
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
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 5000);
        setTimeout(() => {
          if (!manualDisconnectRef.current) {
            connectRef.current?.();
          }
        }, delay);
      } else {
        pendingActionRef.current = null;
        setConnectionState(event.code === 1000 ? "disconnected" : "connection_failed");
        if (storedRoom && reconnectAttemptsRef.current >= 5) {
          setStoredRoomInfo(null);
          setErrorMessage("Connection to match lost. Grace period expired.");
        } else if (event.code !== 1000) {
          setErrorMessage("Unable to connect to the multiplayer server. Please try again.");
        }
      }
    };

    ws.onerror = () => {
      // WebSocket close handler fires immediately after error
    };
  }, [clearConnectionTimeout, clearRoomTimeout, sendMessage]);

  // Handle incoming server message envelope
  const handleServerMessage = useCallback(
    (envelope: ServerEnvelope) => {
      switch (envelope.type) {
        case "session.ready": {
          clearConnectionTimeout();
          const payload = envelope.payload as { playerId: string; sessionToken: string };
          setMyPlayerId(payload.playerId);
          setStoredSessionToken(payload.sessionToken);

          // If a pending user action exists (e.g. Create Room or Join Match), execute it
          // and clear any stale active room so it does not hijack the user's fresh intent.
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
          const payload = envelope.payload as { room: RoomDto; reconnectToken: string };
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
          const payload = envelope.payload as { room: RoomDto; reconnectToken: string };
          setRoom(payload.room);
          setStoredRoomInfo({
            roomId: payload.room.roomId,
            roomCode: payload.room.roomCode,
            reconnectToken: payload.reconnectToken,
          });

          if (payload.room.gameState) {
            const state = payload.room.gameState as OnlineTicTacToeState;
            setGameState(state);
            setConnectionState(
              state.status === "won" || state.status === "draw" ? "game_over" : "in_game"
            );
          } else if (payload.room.players.length >= 2) {
            // Both players in room: ensure immediate entry even if game.state packet is slightly delayed
            const hostPlayer =
              payload.room.players.find((p) => p.seat === 0) || payload.room.players[0];
            const guestPlayer =
              payload.room.players.find((p) => p.seat === 1) || payload.room.players[1];
            const marks: Record<string, PlayerMark> = {};
            if (hostPlayer) marks[hostPlayer.playerId] = "X";
            if (guestPlayer) marks[guestPlayer.playerId] = "O";

            setGameState({
              board: Array(9).fill(null),
              currentPlayer: "X",
              startingPlayer: "X",
              status: "in_progress",
              winner: null,
              winningLine: null,
              moveCount: 0,
              playerMarks: marks,
              rematchRequests: [],
            });
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

          if (payload.room.gameState) {
            const state = payload.room.gameState as OnlineTicTacToeState;
            setGameState(state);
            setConnectionState(
              state.status === "won" || state.status === "draw" ? "game_over" : "in_game"
            );
          } else if (payload.room.status === "in-progress" || payload.room.players.length >= 2) {
            setGameState((prev) => {
              if (prev) return prev;
              const hostPlayer =
                payload.room.players.find((p) => p.seat === 0) || payload.room.players[0];
              const guestPlayer =
                payload.room.players.find((p) => p.seat === 1) || payload.room.players[1];
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
            setConnectionState("in_game");
          }

          // Update opponent connectivity status
          if (payload.reason === "player_disconnected") {
            setIsOpponentConnected(false);
          } else if (payload.reason === "player_reconnected" || payload.reason === "player_joined") {
            setIsOpponentConnected(true);
          } else if (payload.reason === "player_left") {
            setIsOpponentConnected(false);
          }
          break;
        }

        case "game.state": {
          clearRoomTimeout();
          const payload = envelope.payload as {
            roomId: string;
            version: number;
            gameState: OnlineTicTacToeState;
          };
          setGameState(payload.gameState);
          setConnectionState(
            payload.gameState.status === "won" || payload.gameState.status === "draw"
              ? "game_over"
              : "in_game"
          );
          break;
        }

        case "room.left": {
          clearRoomTimeout();
          setRoom(null);
          setGameState(null);
          setStoredRoomInfo(null);
          setConnectionState("connected");
          break;
        }

        case "room.error": {
          clearRoomTimeout();
          const payload = envelope.payload as { code: string; message: string };
          const friendlyMessage = formatRoomErrorMessage(payload.code, payload.message);
          setErrorMessage(friendlyMessage);

          if (payload.code === "RECONNECT_EXPIRED" || payload.code === "INVALID_SESSION") {
            setStoredRoomInfo(null);
            setRoom(null);
            setGameState(null);
          }

          // Always return to connected state so user can immediately retry
          setConnectionState("connected");
          break;
        }
      }
    },
    [clearConnectionTimeout, clearRoomTimeout, sendMessage]
  );

  useEffect(() => {
    connectRef.current = connect;
    handleServerMessageRef.current = handleServerMessage;
  }, [connect, handleServerMessage]);

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
    setGameState(null);
    setErrorMessage(null);
  }, [clearConnectionTimeout, clearRoomTimeout, room]);

  // Create room
  const createRoom = useCallback(() => {
    setErrorMessage(null);
    const doCreate = () => {
      setConnectionState("creating_room");
      startRoomTimeout("create");
      sendMessage("room.create", {
        gameId: "tic-tac-toe",
        maxPlayers: 2,
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
  }, [connectionState, connect, sendMessage, startRoomTimeout]);

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

  // Local clock tick when disconnect grace countdown is active
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!gameState?.disconnectGraceExpiresAt || gameState.status !== "in_progress") {
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
    (gameState?.status === "won" ? "win" : gameState?.status === "draw" ? "draw" : null);

  // Send move intent
  const sendMove = useCallback(
    (position: number) => {
      if (!room || isMatchPaused) return;
      sendMessage("game.move", {
        roomId: room.roomId,
        position,
      });
    },
    [room, isMatchPaused, sendMessage]
  );

  // Request rematch
  const requestRematch = useCallback(() => {
    if (!room) return;
    sendMessage("game.rematch", {
      roomId: room.roomId,
    });
  }, [room, sendMessage]);

  // Leave room
  const leaveRoom = useCallback(() => {
    clearRoomTimeout();
    const storedRoom = getStoredRoomInfo();
    const targetRoomId = room?.roomId ?? storedRoom?.roomId;
    if (targetRoomId) {
      sendMessage("room.leave", { roomId: targetRoomId });
    }
    setStoredRoomInfo(null);
    setRoom(null);
    setGameState(null);
    setErrorMessage(null);
    setConnectionState("connected");
  }, [clearRoomTimeout, room, sendMessage]);

  const roomRef = useRef<RoomDto | null>(null);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

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

  // Derived properties
  const myMark: PlayerMark | null =
    myPlayerId && gameState?.playerMarks?.[myPlayerId]
      ? gameState.playerMarks[myPlayerId]
      : room && myPlayerId
      ? room.hostPlayerId === myPlayerId
        ? "X"
        : "O"
      : null;

  const opponentPlayer: RoomPlayerDto | null =
    room && myPlayerId
      ? room.players.find((p) => p.playerId !== myPlayerId) ?? null
      : null;

  const effectiveOpponentConnected =
    isOpponentConnected && !isMatchPaused && (opponentPlayer?.connected ?? true);

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
    myPlayerId && gameState?.rematchRequests?.includes(myPlayerId)
  );

  const opponentRequestedRematch = Boolean(
    opponentPlayer && gameState?.rematchRequests?.includes(opponentPlayer.playerId)
  );

  return {
    connectionState,
    myPlayerId,
    myMark,
    opponentPlayer,
    isOpponentConnected: effectiveOpponentConnected,
    isMatchPaused,
    disconnectGraceSecondsRemaining,
    resultReason,
    room,
    gameState,
    errorMessage,
    isMyTurn,
    winnerMark,
    isWinner,
    isLoser,
    isDraw,
    hasRequestedRematch,
    opponentRequestedRematch,
    connect,
    disconnect,
    exitMatch: disconnect,
    createRoom,
    joinRoom,
    sendMove,
    requestRematch,
    leaveRoom,
  };
}
