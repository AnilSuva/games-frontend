import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import { COURSES, MAX_STROKES_PER_HOLE } from "./courses.js";
import { simulateShot, vecLength } from "./physics.js";
import type {
  MiniGolfAction,
  MiniGolfGameState,
  MiniGolfPlayer,
  Vector2,
} from "./types.js";

export interface CreateMiniGolfOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: MiniGolfPlayer;
}

export class MiniGolfAdapter
  implements GameAdapter<MiniGolfGameState, MiniGolfAction>
{
  public readonly gameId = "mini-golf-duel";

  public createInitialState(options?: Record<string, unknown>): MiniGolfGameState {
    const opts = (options ?? {}) as CreateMiniGolfOptions;
    const playerRoles: Record<string, MiniGolfPlayer> = {};

    if (opts.hostPlayerId) {
      playerRoles[opts.hostPlayerId] = "orange";
    }
    if (opts.guestPlayerId) {
      playerRoles[opts.guestPlayerId] = "blue";
    }

    const startingPlayer: MiniGolfPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    const course0 = COURSES[0];

    return {
      currentHoleIndex: 0,
      startingPlayer,
      currentPlayer: startingPlayer,
      status,
      winner: null,
      playerRoles,
      rematchRequests: [],
      maxStrokesPerHole: MAX_STROKES_PER_HOLE,
      holeScores: {
        orange: [],
        blue: [],
      },
      holeState: {
        orange: {
          strokes: 0,
          finished: false,
          ballPosition: { ...course0.startPositions.orange },
          lastSafePosition: { ...course0.startPositions.orange },
        },
        blue: {
          strokes: 0,
          finished: false,
          ballPosition: { ...course0.startPositions.blue },
          lastSafePosition: { ...course0.startPositions.blue },
        },
      },
      lastShot: null,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
      turnExpiresAt: null,
    };
  }

  public validateAction(
    state: MiniGolfGameState,
    action: MiniGolfAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "draw") {
        return {
          valid: false,
          error: "Game is still in progress",
        };
      }
      return { valid: true };
    }

    if (action.type === "SHOT" || action.type === "MOVE") {
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

      const playerHole = state.holeState[playerRole];
      if (playerHole.finished) {
        return {
          valid: false,
          error: "Player has already completed this hole",
        };
      }

      // Extract aim and power
      let aim: Vector2 | undefined;
      let power: number | undefined;

      if (action.type === "SHOT") {
        aim = action.aim;
        power = action.power;
      } else if (action.type === "MOVE") {
        if (action.shot) {
          aim = { x: action.shot.dx, y: action.shot.dy };
          power = action.shot.power;
        } else if (action.aim) {
          aim = action.aim;
          power = action.power;
        }
      }

      if (!aim || typeof aim.x !== "number" || typeof aim.y !== "number") {
        return {
          valid: false,
          error: "Invalid aiming vector",
        };
      }

      const aimLen = vecLength(aim);
      if (aimLen < 1e-4) {
        return {
          valid: false,
          error: "Aim vector cannot be zero",
        };
      }

      if (typeof power !== "number" || isNaN(power) || power < 0 || power > 1) {
        return {
          valid: false,
          error: "Invalid shot power (must be between 0 and 1)",
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
    state: MiniGolfGameState,
    action: MiniGolfAction,
    playerId: string
  ): ActionResult<MiniGolfGameState> {
    if (action.type === "REMATCH") {
      const nextStartingPlayer: MiniGolfPlayer =
        state.startingPlayer === "orange" ? "blue" : "orange";
      const course0 = COURSES[0];

      const nextState: MiniGolfGameState = {
        ...state,
        currentHoleIndex: 0,
        startingPlayer: nextStartingPlayer,
        currentPlayer: nextStartingPlayer,
        status: "in_progress",
        winner: null,
        resultReason: undefined,
        rematchRequests: [],
        holeScores: {
          orange: [],
          blue: [],
        },
        holeState: {
          orange: {
            strokes: 0,
            finished: false,
            ballPosition: { ...course0.startPositions.orange },
            lastSafePosition: { ...course0.startPositions.orange },
          },
          blue: {
            strokes: 0,
            finished: false,
            ballPosition: { ...course0.startPositions.blue },
            lastSafePosition: { ...course0.startPositions.blue },
          },
        },
        lastShot: null,
        disconnectGraceExpiresAt: null,
        disconnectedPlayerId: null,
      };

      return { nextState };
    }

    if (action.type === "SHOT" || action.type === "MOVE") {
      const role = state.playerRoles[playerId];
      const playerHole = state.holeState[role];
      const otherRole: MiniGolfPlayer = role === "orange" ? "blue" : "orange";
      const otherHole = state.holeState[otherRole];

      let aim: Vector2;
      let power: number;

      if (action.type === "SHOT") {
        aim = action.aim;
        power = action.power;
      } else {
        if (action.shot) {
          aim = { x: action.shot.dx, y: action.shot.dy };
          power = action.shot.power;
        } else {
          aim = action.aim!;
          power = action.power!;
        }
      }

      const currentCourse = COURSES[state.currentHoleIndex];
      const simResult = simulateShot(
        currentCourse,
        playerHole.ballPosition,
        aim,
        power,
        Date.now()
      );

      let nextStrokes = playerHole.strokes + 1;
      let nextPos = simResult.finalPosition;
      let nextSafePos = playerHole.lastSafePosition;

      if (simResult.waterHazard) {
        // Water hazard penalty: +1 additional stroke and reset ball
        nextStrokes += 1;
        nextPos = { ...playerHole.lastSafePosition };
      } else {
        nextSafePos = { ...simResult.finalPosition };
      }

      let isFinished = simResult.sunk || nextStrokes >= state.maxStrokesPerHole;

      const updatedPlayerHole = {
        strokes: nextStrokes,
        finished: isFinished,
        ballPosition: nextPos,
        lastSafePosition: nextSafePos,
      };

      const updatedHoleState = {
        ...state.holeState,
        [role]: updatedPlayerHole,
      };

      const lastShotData = {
        playerId,
        playerRole: role,
        aim,
        power,
        trajectory: simResult.trajectory,
        events: simResult.events,
        sunk: simResult.sunk,
        waterHazard: simResult.waterHazard,
        finalPosition: nextPos,
        strokes: nextStrokes,
      };

      // Check if both players have finished the current hole
      const bothFinished = isFinished && otherHole.finished;

      if (bothFinished) {
        // Record final scores for this hole
        const orangeFinalStrokes =
          role === "orange" ? nextStrokes : otherHole.strokes;
        const blueFinalStrokes =
          role === "blue" ? nextStrokes : otherHole.strokes;

        const nextHoleScores = {
          orange: [...state.holeScores.orange, orangeFinalStrokes],
          blue: [...state.holeScores.blue, blueFinalStrokes],
        };

        if (state.currentHoleIndex < COURSES.length - 1) {
          // Transition to next hole
          const nextHoleIndex = state.currentHoleIndex + 1;
          const nextCourse = COURSES[nextHoleIndex];

          // Starting player alternates per hole:
          // Hole 0: state.startingPlayer
          // Hole 1: opposite of startingPlayer
          // Hole 2: same as startingPlayer
          const nextHoleStartingPlayer: MiniGolfPlayer =
            nextHoleIndex % 2 === 0
              ? state.startingPlayer
              : state.startingPlayer === "orange"
              ? "blue"
              : "orange";

          const nextState: MiniGolfGameState = {
            ...state,
            currentHoleIndex: nextHoleIndex,
            currentPlayer: nextHoleStartingPlayer,
            holeScores: nextHoleScores,
            holeState: {
              orange: {
                strokes: 0,
                finished: false,
                ballPosition: { ...nextCourse.startPositions.orange },
                lastSafePosition: { ...nextCourse.startPositions.orange },
              },
              blue: {
                strokes: 0,
                finished: false,
                ballPosition: { ...nextCourse.startPositions.blue },
                lastSafePosition: { ...nextCourse.startPositions.blue },
              },
            },
            lastShot: lastShotData,
          };

          return {
            nextState,
            events: [
              {
                type: "shot_resolved",
                ...lastShotData,
                holeTransition: {
                  nextHoleIndex,
                  completedHoleIndex: state.currentHoleIndex,
                  holeScores: nextHoleScores,
                },
              },
            ],
          };
        } else {
          // Match Completed! Calculate winner
          const orangeTotal = nextHoleScores.orange.reduce((a, b) => a + b, 0);
          const blueTotal = nextHoleScores.blue.reduce((a, b) => a + b, 0);

          let winner: MiniGolfPlayer | "draw";
          let status: "won" | "draw";

          if (orangeTotal < blueTotal) {
            winner = "orange";
            status = "won";
          } else if (blueTotal < orangeTotal) {
            winner = "blue";
            status = "won";
          } else {
            winner = "draw";
            status = "draw";
          }

          const nextState: MiniGolfGameState = {
            ...state,
            status,
            winner,
            resultReason: "score",
            holeScores: nextHoleScores,
            holeState: updatedHoleState,
            lastShot: lastShotData,
          };

          return {
            nextState,
            result: {
              status,
              winner,
              scores: nextHoleScores,
              totalOrange: orangeTotal,
              totalBlue: blueTotal,
            },
            events: [
              {
                type: "shot_resolved",
                ...lastShotData,
                matchCompleted: {
                  winner,
                  status,
                  holeScores: nextHoleScores,
                  totalOrange: orangeTotal,
                  totalBlue: blueTotal,
                },
              },
            ],
          };
        }
      } else {
        // Hole is still ongoing: determine who shoots next
        let nextPlayer: MiniGolfPlayer;
        if (!otherHole.finished) {
          nextPlayer = otherRole;
        } else {
          // Other player is already finished, so current player shoots again
          nextPlayer = role;
        }

        const nextState: MiniGolfGameState = {
          ...state,
          currentPlayer: nextPlayer,
          holeState: updatedHoleState,
          lastShot: lastShotData,
        };

        return {
          nextState,
          events: [
            {
              type: "shot_resolved",
              ...lastShotData,
              nextPlayer,
            },
          ],
        };
      }
    }

    return { nextState: state };
  }

  public handlePlayerDisconnect(
    state: MiniGolfGameState,
    playerId: string,
    graceExpiresAt: number
  ): MiniGolfGameState {
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
    state: MiniGolfGameState,
    _playerId: string
  ): MiniGolfGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: MiniGolfGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: MiniGolfGameState; isCompleted: boolean } {
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

    const nextState: MiniGolfGameState = {
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

  public serializeState(
    state: MiniGolfGameState,
    _forPlayerId?: string
  ): MiniGolfGameState {
    return state;
  }
}
