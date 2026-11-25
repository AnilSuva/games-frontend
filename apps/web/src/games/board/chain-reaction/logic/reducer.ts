import type { ChainReactionAction, ChainReactionState } from "./types";
import { createInitialState, resolveMove } from "./rules";

export function chainReactionReducer(
  state: ChainReactionState,
  action: ChainReactionAction
): ChainReactionState {
  switch (action.type) {
    case "PLACE_ORB": {
      const { finalState } = resolveMove(state, action.row, action.col);
      return finalState;
    }
    case "RESET": {
      return createInitialState(action.startingPlayer ?? state.startingPlayer);
    }
    default:
      return state;
  }
}
