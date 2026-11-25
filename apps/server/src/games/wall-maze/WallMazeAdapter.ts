import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import {
  GOAL_ROW,
  INITIAL_WALLS,
  START_POSITIONS,
  getOpponent,
  getValidPawnMoves,
  isInBounds,
  validateWallPlacement,
} from "./rules.js";
import type {
  Player,
  WallMazeAction,
  WallMazeGameState,
} from "./types.js";

export interface CreateWallMazeOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: Player;
}

export class WallMazeAdapter
  implements GameAdapter<WallMazeGameState, WallMazeAction>
{
  public readonly gameId = "wall-maze";

  public createInitialState(options?: Record<string, unknown>): WallMazeGameState {
    const opts = (options ?? {}) as CreateWallMazeOptions;
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
      pawns: {
        X: { ...START_POSITIONS.X },
        O: { ...START_POSITIONS.O },
      },
      walls: [],
      wallsLeft: {
        X: INITIAL_WALLS,
        O: INITIAL_WALLS,
      },
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      moveCount: 0,
      lastAction: null,
      playerRoles,
      rematchRequests: [],
    };
  }

  public validateAction(
    state: WallMazeGameState,
    action: WallMazeAction,
    playerId: string
  ): ValidationOutcome {
    if (!action || typeof action !== "object" || !("type" in action)) {
      return {
        valid: false,
        error: "Invalid action payload",
      };
    }

    if (action.type === "MOVE_PAWN" || action.type === "PLACE_WALL") {
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

      if (action.type === "MOVE_PAWN") {
        if (!isInBounds(action.row, action.col)) {
          return {
            valid: false,
            error: "Invalid move: coordinates out of bounds",
          };
        }

        const validMoves = getValidPawnMoves(state.pawns, state.walls, playerRole);
        const isLegal = validMoves.some(
          (m) => m.row === action.row && m.col === action.col
        );
        if (!isLegal) {
          return {
            valid: false,
            error: "Invalid move: destination is blocked or unreachable",
          };
        }

        return { valid: true };
      }

      // PLACE_WALL
      return validateWallPlacement(
        state.pawns,
        state.walls,
        state.wallsLeft,
        playerRole,
        action.row,
        action.col,
        action.orientation
      );
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
    state: WallMazeGameState,
    action: WallMazeAction,
    playerId: string
  ): ActionResult<WallMazeGameState> {
    if (!this.validateAction(state, action, playerId).valid) {
      return { nextState: state };
    }

    if (action.type === "MOVE_PAWN") {
      const playerRole = state.playerRoles[playerId];
      const nextMoveCount = state.moveCount + 1;

      const nextPawns: WallMazeGameState["pawns"] = {
        X: playerRole === "X" ? { row: action.row, col: action.col } : { ...state.pawns.X },
        O: playerRole === "O" ? { row: action.row, col: action.col } : { ...state.pawns.O },
      };

      const nextLastAction: WallMazeGameState["lastAction"] = {
        type: "MOVE_PAWN",
        row: action.row,
        col: action.col,
        player: playerRole,
        moveCount: nextMoveCount,
      };

      const didWin = action.row === GOAL_ROW[playerRole];

      if (didWin) {
        const nextState: WallMazeGameState = {
          ...state,
          pawns: nextPawns,
          status: "won",
          winner: playerRole,
          moveCount: nextMoveCount,
          lastAction: nextLastAction,
          resultReason: "win",
        };

        return {
          nextState,
          result: {
            status: "won",
            winner: playerRole,
            moveCount: nextMoveCount,
          },
        };
      }

      const nextState: WallMazeGameState = {
        ...state,
        pawns: nextPawns,
        currentPlayer: getOpponent(playerRole),
        moveCount: nextMoveCount,
        lastAction: nextLastAction,
      };

      return { nextState };
    }

    if (action.type === "PLACE_WALL") {
      const playerRole = state.playerRoles[playerId];
      const nextMoveCount = state.moveCount + 1;

      const nextWalls = [
        ...state.walls.map((w) => ({ ...w })),
        {
          row: action.row,
          col: action.col,
          orientation: action.orientation,
          owner: playerRole,
        },
      ];

      const nextWallsLeft: Record<Player, number> = {
        ...state.wallsLeft,
        [playerRole]: state.wallsLeft[playerRole] - 1,
      };

      const nextState: WallMazeGameState = {
        ...state,
        walls: nextWalls,
        wallsLeft: nextWallsLeft,
        currentPlayer: getOpponent(playerRole),
        moveCount: nextMoveCount,
        lastAction: {
          type: "PLACE_WALL",
          row: action.row,
          col: action.col,
          orientation: action.orientation,
          player: playerRole,
          moveCount: nextMoveCount,
        },
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
        const nextState: WallMazeGameState = {
          pawns: {
            X: { ...START_POSITIONS.X },
            O: { ...START_POSITIONS.O },
          },
          walls: [],
          wallsLeft: {
            X: INITIAL_WALLS,
            O: INITIAL_WALLS,
          },
          currentPlayer: nextStarting,
          startingPlayer: nextStarting,
          status: "in_progress",
          winner: null,
          moveCount: 0,
          lastAction: null,
          playerRoles: { ...state.playerRoles },
          rematchRequests: [],
        };
        return { nextState };
      }

      return {
        nextState: {
          ...state,
          rematchRequests: nextRematchRequests,
        },
      };
    }

    return { nextState: state };
  }

  public serializeState(
    state: WallMazeGameState,
    _forPlayerId?: string
  ): WallMazeGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: WallMazeGameState,
    playerId: string,
    graceExpiresAt: number
  ): WallMazeGameState {
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
    state: WallMazeGameState,
    _playerId: string
  ): WallMazeGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: WallMazeGameState,
    forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: WallMazeGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won" || state.status === "abandoned",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const forfeitedRole = state.playerRoles[forfeitedPlayerId];
    const winnerRole =
      (remainingPlayerId ? state.playerRoles[remainingPlayerId] : undefined) ??
      (forfeitedRole ? getOpponent(forfeitedRole) : null);

    const nextState: WallMazeGameState = {
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
