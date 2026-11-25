"use client";

import React, { useCallback, useRef } from "react";
import { GRID_SIZE, WALL_GRID_SIZE } from "../logic/rules";
import type {
  Player,
  Position,
  Wall,
  WallMazeAction,
  WallOrientation,
  WallValidationResult,
} from "../logic/types";

export type InteractionMode = "move" | "wall";

interface WallMazeBoardProps {
  pawns: Record<Player, Position>;
  walls: readonly Wall[];
  currentPlayer: Player;
  validPawnMoves: readonly Position[];
  interactionMode: InteractionMode;
  wallOrientation: WallOrientation;
  ghostWall: { row: number; col: number } | null;
  ghostValidation: WallValidationResult | null;
  invalidShakeKey: number;
  lastAction: WallMazeAction | null;
  localPlayerSeat?: Player;
  disabled?: boolean;
  onCellClick: (row: number, col: number) => void;
  onWallPreview: (row: number | null, col: number | null, pointerType: string) => void;
  onWallTapOrPlace: (row: number, col: number, pointerType: string) => void;
  onToggleOrientation: () => void;
}

// Geometry constants for percentage-aligned 9x9 tiles and 8x8 wall channels
const GROOVE_RATIO = 0.24;
const TOTAL_UNITS = GRID_SIZE + (GRID_SIZE - 1) * GROOVE_RATIO;
const CELL_PCT = (1 / TOTAL_UNITS) * 100;
const GROOVE_PCT = (GROOVE_RATIO / TOTAL_UNITS) * 100;
const STRIDE_PCT = CELL_PCT + GROOVE_PCT;
const WALL_LEN_PCT = 2 * CELL_PCT + GROOVE_PCT;

function clampWallCoord(val: number): number {
  return Math.max(0, Math.min(WALL_GRID_SIZE - 1, val));
}

function getWallGeometry(row: number, col: number, orientation: WallOrientation) {
  if (orientation === "h") {
    return {
      left: `${col * STRIDE_PCT}%`,
      top: `${row * STRIDE_PCT + CELL_PCT}%`,
      width: `${WALL_LEN_PCT}%`,
      height: `${GROOVE_PCT}%`,
    };
  }
  return {
    left: `${col * STRIDE_PCT + CELL_PCT}%`,
    top: `${row * STRIDE_PCT}%`,
    width: `${GROOVE_PCT}%`,
    height: `${WALL_LEN_PCT}%`,
  };
}

