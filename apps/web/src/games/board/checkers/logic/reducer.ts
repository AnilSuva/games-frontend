/**
 * Pure, deterministic reducer managing Checkers (Draughts) state transitions.
 * Zero side-effects, zero DOM or React dependencies.
 */

import {
  BLUE_KING,
  BLUE_MAN,
  BOARD_SIZE,
  EMPTY,
  ORANGE_KING,
  ORANGE_MAN,
  type CheckersAction,
  type CheckersMove,
  type CheckersState,
  type PlatformPlayer,
} from "./types";
import {
  createInitialBoard,
  getJumpsForPiece,
  getValidMoves,
  isValidIndex,
  toRow,
} from "./moves";

/**
 * Creates the clean initial state for a new Checkers match.
 */
export function createInitialState(
  startingPlayer: PlatformPlayer = "orange"
): CheckersState {
  return {
    board: createInitialBoard(),
    currentPlayer: startingPlayer,
    status: "in_progress",
    winner: null,
    activePiece: null,
    orangeCaptures: 0,
    blueCaptures: 0,
    moveCount: 0,
    lastMove: null,
  };
}

/**
 * Pure reducer managing Checkers game state transitions.
 */
export function checkersReducer(
  state: CheckersState,
  action: CheckersAction
): CheckersState {
  switch (action.type) {
    case "RESET": {
      return createInitialState(action.startingPlayer ?? "orange");
    }

    case "MOVE": {
      const { from, to } = action;

      // 1. Guard: match must be in progress
      if (state.status !== "in_progress") {
        return state;
      }

      // 2. Guard: coordinates must be valid
      if (!isValidIndex(from) || !isValidIndex(to)) {
        return state;
      }

      // 3. Find matching legal move in current valid moves
      const validMoves = getValidMoves(state);
      const move = validMoves.find((m) => m.from === from && m.to === to);
      if (!move) {
        return state; // Illegal move: preserve state reference
      }

      // 4. Create new board and execute move
      const nextBoard = [...state.board];
      const movingPiece = nextBoard[from];
      nextBoard[from] = EMPTY;

      let finalPiece = movingPiece;
      let isPromoted = false;

      // Check king promotion
      const toRowCoord = toRow(to);
      if (movingPiece === ORANGE_MAN && toRowCoord === 0) {
        finalPiece = ORANGE_KING;
        isPromoted = true;
      } else if (movingPiece === BLUE_MAN && toRowCoord === BOARD_SIZE - 1) {
        finalPiece = BLUE_KING;
        isPromoted = true;
      }

      nextBoard[to] = finalPiece;

      // Remove jumped piece if this was a capture
      if (move.isJump && move.jumpedIndex !== undefined) {
        nextBoard[move.jumpedIndex] = EMPTY;
      }

      // Update captures count
      let orangeCaptures = state.orangeCaptures;
      let blueCaptures = state.blueCaptures;
      if (move.isJump) {
        if (state.currentPlayer === "orange") {
          orangeCaptures += 1;
        } else {
          blueCaptures += 1;
        }
      }

      const nextMoveCount = state.moveCount + 1;
      const lastMove: CheckersMove = {
        from,
        to,
        isJump: move.isJump,
        jumpedIndex: move.jumpedIndex,
      };

      // 5. Multi-jump continuation check:
      // In standard Checkers:
      // - If a jump was executed, AND the piece was NOT just crowned on this move,
      // - AND further jumps are available from the landing square,
      // the turn does NOT end. Active piece stays at `to`.
      if (move.isJump && !isPromoted) {
        const furtherJumps = getJumpsForPiece(nextBoard, to, state.currentPlayer);
        if (furtherJumps.length > 0) {
          return {
            ...state,
            board: nextBoard,
            activePiece: to,
            orangeCaptures,
            blueCaptures,
            moveCount: nextMoveCount,
            lastMove,
          };
        }
      }

      // 6. Turn completed: switch player
      const nextPlayer: PlatformPlayer =
        state.currentPlayer === "orange" ? "blue" : "orange";

      const candidateState: CheckersState = {
        board: nextBoard,
        currentPlayer: nextPlayer,
        status: "in_progress",
        winner: null,
        activePiece: null,
        orangeCaptures,
        blueCaptures,
        moveCount: nextMoveCount,
        lastMove,
      };

      // 7. Check win condition for nextPlayer (either eliminated or stalemate/no moves)
      const nextPlayerMoves = getValidMoves(candidateState);
      if (nextPlayerMoves.length === 0) {
        return {
          ...candidateState,
          status: "won",
          winner: state.currentPlayer,
        };
      }

      return candidateState;
    }

    default:
      return state;
  }
}
