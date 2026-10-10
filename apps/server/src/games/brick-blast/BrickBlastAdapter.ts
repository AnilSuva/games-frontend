import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import type {
  BrickBlastAction,
  BrickBlastGameState,
  PlatformPlayer,
} from "./types.js";

export interface CreateBrickBlastOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlatformPlayer;
}

export class BrickBlastAdapter
  implements GameAdapter<BrickBlastGameState, BrickBlastAction>
{
  public readonly gameId = "brick-blast";

  public createInitialState(options?: Record<string, unknown>): BrickBlastGameState {
    const opts = (options ?? {}) as CreateBrickBlastOptions;
    const playerRoles: Record<string, PlatformPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange"; // Bottom paddle
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue"; // Top paddle
    }

    const startingPlayer: PlatformPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      status,
      currentLevel: 1,
      startingPlayer,
      serverPlayer: startingPlayer,
      scores: { orange: 0, blue: 0 },
      winner: null,
      playerRoles,
      rematchRequests: [],
      matchStartTime: Date.now(),
      ballSeed: Math.floor(Math.random() * 1000000),
    };
  }

  public validateAction(
    state: BrickBlastGameState,
    action: BrickBlastAction,
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

      if (action.event === "ball_sync" || action.event === "brick_destroyed") {
        if (role !== "orange") {
          return {
            valid: false,
            error: "Only host can broadcast ball sync or brick destruction",
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
    state: BrickBlastGameState,
    action: BrickBlastAction,
    playerId: string
  ): ActionResult<BrickBlastGameState> {
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
      if (action.event === "level_complete") {
        const data = action.data as { level?: number; score?: number } | undefined;
        const nextLevel = data?.level ?? state.currentLevel + 1;
        const nextState: BrickBlastGameState = {
          ...state,
          currentLevel: nextLevel,
        };
        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "level_complete",
              data: { level: nextLevel, ...data },
            },
          ],
        };
      }

      if (action.event === "game_over") {
        const data = action.data as { winner?: PlatformPlayer; score?: number } | undefined;
        const winner = data?.winner === "orange" || data?.winner === "blue" ? data.winner : null;

        const nextState: BrickBlastGameState = {
          ...state,
          status: "won",
          winner,
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
              data: { winner, score: data?.score },
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

        const nextState: BrickBlastGameState = {
          status: "in_progress",
          currentLevel: 1,
          startingPlayer: nextStarting,
          serverPlayer: nextStarting,
          scores: { orange: 0, blue: 0 },
          winner: null,
          playerRoles: state.playerRoles,
          rematchRequests: [],
          matchStartTime: Date.now(),
          ballSeed: Math.floor(Math.random() * 1000000),
        };

        return { nextState };
      }

      const nextState: BrickBlastGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public handlePlayerDisconnect(
    state: BrickBlastGameState,
    playerId: string,
    graceExpiresAt: number
  ): BrickBlastGameState {
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
    state: BrickBlastGameState,
    _playerId: string
  ): BrickBlastGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: BrickBlastGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: BrickBlastGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId ? state.playerRoles[remainingPlayerId] ?? null : null;

    const nextState: BrickBlastGameState = {
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
