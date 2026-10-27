import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import { getRandomPassage } from "./passages.js";
import type {
  PlatformPlayer,
  PlayerRaceStats,
  TypingRaceAction,
  TypingRaceGameState,
} from "./types.js";

export interface CreateTypingRaceOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  passageId?: string;
}

function createEmptyPlayerStats(): PlayerRaceStats {
  return {
    correctChars: 0,
    totalTypedChars: 0,
    totalKeystrokes: 0,
    errorCount: 0,
    wpm: 0,
    accuracy: 100,
    progress: 0,
    isFinished: false,
  };
}

export class TypingRaceAdapter
  implements GameAdapter<TypingRaceGameState, TypingRaceAction>
{
  public readonly gameId = "typing-race";

  public createInitialState(options?: Record<string, unknown>): TypingRaceGameState {
    const opts = (options ?? {}) as CreateTypingRaceOptions;
    const playerRoles: Record<string, PlatformPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange"; // Host car (Lane 1)
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue"; // Guest car (Lane 2)
    }

    const passage = getRandomPassage(opts.passageId);
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      status,
      passageId: passage.id,
      passageText: passage.text,
      wordCount: passage.wordCount,
      countdownStartAt: null,
      raceStartAt: null,
      players: {
        orange: createEmptyPlayerStats(),
        blue: createEmptyPlayerStats(),
      },
      playerRoles,
      readyPlayers: [],
      winner: null,
      rematchRequests: [],
      matchStartTime: Date.now(),
    };
  }

  public validateAction(
    state: TypingRaceGameState,
    action: TypingRaceAction,
    playerId: string
  ): ValidationOutcome {
    const role = state.playerRoles[playerId];
    if (!role) {
      return {
        valid: false,
        error: "Player is not a participant in this race",
      };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "abandoned") {
        return {
          valid: false,
          error: "Match is still in progress",
        };
      }
      return { valid: true };
    }

    if (state.status !== "in_progress") {
      return {
        valid: false,
        error: "Game is not currently in progress",
      };
    }

    if (
      state.disconnectGraceExpiresAt &&
      state.disconnectGraceExpiresAt > Date.now()
    ) {
      return {
        valid: false,
        error: "Match is paused waiting for opponent reconnection",
      };
    }

    if (action.type === "INPUT") {
      if (action.input !== "progress") {
        return {
          valid: false,
          error: "Unknown input type",
        };
      }

      if (
        typeof action.data?.text !== "string" ||
        action.data.text.length > state.passageText.length + 50
      ) {
        return {
          valid: false,
          error: "Invalid typed text payload",
        };
      }

      return { valid: true };
    }

    if (action.type === "EVENT") {
      const eventName = (action as { event?: string }).event;
      if (
        eventName !== "player_ready" &&
        eventName !== "countdown_start"
      ) {
        return {
          valid: false,
          error: `Unsupported event: ${eventName}`,
        };
      }
      return { valid: true };
    }

    return {
      valid: false,
      error: "Unknown action",
    };
  }

  public applyAction(
    state: TypingRaceGameState,
    action: TypingRaceAction,
    playerId: string
  ): ActionResult<TypingRaceGameState> {
    const role = state.playerRoles[playerId];

    if (action.type === "EVENT" && action.event === "player_ready") {
      const readyPlayers = state.readyPlayers.includes(playerId)
        ? state.readyPlayers
        : [...state.readyPlayers, playerId];

      const registeredPlayers = Object.keys(state.playerRoles);
      const allReady =
        registeredPlayers.length >= 2 &&
        registeredPlayers.every((pid) => readyPlayers.includes(pid));

      let countdownStartAt = state.countdownStartAt;
      let raceStartAt = state.raceStartAt;

      if (allReady && !raceStartAt) {
        countdownStartAt = Date.now() + 300;
        raceStartAt = countdownStartAt + 3000;
      }

      const nextState: TypingRaceGameState = {
        ...state,
        readyPlayers,
        countdownStartAt,
        raceStartAt,
      };

      return {
        nextState,
        events: [
          {
            type: "game_event",
            event: "player_ready",
            data: {
              playerId,
              role,
              readyPlayers,
              allReady,
              countdownStartAt,
              raceStartAt,
            },
          },
        ],
      };
    }

    if (action.type === "EVENT" && action.event === "countdown_start") {
      const now = Date.now();
      const countdownStartAt = action.data?.countdownStartAt ?? now;
      const raceStartAt = action.data?.raceStartAt ?? countdownStartAt + 3000;

      const nextState: TypingRaceGameState = {
        ...state,
        countdownStartAt,
        raceStartAt,
      };

      return {
        nextState,
        events: [
          {
            type: "game_event",
            event: "countdown_start",
            data: { countdownStartAt, raceStartAt },
          },
        ],
      };
    }

    if (action.type === "INPUT" && action.input === "progress") {
      const typedText = String(action.data?.text ?? "");
      const passage = state.passageText;

      // Authoritative correct prefix validation:
      // A car ONLY advances up to the first mismatch!
      let correctChars = 0;
      const maxLen = Math.min(typedText.length, passage.length);
      for (let i = 0; i < maxLen; i++) {
        if (typedText[i] === passage[i]) {
          correctChars++;
        } else {
          break; // Stop at first uncorrected error
        }
      }

      const progress = passage.length > 0 ? Math.min(1, correctChars / passage.length) : 0;
      const isFinished = correctChars === passage.length;

      // Compute WPM & Accuracy
      const raceStart = state.raceStartAt ?? state.matchStartTime;
      const now = Date.now();
      const elapsedMinutes = Math.max(0.0167, (now - raceStart) / 60000);
      const wpm = raceStart && now > raceStart ? Math.round((correctChars / 5) / elapsedMinutes) : 0;

      const totalKeystrokes = Math.max(
        correctChars,
        Number(action.data?.totalKeystrokes ?? typedText.length)
      );
      const accuracy =
        totalKeystrokes > 0
          ? Math.min(100, Math.round((correctChars / totalKeystrokes) * 100))
          : 100;

      const finishTimeMs = isFinished
        ? state.players[role].finishTimeMs ?? Math.max(100, now - raceStart)
        : undefined;

      const updatedPlayerStats: PlayerRaceStats = {
        correctChars,
        totalTypedChars: typedText.length,
        totalKeystrokes,
        errorCount: Math.max(0, totalKeystrokes - correctChars),
        wpm,
        accuracy,
        progress,
        isFinished,
        finishTimeMs,
      };

      let nextWinner = state.winner;
      let nextStatus = state.status;
      let resultReason = state.resultReason;

      if (isFinished && !nextWinner) {
        nextWinner = role;
        nextStatus = "won";
        resultReason = "win";
      }

      const nextState: TypingRaceGameState = {
        ...state,
        status: nextStatus,
        winner: nextWinner,
        resultReason,
        players: {
          ...state.players,
          [role]: updatedPlayerStats,
        },
      };

      const events: unknown[] = [
        {
          type: "player_input",
          playerId,
          playerRole: role,
          input: "progress",
          data: {
            role,
            stats: updatedPlayerStats,
          },
        },
      ];

      if (nextStatus === "won" && nextWinner) {
        events.push({
          type: "game_event",
          event: "game_over",
          data: {
            winner: nextWinner,
            resultReason: "win",
            finalStats: nextState.players,
          },
        });
      }

      return {
        nextState,
        events,
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
        const freshPassage = getRandomPassage(state.passageId);

        const nextState: TypingRaceGameState = {
          status: "in_progress",
          passageId: freshPassage.id,
          passageText: freshPassage.text,
          wordCount: freshPassage.wordCount,
          countdownStartAt: null,
          raceStartAt: null,
          players: {
            orange: createEmptyPlayerStats(),
            blue: createEmptyPlayerStats(),
          },
          playerRoles: state.playerRoles,
          readyPlayers: [],
          winner: null,
          rematchRequests: [],
          matchStartTime: Date.now(),
        };

        return {
          nextState,
          events: [
            {
              type: "game_event",
              event: "rematch_start",
              data: {
                passageId: freshPassage.id,
                passageText: freshPassage.text,
                wordCount: freshPassage.wordCount,
              },
            },
          ],
        };
      }

      const nextState: TypingRaceGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };

      return { nextState };
    }

    return { nextState: state };
  }

  public sanitizeStateForPlayer(
    state: TypingRaceGameState,
    _playerId: string
  ): TypingRaceGameState {
    return state;
  }

  public handlePlayerDisconnect(
    state: TypingRaceGameState,
    playerId: string,
    graceExpiresAt: number
  ): TypingRaceGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: graceExpiresAt,
      disconnectedPlayerId: playerId,
    };
  }

  public handlePlayerReconnect(
    state: TypingRaceGameState,
    _playerId: string
  ): TypingRaceGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: TypingRaceGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: TypingRaceGameState; isCompleted: boolean } {
    const remainingPlayerId = remainingPlayerIds[0];
    const winnerRole = remainingPlayerId
      ? state.playerRoles[remainingPlayerId] ?? null
      : null;

    const nextState: TypingRaceGameState = {
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
