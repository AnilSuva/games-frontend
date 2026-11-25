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
  "ping-pong": React.lazy(
    () => import("@/games/arcade/ping-pong/components/PingPongGame")
  ),
  "knife-thrower": React.lazy(
    () => import("@/games/arcade/knife-thrower/components/KnifeThrowerGame")
  ),
  "star-catcher": React.lazy(
    () => import("@/games/arcade/star-catcher/components/StarCatcherGame")
  ),
  "dodge-arena": React.lazy(
    () => import("@/games/arcade/dodge-arena/components/DodgeArenaGame")
  ),
  "mini-golf-duel": React.lazy(
    () => import("@/games/arcade/mini-golf-duel/components/MiniGolfGame")
  ),
  "dots-and-boxes": React.lazy(
    () => import("@/games/board/dots-and-boxes/components/DotsAndBoxesGame")
  ),
  "chain-reaction": React.lazy(
    () => import("@/games/board/chain-reaction/components/ChainReactionGame")
  ),
  "wall-maze": React.lazy(
    () => import("@/games/board/wall-maze/components/WallMazeGame")
  ),
  "uno-no-mercy": React.lazy(
    () => import("@/games/board/uno-no-mercy/components/UnoNoMercyGame")
  ),
  "typing-race": React.lazy(
    () => import("@/games/arcade/typing-race/components/TypingRaceGame")
  ),
  "light-fingers": React.lazy(
    () => import("@/games/arcade/light-fingers/components/LightFingersGame")
  ),
};
