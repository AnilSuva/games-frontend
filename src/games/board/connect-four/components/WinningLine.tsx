"use client";

import type { Player, WinningLine } from "../logic/types";
import { COLUMNS, ROWS } from "../logic/types";

interface WinningLineProps {
  winningLine: WinningLine;
  winner: Player | null;
}

const GAP_RATIO = 1 / 7;
const COL_TRACKS = COLUMNS;
const ROW_TRACKS = ROWS;
const COL_GAPS = COLUMNS - 1;
const ROW_GAPS = ROWS - 1;
const COL_DENOM = COL_TRACKS + COL_GAPS * GAP_RATIO;
const ROW_DENOM = ROW_TRACKS + ROW_GAPS * GAP_RATIO;
const TRACK_FACTOR = 1 + GAP_RATIO;

function cellCenterPercent(index: number): { x: number; y: number } {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const x = ((col * TRACK_FACTOR + 0.5) / COL_DENOM) * 100;
  const y = ((row * TRACK_FACTOR + 0.5) / ROW_DENOM) * 100;
  return { x, y };
}

export function WinningLine({ winningLine, winner }: WinningLineProps) {
  const firstIdx = winningLine.line[0];
  const lastIdx = winningLine.line[3];

  const { x: x1, y: y1 } = cellCenterPercent(firstIdx);
  const { x: x2, y: y2 } = cellCenterPercent(lastIdx);

  const strokeColor = winner === "R" ? "#e0530a" : "#2563eb";

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-30 p-2 sm:p-3"
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
        strokeWidth="4"
        strokeLinecap="round"
        className="winning-line-anim"
      />
    </svg>
  );
}