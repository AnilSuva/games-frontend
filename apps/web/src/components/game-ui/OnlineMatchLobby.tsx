"use client";

import { useState } from "react";
import type { ConnectionState, RoomDto } from "@/platform/multiplayer/types";
import { soundManager } from "@/platform/audio";

export interface OnlineMatchLobbyProps {
  /** Optional game title used in the lobby header (defaults to "Online Match") */
  gameTitle?: string;
  /** Optional custom subtitle (defaults to "Play <gameTitle> in real-time with a friend") */
  subtitle?: string;
  /** Current multiplayer connection status */
  connectionState: ConnectionState;
  /** Active room object if created or joined */
  room: RoomDto | null;
  /** Server error or friendly error message */
  errorMessage: string | null;
  /** Triggers room creation */
  onCreateRoom: () => void;
  /** Triggers joining an existing room with code */
  onJoinRoom: (code: string) => void;
  /** Leaves or cancels the current room */
  onLeaveRoom: () => void;
  /** Returns back to mode selection */
  onReturnToModes: () => void;
}

function GlobeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function GamepadIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" x2="10" y1="12" y2="12" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="15" x2="15.01" y1="13" y2="13" />
      <line x1="18" x2="18.01" y1="11" y2="11" />
      <rect width="20" height="12" x="2" y="6" rx="6" />
    </svg>
  );
}

/**
 * Reusable, game-agnostic Online Match Lobby component.
 * Provides room creation, room code joining, and waiting status
 * for any multiplayer game cartridge (Tic-Tac-Toe, Connect Four, etc.).
 */
