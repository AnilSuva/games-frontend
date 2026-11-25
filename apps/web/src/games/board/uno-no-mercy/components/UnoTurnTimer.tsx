"use client";

import { useEffect, useRef, useState } from "react";
import { soundManager } from "@/platform/audio";
import { formatCountdown } from "../logic/uiHelpers";

interface UnoTurnTimerProps {
  turnDeadlineAt: number | null;
  totalTimeoutMs: number;
  isMyTurn: boolean;
  compact?: boolean;
}

export function UnoTurnTimer({
  turnDeadlineAt,
  totalTimeoutMs,
  isMyTurn,
  compact = false,
}: UnoTurnTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    turnDeadlineAt ? Math.max(0, turnDeadlineAt - Date.now()) : totalTimeoutMs
  );
  const warnedAt15Ref = useRef<number | null>(null);
  const warnedAt5Ref = useRef<number | null>(null);

  useEffect(() => {
    if (!turnDeadlineAt) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      const rem = Math.max(0, turnDeadlineAt - Date.now());
      setRemainingMs(rem);

      if (isMyTurn) {
        if (rem <= 15_000 && rem > 10_000 && warnedAt15Ref.current !== turnDeadlineAt) {
          warnedAt15Ref.current = turnDeadlineAt;
          soundManager.play("dropBall");
        }
        if (rem <= 5_000 && rem > 0 && warnedAt5Ref.current !== turnDeadlineAt) {
          warnedAt5Ref.current = turnDeadlineAt;
          soundManager.play("dropBall");
        }
      }
    };

    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [turnDeadlineAt, isMyTurn]);

  if (!turnDeadlineAt) return null;

  const pct = Math.max(0, Math.min(100, (remainingMs / Math.max(1, totalTimeoutMs)) * 100));
  const isCritical = remainingMs <= 15_000;
  const isWarning = !isCritical && remainingMs <= 30_000;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
          isCritical
            ? "bg-rose-100 text-rose-700 animate-pulse"
            : isWarning
            ? "bg-amber-100 text-amber-800"
            : "bg-stone-100 text-stone-700"
        }`}
      >
        {formatCountdown(remainingMs)}
      </span>
    );
  }

  return (
    <div className="w-full flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#e6e3dc] overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${
            isCritical
              ? "bg-rose-600 animate-pulse"
              : isWarning
              ? "bg-amber-500"
              : "bg-stone-700"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
          isCritical
            ? "text-rose-600 animate-pulse"
            : isWarning
            ? "text-amber-600"
            : "text-[#6b665f]"
        }`}
      >
        {formatCountdown(remainingMs)}
      </span>
    </div>
  );
}
