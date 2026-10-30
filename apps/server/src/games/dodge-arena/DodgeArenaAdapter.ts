import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import type {
  DodgeArenaAction,
  DodgeArenaGameState,
  DodgeArenaLives,
  DodgeArenaPlayer,
} from "./types.js";

export interface CreateDodgeArenaOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: DodgeArenaPlayer;
}

export class DodgeArenaAdapter
  implements GameAdapter<DodgeArenaGameState, DodgeArenaAction>
{
  public readonly gameId = "dodge-arena";

  public createInitialState(options?: Record<string, unknown>): DodgeArenaGameState {
    const opts = (options ?? {}) as CreateDodgeArenaOptions;
    const playerRoles: Record<string, DodgeArenaPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange";
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue";
    }

    const startingPlayer: DodgeArenaPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      status,
      startingPlayer,
      lives: { orange: 3, blue: 3 },
      wave: 1,
      winner: null,
      playerRoles,
      readyPlayers: [],
      seed: Math.floor(Math.random() * 1000000),
      rematchRequests: [],
      matchStartTime: Date.now(),
    };
  }

  public validateAction(
    state: DodgeArenaGameState,
    action: DodgeArenaAction,
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

      // Eliminated players cannot move
      if (state.lives[role] <= 0) {
        return {
          valid: false,
          error: "Eliminated player cannot send movement input",
        };
      }

      if (typeof action.input !== "string" || action.input.length > 64) {
        return {
          valid: false,
          error: "Invalid input command",
        };
      }

      // Validate direction parameters if movement
      if (action.input === "move" && action.data) {
        const data = action.data as Record<string, unknown>;
        const dx = data.directionX ?? data.dx;
        const dy = data.directionY ?? data.dy;

        if (typeof dx === "number" && (!Number.isFinite(dx) || Math.abs(dx) > 1.1)) {
          return { valid: false, error: "Invalid directionX" };
        }
        if (typeof dy === "number" && (!Number.isFinite(dy) || Math.abs(dy) > 1.1)) {
          return { valid: false, error: "Invalid directionY" };
        }
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

      // Host authoritative restriction: only Host (orange) can broadcast countdown_start
      if (action.event === "countdown_start" && role !== "orange") {
        return {
          valid: false,
          error: "Only host can broadcast countdown_start",
        };
      }

      return { valid: true };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "draw" && state.status !== "abandoned") {
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
    state: DodgeArenaGameState,
    action: DodgeArenaAction,
    playerId: string
  ): ActionResult<DodgeArenaGameState> {
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
      if (action.event === "player_ready") {
        const nextReady = state.readyPlayers.includes(playerId)
          ? state.readyPlayers
          : [...state.readyPlayers, playerId];

        const nextState: DodgeArenaGameState = {
          ...state,
          readyPlayers: nextReady,
        };

        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "player_ready",
              data: { playerId },
            },
          ],
        };
      }

      if (action.event === "player_hit") {
        const data = action.data as { player?: DodgeArenaPlayer } | undefined;
        const hitRole = data?.player;

        if (!hitRole || (hitRole !== "orange" && hitRole !== "blue")) {
          return { nextState: state };
        }

        const nextLives: DodgeArenaLives = {
          ...state.lives,
          [hitRole]: Math.max(0, state.lives[hitRole] - 1),
        };

        let nextStatus = state.status;
        let winner = state.winner;
        let resultReason = state.resultReason;

        if (nextLives.orange <= 0 && nextLives.blue <= 0) {
          nextStatus = "draw";
          winner = "draw";
          resultReason = "draw";
        } else if (nextLives.orange <= 0) {
          nextStatus = "won";
          winner = "blue";
          resultReason = "win";
        } else if (nextLives.blue <= 0) {
          nextStatus = "won";
          winner = "orange";
          resultReason = "win";
        }

        const nextState: DodgeArenaGameState = {
          ...state,
          lives: nextLives,
          status: nextStatus,
          winner,
          resultReason,
        };

        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "lives_update",
              data: { lives: nextLives, hitRole },
            },
          ],
        };
      }

      if (action.event === "game_over") {
        const data = action.data as
          | { winner?: DodgeArenaPlayer | "draw" }
          | undefined;
        const winner =
          data?.winner === "orange" ||
          data?.winner === "blue" ||
          data?.winner === "draw"
            ? data.winner
            : null;

        const nextStatus = winner === "draw" ? "draw" : "won";

        const nextState: DodgeArenaGameState = {
          ...state,
          status: nextStatus,
          winner,
          resultReason: winner === "draw" ? "draw" : "win",
        };

        return {
          nextState,
          result: {
            status: nextStatus,
            winner,
          },
          events: [
            {
              type: "game_event",
              event: "game_over",
              data: { winner, lives: state.lives },
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
        const nextStarting: DodgeArenaPlayer =
          state.startingPlayer === "orange" ? "blue" : "orange";

        const nextState: DodgeArenaGameState = {
          status: "in_progress",
          startingPlayer: nextStarting,
          lives: { orange: 3, blue: 3 },
          wave: 1,
          winner: null,
          playerRoles: state.playerRoles,
          readyPlayers: [],
          seed: Math.floor(Math.random() * 1000000),
          rematchRequests: [],
          matchStartTime: Date.now(),
        };

        return { nextState };
      }

      const nextState: DodgeArenaGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public sanitizeStateForPlayer(
    state: DodgeArenaGameState,
    _playerId: string
  ): DodgeArenaGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: DodgeArenaGameState,
    playerId: string,
    graceExpiresAt: number
  ): DodgeArenaGameState {
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
    state: DodgeArenaGameState,
    _playerId: string
  ): DodgeArenaGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: DodgeArenaGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: DodgeArenaGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won" || state.status === "draw",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId ? state.playerRoles[remainingPlayerId] ?? null : null;

    const nextState: DodgeArenaGameState = {
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
