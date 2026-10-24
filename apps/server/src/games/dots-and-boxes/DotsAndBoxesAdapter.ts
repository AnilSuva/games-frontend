import type {
  ActionResult,
  GameAdapter,
  ValidationOutcome,
} from "../GameAdapter.js";
import type {
  BoxCoord,
  DotsBoxesAction,
  DotsBoxesConfig,
  DotsBoxesGameState,
  Edge,
  PlatformPlayer,
} from "./types.js";

const DEFAULT_CONFIG: DotsBoxesConfig = {
  rows: 5,
  cols: 5,
};

function createEmptyHorizontal(config: DotsBoxesConfig): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows + 1 }, () =>
    Array(config.cols).fill(null)
  );
}

function createEmptyVertical(config: DotsBoxesConfig): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows }, () =>
    Array(config.cols + 1).fill(null)
  );
}

function createEmptyBoxes(config: DotsBoxesConfig): (PlatformPlayer | null)[][] {
  return Array.from({ length: config.rows }, () =>
    Array(config.cols).fill(null)
  );
}

function getAdjacentBoxesForEdge(
  edge: Edge,
  config: DotsBoxesConfig
): BoxCoord[] {
  const boxes: BoxCoord[] = [];
  const { type, row, col } = edge;

  if (type === "h") {
    if (row > 0 && col < config.cols) {
      boxes.push({ row: row - 1, col });
    }
    if (row < config.rows && col < config.cols) {
      boxes.push({ row, col });
    }
  } else {
    if (col > 0 && row < config.rows) {
      boxes.push({ row, col: col - 1 });
    }
    if (col < config.cols && row < config.rows) {
      boxes.push({ row, col });
    }
  }
  return boxes;
}

function isBoxComplete(
  box: BoxCoord,
  hEdges: (PlatformPlayer | null)[][],
  vEdges: (PlatformPlayer | null)[][]
): boolean {
  const r = box.row;
  const c = box.col;
  const top = hEdges[r]?.[c] !== null;
  const bottom = hEdges[r + 1]?.[c] !== null;
  const left = vEdges[r]?.[c] !== null;
  const right = vEdges[r]?.[c + 1] !== null;
  return top && bottom && left && right;
}

export interface CreateDotsBoxesOptions {
  hostPlayerId?: string;
  guestPlayerId?: string;
  startingPlayer?: PlatformPlayer;
  config?: DotsBoxesConfig;
}

