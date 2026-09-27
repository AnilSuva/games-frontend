"use client";

import type { Player } from "../logic/types";

interface ConnectFourCellProps {
  value: Player | null;
  isWinningCell: boolean;
}

export function ConnectFourCell({ value, isWinningCell }: ConnectFourCellProps) {
  const isOrange = value === "R";
  const isBlue = value === "Y";

  const cellClasses = [
    "relative w-full aspect-square rounded-full transition-all duration-100",
    isWinningCell ? "ring-2 ring-[#1c1917] ring-offset-1" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const innerClasses = [
    "w-full h-full rounded-full",
    !value ? "bg-white border-2 border-[#e6e3dc] group-hover:border-[#c8c4bc] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-colors" : "",
    isOrange ? "bg-[#e0530a] shadow-[0_1px_2px_rgba(0,0,0,0.15)]" : "",
    isBlue ? "bg-[#2563eb] shadow-[0_1px_2px_rgba(0,0,0,0.15)]" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cellClasses} aria-hidden="true">
      <div className={innerClasses} />
    </div>
  );
}