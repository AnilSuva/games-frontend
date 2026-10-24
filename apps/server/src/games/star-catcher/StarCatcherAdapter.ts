import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import type {
  StarCatcherAction,
  StarCatcherGameState,
  StarCatcherScore,
  PlatformPlayer,
} from "./types.js";

export interface CreateStarCatcherOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlatformPlayer;
}

export class StarCatcherAdapter
  implements GameAdapter<StarCatcherGameState, StarCatcherAction>
{
  public readonly gameId = "star-catcher";

  public createInitialState(options?: Record<string, unknown>): StarCatcherGameState {
    const opts = (options ?? {}) as CreateStarCatcherOptions;
    const playerRoles: Record<string, PlatformPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange"; // Bottom ship (Host)
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue"; // Top ship (Guest)
    }

    const startingPlayer: PlatformPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      status,
      startingPlayer,
      scores: { orange: 0, blue: 0 },
      winner: null,
      playerRoles,
      rematchRequests: [],
      matchStartTime: Date.now(),
    };
  }

  public validateAction(
    state: StarCatcherGameState,
    action: StarCatcherAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "INPUT") {
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

      const role = state.playerRoles[playerId];
      if (!role) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      if (typeof action.input !== "string" || action.input.length > 64) {
        return {
          valid: false,
          error: "Invalid input command",
        };
      }

      return { valid: true };
    }

    if (action.type === "EVENT") {
      if (state.status !== "in_progress") {
        return {
          valid: false,
          error: "Game is not in progress",
        };
      }

      const role = state.playerRoles[playerId];
      if (!role) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      if (typeof action.event !== "string" || action.event.length > 64) {
        return {
          valid: false,
          error: "Invalid event name",
        };
      }

      // Host authoritative restriction: only Host (orange) can broadcast global state events
      const hostOnlyEvents = [
        "star_spawn",
        "black_hole_spawn",
        "black_hole_despawn",
        "score_update",
        "game_over",
      ];

      if (hostOnlyEvents.includes(action.event)) {
        if (role !== "orange") {
          return {
            valid: false,
            error: `Only host can broadcast ${action.event}`,
          };
        }
      }

      return { valid: true };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won") {
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
    state: StarCatcherGameState,
    action: StarCatcherAction,
    playerId: string
  ): ActionResult<StarCatcherGameState> {
    if (action.type === "INPUT") {
      const role = state.playerRoles[playerId];
      return {
        nextState: state,
        events: [
          {
            type: "player_input",
            playerId,
            playerRole: role,
            input: action.input,
            data: action.data,
          },
        ],
      };
    }

    if (action.type === "EVENT") {
      if (action.event === "score_update") {
        const data = action.data as
          | { scores?: StarCatcherScore; collector?: PlatformPlayer }
          | undefined;
        const nextScores = data?.scores ?? state.scores;
        const nextState: StarCatcherGameState = {
          ...state,
          scores: nextScores,
        };
        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "score_update",
              data: { scores: nextScores, collector: data?.collector },
            },
          ],
        };
      }

      if (action.event === "game_over") {
        const data = action.data as
          | { winner?: PlatformPlayer; scores?: StarCatcherScore }
          | undefined;
        const winner =
          data?.winner === "orange" || data?.winner === "blue"
            ? data.winner
            : null;

        const nextState: StarCatcherGameState = {
          ...state,
          status: "won",
          winner,
          scores: data?.scores ?? state.scores,
          resultReason: "win",
        };

        return {
          nextState,
          result: {
            status: "won",
            winner,
          },
          events: [
            {
              type: "game_event",
              event: "game_over",
              data: { winner, scores: nextState.scores },
            },
          ],
        };
      }

      return {
        nextState: state,
        events: [
          {
            type: "game_event",
            event: action.event,
            data: action.data,
          },
        ],
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
        const nextStarting: PlatformPlayer =
          state.startingPlayer === "orange" ? "blue" : "orange";

        const nextState: StarCatcherGameState = {
          status: "in_progress",
          startingPlayer: nextStarting,
          scores: { orange: 0, blue: 0 },
          winner: null,
          playerRoles: state.playerRoles,
          rematchRequests: [],
          matchStartTime: Date.now(),
        };

        return { nextState };
      }

      const nextState: StarCatcherGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public sanitizeStateForPlayer(
    state: StarCatcherGameState,
    _playerId: string
  ): StarCatcherGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: StarCatcherGameState,
    playerId: string,
    graceExpiresAt: number
  ): StarCatcherGameState {
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
    state: StarCatcherGameState,
    _playerId: string
  ): StarCatcherGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: StarCatcherGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: StarCatcherGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId
      ? state.playerRoles[remainingPlayerId] ?? null
      : null;

    const nextState: StarCatcherGameState = {
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
