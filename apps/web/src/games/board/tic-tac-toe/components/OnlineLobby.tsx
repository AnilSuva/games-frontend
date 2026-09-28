"use client";

import { useState } from "react";
import type { ConnectionState, RoomDto } from "@/platform/multiplayer/types";
import { soundManager } from "@/platform/audio";

interface OnlineLobbyProps {
  connectionState: ConnectionState;
  room: RoomDto | null;
  errorMessage: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onReturnToModes: () => void;
}

export function OnlineLobby({
  connectionState,
  room,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onReturnToModes,
}: OnlineLobbyProps) {
  const [tab, setTab] = useState<"choose" | "join">("choose");
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const isConnecting = connectionState === "connecting" || connectionState === "identifying";
  const isCreating = connectionState === "creating_room";
  const isJoining = connectionState === "joining_room";
  const isWaiting = connectionState === "waiting_for_opponent" && Boolean(room);

  const handleCopyCode = async () => {
    if (!room?.roomCode) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      soundManager.play("buttonClick");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeInput.trim().length >= 3 && !isJoining && !isConnecting) {
      soundManager.play("buttonClick");
      onJoinRoom(roomCodeInput.trim().toUpperCase());
    }
  };

  // If host is waiting for opponent inside a created room
  if (isWaiting && room) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-[360px] p-6 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm text-center">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#e6e3dc] flex items-center justify-center text-[#e0530a] mb-3 text-lg">
          🎮
        </div>
        <h2 className="text-base font-semibold text-[#1c1917] mb-1">Room Created</h2>
        <p className="text-xs text-[#6b665f] mb-4">
          Share this room code with your opponent:
        </p>

        {/* Room Code Display */}
        <div className="flex items-center justify-center gap-2 w-full p-3 bg-white rounded-xl border border-[#e6e3dc] mb-4">
          <span className="font-mono text-2xl font-bold tracking-widest text-[#1c1917]">
            {room.roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-2.5 py-1 text-xs font-medium text-[#6b665f] bg-[#f7f5f0] hover:bg-[#ede9e1] border border-[#dedad2] rounded-md transition cursor-pointer"
          >
            {copied ? "Copied! ✓" : "Copy"}
          </button>
        </div>

        {/* Pulsing Waiting Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#6b665f] mb-6">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e0530a] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e0530a]" />
          </span>
          <span>Waiting for opponent to join...</span>
        </div>

        {/* Cancel / Leave */}
        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            onLeaveRoom();
          }}
          className="text-xs text-[#6b665f] hover:text-[#1c1917] underline underline-offset-4 cursor-pointer"
        >
          Cancel Room
        </button>
      </div>
    );
  }

  // Join Room Form Tab
  if (tab === "join") {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-[360px] p-6 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm">
        <h2 className="text-base font-semibold text-[#1c1917] mb-1">Join Match</h2>
        <p className="text-xs text-[#6b665f] mb-5 text-center">
          Enter the 6-character room code from your opponent:
        </p>

        <form onSubmit={handleJoinSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. ABC234"
            maxLength={10}
            autoFocus
            disabled={isJoining}
            className="w-full px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-[#1c1917] bg-white border border-[#e6e3dc] rounded-xl focus:outline-none focus:border-[#1c1917] transition placeholder:text-[#9c978e] placeholder:tracking-normal placeholder:font-normal placeholder:text-sm disabled:bg-[#f7f5f0] disabled:text-[#9c978e]"
          />

          {errorMessage && (
            <div className="w-full p-2.5 text-xs font-medium text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-center">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={roomCodeInput.trim().length < 3 || isJoining || isConnecting}
            className="w-full py-2.5 text-xs font-semibold text-white bg-[#1c1917] hover:bg-[#2d2825] disabled:bg-[#d6d3cd] disabled:cursor-not-allowed rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : isJoining ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Joining match...</span>
              </>
            ) : (
              <span>Join Match</span>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            setTab("choose");
          }}
          disabled={isJoining}
          className="mt-4 text-xs text-[#6b665f] hover:text-[#1c1917] disabled:text-[#9c978e] underline underline-offset-4 cursor-pointer"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Choose Action Tab (Create Room or Join Room)
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[360px] p-6 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-white border border-[#e6e3dc] flex items-center justify-center text-[#1c1917] mb-2 text-lg">
        🌐
      </div>
      <h2 className="text-base font-semibold text-[#1c1917] mb-1">Online Match</h2>
      <p className="text-xs text-[#6b665f] mb-5 text-center">
        Play Tic-Tac-Toe in real-time with a friend
      </p>

      {errorMessage && (
        <div className="w-full p-2.5 mb-4 text-xs font-medium text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-center">
          {errorMessage}
        </div>
      )}

      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            onCreateRoom();
          }}
          disabled={isConnecting || isCreating}
          className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#1c1917] hover:bg-[#2d2825] disabled:bg-[#d6d3cd] disabled:cursor-not-allowed rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
        >
          {isConnecting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          ) : isCreating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating room...</span>
            </>
          ) : (
            <span>Create Room</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            setTab("join");
          }}
          disabled={isConnecting || isCreating}
          className="w-full py-3 px-4 text-xs font-semibold text-[#1c1917] bg-white hover:bg-[#f7f5f0] disabled:bg-[#f7f5f0] disabled:text-[#9c978e] disabled:cursor-not-allowed border border-[#e6e3dc] rounded-xl transition shadow-xs cursor-pointer"
        >
          Join Room
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          soundManager.play("buttonClick");
          onReturnToModes();
        }}
        disabled={isCreating}
        className="mt-5 text-xs text-[#6b665f] hover:text-[#1c1917] disabled:text-[#9c978e] underline underline-offset-4 cursor-pointer"
      >
        ← Back to Modes
      </button>
    </div>
  );
}