export function OnlineMatchLobby({
  gameTitle,
  subtitle,
  connectionState,
  room,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onReturnToModes,
}: OnlineMatchLobbyProps) {
  const [tab, setTab] = useState<"choose" | "join">("choose");
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const displayTitle = "Online Match";
  const displaySubtitle =
    subtitle ??
    (gameTitle
      ? `Play ${gameTitle} in real-time with a friend`
      : "Play in real-time with a friend");

  const isConnecting =
    connectionState === "connecting" || connectionState === "identifying";
  const isCreating = connectionState === "creating_room";
  const isJoining = connectionState === "joining_room";
  const isWaiting =
    connectionState === "waiting_for_opponent" && Boolean(room);

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

  // State 1: Host waiting for opponent inside a created room
  if (isWaiting && room) {
    return (
      <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] aspect-square p-6 bg-white rounded-2xl border border-[#e6e3dc] shadow-sm flex flex-col items-center justify-between text-center mx-auto my-auto select-none">
        {/* Header */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-[#faf9f6] border border-[#e6e3dc] flex items-center justify-center text-[#e0530a] mb-3 shadow-2xs">
            <GamepadIcon className="w-5 h-5 text-[#e0530a]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#1c1917]">
              Room Created
            </h2>
            <p className="text-xs text-[#6b665f]">
              Share this room code with your opponent
            </p>
          </div>
        </div>

        {/* Room Code Display & Waiting Indicator */}
        <div className="w-full max-w-xs space-y-3 my-auto">
          <div className="flex items-center justify-between w-full min-h-[46px] px-4 py-2 bg-[#faf9f6] rounded-xl border border-[#e6e3dc] shadow-2xs">
            <span className="font-mono text-xl font-bold tracking-widest text-[#1c1917]">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-2.5 py-1 text-xs font-semibold text-[#1c1917] bg-white sm:hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] rounded-lg transition-colors cursor-pointer"
            >
              {copied ? "Copied! ✓" : "Copy"}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#6b665f]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e0530a] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e0530a]" />
            </span>
            <span>Waiting for opponent to join...</span>
          </div>
        </div>

        {/* Cancel / Leave Action */}
        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            onLeaveRoom();
          }}
          className="w-full min-h-[36px] py-1.5 text-xs text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors flex items-center justify-center cursor-pointer"
        >
          Cancel Room
        </button>
      </div>
    );
  }

  // State 2: Join Room Tab
  if (tab === "join") {
    return (
      <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] aspect-square p-6 bg-white rounded-2xl border border-[#e6e3dc] shadow-sm flex flex-col items-center justify-between text-center mx-auto my-auto select-none">
        {/* Header - Identical to Initial Screen */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-[#faf9f6] border border-[#e6e3dc] flex items-center justify-center text-[#1c1917] mb-3 shadow-2xs">
            <GlobeIcon className="w-5 h-5 text-[#1c1917]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#1c1917]">
              {displayTitle}
            </h2>
            <p className="text-xs text-[#6b665f]">{displaySubtitle}</p>
          </div>
        </div>

        {/* Join Form Area */}
        <form
          onSubmit={handleJoinSubmit}
          className="w-full max-w-xs space-y-2.5 my-auto"
        >
          <div className="space-y-1 text-center">
            <label
              htmlFor="room-code-input"
              className="block text-xs font-medium text-[#6b665f]"
            >
              Room Code
            </label>
            <input
              id="room-code-input"
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={10}
              autoFocus
              disabled={isJoining}
              className="w-full min-h-[46px] px-3 py-2 text-center font-mono text-base font-bold tracking-widest text-[#1c1917] bg-[#faf9f6] border border-[#e6e3dc] rounded-xl focus:outline-none focus:border-[#1c1917] focus:bg-white transition-colors placeholder:text-[#9c978e] placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-xs disabled:bg-[#f7f5f0] disabled:text-[#9c978e]"
            />
          </div>

          {errorMessage && (
            <div className="w-full px-2.5 py-1 text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fee2e2] rounded-lg text-center font-medium">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={roomCodeInput.trim().length < 3 || isJoining}
            className="w-full min-h-[46px] py-2.5 px-4 text-sm font-semibold text-white bg-[#1c1917] sm:hover:bg-[#322f2c] active:bg-black disabled:bg-[#d6d3cd] disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {isJoining ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Joining room...</span>
              </>
            ) : isConnecting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Join Room</span>
            )}
          </button>
        </form>

        {/* Back Navigation */}
        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            setTab("choose");
          }}
          disabled={isJoining}
          className="w-full min-h-[36px] py-1.5 text-xs text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors flex items-center justify-center cursor-pointer disabled:text-[#9c978e]"
        >
          ← Back
        </button>
      </div>
    );
  }

  // State 3: Initial Screen (Choose Create or Join)
  return (
    <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] aspect-square p-6 bg-white rounded-2xl border border-[#e6e3dc] shadow-sm flex flex-col items-center justify-between text-center mx-auto my-auto select-none">
      {/* Header */}
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-xl bg-[#faf9f6] border border-[#e6e3dc] flex items-center justify-center text-[#1c1917] mb-3 shadow-2xs">
          <GlobeIcon className="w-5 h-5 text-[#1c1917]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-[#1c1917]">
            {displayTitle}
          </h2>
          <p className="text-xs text-[#6b665f]">{displaySubtitle}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs space-y-2.5 my-auto">
        {errorMessage && (
          <div className="w-full px-2.5 py-1 text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fee2e2] rounded-lg text-center font-medium">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            soundManager.play("buttonClick");
            onCreateRoom();
          }}
          disabled={isCreating}
          className="w-full min-h-[46px] py-2.5 px-4 text-sm font-semibold text-white bg-[#1c1917] sm:hover:bg-[#322f2c] active:bg-black disabled:bg-[#d6d3cd] disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating room...</span>
            </>
          ) : isConnecting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
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
          disabled={isCreating}
          className="w-full min-h-[46px] py-2.5 px-4 text-sm font-semibold bg-[#faf9f6] sm:hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] sm:hover:border-[#1c1917] text-[#1c1917] disabled:bg-[#faf9f6] disabled:text-[#9c978e] disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer flex items-center justify-center"
        >
          Join Room
        </button>
      </div>

      {/* Back to Modes Navigation */}
      <button
        type="button"
        onClick={() => {
          soundManager.play("buttonClick");
          onReturnToModes();
        }}
        disabled={isCreating}
        className="w-full min-h-[36px] py-1.5 text-xs text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors flex items-center justify-center cursor-pointer disabled:text-[#9c978e]"
      >
        ← Back to Modes
      </button>
    </div>
  );
}
