import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import type {
  PingPongAction,
  PingPongGameState,
  PingPongScore,
  PlatformPlayer,
} from "./types.js";

export interface CreatePingPongOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlatformPlayer;
}

export class PingPongAdapter
  implements GameAdapter<PingPongGameState, PingPongAction>
{
  public readonly gameId = "ping-pong";

  public createInitialState(options?: Record<string, unknown>): PingPongGameState {
    const opts = (options ?? {}) as CreatePingPongOptions;
    const playerRoles: Record<string, PlatformPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange"; // Bottom paddle (Host)
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue"; // Top paddle (Guest)
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
    state: PingPongGameState,
    action: PingPongAction,
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

      // Host authoritative restriction: only Host (orange) can broadcast ball sync
      if (action.event === "ball_sync") {
        if (role !== "orange") {
          return {
            valid: false,
            error: "Only host can broadcast ball sync",
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
    state: PingPongGameState,
    action: PingPongAction,
    playerId: string
  ): ActionResult<PingPongGameState> {
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
        const data = action.data as { scores?: PingPongScore; scorer?: PlatformPlayer } | undefined;
        const nextScores = data?.scores ?? state.scores;
        const nextState: PingPongGameState = {
          ...state,
          scores: nextScores,
        };
        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "score_update",
              data: { scores: nextScores, scorer: data?.scorer },
            },
          ],
        };
      }

      if (action.event === "game_over") {
        const data = action.data as { winner?: PlatformPlayer; scores?: PingPongScore } | undefined;
        const winner = data?.winner === "orange" || data?.winner === "blue" ? data.winner : null;

        const nextState: PingPongGameState = {
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

        const nextState: PingPongGameState = {
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

      const nextState: PingPongGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public sanitizeStateForPlayer(
    state: PingPongGameState,
    _playerId: string
  ): PingPongGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: PingPongGameState,
    playerId: string,
    graceExpiresAt: number
  ): PingPongGameState {
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
    state: PingPongGameState,
    _playerId: string
  ): PingPongGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: PingPongGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: PingPongGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId ? state.playerRoles[remainingPlayerId] ?? null : null;

    const nextState: PingPongGameState = {
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
