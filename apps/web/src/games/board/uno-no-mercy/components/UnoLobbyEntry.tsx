"use client";

import { useState } from "react";
import { soundManager } from "@/platform/audio";

interface UnoLobbyEntryProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenHowToPlay: () => void;
  isBusy: boolean;
  errorMessage: string | null;
  kickedReason: "afk_timeout" | "disconnected" | null;
  onDismissKicked: () => void;
}

export function UnoLobbyEntry({
  displayName,
  onDisplayNameChange,
  onCreateRoom,
  onJoinRoom,
  onOpenHowToPlay,
  isBusy,
  errorMessage,
  kickedReason,
  onDismissKicked,
}: UnoLobbyEntryProps) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const validateName = (): boolean => {
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 24) {
      setLocalError("Please enter a display name (1–24 characters).");
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleCreate = () => {
    if (!validateName()) return;
    soundManager.play("buttonClick");
    onCreateRoom();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateName()) return;
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setLocalError("Enter a valid 6-character room code.");
      return;
    }
    setLocalError(null);
    soundManager.play("buttonClick");
    onJoinRoom(cleanCode);
  };

  const displayedError = localError || errorMessage;

  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-[#f7f6f2] overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#e6e3dc] shadow-sm p-5 sm:p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Online Only • 2–6 Players
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1c1917]">
              UNO No Mercy
            </h1>
            <p className="text-xs text-[#6b665f] mt-0.5">
              Stackable +10s, 7-Swaps, Color Roulette &amp; 25-Card Mercy Elimination.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onOpenHowToPlay();
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-[#f7f6f2] hover:bg-[#eeece6] border border-[#e6e3dc] text-xs font-semibold text-[#1c1917] cursor-pointer transition-colors"
          >
            How to Play
          </button>
        </div>

        {/* Kicked Notice */}
        {kickedReason && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-rose-800">
                {kickedReason === "afk_timeout"
                  ? "Removed for Inactivity (2:00 AFK)"
                  : "Disconnected from Match"}
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                {kickedReason === "afk_timeout"
                  ? "You didn't play within the 2-minute turn timer."
                  : "You were removed from the active match."}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissKicked}
              className="text-rose-600 hover:text-rose-900 text-xs font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Display Name */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="uno-display-name"
            className="text-xs font-semibold text-[#1c1917]"
          >
            Your Display Name
          </label>
          <input
            id="uno-display-name"
            type="text"
            maxLength={24}
            value={displayName}
            onChange={(e) => {
              onDisplayNameChange(e.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder="e.g. Alex"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] text-sm font-medium text-[#1c1917] placeholder:text-[#9c968e] focus:outline-none focus:ring-2 focus:ring-[#1c1917]/20 focus:border-[#1c1917]"
          />
        </div>

        {/* Error Banner */}
        {displayedError && (
          <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {displayedError}
          </div>
        )}

        {/* Create Room */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={isBusy}
          className="w-full py-3 px-4 rounded-xl bg-[#1c1917] hover:bg-[#322f2c] active:bg-black disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
        >
          {isBusy ? "Connecting..." : "Create Room (Host)"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#e6e3dc]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b665f]">
            Or Join with Code
          </span>
          <div className="flex-1 h-px bg-[#e6e3dc]" />
        </div>

        {/* Join Room */}
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            maxLength={8}
            value={roomCodeInput}
            onChange={(e) => {
              setRoomCodeInput(e.target.value.toUpperCase());
              if (localError) setLocalError(null);
            }}
            placeholder="ABC234"
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc] font-mono text-sm font-bold tracking-widest uppercase text-[#1c1917] placeholder:text-[#9c968e] focus:outline-none focus:ring-2 focus:ring-[#1c1917]/20 focus:border-[#1c1917]"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#f0eee9] active:bg-[#e7e4dc] disabled:opacity-60 border border-[#e6e3dc] text-sm font-bold text-[#1c1917] transition-colors cursor-pointer shrink-0"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
