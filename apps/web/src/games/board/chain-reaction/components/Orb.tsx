import React from "react";
import type { Player } from "../logic/types";

interface OrbProps {
  count: number;
  owner: Player | null;
  isNearCritical?: boolean;
}

export function Orb({ count, owner, isNearCritical = false }: OrbProps) {
  if (count <= 0 || !owner) return null;

  const isOrange = owner === "X";
  const primaryColor = isOrange ? "#e0530a" : "#2563eb";
  const lightColor = isOrange ? "#ffedd5" : "#dbeafe";
  const shadowColor = isOrange ? "rgba(224, 83, 10, 0.35)" : "rgba(37, 99, 235, 0.35)";

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none pointer-events-none transition-transform duration-200 ${
        isNearCritical ? "chain-wobble" : ""
      }`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 60 60"
        className="w-[82%] h-[82%] max-w-[50px] max-h-[50px] drop-shadow-sm overflow-visible"
      >
        <defs>
          <radialGradient id={`orbGrad-${owner}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor={lightColor} stopOpacity="0.9" />
            <stop offset="35%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={isOrange ? "#9a3412" : "#1e40af"} />
          </radialGradient>
          <filter id={`orbGlow-${owner}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor={shadowColor} />
          </filter>
        </defs>

        {count === 1 && (
          <circle
            cx="30"
            cy="30"
            r="14"
            fill={`url(#orbGrad-${owner})`}
            filter={`url(#orbGlow-${owner})`}
            className="transition-all duration-200"
          />
        )}

        {count === 2 && (
          <g filter={`url(#orbGlow-${owner})`}>
            <circle
              cx="22"
              cy="25"
              r="11"
              fill={`url(#orbGrad-${owner})`}
              className="transition-all duration-200"
            />
            <circle
              cx="38"
              cy="35"
              r="11"
              fill={`url(#orbGrad-${owner})`}
              className="transition-all duration-200"
            />
          </g>
        )}

        {count >= 3 && (
          <g filter={`url(#orbGlow-${owner})`}>
            <circle
              cx="30"
              cy="19"
              r="10"
              fill={`url(#orbGrad-${owner})`}
              className="transition-all duration-200"
            />
            <circle
              cx="19"
              cy="38"
              r="10"
              fill={`url(#orbGrad-${owner})`}
              className="transition-all duration-200"
            />
            <circle
              cx="41"
              cy="38"
              r="10"
              fill={`url(#orbGrad-${owner})`}
              className="transition-all duration-200"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
