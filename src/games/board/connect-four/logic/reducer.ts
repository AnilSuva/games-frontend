import {
  getLandingRow,
  getWinningLineAt,
  incrementColumnCount,
  isBoardFull,
  isColumnFull,
  isValidColumn,
  placeDisc,
} from "./rules";
import type {
  CellValue,
  ConnectFourAction,
  ConnectFourState,
  Player,
} from "./types";

/**
 * Creates the clean initial state for a new match.
 */
export function createInitialState(
  startingPlayer: Player = "R"
): ConnectFourState {
  return {
    board: Array(42).fill(null),
    columnCounts: [0, 0, 0, 0, 0, 0, 0],
    currentPlayer: startingPlayer,
    status: "in_progress",
    winner: null,
    winningLine: null,
    moveCount: 0,
  };
}

/**
 * Pure, deterministic reducer managing Connect Four state transitions.
 * Zero side-effects, zero DOM dependencies.
 */
export function connectFourReducer(
  state: ConnectFourState,
  action: ConnectFourAction
): ConnectFourState {
  switch (action.type) {
    case "DROP": {
      const { column } = action;

      // 1. Guard: reject moves if game is already over
      if (state.status !== "in_progress") {
        return state;
      }

      // 2. Guard: reject out-of-range columns
      if (!isValidColumn(column)) {
        return state;
      }

      // 3. Guard: reject full columns
      if (isColumnFull(state.columnCounts, column)) {
        return state;
      }

      // 4. Compute landing row and apply the drop
      const row = getLandingRow(state.columnCounts, column);
      const player: CellValue = state.currentPlayer;
      const nextBoard = placeDisc(state.board, row, column, player);
      const nextColumnCounts = incrementColumnCount(state.columnCounts, column);
      const nextMoveCount = state.moveCount + 1;

      // 5. Check for a winning combination at the dropped cell
      const winResult = getWinningLineAt(nextBoard, row, column, player as Player);
      if (winResult) {
        return {
          board: nextBoard,
          columnCounts: nextColumnCounts,
          currentPlayer: state.currentPlayer,
          status: "won",
          winner: player as Player,
          winningLine: winResult,
          moveCount: nextMoveCount,
        };
      }

      // 6. Check for draw condition (board completely full)
      if (isBoardFull(nextColumnCounts)) {
        return {
          board: nextBoard,
          columnCounts: nextColumnCounts,
          currentPlayer: state.currentPlayer,
          status: "draw",
          winner: null,
          winningLine: null,
          moveCount: nextMoveCount,
        };
      }

      // 7. Advance turn to next player
      const nextPlayer: Player = state.currentPlayer === "R" ? "Y" : "R";
      return {
        board: nextBoard,
        columnCounts: nextColumnCounts,
        currentPlayer: nextPlayer,
        status: "in_progress",
        winner: null,
        winningLine: null,
        moveCount: nextMoveCount,
      };
    }

    case "RESET": {
      return createInitialState(action.startingPlayer ?? "R");
    }

    default:
      return state;
  }
}