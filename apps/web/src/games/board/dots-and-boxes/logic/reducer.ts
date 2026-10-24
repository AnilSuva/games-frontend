/**
 * Dots and Boxes Pure Functional Reducer
 * Reverse-engineered from Two Player Games Challenge (57_DOTSBOXES)
 */

import {
  DEFAULT_CONFIG,
  createEmptyBoxes,
  createEmptyHorizontalEdges,
  createEmptyVerticalEdges,
} from "./board";
import { applyMove } from "./moves";
import type {
  DotsBoxesConfig,
  DotsBoxesState,
  Edge,
  PlatformPlayer,
} from "./types";

export type DotsBoxesAction =
  | { type: "CLAIM_EDGE"; edge: Edge; player?: PlatformPlayer }
  | {
      type: "RESTART_GAME";
      startingPlayer?: PlatformPlayer;
      config?: Partial<DotsBoxesConfig>;
    }
  | { type: "SET_STARTING_PLAYER"; player: PlatformPlayer }
  | { type: "SET_CONFIG"; config: Partial<DotsBoxesConfig> };

export function createInitialState(
  customConfig?: Partial<DotsBoxesConfig>,
  startingPlayer: PlatformPlayer = "orange"
): DotsBoxesState {
  const config: DotsBoxesConfig = {
    rows: customConfig?.rows ?? DEFAULT_CONFIG.rows,
    cols: customConfig?.cols ?? DEFAULT_CONFIG.cols,
  };

  return {
    config,
    horizontalEdges: createEmptyHorizontalEdges(config),
    verticalEdges: createEmptyVerticalEdges(config),
    boxes: createEmptyBoxes(config),
    scores: {
      orange: 0,
      blue: 0,
    },
    currentPlayer: startingPlayer,
    status: "in_progress",
    winner: null,
    lastMove: null,
    moveCount: 0,
    consecutiveBoxesThisTurn: 0,
  };
}

export function dotsBoxesReducer(
  state: DotsBoxesState,
  action: DotsBoxesAction
): DotsBoxesState {
  switch (action.type) {
    case "CLAIM_EDGE":
      return applyMove(state, action.edge, action.player ?? state.currentPlayer);

    case "RESTART_GAME":
      return createInitialState(
        action.config ?? state.config,
        action.startingPlayer ?? state.currentPlayer
      );

    case "SET_STARTING_PLAYER":
      if (state.moveCount === 0) {
        return {
          ...state,
          currentPlayer: action.player,
        };
      }
      return state;

    case "SET_CONFIG": {
      const newConfig: DotsBoxesConfig = {
        rows: action.config.rows ?? state.config.rows,
        cols: action.config.cols ?? state.config.cols,
      };
      return createInitialState(newConfig, state.currentPlayer);
    }

    default:
      return state;
  }
}
