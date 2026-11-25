import React from "react";
import type { Cell, Player } from "../logic/types";
import { COLS, ROWS, getCriticalMass } from "../logic/rules";
import { Orb } from "./Orb";

export interface FlyingOrbData {
  id: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  player: Player;
}

interface ChainReactionBoardProps {
  grid: Cell[][];
  currentPlayer: Player;
  onCellClick: (row: number, col: number) => void;
  disabled?: boolean;
  lastMove?: { row: number; col: number } | null;
  flashingCells?: Set<string>;
  flyingOrbs?: FlyingOrbData[];
  humanPlayer?: Player;
}

export function ChainReactionBoard({
  grid,
  currentPlayer,
  onCellClick,
  disabled = false,
  lastMove,
  flashingCells,
  flyingOrbs = [],
  humanPlayer,
}: ChainReactionBoardProps) {
  const isHumanTurn = humanPlayer === undefined || currentPlayer === humanPlayer;
  const isBoardInteractive = !disabled && isHumanTurn;

  return (
    <div className="relative w-full max-w-[400px] aspect-[3/4] mx-auto select-none touch-none flex flex-col justify-center">
      {/* Grid container with OmniPlay tactile surface */}
      <div
        role="grid"
        aria-label="Chain Reaction Board"
        className="relative w-full h-full bg-white rounded-2xl border-2 border-[#e6e3dc] shadow-md grid grid-cols-6 grid-rows-8 overflow-hidden p-1 gap-1"
      >
        {grid.map((rowCells, r) =>
          rowCells.map((cell, c) => {
            const cellKey = `${r},${c}`;
            const crit = getCriticalMass(r, c);
            const isNearCrit = cell.count === crit - 1 && cell.owner !== null;
            const isLegal =
              isBoardInteractive && (cell.owner === null || cell.owner === currentPlayer);
            const isFlashing = flashingCells?.has(cellKey);
            const isLastMove = lastMove?.row === r && lastMove?.col === c;

            return (
              <button
                key={cellKey}
                type="button"
                role="gridcell"
                aria-label={`Row ${r + 1}, Column ${c + 1}: ${cell.count} orbs, Critical mass ${crit}`}
                aria-disabled={!isLegal}
                tabIndex={isLegal ? 0 : -1}
                disabled={!isBoardInteractive || !isLegal}
                onClick={() => onCellClick(r, c)}
                className={`relative flex items-center justify-center rounded-lg transition-colors duration-150 overflow-hidden outline-none ${
                  isFlashing
                    ? "bg-[#fed7aa]/50"
                    : isLastMove
                    ? "bg-[#eeece6]/80"
                    : "bg-[#faf9f6] hover:bg-[#f2efe9]"
                } ${
                  isLegal
                    ? "cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-[#1c1917]"
                    : "cursor-default"
                }`}
              >
                {/* Critical mass capacity dots in top corner */}
                <div
                  className="absolute top-1 right-1 flex gap-0.5 pointer-events-none opacity-40"
                  aria-hidden="true"
                >
                  {Array.from({ length: crit }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 h-1 rounded-full ${
                        i < cell.count
                          ? cell.owner === "X"
                            ? "bg-[#e0530a] opacity-90"
                            : "bg-[#2563eb] opacity-90"
                          : "bg-[#9c978e]"
                      }`}
                    />
                  ))}
                </div>

                {/* Orbs in this cell */}
                <Orb
                  count={cell.count}
                  owner={cell.owner}
                  isNearCritical={isNearCrit}
                />
              </button>
            );
          })
        )}

        {/* Flying orb cascade overlay */}
        {flyingOrbs.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {flyingOrbs.map((orb) => {
              const startX = ((orb.fromCol + 0.5) / COLS) * 100;
              const startY = ((orb.fromRow + 0.5) / ROWS) * 100;
              const endX = ((orb.toCol + 0.5) / COLS) * 100;
              const endY = ((orb.toRow + 0.5) / ROWS) * 100;

              const isOrange = orb.player === "X";
              const color = isOrange ? "#e0530a" : "#2563eb";

              return (
                <div
                  key={orb.id}
                  className="flying-orb absolute w-4 h-4 rounded-full shadow-md"
                  style={
                    {
                      backgroundColor: color,
                      left: `${startX}%`,
                      top: `${startY}%`,
                      transform: "translate(-50%, -50%)",
                      "--target-x": `${endX - startX}%`,
                      "--target-y": `${endY - startY}%`,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