export class DotsAndBoxesAdapter
  implements GameAdapter<DotsBoxesGameState, DotsBoxesAction>
{
  public readonly gameId = "dots-and-boxes";

  public createInitialState(options?: Record<string, unknown>): DotsBoxesGameState {
    const opts = (options ?? {}) as CreateDotsBoxesOptions;
    const config = opts.config ?? DEFAULT_CONFIG;
    const playerColors: Record<string, PlatformPlayer> = {};

    if (opts.hostPlayerId) {
      playerColors[opts.hostPlayerId] = "orange";
    }
    if (opts.guestPlayerId) {
      playerColors[opts.guestPlayerId] = "blue";
    }

    const startingPlayer: PlatformPlayer = opts.startingPlayer ?? "orange";
    const status =
      opts.hostPlayerId && opts.guestPlayerId ? "in_progress" : "waiting";

    return {
      config,
      horizontalEdges: createEmptyHorizontal(config),
      verticalEdges: createEmptyVertical(config),
      boxes: createEmptyBoxes(config),
      scores: {
        orange: 0,
        blue: 0,
      },
      currentPlayer: startingPlayer,
      startingPlayer,
      status,
      winner: null,
      lastMove: null,
      moveCount: 0,
      consecutiveBoxesThisTurn: 0,
      playerColors,
      rematchRequests: [],
    };
  }

  public validateAction(
    state: DotsBoxesGameState,
    action: DotsBoxesAction,
    playerId: string
  ): ValidationOutcome {
    if (action.type === "CLAIM_EDGE") {
      if (state.status !== "in_progress") {
        return { valid: false, error: "Game is not in progress" };
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

      const playerColor = state.playerColors[playerId];
      if (!playerColor) {
        return { valid: false, error: "Player is not a participant in this game" };
      }

      if (playerColor !== state.currentPlayer) {
        return { valid: false, error: "It is not your turn" };
      }

      const { edge } = action;
      if (edge.type === "h") {
        if (
          edge.row < 0 ||
          edge.row > state.config.rows ||
          edge.col < 0 ||
          edge.col >= state.config.cols
        ) {
          return { valid: false, error: "Edge out of bounds" };
        }
        if (state.horizontalEdges[edge.row][edge.col] !== null) {
          return { valid: false, error: "Edge already claimed" };
        }
      } else if (edge.type === "v") {
        if (
          edge.row < 0 ||
          edge.row >= state.config.rows ||
          edge.col < 0 ||
          edge.col > state.config.cols
        ) {
          return { valid: false, error: "Edge out of bounds" };
        }
        if (state.verticalEdges[edge.row][edge.col] !== null) {
          return { valid: false, error: "Edge already claimed" };
        }
      } else {
        return { valid: false, error: "Invalid edge type" };
      }

      return { valid: true };
    }

    if (action.type === "REMATCH") {
      if (state.status !== "won" && state.status !== "draw") {
        return { valid: false, error: "Game is still in progress" };
      }
      if (!state.playerColors[playerId]) {
        return { valid: false, error: "Player is not a participant" };
      }
      return { valid: true };
    }

    return { valid: false, error: "Unknown action" };
  }

  public applyAction(
    state: DotsBoxesGameState,
    action: DotsBoxesAction,
    playerId: string
  ): ActionResult<DotsBoxesGameState> {
    if (action.type === "REMATCH") {
      const alreadyRequested = state.rematchRequests.includes(playerId);
      const updatedRequests = alreadyRequested
        ? state.rematchRequests
        : [...state.rematchRequests, playerId];

      const participantIds = Object.keys(state.playerColors);
      const allAgreed =
        participantIds.length >= 2 &&
        participantIds.every((id) => updatedRequests.includes(id));

      if (allAgreed) {
        const nextStartingPlayer: PlatformPlayer =
          state.startingPlayer === "orange" ? "blue" : "orange";

        const nextState: DotsBoxesGameState = {
          config: state.config,
          horizontalEdges: createEmptyHorizontal(state.config),
          verticalEdges: createEmptyVertical(state.config),
          boxes: createEmptyBoxes(state.config),
          scores: { orange: 0, blue: 0 },
          currentPlayer: nextStartingPlayer,
          startingPlayer: nextStartingPlayer,
          status: "in_progress",
          winner: null,
          lastMove: null,
          moveCount: 0,
          consecutiveBoxesThisTurn: 0,
          playerColors: { ...state.playerColors },
          rematchRequests: [],
        };
        return { nextState };
      }

      return {
        nextState: { ...state, rematchRequests: updatedRequests },
      };
    }

    // CLAIM_EDGE
    const playerColor = state.playerColors[playerId];
    const { edge } = action;

    const nextHorizontal = state.horizontalEdges.map((row) => [...row]);
    const nextVertical = state.verticalEdges.map((row) => [...row]);
    const nextBoxes = state.boxes.map((row) => [...row]);
    const nextScores = { ...state.scores };

    if (edge.type === "h") {
      nextHorizontal[edge.row][edge.col] = playerColor;
    } else {
      nextVertical[edge.row][edge.col] = playerColor;
    }

    // Check newly completed boxes
    const adjacent = getAdjacentBoxesForEdge(edge, state.config);
    const completedBoxes: BoxCoord[] = [];

    for (const box of adjacent) {
      if (state.boxes[box.row][box.col] === null) {
        if (isBoxComplete(box, nextHorizontal, nextVertical)) {
          nextBoxes[box.row][box.col] = playerColor;
          nextScores[playerColor] += 1;
          completedBoxes.push(box);
        }
      }
    }

    // Turn continuation rule
    let nextPlayer: PlatformPlayer;
    let nextConsecutive = 0;
    if (completedBoxes.length > 0) {
      nextPlayer = playerColor;
      nextConsecutive = state.consecutiveBoxesThisTurn + completedBoxes.length;
    } else {
      nextPlayer = playerColor === "orange" ? "blue" : "orange";
      nextConsecutive = 0;
    }

    // Check endgame
    const totalBoxes = state.config.rows * state.config.cols;
    const totalScored = nextScores.orange + nextScores.blue;
    let status = state.status;
    let winner: PlatformPlayer | "draw" | null = null;

    if (totalScored >= totalBoxes) {
      if (nextScores.orange > nextScores.blue) {
        status = "won";
        winner = "orange";
      } else if (nextScores.blue > nextScores.orange) {
        status = "won";
        winner = "blue";
      } else {
        status = "draw";
        winner = "draw";
      }
    }

    const nextState: DotsBoxesGameState = {
      config: state.config,
      horizontalEdges: nextHorizontal,
      verticalEdges: nextVertical,
      boxes: nextBoxes,
      scores: nextScores,
      currentPlayer: nextPlayer,
      startingPlayer: state.startingPlayer,
      status,
      winner,
      lastMove: {
        edge,
        player: playerColor,
        completedBoxes,
      },
      moveCount: state.moveCount + 1,
      consecutiveBoxesThisTurn: nextConsecutive,
      playerColors: { ...state.playerColors },
      rematchRequests: [],
    };

    return { nextState };
  }

  public handlePlayerDisconnect(
    state: DotsBoxesGameState,
    playerId: string,
    graceExpiresAt: number
  ): DotsBoxesGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: graceExpiresAt,
      disconnectedPlayerId: playerId,
    };
  }

  public handlePlayerReconnect(
    state: DotsBoxesGameState,
    _playerId: string
  ): DotsBoxesGameState {
    return {
      ...state,
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };
  }

  public handleForfeit(
    state: DotsBoxesGameState,
    forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: DotsBoxesGameState; isCompleted: boolean } {
    const forfeitedColor = state.playerColors[forfeitedPlayerId];
    const winningColor: PlatformPlayer =
      forfeitedColor === "orange" ? "blue" : "orange";

    const nextState: DotsBoxesGameState = {
      ...state,
      status: "won",
      winner: winningColor,
      resultReason: "disconnect_forfeit",
      disconnectGraceExpiresAt: null,
      disconnectedPlayerId: null,
    };

    return { nextState, isCompleted: true };
  }
}
