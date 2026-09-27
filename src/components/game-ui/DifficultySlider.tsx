"use client";

import { useId, useCallback, useRef } from "react";
import { soundManager } from "@/platform/audio";

interface DifficultySliderProps<T extends string = string> {
  /** Ordered list of difficulty values from lowest to highest */
  values: readonly T[];
  /** Currently selected value */
  value: T;
  /** Callback when user selects a new value */
  onChange: (value: T) => void;
  /** Accessible label for the slider */
  label?: string;
}

/**
 * A generic stepped slider for selecting from an ordered list of values.
 * Reusable across any game needing difficulty or level selection.
 *
 * Example usage:
 *   <DifficultySlider values={["easy", "medium", "hard"]} value={difficulty} onChange={setDifficulty} />
 */
export function DifficultySlider<T extends string = string>({
  values,
  value,
  onChange,
  label = "Difficulty",
}: DifficultySliderProps<T>) {
  const sliderId = useId();
  const innerTrackRef = useRef<HTMLDivElement | null>(null);
  const currentIndex = values.indexOf(value);
  const maxIndex = values.length - 1;

  // Compute percentage position for a given index
  const getPercentage = (index: number) =>
    maxIndex === 0 ? "50%" : `${(index / maxIndex) * 100}%`;

  const currentPercentage = getPercentage(currentIndex >= 0 ? currentIndex : 0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        const nextIndex = Math.min(maxIndex, currentIndex + 1);
        onChange(values[nextIndex]);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        const prevIndex = Math.max(0, currentIndex - 1);
        onChange(values[prevIndex]);
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(values[0]);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(values[maxIndex]);
      }
    },
    [currentIndex, maxIndex, onChange, values]
  );

  const updateFromPointer = useCallback(
    (clientX: number) => {
      if (!innerTrackRef.current || maxIndex === 0) return;
      const rect = innerTrackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const nearestIndex = Math.round(ratio * maxIndex);
      onChange(values[nearestIndex]);
    },
    [maxIndex, onChange, values]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.pointerType !== "touch") return;
    updateFromPointer(e.clientX);
  };

  return (
    <div className="w-full max-w-xs space-y-3 select-none">
      {/* Labels Row */}
      <div className="relative w-full h-5 text-xs font-medium px-4">
        <div className="relative w-full h-full">
          {values.map((val, index) => {
            const isSelected = val === value;
            return (
              <button
                key={val}
                type="button"
                onClick={() => {
                  if (val !== value) {
                    soundManager.play("buttonClick");
                  }
                  onChange(val);
                }}
                style={{ left: getPercentage(index) }}
                className={`absolute top-0 -translate-x-1/2 capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:underline cursor-pointer ${
                  isSelected
                    ? "text-[#1c1917] font-semibold"
                    : "text-[#9c978e] sm:hover:text-[#6b665f]"
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accessible Slider Control */}
      <div
        id={sliderId}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maxIndex}
        aria-valuenow={currentIndex >= 0 ? currentIndex : 0}
        aria-valuetext={value}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="relative h-8 flex items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] focus-visible:ring-offset-2 rounded-full px-4 touch-none"
      >
        {/* Track geometry */}
        <div ref={innerTrackRef} className="relative w-full h-1.5 flex items-center">
          {/* Inactive base track */}
          <div className="absolute inset-0 bg-[#eeece6] rounded-full" />

          {/* Active highlight track */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#1c1917] rounded-full transition-all duration-150 motion-reduce:transition-none"
            style={{ width: currentPercentage }}
          />

          {/* Stop markers */}
          {values.map((val, index) => {
            const isFilled = index <= currentIndex;
            return (
              <span
                key={val}
                style={{ left: getPercentage(index) }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full pointer-events-none transition-colors duration-150 ${
                  isFilled ? "bg-[#1c1917]" : "bg-[#d2cecd]"
                }`}
              />
            );
          })}

          {/* Slider Thumb */}
          <div
            style={{ left: currentPercentage }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-[#1c1917] shadow-sm flex items-center justify-center pointer-events-none transition-all duration-150 ease-out motion-reduce:transition-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
          </div>
        </div>
      </div>
    </div>
  );
}
