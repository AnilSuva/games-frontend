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
  "connect-four": React.lazy(
    () => import("@/games/board/connect-four/components/ConnectFourGame")
  ),
  "brick-blast": React.lazy(
    () => import("@/games/arcade/brick-blast/components/BrickBlastGame")
  ),
  checkers: React.lazy(
    () => import("@/games/board/checkers/components/CheckersGame")
  ),
};
