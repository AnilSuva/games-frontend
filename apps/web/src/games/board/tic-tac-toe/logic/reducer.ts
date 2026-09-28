import {
  checkWinningLine,
  createEmptyBoard,
  isBoardFull,
  isValidMove,
  placeMark,
} from "./rules";
import type { Player, TicTacToeAction, TicTacToeState } from "./types";

/**
 * Creates the clean initial state for a new match.
 */
export function createInitialState(startingPlayer: Player = "X"): TicTacToeState {
  return {
    board: createEmptyBoard(),
    currentPlayer: startingPlayer,
    status: "in_progress",
    winner: null,
    winningLine: null,
    moveCount: 0,
  };
}

/**
 * Pure, deterministic reducer managing Tic-Tac-Toe state transitions.
 * Zero side-effects, zero DOM dependencies.
 */
export function ticTacToeReducer(
  state: TicTacToeState,
  action: TicTacToeAction
): TicTacToeState {
  switch (action.type) {
    case "MAKE_MOVE": {
      const { cellIndex } = action;

      // 1. Guard: reject moves if game is already over
      if (state.status !== "in_progress") {
        return state;
      }

      // 2. Guard: reject invalid index or already occupied cell
      if (!isValidMove(state.board, cellIndex)) {
        return state;
      }

      // 3. Apply move to board
      const nextBoard = placeMark(state.board, cellIndex, state.currentPlayer);
      const nextMoveCount = state.moveCount + 1;

      // 4. Check for winning combination
      const winResult = checkWinningLine(nextBoard);
      if (winResult) {
        return {
          board: nextBoard,
          currentPlayer: state.currentPlayer,
          status: "won",
          winner: state.currentPlayer,
          winningLine: winResult,
          moveCount: nextMoveCount,
        };
      }

      // 5. Check for draw condition
      if (isBoardFull(nextBoard)) {
        return {
          board: nextBoard,
          currentPlayer: state.currentPlayer,
          status: "draw",
          winner: null,
          winningLine: null,
          moveCount: nextMoveCount,
        };
      }

      // 6. Advance turn to next player
      const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
      return {
        board: nextBoard,
        currentPlayer: nextPlayer,
        status: "in_progress",
        winner: null,
        winningLine: null,
        moveCount: nextMoveCount,
      };
    }

    case "RESET": {
      return createInitialState(action.startingPlayer ?? "X");
    }

    default:
      return state;
  }
}
