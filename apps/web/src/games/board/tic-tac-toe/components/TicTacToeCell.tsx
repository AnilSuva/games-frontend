"use client";

import type { CellValue, Player } from "../logic/types";

interface TicTacToeCellProps {
  index: number;
  value: CellValue;
  isWinningCell: boolean;
  winner: Player | null;
  isDisabled: boolean;
  onClick: (index: number) => void;
}

export function TicTacToeCell({
  index,
  value,
  isWinningCell,
  winner,
  isDisabled,
  onClick,
}: TicTacToeCellProps) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;

  const accessibleLabel = value
    ? `Row ${row}, Column ${col}, ${value === "X" ? "Player 1 marked X" : "Player 2 marked O"}`
    : `Row ${row}, Column ${col}, empty`;

  // Winning cell tint styling based on winner
  const winningStyles = isWinningCell
    ? winner === "X"
      ? "bg-[#fff7ed] border-[#fed7aa] shadow-xs"
      : "bg-[#eff6ff] border-[#bfdbfe] shadow-xs"
    : "bg-white border-[#e6e3dc] sm:hover:border-[#d2cecd]";

  return (
    <button
      type="button"
      onClick={() => onClick(index)}
      disabled={isDisabled || value !== null}
      aria-label={accessibleLabel}
      className={`relative w-full aspect-square rounded-xl border flex items-center justify-center select-none transition-all duration-100 active:scale-[0.96] disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer ${winningStyles}`}
    >
      {/* Player 1 Mark: Orange X */}
      {value === "X" && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e0530a"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-10 h-10 sm:w-12 sm:h-12 animate-in zoom-in-75 duration-100 motion-reduce:animate-none"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}

      {/* Player 2 Mark: Blue O */}
      {value === "O" && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-10 h-10 sm:w-12 sm:h-12 animate-in zoom-in-75 duration-100 motion-reduce:animate-none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      )}
    </button>
  );
}
