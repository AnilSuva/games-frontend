import React from "react";
import type { GameHostProps } from "@/games/common/types";

/**
 * Static module-level lazy bindings.
 * Code-split boundaries are established at module load time,
 * satisfying React 19 static component rules and eliminating re-creation during render.
 */
export const CARTRIDGE_MAP: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<GameHostProps>>
> = {
  "tic-tac-toe": React.lazy(
    () => import("@/games/board/tic-tac-toe/components/TicTacToeGame")
  ),
  "brick-blast": React.lazy(
    () => import("@/games/arcade/brick-blast/preview/BrickBlastPreview")
  ),
};
