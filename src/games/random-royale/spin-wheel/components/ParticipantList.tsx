"use client";

import type { ReactNode } from "react";
import { MAX_PARTICIPANTS } from "../config";
import type { Participant } from "../types";

interface ParticipantListProps {
  participants: Participant[];
  winnerId?: string | null;
  isSpinning: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  children?: ReactNode;
}

export function ParticipantList({
  participants,
  winnerId,
  isSpinning,
  onRemove,
  onClear,
  children,
}: ParticipantListProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3 sm:mb-2">
        <div>
          <h2 id="participants-title" className="text-sm font-semibold text-[#1c1917] sm:text-base">
            Participants
          </h2>
          <p className="text-[11px] text-[#817a71] sm:text-xs">
            {participants.length} of {MAX_PARTICIPANTS}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={isSpinning || participants.length === 0}
          className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-[#6b665f] transition-colors hover:bg-[#f7f6f2] active:bg-[#eeece6] disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      {children}

      <ol
        className="mt-2 min-h-20 max-h-[min(42dvh,560px)] divide-y divide-[#f0eee9] overflow-y-auto overscroll-contain pr-1 lg:max-h-[min(54vh,620px)]"
        aria-label="Participant list"
      >
        {participants.map((participant, index) => (
          <li
            key={participant.id}
            className={`flex min-h-9 items-center gap-2 py-0.5 sm:min-h-11 sm:gap-3 sm:py-1.5 ${
              winnerId === participant.id
                ? "font-semibold text-[#1c1917]"
                : "text-[#4b4741]"
            }`}
          >
            <span className="w-7 shrink-0 text-right text-xs tabular-nums text-[#9c978e]">
              {index + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {participant.name}
            </span>
            {winnerId === participant.id && (
              <span className="shrink-0 text-[11px] font-medium text-[#b35d35]">
                Winner
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(participant.id)}
              disabled={isSpinning}
              aria-label={`Remove participant ${index + 1}: ${participant.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg leading-none text-[#817a71] transition-colors hover:bg-[#f7f6f2] hover:text-[#1c1917] active:bg-[#eeece6] disabled:opacity-40 sm:h-9 sm:w-9"
            >
              ×
            </button>
          </li>
        ))}
        {participants.length === 0 && (
          <li className="flex min-h-20 items-center justify-center px-4 text-center text-sm text-[#9c978e]">
            Add names above to get started.
          </li>
        )}
      </ol>
    </div>
  );
}
