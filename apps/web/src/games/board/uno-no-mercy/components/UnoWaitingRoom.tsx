"use client";

import { useState } from "react";
import { soundManager } from "@/platform/audio";
import type { RoomPlayerDto, UnoSettings } from "@/platform/multiplayer/types";

interface UnoWaitingRoomProps {
  roomCode: string;
  players: RoomPlayerDto[];
  myPlayerId: string | null;
  hostPlayerId: string;
  isHost: boolean;
  settings: UnoSettings;
  errorMessage: string | null;
  onUpdateSettings: (patch: Partial<UnoSettings>) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onOpenHowToPlay: () => void;
}

const AVATAR_COLORS = [
  "bg-rose-600 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-500 text-stone-950",
  "bg-purple-600 text-white",
  "bg-cyan-600 text-white",
];

export function UnoWaitingRoom({
  roomCode,
  players,
  myPlayerId,
  hostPlayerId,
  isHost,
  settings,
  errorMessage,
  onUpdateSettings,
  onStartGame,
  onLeaveRoom,
  onOpenHowToPlay,
}: UnoWaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    soundManager.play("buttonClick");
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleMercyChange = (nextMercy: number) => {
    const minAllowed = Math.max(15, settings.startingHandSize + 3);
    const clamped = Math.min(50, Math.max(minAllowed, nextMercy));
    soundManager.play("buttonClick");
    onUpdateSettings({ mercyLimit: clamped });
  };

  const handleStartingCardsChange = (nextStart: number) => {
    const clampedStart = Math.min(15, Math.max(4, nextStart));
    const nextMercy = Math.max(settings.mercyLimit, clampedStart + 3);
    soundManager.play("buttonClick");
    onUpdateSettings({
      startingHandSize: clampedStart,
      mercyLimit: nextMercy,
    });
  };

  const handleMaxPlayersChange = (nextMax: number) => {
    const clamped = Math.min(6, Math.max(Math.max(2, players.length), nextMax));
    soundManager.play("buttonClick");
    onUpdateSettings({ maxPlayers: clamped });
  };

  const canStart = isHost && players.length >= 2;
  const emptySlots = Math.max(0, settings.maxPlayers - players.length);

  return (
    <div className="w-full h-full flex items-center justify-center p-3 sm:p-5 bg-[#f7f6f2] overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#e6e3dc] shadow-sm p-4 sm:p-6 flex flex-col gap-4">
        {/* Top Room Code Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e6e3dc]">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b665f] block">
                Room Code
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-[#1c1917]">
                  {roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg bg-[#f7f6f2] hover:bg-[#eeece6] border border-[#e6e3dc] text-xs font-semibold text-[#1c1917] cursor-pointer transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#f7f6f2] border border-[#e6e3dc] text-xs font-bold text-[#1c1917]">
              {players.length} / {settings.maxPlayers} Players
            </span>
            <button
              type="button"
              onClick={() => {
                soundManager.play("buttonClick");
                onOpenHowToPlay();
              }}
              className="w-8 h-8 rounded-full bg-[#f7f6f2] hover:bg-[#eeece6] border border-[#e6e3dc] text-xs font-bold text-[#1c1917] cursor-pointer"
              title="How to Play"
              aria-label="How to Play"
            >
              ?
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Player Waiting List */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b665f]">
              Players in Lobby
            </h2>
            <div className="flex flex-col gap-1.5">
              {players.map((p, idx) => {
                const isMe = p.playerId === myPlayerId;
                const playerIsHost = p.isHost ?? p.playerId === hostPlayerId;
                const name = p.displayName || `Player ${idx + 1}`;
                const initial = name.charAt(0).toUpperCase();
                return (
                  <div
                    key={p.playerId}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                      isMe
                        ? "bg-amber-50/70 border-amber-200"
                        : "bg-[#f7f6f2] border-[#e6e3dc]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          AVATAR_COLORS[idx % AVATAR_COLORS.length]
                        }`}
                      >
                        {initial}
                      </span>
                      <span className="text-sm font-semibold text-[#1c1917] truncate">
                        {name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {playerIsHost && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold">
                          HOST
                        </span>
                      )}
                      {isMe && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1c1917] text-white text-[10px] font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: emptySlots }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="flex items-center px-3 py-2 rounded-xl border border-dashed border-[#d8d4cb] text-xs text-[#9c968e]"
                >
                  Open Seat #{players.length + idx + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Room Rules Panel */}
          <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#f7f6f2] border border-[#e6e3dc]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b665f]">
                Room Rules
              </h2>
              <span className="text-[10px] font-semibold text-[#6b665f]">
                {isHost ? "Host Controls" : "Read Only"}
              </span>
            </div>

            {/* Mercy Limit */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1c1917]">Mercy Limit</span>
                <span className="text-[#6b665f]">
                  Eliminated at <strong>{settings.mercyLimit}+</strong> cards
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleMercyChange(settings.mercyLimit - 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#e6e3dc] font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-xs font-bold">
                  {settings.mercyLimit}
                </span>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleMercyChange(settings.mercyLimit + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#e6e3dc] font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  +
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  {[24, 25, 30].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleMercyChange(preset)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer disabled:opacity-60 ${
                        settings.mercyLimit === preset
                          ? "bg-[#1c1917] text-white border-[#1c1917]"
                          : "bg-white text-[#1c1917] border-[#e6e3dc]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Starting Hand Size */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1c1917]">Starting Cards</span>
                <span className="text-[#6b665f]">
                  <strong>{settings.startingHandSize}</strong> dealt each
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleStartingCardsChange(settings.startingHandSize - 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#e6e3dc] font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono text-xs font-bold">
                  {settings.startingHandSize}
                </span>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleStartingCardsChange(settings.startingHandSize + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#e6e3dc] font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  +
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  {[7, 8].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleStartingCardsChange(preset)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer disabled:opacity-60 ${
                        settings.startingHandSize === preset
                          ? "bg-[#1c1917] text-white border-[#1c1917]"
                          : "bg-white text-[#1c1917] border-[#e6e3dc]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Max Players */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1c1917]">Max Players</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!isHost || n < players.length}
                    onClick={() => handleMaxPlayersChange(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-45 ${
                      settings.maxPlayers === n
                        ? "bg-[#1c1917] text-white border-[#1c1917]"
                        : "bg-white text-[#1c1917] border-[#e6e3dc]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Draw Until Playable */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1c1917]">
                Draw Until Playable
              </span>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => {
                  soundManager.play("buttonClick");
                  onUpdateSettings({
                    drawUntilPlayable: !settings.drawUntilPlayable,
                  });
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer disabled:opacity-60 ${
                  settings.drawUntilPlayable
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : "bg-white text-[#6b665f] border-[#e6e3dc]"
                }`}
              >
                {settings.drawUntilPlayable ? "ON (Official)" : "OFF (Draw 1)"}
              </button>
            </div>

            {/* Mercy End Mode */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#e6e3dc]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1c1917]">
                  Mercy End Mode
                </span>
                <span className="text-[10px] font-semibold text-[#6b665f]">
                  {settings.endOnFirstMercyLoss ? "One Loser" : "Classic"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    soundManager.play("buttonClick");
                    onUpdateSettings({ endOnFirstMercyLoss: false });
                  }}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-65 ${
                    !settings.endOnFirstMercyLoss
                      ? "bg-[#1c1917] text-white border-[#1c1917]"
                      : "bg-white text-[#1c1917] border-[#e6e3dc] hover:bg-[#eeece6]"
                  }`}
                >
                  <span className="block text-[11px] font-bold">
                    Classic Elimination
                  </span>
                  <span
                    className={`block text-[10px] leading-tight mt-0.5 ${
                      !settings.endOnFirstMercyLoss
                        ? "text-stone-300"
                        : "text-[#6b665f]"
                    }`}
                  >
                    Eliminated players drop out; match continues
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    soundManager.play("buttonClick");
                    onUpdateSettings({ endOnFirstMercyLoss: true });
                  }}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-65 ${
                    settings.endOnFirstMercyLoss
                      ? "bg-rose-600 text-white border-rose-700"
                      : "bg-white text-[#1c1917] border-[#e6e3dc] hover:bg-[#eeece6]"
                  }`}
                >
                  <span className="block text-[11px] font-bold">
                    One Loser Ends Game
                  </span>
                  <span
                    className={`block text-[10px] leading-tight mt-0.5 ${
                      settings.endOnFirstMercyLoss
                        ? "text-rose-100"
                        : "text-[#6b665f]"
                    }`}
                  >
                    First to {settings.mercyLimit}+ cards loses &amp; ends match
                  </span>
                </button>
              </div>
            </div>

            {/* Fairness Info Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#e6e3dc]">
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e6e3dc] text-[10px] font-semibold text-[#6b665f]">
                ⏱ 2:00 AFK Kick
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e6e3dc] text-[10px] font-semibold text-[#6b665f]">
                ⚡ Disconnect = Removed
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e6e3dc]">
          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onLeaveRoom();
            }}
            className="px-4 py-2.5 rounded-xl bg-[#f7f6f2] hover:bg-[#eeece6] border border-[#e6e3dc] text-xs font-semibold text-[#6b665f] hover:text-[#1c1917] cursor-pointer transition-colors"
          >
            Leave Room
          </button>

          {isHost ? (
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                soundManager.play("buttonClick");
                onStartGame();
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#1c1917] hover:bg-[#322f2c] disabled:bg-[#d2cecd] disabled:text-[#6b665f] text-white text-sm font-bold shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {players.length < 2
                ? "Waiting for at least 1 more player..."
                : `Start Match (${players.length} Players)`}
            </button>
          ) : (
            <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 animate-pulse">
              Waiting for Host to start the match...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