export function WallMazeBoard({
  pawns,
  walls,
  currentPlayer,
  validPawnMoves,
  interactionMode,
  wallOrientation,
  ghostWall,
  ghostValidation,
  invalidShakeKey,
  lastAction,
  localPlayerSeat,
  disabled = false,
  onCellClick,
  onWallPreview,
  onWallTapOrPlace,
  onToggleOrientation,
}: WallMazeBoardProps) {
  const boardInnerRef = useRef<HTMLDivElement | null>(null);
  const touchDragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    moved: boolean;
    pointerId: number | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
    pointerId: null,
  });

  const validMoveSet = new Set(validPawnMoves.map((m) => `${m.row},${m.col}`));

  const getNearestIntersection = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const el = boardInnerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      const xPct = ((clientX - rect.left) / rect.width) * 100;
      const yPct = ((clientY - rect.top) / rect.height) * 100;
      const firstCenter = CELL_PCT + GROOVE_PCT / 2;

      const col = clampWallCoord(Math.round((xPct - firstCenter) / STRIDE_PCT));
      const row = clampWallCoord(Math.round((yPct - firstCenter) / STRIDE_PCT));
      return { row, col };
    },
    []
  );

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || interactionMode !== "wall") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const coords = getNearestIntersection(e.clientX, e.clientY);
    if (!coords) return;

    if (e.pointerType === "touch") {
      e.currentTarget.setPointerCapture(e.pointerId);
      touchDragStateRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        pointerId: e.pointerId,
      };
      onWallPreview(coords.row, coords.col, "touch");
    } else {
      onWallPreview(coords.row, coords.col, e.pointerType);
    }
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || interactionMode !== "wall") return;

    const coords = getNearestIntersection(e.clientX, e.clientY);
    if (!coords) return;

    if (e.pointerType === "touch") {
      if (!touchDragStateRef.current.active) return;
      const dx = e.clientX - touchDragStateRef.current.startX;
      const dy = e.clientY - touchDragStateRef.current.startY;
      if (dx * dx + dy * dy > 64) {
        touchDragStateRef.current.moved = true;
      }
      onWallPreview(coords.row, coords.col, "touch");
    } else {
      onWallPreview(coords.row, coords.col, e.pointerType);
    }
  };

  const handleOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || interactionMode !== "wall") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const coords = getNearestIntersection(e.clientX, e.clientY);
    if (!coords) return;

    if (e.pointerType === "touch") {
      const wasMoved = touchDragStateRef.current.moved;
      touchDragStateRef.current.active = false;
      touchDragStateRef.current.pointerId = null;
      if (!wasMoved) {
        onWallTapOrPlace(coords.row, coords.col, "touch");
      }
    } else {
      onWallTapOrPlace(coords.row, coords.col, e.pointerType);
    }
  };

  const handleOverlayPointerCancel = () => {
    touchDragStateRef.current.active = false;
    touchDragStateRef.current.pointerId = null;
  };

  const handleOverlayPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") {
      onWallPreview(null, null, e.pointerType);
    }
  };

  const activeColor = currentPlayer === "X" ? "#e0530a" : "#2563eb";
  const lastPlacedWall =
    lastAction?.type === "PLACE_WALL" ? lastAction : null;
  const lastMovedPawnTarget =
    lastAction?.type === "MOVE_PAWN" ? lastAction : null;

  const isOrangeGoalMine = localPlayerSeat === "X";
  const isBlueGoalMine = localPlayerSeat === "O";

  return (
    <div className="w-full flex flex-col items-center select-none touch-none">
      {/* Top Goal Strip — Orange Target (Row 0) */}
      <div className="w-full flex items-center justify-center gap-1.5 pb-1">
        <div
          className={`flex-1 rounded-full transition-all ${
            isOrangeGoalMine
              ? "h-2 bg-gradient-to-r from-[#e0530a]/30 via-[#e0530a] to-[#e0530a]/30"
              : "h-1.5 bg-gradient-to-r from-[#e0530a]/15 via-[#e0530a]/65 to-[#e0530a]/15"
          }`}
        />
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${
            isOrangeGoalMine ? "text-[#9a3412]" : "text-[#c2410c]"
          }`}
        >
          {isOrangeGoalMine ? "★ Your Goal ▲" : "▲ Orange Goal"}
        </span>
        <div
          className={`flex-1 rounded-full transition-all ${
            isOrangeGoalMine
              ? "h-2 bg-gradient-to-r from-[#e0530a]/30 via-[#e0530a] to-[#e0530a]/30"
              : "h-1.5 bg-gradient-to-r from-[#e0530a]/15 via-[#e0530a]/65 to-[#e0530a]/15"
          }`}
        />
      </div>

      {/* Outer Board Frame */}
      <div
        className="w-full aspect-square bg-white rounded-2xl border-2 border-[#e6e3dc] shadow-sm p-2 sm:p-2.5"
        onContextMenu={(e) => {
          if (interactionMode === "wall" && !disabled) {
            e.preventDefault();
            onToggleOrientation();
          }
        }}
      >
        {/* Recessed Board Groove Canvas */}
        <div
          ref={boardInnerRef}
          role="grid"
          aria-label="Wall Maze 9 by 9 Board"
          className="relative w-full h-full rounded-xl bg-[#e7e2d8] overflow-visible"
        >
          {/* 1. 9x9 Tile Cells */}
          {Array.from({ length: GRID_SIZE }).map((_, r) =>
            Array.from({ length: GRID_SIZE }).map((__, c) => {
              const isValidTarget =
                !disabled &&
                interactionMode === "move" &&
                validMoveSet.has(`${r},${c}`);
              const isOrangeGoalRow = r === 0;
              const isBlueGoalRow = r === GRID_SIZE - 1;
              const isLastMoved =
                lastMovedPawnTarget?.row === r && lastMovedPawnTarget?.col === c;

              const activePawn = pawns[currentPlayer];
              const isJumpTarget =
                isValidTarget &&
                Math.abs(activePawn.row - r) + Math.abs(activePawn.col - c) === 2;

              return (
                <button
                  key={`cell-${r}-${c}`}
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${r + 1}, Column ${c + 1}${
                    isValidTarget
                      ? isJumpTarget
                        ? " (valid jump move)"
                        : " (valid move)"
                      : ""
                  }`}
                  disabled={!isValidTarget}
                  tabIndex={isValidTarget ? 0 : -1}
                  onClick={() => isValidTarget && onCellClick(r, c)}
                  style={{
                    left: `${c * STRIDE_PCT}%`,
                    top: `${r * STRIDE_PCT}%`,
                    width: `${CELL_PCT}%`,
                    height: `${CELL_PCT}%`,
                  }}
                  className={`absolute rounded-[5px] sm:rounded-md flex items-center justify-center transition-colors duration-150 outline-none ${
                    isValidTarget
                      ? currentPlayer === "X"
                        ? "bg-[#fff7ed] hover:bg-[#ffedd5] border border-[#fdba74] cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-[#e0530a]"
                        : "bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#93c5fd] cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                      : isOrangeGoalRow
                      ? "bg-[#fffaf4] border border-[#f5e3d3]"
                      : isBlueGoalRow
                      ? "bg-[#f6f9ff] border border-[#dce6fb]"
                      : isLastMoved
                      ? "bg-[#f3ede2] border border-[#c9bba6]"
                      : "bg-white border border-[#e6e3dc]/80"
                  }`}
                >
                  {isValidTarget && (
                    <span
                      aria-hidden="true"
                      className={`flex items-center justify-center rounded-full pointer-events-none ${
                        isJumpTarget
                          ? "w-[54%] h-[54%] border-2 animate-pulse"
                          : "w-[36%] h-[36%] animate-pulse"
                      }`}
                      style={{
                        backgroundColor: isJumpTarget ? "transparent" : activeColor,
                        borderColor: isJumpTarget ? activeColor : undefined,
                        opacity: 0.85,
                      }}
                    >
                      {isJumpTarget && (
                        <span
                          className="w-[46%] h-[46%] rounded-full"
                          style={{ backgroundColor: activeColor }}
                        />
                      )}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* 2. Subtle Visual Intersection Pips in Wall Mode */}
          {interactionMode === "wall" &&
            !disabled &&
            Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
              Array.from({ length: WALL_GRID_SIZE }).map((__, c) => (
                <span
                  key={`pip-${r}-${c}`}
                  aria-hidden="true"
                  style={{
                    left: `${c * STRIDE_PCT + CELL_PCT + GROOVE_PCT / 2}%`,
                    top: `${r * STRIDE_PCT + CELL_PCT + GROOVE_PCT / 2}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#9c978e]/45 pointer-events-none z-10"
                />
              ))
            )}

          {/* 3. Placed Walls */}
          {walls.map((w, idx) => {
            const geom = getWallGeometry(w.row, w.col, w.orientation);
            const isRecent =
              lastPlacedWall &&
              lastPlacedWall.row === w.row &&
              lastPlacedWall.col === w.col &&
              lastPlacedWall.orientation === w.orientation;

            return (
              <div
                key={`wall-${idx}-${w.row}-${w.col}-${w.orientation}`}
                aria-hidden="true"
                style={geom}
                className={`absolute z-20 rounded-full bg-[#1c1917] shadow-sm pointer-events-none flex items-center justify-center ${
                  isRecent
                    ? w.owner === "X"
                      ? "ring-2 ring-[#e0530a]/60"
                      : "ring-2 ring-[#2563eb]/60"
                    : "border border-[#0c0a09]"
                }`}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: w.orientation === "h" ? "26%" : "45%",
                    height: w.orientation === "h" ? "45%" : "26%",
                    backgroundColor:
                      w.owner === "X"
                        ? "#fb923c"
                        : w.owner === "O"
                        ? "#60a5fa"
                        : "#57534e",
                    opacity: 0.85,
                  }}
                />
              </div>
            );
          })}

          {/* 4. Ghost Wall Preview */}
          {interactionMode === "wall" && !disabled && ghostWall && (
            <div
              key={`ghost-${ghostWall.row}-${ghostWall.col}-${wallOrientation}-${invalidShakeKey}`}
              aria-hidden="true"
              style={getWallGeometry(ghostWall.row, ghostWall.col, wallOrientation)}
              className={`absolute z-30 rounded-full pointer-events-none transition-all duration-100 ${
                ghostValidation?.valid
                  ? "bg-[#10b981]/80 border-2 border-[#047857] shadow-md"
                  : "bg-[#ef4444]/80 border-2 border-[#b91c1c] shadow-md wall-shake"
              }`}
            />
          )}

          {/* 5. Pawns (GPU-composited transform transition for smooth movement & jumps) */}
          {(["X", "O"] as const).map((player) => {
            const pos = pawns[player];
            const isActive = currentPlayer === player;
            const isOrange = player === "X";
            const tx = pos.col * (1 + GROOVE_RATIO) * 100;
            const ty = pos.row * (1 + GROOVE_RATIO) * 100;

            return (
              <div
                key={`pawn-${player}`}
                aria-label={`${isOrange ? "Orange" : "Blue"} pawn at row ${pos.row + 1}, column ${pos.col + 1}`}
                style={{
                  left: 0,
                  top: 0,
                  width: `${CELL_PCT}%`,
                  height: `${CELL_PCT}%`,
                  transform: `translate3d(${tx}%, ${ty}%, 0)`,
                  transition: "transform 240ms cubic-bezier(0.34, 1.45, 0.64, 1)",
                }}
                className="absolute z-[25] pointer-events-none flex items-center justify-center motion-reduce:transition-none"
              >
                <div
                  className={`w-[74%] h-[74%] rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform duration-150 ${
                    isActive ? "scale-105" : "scale-95 opacity-95"
                  }`}
                  style={{
                    backgroundColor: isOrange ? "#e0530a" : "#2563eb",
                    boxShadow: isActive
                      ? isOrange
                        ? "0 0 0 2.5px rgba(224, 83, 10, 0.35), 0 3px 8px rgba(28, 25, 23, 0.22)"
                        : "0 0 0 2.5px rgba(37, 99, 235, 0.35), 0 3px 8px rgba(28, 25, 23, 0.22)"
                      : "0 2px 5px rgba(28, 25, 23, 0.18)",
                  }}
                >
                  <span className="w-[34%] h-[34%] rounded-full bg-white/40" />
                </div>
              </div>
            );
          })}

          {/* 6. Wall Mode Generous Intersection Touch/Hover Overlay */}
          {interactionMode === "wall" && !disabled && (
            <div
              className="absolute inset-0 z-40 cursor-crosshair touch-none"
              aria-label="Wall placement grid overlay"
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerUp}
              onPointerCancel={handleOverlayPointerCancel}
              onPointerLeave={handleOverlayPointerLeave}
            >
              {/* Accessible keyboard/assistive intersection buttons */}
              {Array.from({ length: WALL_GRID_SIZE }).map((_, r) =>
                Array.from({ length: WALL_GRID_SIZE }).map((__, c) => (
                  <button
                    key={`hit-${r}-${c}`}
                    type="button"
                    aria-label={`Place ${
                      wallOrientation === "h" ? "horizontal" : "vertical"
                    } wall at row ${r + 1}, column ${c + 1}`}
                    onFocus={() => onWallPreview(r, c, "keyboard")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onWallTapOrPlace(r, c, "keyboard");
                      }
                    }}
                    style={{
                      left: `${c * STRIDE_PCT + CELL_PCT + GROOVE_PCT / 2}%`,
                      top: `${r * STRIDE_PCT + CELL_PCT + GROOVE_PCT / 2}%`,
                      width: `${STRIDE_PCT}%`,
                      height: `${STRIDE_PCT}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 bg-transparent focus-visible:ring-2 focus-visible:ring-[#1c1917] rounded-md"
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Goal Strip — Blue Target (Row 8) */}
      <div className="w-full flex items-center justify-center gap-1.5 pt-1">
        <div
          className={`flex-1 rounded-full transition-all ${
            isBlueGoalMine
              ? "h-2 bg-gradient-to-r from-[#2563eb]/30 via-[#2563eb] to-[#2563eb]/30"
              : "h-1.5 bg-gradient-to-r from-[#2563eb]/15 via-[#2563eb]/65 to-[#2563eb]/15"
          }`}
        />
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${
            isBlueGoalMine ? "text-[#1e3a8a]" : "text-[#1d4ed8]"
          }`}
        >
          {isBlueGoalMine ? "★ Your Goal ▼" : "▼ Blue Goal"}
        </span>
        <div
          className={`flex-1 rounded-full transition-all ${
            isBlueGoalMine
              ? "h-2 bg-gradient-to-r from-[#2563eb]/30 via-[#2563eb] to-[#2563eb]/30"
              : "h-1.5 bg-gradient-to-r from-[#2563eb]/15 via-[#2563eb]/65 to-[#2563eb]/15"
          }`}
        />
      </div>
    </div>
  );
}
