"use client";

import { useEffect, useRef } from "react";
import { SPIN_MOTION_CONFIG, SPIN_WHEEL_CONFIG, WHEEL_COLORS } from "../config";
import { createSpinMotion } from "../logic/spinMotion";
import {
  countSegmentBoundaryCrossings,
  nextSpinTickNumber,
} from "../logic/boundaryCrossings";
import { soundManager } from "@/platform/audio";
import type { Participant, WheelSegment } from "../types";

interface WheelDisplayProps {
  participants: Participant[];
  segments: WheelSegment[];
  rotation: number;
  spinDuration: number;
  isSpinning: boolean;
  winnerId?: string;
  onSpin: () => void;
  onSpinEnd: (propertyName: string) => void;
}

export function WheelDisplay({
  participants,
  segments,
  rotation,
  spinDuration,
  isSpinning,
  winnerId,
  onSpin,
  onSpinEnd,
}: WheelDisplayProps) {
  const wheelRef = useRef<SVGSVGElement>(null);
  const visualRotation = useRef(0);

  useEffect(() => {
    void soundManager.preloadSpinTicks();
  }, []);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    if (!isSpinning) {
      visualRotation.current = rotation;
      wheel.style.transform = `rotate(${rotation}deg)`;
      return;
    }

    const startRotation = visualRotation.current;
    const rotationDelta = rotation - startRotation;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion
      ? SPIN_MOTION_CONFIG.reducedMotionDurationMs
      : spinDuration;
    const motion = createSpinMotion(duration);
    wheel.style.willChange = "transform";
    let frame = 0;
    let startTime: number | null = null;
    let previousRotation = startRotation;
    let nextTickNumber = 1;
    let animationCompleted = false;

    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min(1, (time - startTime) / duration);
      const currentRotation = progress === 1
        ? rotation
        : startRotation + rotationDelta * motion.positionAt(progress);
      wheel.style.transform = `rotate(${currentRotation}deg)`;

      const crossings = countSegmentBoundaryCrossings(
        previousRotation,
        currentRotation,
        participants.length
      );
      for (let crossing = 0; crossing < crossings; crossing += 1) {
        soundManager.playSpinTick(nextTickNumber);
        nextTickNumber = nextSpinTickNumber(nextTickNumber);
      }
      previousRotation = currentRotation;

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        animationCompleted = true;
        visualRotation.current = rotation;
        wheel.style.willChange = "auto";
        onSpinEnd("transform");
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      if (!animationCompleted) soundManager.stopSpinTicks();
      wheel.style.willChange = "auto";
    };
  }, [isSpinning, onSpinEnd, participants.length, rotation, spinDuration]);

  const buttonAriaLabel = isSpinning
    ? "Wheel spinning"
    : participants.length
      ? "Spin the wheel"
      : "Add participants to spin the wheel";
  const labelFontSize = participants.length <= 4 ? 22 : participants.length <= 8 ? 18 : participants.length <= 12 ? 15 : 13;
  const labelLength = participants.length <= 4 ? 14 : participants.length <= 8 ? 10 : participants.length <= 12 ? 7 : 5;

  return (
    <div className="relative aspect-square w-[min(94vw,calc(100dvh-12rem),760px)] max-w-full">
      {/* Top pointer indicator */}
      <div
        className="absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 -translate-y-1 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#1c1917] drop-shadow-sm"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={onSpin}
        disabled={participants.length === 0 || isSpinning}
        aria-label={buttonAriaLabel}
        className="block w-full rounded-full disabled:cursor-not-allowed focus-visible:outline-offset-4"
      >
        <svg
          viewBox="0 0 500 500"
          ref={wheelRef}
          role="img"
          aria-label={`Wheel with ${participants.length} participant segments`}
          className="spin-wheel-svg block h-auto w-full overflow-visible rounded-full border-[6px] border-white bg-[#e8e4dc] shadow-[0_8px_24px_rgba(28,25,23,0.10)]"
          style={{
            transform: "rotate(0deg)",
          }}
        >
          {participants.length === 0 ? (
            <g>
              <circle cx="250" cy="250" r="240" fill="#eeece6" />
              <circle
                cx="250"
                cy="250"
                r="205"
                fill="none"
                stroke="#d2cecd"
                strokeDasharray="4 8"
              />
              <text
                x="250"
                y="244"
                textAnchor="middle"
                className="fill-[#6b665f] text-[18px]"
              >
                Add names
              </text>
              <text
                x="250"
                y="270"
                textAnchor="middle"
                className="fill-[#9c978e] text-[12px]"
              >
                to build your wheel
              </text>
            </g>
          ) : participants.length === 1 ? (
            <g>
              <circle cx="250" cy="250" r="240" fill={WHEEL_COLORS[0]} />
              <text
                x="250"
                y="194"
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                stroke="white"
                strokeWidth="3"
                paintOrder="stroke"
                className="fill-[#292521]"
              >
                {participants[0].name.length > 18
                  ? `${participants[0].name.slice(0, 17)}…`
                  : participants[0].name}
              </text>
            </g>
          ) : (
            segments.map((segment) => (
              <g key={segment.id}>
                <path
                  d={segment.path}
                  fill={winnerId === segment.id ? "#f3c76b" : segment.color}
                  stroke={winnerId === segment.id ? "#1c1917" : "white"}
                  strokeWidth={winnerId === segment.id ? 4 : 2}
                />
                {participants.length <= SPIN_WHEEL_CONFIG.maxVisibleLabels && (
                  <text
                    x="250"
                    y="82"
                    transform={`rotate(${segment.angle + 90} 250 250)`}
                    textAnchor="middle"
                    fontSize={labelFontSize}
                    fontWeight="700"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-[#292521]"
                  >
                    {segment.name.length > labelLength
                      ? `${segment.name.slice(0, labelLength - 1)}…`
                      : segment.name}
                  </text>
                )}
              </g>
            ))
          )}
          {/* Wheel center hub */}
          <circle
            cx="250"
            cy="250"
            r="24"
            fill="#fff"
            stroke="#1c1917"
            strokeWidth="3"
          />
          <circle cx="250" cy="250" r="7" fill="#1c1917" />
        </svg>
      </button>
    </div>
  );
}
