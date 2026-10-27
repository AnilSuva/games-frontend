"use client";

import type { PlayerRaceStats, TypingRaceOnlinePlayer } from "@/platform/multiplayer/types";

export interface RaceTrackProps {
  orangeStats: PlayerRaceStats;
  blueStats: PlayerRaceStats;
  myRole: TypingRaceOnlinePlayer | null;
  winner: TypingRaceOnlinePlayer | null;
  isRacing: boolean;
  localProgress?: number;
}

function RaceCarSvg({
  color,
  isMoving,
  isFinished,
}: {
  color: "orange" | "blue";
  isMoving: boolean;
  isFinished: boolean;
}) {
  const isOrange = color === "orange";
  const primaryColor = isOrange ? "#f97316" : "#3b82f6";
  const accentColor = isOrange ? "#fbbf24" : "#60a5fa";
  const glowFilter = isOrange
    ? "drop-shadow(0 0 8px rgba(249,115,22,0.75))"
    : "drop-shadow(0 0 8px rgba(59,130,246,0.75))";

  return (
    <div
      className="relative flex items-center select-none"
      style={{ filter: glowFilter }}
    >
      {/* Exhaust Thruster Flame when typing / moving */}
      {isMoving && !isFinished && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 animate-pulse">
          <svg className="w-4 h-3 rotate-180" viewBox="0 0 16 12" fill="none">
            <polygon
              points="0,6 16,1 12,6 16,11"
              fill={isOrange ? "#fbbf24" : "#38bdf8"}
              fillOpacity="0.85"
            />
            <polygon
              points="2,6 12,3 9,6 12,9"
              fill="#ffffff"
            />
          </svg>
        </div>
      )}

      {/* Sleek Aerodynamic Race Car Silhouette */}
      <svg
        className="w-14 sm:w-16 h-8 sm:h-9"
        viewBox="0 0 72 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shadow underneath */}
        <ellipse cx="36" cy="33" rx="30" ry="3" fill="#000000" fillOpacity="0.45" />

        {/* Rear Wing / Spoiler */}
        <path
          d="M8 8 L16 8 L14 14 L6 14 Z"
          fill={accentColor}
          stroke="#090d16"
          strokeWidth="1"
        />
        <rect x="10" y="14" width="3" height="6" fill="#1e293b" />

        {/* Wheels with silver rims */}
        <circle cx="18" cy="27" r="7" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        <circle cx="18" cy="27" r="3" fill="#94a3b8" />
        <circle cx="54" cy="27" r="7" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        <circle cx="54" cy="27" r="3" fill="#94a3b8" />

        {/* Main Aerodynamic Chassis */}
        <path
          d="M6 22 L14 16 L26 12 L44 12 L58 18 L68 24 L68 27 L6 27 Z"
          fill={primaryColor}
          stroke="#090d16"
          strokeWidth="1.5"
        />

        {/* Hood & Side Decal Stripe */}
        <path
          d="M24 16 L46 16 L60 21 L54 23 L22 23 Z"
          fill={accentColor}
          fillOpacity="0.85"
        />

        {/* Cockpit Canopy Glass with Specular Glare */}
        <path
          d="M27 13 L39 13 L47 17 L25 17 Z"
          fill="#0f172a"
          stroke="#1e293b"
          strokeWidth="1"
        />
        <path
          d="M28 14 L37 14 L44 17 L30 17 Z"
          fill="#38bdf8"
          fillOpacity="0.35"
        />

        {/* Headlight Beam */}
        <polygon points="68,23 72,24 68,26" fill="#fef08a" />
        <circle cx="67" cy="24.5" r="1.5" fill="#ffffff" />
      </svg>
    </div>
  );
}

