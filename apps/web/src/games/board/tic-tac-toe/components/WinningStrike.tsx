"use client";

import type { Player, WinningLine } from "../logic/types";

interface WinningStrikeProps {
  winningLine: WinningLine;
  winner: Player | null;
}

export function WinningStrike({ winningLine, winner }: WinningStrikeProps) {
  const [a, , c] = winningLine.line;

  // Compute normalized coordinates (0 to 100) for the 3x3 grid
  let x1 = 50;
  let y1 = 50;
  let x2 = 50;
  let y2 = 50;

  if (winningLine.direction === "horizontal") {
    const row = Math.floor(a / 3);
    const y = row === 0 ? 16.67 : row === 1 ? 50 : 83.33;
    x1 = 7;
    y1 = y;
    x2 = 93;
    y2 = y;
  } else if (winningLine.direction === "vertical") {
    const col = a % 3;
    const x = col === 0 ? 16.67 : col === 1 ? 50 : 83.33;
    x1 = x;
    y1 = 7;
    x2 = x;
    y2 = 93;
  } else if (winningLine.direction === "diagonal") {
    if (a === 0 && c === 8) {
      // Main diagonal top-left -> bottom-right
      x1 = 8;
      y1 = 8;
      x2 = 92;
      y2 = 92;
    } else {
      // Anti-diagonal top-right -> bottom-left
      x1 = 92;
      y1 = 8;
      x2 = 8;
      y2 = 92;
    }
  }

  const strokeColor = winner === "X" ? "#e0530a" : "#2563eb";

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10 p-2.5 sm:p-3"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        className="winning-line-anim"
      />
    </svg>
  );
}
