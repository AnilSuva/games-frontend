"use client";

import { useState } from "react";
import type { DotsBoxesState, Edge, PlatformPlayer } from "../logic/types";

interface DotsAndBoxesBoardProps {
  state: DotsBoxesState;
  onClaimEdge: (edge: Edge) => void;
  disabled?: boolean;
  humanPlayer?: PlatformPlayer;
}

export function DotsAndBoxesBoard({
  state,
  onClaimEdge,
  disabled = false,
  humanPlayer,
}: DotsAndBoxesBoardProps) {
  const { config, horizontalEdges, verticalEdges, boxes, lastMove, currentPlayer } = state;
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const isInteractive = !disabled && (humanPlayer === undefined || currentPlayer === humanPlayer);

  const SVG_SIZE = 500;
  const PADDING = 45;
  const cellW = (SVG_SIZE - 2 * PADDING) / config.cols;
  const cellH = (SVG_SIZE - 2 * PADDING) / config.rows;

  const getDotX = (c: number) => PADDING + c * cellW;
  const getDotY = (r: number) => PADDING + r * cellH;

  const handleEdgeClick = (edge: Edge) => {
    if (!isInteractive) return;
    onClaimEdge(edge);
  };

  const handleKeyDown = (e: React.KeyboardEvent, edge: Edge) => {
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClaimEdge(edge);
    }
  };

  const activeColorHex = currentPlayer === "orange" ? "#e0530a" : "#2563eb";

  return (
    <div className="relative w-full max-w-[460px] aspect-square mx-auto select-none touch-manipulation">
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full h-full rounded-2xl bg-[#141416]/90 border border-white/10 shadow-2xl p-2"
      >
        <defs>
          {/* Subtle drop shadow for completed boxes */}
          <filter id="box-glow-orange" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#e0530a" floodOpacity="0.4" />
          </filter>
          <filter id="box-glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#2563eb" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 1. Completed Boxes Grid */}
        {boxes.map((rowArr, r) =>
          rowArr.map((owner, c) => {
            if (!owner) return null;
            const bx = getDotX(c) + 6;
            const by = getDotY(r) + 6;
            const bw = cellW - 12;
            const bh = cellH - 12;
            const isOrange = owner === "orange";

            return (
              <g key={`box-${r}-${c}`} className="animate-in fade-in zoom-in-90 duration-300">
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  rx={8}
                  fill={isOrange ? "#e0530a" : "#2563eb"}
                  fillOpacity={0.28}
                  stroke={isOrange ? "#e0530a" : "#2563eb"}
                  strokeWidth={2}
                  strokeOpacity={0.7}
                  filter={isOrange ? "url(#box-glow-orange)" : "url(#box-glow-blue)"}
                />
                {/* Central initial letter or emblem */}
                <text
                  x={bx + bw / 2}
                  y={by + bh / 2 + 6}
                  textAnchor="middle"
                  fontSize={Math.min(bw, bh) * 0.42}
                  fontWeight="bold"
                  fill={isOrange ? "#fdba74" : "#93c5fd"}
                  className="font-mono tracking-wider select-none pointer-events-none opacity-90"
                >
                  {isOrange ? "O" : "B"}
                </text>
              </g>
            );
          })
        )}

        {/* 2. Horizontal Edges */}
        {horizontalEdges.map((rowArr, r) =>
          rowArr.map((owner, c) => {
            const edgeId = `h:${r}:${c}`;
            const x1 = getDotX(c);
            const y1 = getDotY(r);
            const x2 = getDotX(c + 1);
            const y2 = getDotY(r);
            const isClaimed = owner !== null;
            const isLast =
              lastMove?.edge.type === "h" &&
              lastMove.edge.row === r &&
              lastMove.edge.col === c;
            const isHovered = hoveredEdgeId === edgeId;

            return (
              <g key={edgeId} className="group">
                {/* Glow backing line for the most recent move */}
                {isClaimed && isLast && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={owner === "orange" ? "#fb923c" : "#60a5fa"}
                    strokeWidth={12}
                    strokeOpacity={0.45}
                    strokeLinecap="round"
                  />
                )}

                {/* Visual line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    isClaimed
                      ? owner === "orange"
                        ? "#e0530a"
                        : "#2563eb"
                      : isHovered && isInteractive
                      ? activeColorHex
                      : "#2a2b30"
                  }
                  strokeWidth={isClaimed ? (isLast ? 6.5 : 5.5) : isHovered && isInteractive ? 4 : 2}
                  strokeDasharray={!isClaimed && !isHovered ? "4 4" : undefined}
                  strokeLinecap="round"
                  className="transition-colors duration-150"
                />

                {/* Generous touch / click hitbox */}
                {!isClaimed && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={36}
                    strokeLinecap="round"
                    style={{ pointerEvents: "all" }}
                    className={`focus:outline-none ${
                      isInteractive ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    tabIndex={isInteractive ? 0 : -1}
                    role="button"
                    aria-label={`Claim horizontal line at row ${r + 1}, column ${c + 1}`}
                    onClick={() => {
                      setHoveredEdgeId(null);
                      handleEdgeClick({ type: "h", row: r, col: c });
                    }}
                    onPointerDown={() => isInteractive && setHoveredEdgeId(edgeId)}
                    onKeyDown={(e) => handleKeyDown(e, { type: "h", row: r, col: c })}
                    onPointerEnter={() => isInteractive && setHoveredEdgeId(edgeId)}
                    onPointerLeave={() => setHoveredEdgeId(null)}
                  />
                )}
              </g>
            );
          })
        )}

        {/* 3. Vertical Edges */}
        {verticalEdges.map((rowArr, r) =>
          rowArr.map((owner, c) => {
            const edgeId = `v:${r}:${c}`;
            const x1 = getDotX(c);
            const y1 = getDotY(r);
            const x2 = getDotX(c);
            const y2 = getDotY(r + 1);
            const isClaimed = owner !== null;
            const isLast =
              lastMove?.edge.type === "v" &&
              lastMove.edge.row === r &&
              lastMove.edge.col === c;
            const isHovered = hoveredEdgeId === edgeId;

            return (
              <g key={edgeId} className="group">
                {/* Glow backing line for the most recent move */}
                {isClaimed && isLast && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={owner === "orange" ? "#fb923c" : "#60a5fa"}
                    strokeWidth={12}
                    strokeOpacity={0.45}
                    strokeLinecap="round"
                  />
                )}

                {/* Visual line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    isClaimed
                      ? owner === "orange"
                        ? "#e0530a"
                        : "#2563eb"
                      : isHovered && isInteractive
                      ? activeColorHex
                      : "#2a2b30"
                  }
                  strokeWidth={isClaimed ? (isLast ? 6.5 : 5.5) : isHovered && isInteractive ? 4 : 2}
                  strokeDasharray={!isClaimed && !isHovered ? "4 4" : undefined}
                  strokeLinecap="round"
                  className="transition-colors duration-150"
                />

                {/* Generous touch / click hitbox */}
                {!isClaimed && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={36}
                    strokeLinecap="round"
                    style={{ pointerEvents: "all" }}
                    className={`focus:outline-none ${
                      isInteractive ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    tabIndex={isInteractive ? 0 : -1}
                    role="button"
                    aria-label={`Claim vertical line at row ${r + 1}, column ${c + 1}`}
                    onClick={() => {
                      setHoveredEdgeId(null);
                      handleEdgeClick({ type: "v", row: r, col: c });
                    }}
                    onPointerDown={() => isInteractive && setHoveredEdgeId(edgeId)}
                    onKeyDown={(e) => handleKeyDown(e, { type: "v", row: r, col: c })}
                    onPointerEnter={() => isInteractive && setHoveredEdgeId(edgeId)}
                    onPointerLeave={() => setHoveredEdgeId(null)}
                  />
                )}
              </g>
            );
          })
        )}

        {/* 4. Dots at grid intersections (drawn on top of lines for crisp appearance) */}
        {Array.from({ length: config.rows + 1 }).map((_, r) =>
          Array.from({ length: config.cols + 1 }).map((_, c) => {
            const cx = getDotX(c);
            const cy = getDotY(r);
            return (
              <circle
                key={`dot-${r}-${c}`}
                cx={cx}
                cy={cy}
                r={6}
                fill="#e5e7eb"
                stroke="#1f2937"
                strokeWidth={2}
                className="pointer-events-none drop-shadow-sm"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
