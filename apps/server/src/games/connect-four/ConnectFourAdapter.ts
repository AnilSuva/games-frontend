import type { ActionResult, GameAdapter, ValidationOutcome } from "../GameAdapter.js";
import {
  createEmptyBoard,
  createInitialColumnCounts,
  getLandingRow,
  getWinningLineAt,
  incrementColumnCount,
  isBoardFull,
  isColumnFull,
  isValidColumn,
  placeDisc,
} from "./rules.js";
import type {
  ConnectFourAction,
  ConnectFourGameState,
  PlayerDisc,
} from "./types.js";

export interface CreateConnectFourOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlayerDisc;
}

export class ConnectFourAdapter
  implements GameAdapter<ConnectFourGameState, ConnectFourAction>
{
  public readonly gameId = "connect-four";

  public createInitialState(options?: Record<string, unknown>): ConnectFourGameState {
    const opts = (options ?? {}) as CreateConnectFourOptions;
    const playerDiscs: Record<string, PlayerDisc> = {};

    if (opts.hostPlayerId) {
      playerDiscs[opts.hostPlayerId] = "R"; // Orange
    }
    if (opts.guestPlayerId) {
      playerDiscs[opts.guestPlayerId] = "Y"; // Blue
    }

    const startingPlayer: PlayerDisc = opts.startingPlayer ?? "R";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      board: createEmptyBoard(),
      columnCounts: createInitialColumnCounts(),
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      winningLine: null,
      lastMove: null,
      moveCount: 0,
      playerDiscs,
      rematchRequests: [],
    };
  }

  public validateAction(
    state: ConnectFourGameState,
    action: ConnectFourAction,
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

      const playerDisc = state.playerDiscs[playerId];
      if (!playerDisc) {
        return {
          valid: false,
          error: "Player is not a participant in this game",
        };
      }

      if (playerDisc !== state.currentPlayer) {
        return {
          valid: false,
          error: "It is not your turn",
        };
      }

      if (!isValidColumn(action.column)) {
        return {
          valid: false,
          error: "Invalid column",
        };
      }

      if (isColumnFull(state.columnCounts, action.column)) {
        return {
          valid: false,
          error: "Column is full",
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

      if (!state.playerDiscs[playerId]) {
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
    state: ConnectFourGameState,
    action: ConnectFourAction,
    playerId: string
  ): ActionResult<ConnectFourGameState> {
    if (action.type === "MOVE") {
      const playerDisc = state.playerDiscs[playerId];
      const landingRow = getLandingRow(state.columnCounts, action.column);
      const nextBoard = placeDisc(state.board, landingRow, action.column, playerDisc);
      const nextColumnCounts = incrementColumnCount(state.columnCounts, action.column);
      const moveCount = state.moveCount + 1;
      const winningLine = getWinningLineAt(nextBoard, landingRow, action.column, playerDisc);
      const lastMove = {
        column: action.column,
        row: landingRow,
        player: playerDisc,
      };

      if (winningLine) {
        const nextState: ConnectFourGameState = {
          ...state,
          board: nextBoard,
          columnCounts: nextColumnCounts,
          status: "won",
          winner: playerDisc,
          winningLine,
          lastMove,
          moveCount,
          resultReason: "win",
        };
        return {
          nextState,
          result: {
            status: "won",
            winner: playerDisc,
            winningLine,
          },
        };
      }

      if (isBoardFull(nextColumnCounts)) {
        const nextState: ConnectFourGameState = {
          ...state,
          board: nextBoard,
          columnCounts: nextColumnCounts,
          status: "draw",
          winner: null,
          winningLine: null,
          lastMove,
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

      const nextPlayer: PlayerDisc = playerDisc === "R" ? "Y" : "R";
      const nextState: ConnectFourGameState = {
        ...state,
        board: nextBoard,
        columnCounts: nextColumnCounts,
        currentPlayer: nextPlayer,
        lastMove,
        moveCount,
      };
      return { nextState };
    }

    if (action.type === "REMATCH") {
      const alreadyRequested = state.rematchRequests.includes(playerId);
      const nextRematchRequests = alreadyRequested
        ? state.rematchRequests
        : [...state.rematchRequests, playerId];

      const registeredPlayers = Object.keys(state.playerDiscs);
      const bothReady =
        registeredPlayers.length >= 2 &&
        registeredPlayers.every((pid) => nextRematchRequests.includes(pid));

      if (bothReady) {
        const nextStarting: PlayerDisc = state.startingPlayer === "R" ? "Y" : "R";
        const nextState: ConnectFourGameState = {
          board: createEmptyBoard(),
          columnCounts: createInitialColumnCounts(),
          currentPlayer: nextStarting,
          startingPlayer: nextStarting,
          status: "in_progress",
          winner: null,
          winningLine: null,
          lastMove: null,
          moveCount: 0,
          playerDiscs: state.playerDiscs,
          rematchRequests: [],
        };
        return { nextState };
      }

      const nextState: ConnectFourGameState = {
        ...state,
        rematchRequests: nextRematchRequests,
      };
      return { nextState };
    }

    return { nextState: state };
  }

  public handlePlayerDisconnect(
    state: ConnectFourGameState,
    playerId: string,
    graceExpiresAt: number
  ): ConnectFourGameState {
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
    state: ConnectFourGameState,
    _playerId: string
  ): ConnectFourGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: ConnectFourGameState,
    _forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: ConnectFourGameState; isCompleted: boolean } {
    if (state.status !== "in_progress") {
      return {
        nextState: state,
        isCompleted: state.status === "won" || state.status === "draw",
      };
    }

    const remainingPlayerId = remainingPlayerIds[0];
    const winnerDisc = remainingPlayerId ? state.playerDiscs[remainingPlayerId] ?? null : null;

    const nextState: ConnectFourGameState = {
      ...state,
      status: "won",
      winner: winnerDisc,
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
