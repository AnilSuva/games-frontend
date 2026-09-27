"use client";

import type { FormEvent } from "react";
import { MAX_PARTICIPANTS } from "../config";

interface ParticipantInputProps {
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
  isFull: boolean;
}

export function ParticipantInput({
  name,
  onNameChange,
  onSubmit,
  disabled,
  isFull,
}: ParticipantInputProps) {
  return (
    <>
      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="participant-name" className="sr-only">
          Participant name
        </label>
        <input
          id="participant-name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={isFull ? "Participant limit reached" : "Enter a name…"}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#e6e3dc] bg-[#fff] px-3 text-base text-[#1c1917] outline-none placeholder:text-[#aaa49b] focus:border-[#817a71] disabled:bg-[#faf9f6] sm:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || !name.trim()}
          className="min-h-11 rounded-lg bg-[#f0eee9] px-4 text-sm font-semibold text-[#1c1917] hover:bg-[#e6e3dc] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add
        </button>
      </form>
      {isFull && (
        <p className="mt-2 text-xs text-[#b35d35]">
          The wheel supports up to {MAX_PARTICIPANTS} participants.
        </p>
      )}
    </>
  );
}
