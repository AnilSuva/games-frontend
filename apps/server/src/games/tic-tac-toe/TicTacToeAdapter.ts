import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import {
  checkWinningLine,
  createEmptyBoard,
  isBoardFull,
  isValidMove,
  placeMark,
} from "./rules.js";
import type {
  PlayerMark,
  TicTacToeAction,
  TicTacToeGameState,
} from "./types.js";

export interface CreateTicTacToeOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlayerMark;
}

export class TicTacToeAdapter
  implements GameAdapter<TicTacToeGameState, TicTacToeAction>
{
  public readonly gameId = "tic-tac-toe";

  public createInitialState(options?: Record<string, unknown>): TicTacToeGameState {
    const opts = (options ?? {}) as CreateTicTacToeOptions;
    const playerMarks: Record<string, PlayerMark> = {};

    if (opts.hostPlayerId) {
      playerMarks[opts.hostPlayerId] = "X";
    }
    if (opts.guestPlayerId) {
      playerMarks[opts.guestPlayerId] = "O";
    }

    const startingPlayer: PlayerMark = opts.startingPlayer ?? "X";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      board: createEmptyBoard(),
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      winningLine: null,
      moveCount: 0,
      playerMarks,
      rematchRequests: [],
    };
  }

  public validateAction(
    state: TicTacToeGameState,
    action: TicTacToeAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "MOVE") {
      if (state.status !== "in_progress") {
        return {
          valid: false,
          error: "Game is not in progress",
        };
      }

      if (state.disconnectGraceExpiresAt && state.disconnectGraceExpiresAt > Date.now()) {
        return {
          valid: false,
          error: "Match is paused while waiting for opponent to reconnect",
        };
      }

      const playerMark = state.playerMarks[playerId];
      if (!playerMark) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      if (playerMark !== state.currentPlayer) {
        return {
          valid: false,
          error: "It is not your turn",
        };
      }

      if (!isValidMove(state.board, action.position)) {
        return {
          valid: false,
          error: "Invalid move position",
        };
      }

      return { valid: true };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "draw") {
        return {
          valid: false,
          error: "Game is still in progress",
        };
      }

      if (!state.playerMarks[playerId]) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      return { valid: true };
    }

    return {
      valid: false,
      error: "Unknown action type",
    };
  }

  public applyAction(
    state: TicTacToeGameState,
    action: TicTacToeAction,
    playerId: string
  ): ActionResult<TicTacToeGameState> {
    if (action.type === "MOVE") {
      const playerMark = state.playerMarks[playerId];
      const nextBoard = placeMark(state.board, action.position, playerMark);
      const moveCount = state.moveCount + 1;
      const winningLine = checkWinningLine(nextBoard);

      if (winningLine) {
        const nextState: TicTacToeGameState = {
          ...state,
          board: nextBoard,
          status: "won",
          winner: playerMark,
          winningLine,
          moveCount,
          resultReason: "win",
        };
        return {
          nextState,
          result: {
            status: "won",
            winner: playerMark,
            winningLine,
          },
        };
      }

      if (isBoardFull(nextBoard)) {
        const nextState: TicTacToeGameState = {
          ...state,
          board: nextBoard,
          status: "draw",
          winner: null,
          winningLine: null,
          moveCount,
          resultReason: "draw",
        };
        return {
          nextState,
          result: {
            status: "draw",
            winner: null,
            winningLine: null,
          },
        };
      }

      const nextPlayer: PlayerMark = playerMark === "X" ? "O" : "X";
      const nextState: TicTacToeGameState = {
        ...state,
        board: nextBoard,
        currentPlayer: nextPlayer,
        moveCount,
      };
      return { nextState };
    }

    if (action.type === "REMATCH") {
      const alreadyRequested = state.rematchRequests.includes(playerId);
      const nextRematchRequests = alreadyRequested
        ? state.rematchRequests
        : [...state.rematchRequests, playerId];

      const registeredPlayers = Object.keys(state.playerMarks);
      const bothReady =
        registeredPlayers.length >= 2 &&
        registeredPlayers.every((pid) => nextRematchRequests.includes(pid));

      if (bothReady) {
        const nextStarting: PlayerMark = state.startingPlayer === "X" ? "O" : "X";
        const nextState: TicTacToeGameState = {
          board: createEmptyBoard(),
          currentPlayer: nextStarting,
          startingPlayer: nextStarting,
          status: "in_progress",
          winner: null,
          winningLine: null,
          moveCount: 0,
          playerMarks: state.playerMarks,
          rematchRequests: [],
        };
        return { nextState };
      }

      const nextState: TicTacToeGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }
}
