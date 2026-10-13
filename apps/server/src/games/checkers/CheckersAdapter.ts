import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import {
  applyCheckersMove,
  createInitialBoard,
  getValidMoves,
} from "./rules.js";
import {
  TURN_DURATION_MS,
  type CheckersAction,
  type CheckersGameState,
  type CheckersPlayer,
} from "./types.js";

export interface CreateCheckersOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: CheckersPlayer;
}

export class CheckersAdapter
  implements GameAdapter<CheckersGameState, CheckersAction>
{
  public readonly gameId = "checkers";

  public createInitialState(options?: Record<string, unknown>): CheckersGameState {
    const opts = (options ?? {}) as CreateCheckersOptions;
    const playerRoles: Record<string, CheckersPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange";
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue";
    }

    const startingPlayer: CheckersPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      board: createInitialBoard(),
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      activePiece: null,
      orangeCaptures: 0,
      blueCaptures: 0,
      moveCount: 0,
      lastMove: null,
      playerRoles,
      rematchRequests: [],
      turnExpiresAt: status === "in_progress" ? Date.now() + TURN_DURATION_MS : null,
    };
  }

  public validateAction(
    state: CheckersGameState,
    action: CheckersAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "MOVE") {
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

      if (
        typeof action.from !== "number" ||
        typeof action.to !== "number" ||
        action.from < 0 ||
        action.from >= 64 ||
        action.to < 0 ||
        action.to >= 64
      ) {
        return {
          valid: false,
          error: "Invalid move coordinates",
        };
      }

      if (state.activePiece !== null && action.from !== state.activePiece) {
        return {
          valid: false,
          error: "Must continue multi-jump sequence with active piece",
        };
      }

      const validMoves = getValidMoves(state);
      const isLegal = validMoves.some(
        (m) => m.from === action.from && m.to === action.to
      );

      if (!isLegal) {
        return {
          valid: false,
          error: "Invalid move",
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

      if (!state.playerRoles[playerId]) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      return { valid: true };
    }

    if (action.type === "TIMEOUT" || (action.type === "EVENT" && action.event === "TIMEOUT")) {
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

      if (!state.playerRoles[playerId]) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      // Allow claiming timeout within 1000ms clock skew tolerance or after expiration
      if (state.turnExpiresAt && Date.now() < state.turnExpiresAt - 1000) {
        return {
          valid: false,
          error: "Turn has not expired yet",
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
    state: CheckersGameState,
    action: CheckersAction,
    playerId: string
  ): ActionResult<CheckersGameState> {
    if (action.type === "MOVE") {
      const nextState = applyCheckersMove(state, action.from, action.to);

      if (nextState.status === "in_progress") {
        nextState.turnExpiresAt = Date.now() + TURN_DURATION_MS;
      } else {
        nextState.turnExpiresAt = null;
      }

      if (nextState.status === "won") {
        return {
          nextState,
          result: {
            status: "won",
            winner: nextState.winner,
          },
        };
      }

      if (nextState.status === "draw") {
        return {
          nextState,
          result: {
            status: "draw",
            winner: null,
          },
        };
      }

      return { nextState };
    }

    if (action.type === "TIMEOUT" || (action.type === "EVENT" && action.event === "TIMEOUT")) {
      const timedOutPlayer = state.currentPlayer;
      const winnerPlayer: CheckersPlayer =
        timedOutPlayer === "orange" ? "blue" : "orange";

      const nextState: CheckersGameState = {
        ...state,
        status: "won",
        winner: winnerPlayer,
        resultReason: "timeout",
        turnExpiresAt: null,
      };

      return {
        nextState,
        result: {
          status: "won",
          winner: winnerPlayer,
          reason: "timeout",
        },
      };
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
        const nextStarting: CheckersPlayer =
          state.startingPlayer === "orange" ? "blue" : "orange";
        const nextState: CheckersGameState = {
          board: createInitialBoard(),
          currentPlayer: nextStarting,
          startingPlayer: nextStarting,
          status: "in_progress",
          winner: null,
          activePiece: null,
          orangeCaptures: 0,
          blueCaptures: 0,
          moveCount: 0,
          lastMove: null,
          playerRoles: state.playerRoles,
          rematchRequests: [],
          turnExpiresAt: Date.now() + TURN_DURATION_MS,
        };
        return { nextState };
      }

      const nextState: CheckersGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public handlePlayerDisconnect(
    state: CheckersGameState,
    playerId: string,
    graceExpiresAt: number
  ): CheckersGameState {
    if (state.status !== "in_progress") {
      return state;
    }
    return {
      ...state,
      disconnectGraceExpiresAt: graceExpiresAt,
      disconnectedPlayerId: playerId,
      turnExpiresAt: null,
    };
  }

  public handlePlayerReconnect(
    state: CheckersGameState,
    _playerId: string
  ): CheckersGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
      turnExpiresAt:
        state.status === "in_progress" ? Date.now() + TURN_DURATION_MS : null,
    };
  }

  public handleForfeit(
    state: CheckersGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: CheckersGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won" || state.status === "draw",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId
      ? state.playerRoles[remainingPlayerId] ?? null
      : null;

    const nextState: CheckersGameState = {
      ...state,
      status: "won",
      winner: winnerRole,
      resultReason: "disconnect_forfeit",
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
      turnExpiresAt: null,
    };

    return {
      nextState,
      isCompleted: true,
    };
  }

  public serializeState(
    state: CheckersGameState,
    _forPlayerId?: string
  ): CheckersGameState {
    // Checkers is a game of perfect information; state is completely public
    return state;
  }
}
