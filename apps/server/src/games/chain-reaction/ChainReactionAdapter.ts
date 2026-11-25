import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import {
  COLS,
  ROWS,
  countOrbs,
  createEmptyBoard,
  isValidMove,
  resolveServerMove,
} from "./rules.js";
import type {
  ChainReactionAction,
  ChainReactionGameState,
  Player,
} from "./types.js";

export interface CreateChainReactionOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: Player;
}

export class ChainReactionAdapter
  implements GameAdapter<ChainReactionGameState, ChainReactionAction>
{
  public readonly gameId = "chain-reaction";

  public createInitialState(options?: Record<string, unknown>): ChainReactionGameState {
    const opts = (options ?? {}) as CreateChainReactionOptions;
    const playerRoles: Record<string, Player> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "X";
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "O";
    }

    const startingPlayer: Player = opts.startingPlayer ?? "X";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      board: createEmptyBoard(),
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      movesPlayed: 0,
      moveNumber: 0,
      lastMove: null,
      orbCounts: { X: 0, O: 0 },
      playerRoles,
      rematchRequests: [],
    };
  }

  public validateAction(
    state: ChainReactionGameState,
    action: ChainReactionAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "PLACE_ORB" || action.type === "MOVE") {
      if (state.status !== "in_progress") {
        return {
          valid: false,
          error: "Game is not in progress",
        };
      }

      if (
        state.disconnectGraceExpiresAt &&
        state.disconnectGraceExpiresAt > Date.now()
      ) {
        return {
          valid: false,
          error: "Match is paused while waiting for opponent to reconnect",
        };
      }

      const playerRole = state.playerRoles[playerId];
      if (!playerRole) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      if (playerRole !== state.currentPlayer) {
        return {
          valid: false,
          error: "It is not your turn",
        };
      }

      let row: number | undefined;
      let col: number | undefined;

      if ("row" in action && "col" in action && action.row !== undefined && action.col !== undefined) {
        row = action.row;
        col = action.col;
      } else if ("position" in action && typeof action.position === "number") {
        row = Math.floor(action.position / COLS);
        col = action.position % COLS;
      }

      if (row === undefined || col === undefined) {
        return {
          valid: false,
          error: "Missing move coordinates",
        };
      }

      if (!isValidMove(state.board, row, col, playerRole)) {
        return {
          valid: false,
          error: "Invalid move: cell is out of bounds or occupied by opponent",
        };
      }

      return { valid: true };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "abandoned") {
        return {
          valid: false,
          error: "Game is still in progress",
        };
      }

      if (!state.playerRoles[playerId]) {
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
    state: ChainReactionGameState,
    action: ChainReactionAction,
    playerId: string
  ): ActionResult<ChainReactionGameState> {
    if (action.type === "PLACE_ORB" || action.type === "MOVE") {
      const playerRole = state.playerRoles[playerId];
      let row = 0;
      let col = 0;

      if ("row" in action && "col" in action && action.row !== undefined && action.col !== undefined) {
        row = action.row;
        col = action.col;
      } else if ("position" in action && typeof action.position === "number") {
        row = Math.floor(action.position / COLS);
        col = action.position % COLS;
      }

      const nextMovesPlayed = state.movesPlayed + 1;
      const nextMoveNumber = state.moveNumber + 1;

      const { nextBoard, winner, isFinished } = resolveServerMove(
        state.board,
        row,
        col,
        playerRole,
        nextMovesPlayed
      );

      const nextOrbCounts = countOrbs(nextBoard);
      const nextLastMove = {
        row,
        col,
        player: playerRole,
        moveNumber: nextMoveNumber,
      };

      if (isFinished && winner) {
        const nextState: ChainReactionGameState = {
          ...state,
          board: nextBoard,
          status: "won",
          winner,
          movesPlayed: nextMovesPlayed,
          moveNumber: nextMoveNumber,
          lastMove: nextLastMove,
          orbCounts: nextOrbCounts,
          resultReason: "win",
        };

        return {
          nextState,
          result: {
            status: "won",
            winner,
            movesPlayed: nextMovesPlayed,
          },
        };
      }

      const nextPlayer: Player = playerRole === "X" ? "O" : "X";
      const nextState: ChainReactionGameState = {
        ...state,
        board: nextBoard,
        currentPlayer: nextPlayer,
        movesPlayed: nextMovesPlayed,
        moveNumber: nextMoveNumber,
        lastMove: nextLastMove,
        orbCounts: nextOrbCounts,
      };

      return { nextState };
    }

    if (action.type === "REMATCH") {
      const alreadyRequested = state.rematchRequests.includes(playerId);
      const nextRematchRequests = alreadyRequested
        ? state.rematchRequests
        : [...state.rematchRequests, playerId];

      const registeredPlayers = Object.keys(state.playerRoles);
      const bothReady =
        registeredPlayers.length >= 2 &&
        registeredPlayers.every((pid) => nextRematchRequests.includes(pid));

      if (bothReady) {
        const nextStarting: Player = state.startingPlayer === "X" ? "O" : "X";
        const nextState: ChainReactionGameState = {
          board: createEmptyBoard(),
          currentPlayer: nextStarting,
          startingPlayer: nextStarting,
          status: "in_progress",
          winner: null,
          movesPlayed: 0,
          moveNumber: 0,
          lastMove: null,
          orbCounts: { X: 0, O: 0 },
          playerRoles: state.playerRoles,
          rematchRequests: [],
        };
        return { nextState };
      }

      const nextState: ChainReactionGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public serializeState(
    state: ChainReactionGameState,
    _forPlayerId?: string
  ): ChainReactionGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: ChainReactionGameState,
    playerId: string,
    graceExpiresAt: number
  ): ChainReactionGameState {
    if (state.status !== "in_progress") {
      return state;
    }
    return {
      ...state,
      disconnectGraceExpiresAt: graceExpiresAt,
      disconnectedPlayerId: playerId,
    };
  }

  public handlePlayerReconnect(
    state: ChainReactionGameState,
    _playerId: string
  ): ChainReactionGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: ChainReactionGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: ChainReactionGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won" || state.status === "abandoned",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId
      ? state.playerRoles[remainingPlayerId] ?? null
      : null;

    const nextState: ChainReactionGameState = {
      ...state,
      status: "won",
      winner: winnerRole,
      resultReason: "disconnect_forfeit",
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };

    return {
      nextState,
      isCompleted: true,
    };
  }
}