export function RaceTrack({
  orangeStats,
  blueStats,
  myRole,
  winner,
  isRacing,
  localProgress,
}: RaceTrackProps) {
  const isMeOrange = myRole === "orange";
  const isMeBlue = myRole === "blue";

  // Calculate track travel clamping: 0% to 100%, incorporating local real-time typing progress
  const orangeProgress = Math.max(
    0,
    Math.min(
      1,
      isMeOrange && localProgress !== undefined
        ? Math.max(orangeStats.progress || 0, localProgress)
        : orangeStats.progress || 0
    )
  );
  const blueProgress = Math.max(
    0,
    Math.min(
      1,
      isMeBlue && localProgress !== undefined
        ? Math.max(blueStats.progress || 0, localProgress)
        : blueStats.progress || 0
    )
  );

  return (
    <div className="w-full flex flex-col gap-2 rounded-2xl bg-[#090d16] border border-slate-700/60 shadow-[0_4px_25px_rgba(0,0,0,0.7)] p-3 sm:p-4 select-none relative overflow-hidden">
      {/* Background Track Grid and Speed Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="w-full h-full bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* Track Header & Distance Markers */}
      <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pb-1 border-b border-slate-800">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-slate-300 uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
          Circuit Sprint (45 Words)
        </span>
        <div className="hidden sm:flex items-center gap-8 text-[10px] text-slate-500 font-mono">
          <span>START</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span className="text-amber-400 font-bold">FINISH</span>
        </div>
      </div>

      {/* Main Dual-Lane Asphalt Race Track */}
      <div className="relative w-full rounded-xl bg-[#11141c] border-2 border-slate-800 shadow-inner overflow-hidden py-1">
        {/* Distance Tick Lines */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-16 sm:px-20 z-0">
          <div className="w-px h-full bg-slate-700/30" />
          <div className="w-px h-full bg-slate-700/30" />
          <div className="w-px h-full bg-slate-700/30" />
        </div>

        {/* Checkered Finish Line Banner at right edge */}
        <div className="absolute top-0 bottom-0 right-6 sm:right-8 w-4 flex flex-col z-10 opacity-90 pointer-events-none border-x border-white/20 shadow-md">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 flex">
              <div className={`w-1/2 h-full ${i % 2 === 0 ? "bg-white" : "bg-black"}`} />
              <div className={`w-1/2 h-full ${i % 2 === 0 ? "bg-black" : "bg-white"}`} />
            </div>
          ))}
        </div>

        {/* ─── LANE 1: ORANGE (P1 / Host) ──────────────────────────────── */}
        <div className="relative w-full h-14 sm:h-16 flex items-center px-2 border-b border-dashed border-slate-700/50">
          {/* Lane Side Badge */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/50 text-[10px] sm:text-[11px] font-bold text-orange-400 font-mono uppercase tracking-tight">
              {isMeOrange ? "You (Orange)" : "Rival (Orange)"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">
              {orangeStats.wpm} WPM • {Math.round(orangeProgress * 100)}%
            </span>
          </div>

          {/* Orange Car Motion Track Runner: runs from start (left) to checkered line (right) */}
          <div className="absolute left-28 sm:left-32 right-12 sm:right-14 top-0 bottom-0 pointer-events-none">
            <div
              className="absolute top-1/2 transition-[left] duration-150 ease-out z-20"
              style={{
                left: `${orangeProgress * 100}%`,
                transform: `translate(-${orangeProgress * 100}%, -50%)`,
              }}
            >
              <RaceCarSvg
                color="orange"
                isMoving={isRacing && orangeProgress > 0}
                isFinished={orangeStats.isFinished}
              />
              {winner === "orange" && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] font-mono shadow-md animate-bounce whitespace-nowrap">
                  WINNER! 🏆
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── LANE 2: BLUE (P2 / Guest) ───────────────────────────────── */}
        <div className="relative w-full h-14 sm:h-16 flex items-center px-2">
          {/* Lane Side Badge */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/50 text-[10px] sm:text-[11px] font-bold text-blue-400 font-mono uppercase tracking-tight">
              {isMeBlue ? "You (Blue)" : "Rival (Blue)"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">
              {blueStats.wpm} WPM • {Math.round(blueProgress * 100)}%
            </span>
          </div>

          {/* Blue Car Motion Track Runner */}
          <div className="absolute left-28 sm:left-32 right-12 sm:right-14 top-0 bottom-0 pointer-events-none">
            <div
              className="absolute top-1/2 transition-[left] duration-150 ease-out z-20"
              style={{
                left: `${blueProgress * 100}%`,
                transform: `translate(-${blueProgress * 100}%, -50%)`,
              }}
            >
              <RaceCarSvg
                color="blue"
                isMoving={isRacing && blueProgress > 0}
                isFinished={blueStats.isFinished}
              />
              {winner === "blue" && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] font-mono shadow-md animate-bounce whitespace-nowrap">
                  WINNER! 🏆
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
