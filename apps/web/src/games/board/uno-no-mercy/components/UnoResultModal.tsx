"use client";

import Link from "next/link";
import { soundManager } from "@/platform/audio";
import type { OnlineUnoNoMercyState } from "@/platform/multiplayer/types";

interface UnoResultModalProps {
  gameState: OnlineUnoNoMercyState;
  myPlayerId: string;
  onLeaveRoom: () => void;
  onClose: () => void;
}

export function UnoResultModal({
  gameState,
  myPlayerId,
  onLeaveRoom,
  onClose,
}: UnoResultModalProps) {
  const isSingleLoser = gameState.resultReason === "single_loser_mercy";
  const iLostSingleLoser = isSingleLoser && gameState.loserId === myPlayerId;

  const winnerInfo = gameState.players.find(
    (p) => p.playerId === gameState.winnerId
  );

  const standings =
    gameState.finalStandings ??
    [...gameState.players]
      .sort((a, b) => a.cardCount - b.cardCount)
      .map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName || `Seat ${p.seat + 1}`,
        seat: p.seat,
        status: p.status,
        cardCount: p.cardCount,
        isLoser: p.playerId === gameState.loserId,
        isWinner: p.playerId === gameState.winnerId,
      }));

  const loserDisplayName =
    gameState.loserName ||
    gameState.players.find((p) => p.playerId === gameState.loserId)
      ?.displayName ||
    "Player";

  const headline = isSingleLoser
    ? iLostSingleLoser
      ? `You Lost! (${loserDisplayName})`
      : `${loserDisplayName} Lost!`
    : gameState.winnerId === myPlayerId
    ? "You Won!"
    : `${winnerInfo?.displayName || "Opponent"} Won`;

  const subtitle = isSingleLoser
    ? `Reached ${gameState.loserCardCount ?? gameState.settings.mercyLimit} cards (Limit: ${gameState.settings.mercyLimit})`
    : gameState.resultReason === "mercy_elimination"
    ? "Last survivor after Mercy Eliminations"
    : gameState.resultReason === "last_player_standing"
    ? "Last player standing"
    : "Emptied entire hand first";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match Result"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white border border-[#e6e3dc] shadow-xl p-5 flex flex-col gap-3.5 text-[#1c1917]">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            {isSingleLoser ? (
              <span className="inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider mb-1">
                NO MERCY — GAME OVER
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider mb-1">
                MATCH COMPLETE
              </span>
            )}
            <h2 className="text-xl font-black tracking-tight text-[#1c1917]">
              {headline}
            </h2>
            <p className="text-xs text-[#6b665f] mt-0.5">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onClose();
            }}
            className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-lg text-[#6b665f] hover:text-[#1c1917] hover:bg-[#f0eee9] cursor-pointer"
            aria-label="Close result"
          >
            ✕
          </button>
        </div>

        {/* Final Standings Table */}
        <div className="flex flex-col gap-1.5 max-h-[210px] overflow-y-auto pr-0.5">
          {standings.map((entry, idx) => {
            const isMe = entry.playerId === myPlayerId;
            return (
              <div
                key={entry.playerId}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                  entry.isLoser
                    ? "bg-rose-50 border-rose-300 text-rose-900"
                    : entry.isWinner
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-[#f7f6f2] border-[#e6e3dc] text-[#1c1917]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold opacity-60 w-4">
                    #{idx + 1}
                  </span>
                  <span className="font-bold truncate">
                    {entry.displayName}
                    {isMe ? " (You)" : ""}
                  </span>
                  {entry.isLoser && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase">
                      LOSER
                    </span>
                  )}
                  {entry.isWinner && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">
                      WINNER
                    </span>
                  )}
                </div>

                <span className="font-mono font-black shrink-0">
                  {entry.cardCount} {entry.cardCount === 1 ? "card" : "cards"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              soundManager.play("buttonClick");
              onLeaveRoom();
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#1c1917] hover:bg-[#322f2c] active:bg-black transition-colors cursor-pointer"
          >
            Back to Lobby / New Match
          </button>

          <Link
            href="/"
            onClick={() => {
              soundManager.play("buttonClick");
              onLeaveRoom();
            }}
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-[#6b665f] hover:text-[#1c1917] hover:bg-[#f0eee9] border border-[#e6e3dc] text-center transition-colors block"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
