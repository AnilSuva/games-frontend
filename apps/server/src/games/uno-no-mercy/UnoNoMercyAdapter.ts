import type {
  ActionResult,
  DisconnectPolicy,
  GameAdapter,
  ImmediateRemoveResult,
  TurnDeadlineInfo,
  ValidationOutcome,
} from "../GameAdapter.js";
import {
  applyUnoAction,
  createUnoInitialState,
  DEFAULT_UNO_SETTINGS,
  projectUnoStateForPlayer,
  removeUnoPlayer,
  validateUnoAction,
  validateUnoSettings,
} from "./rules.js";
import type { UnoAction, UnoGameState, UnoPublicPlayerView } from "./types.js";

export class UnoNoMercyAdapter implements GameAdapter<UnoGameState, UnoAction> {
  public readonly gameId = "uno-no-mercy";
  public readonly minPlayers = 2;
  public readonly maxPlayers = 6;
  public readonly manualStart = true;
  public readonly disconnectPolicy: DisconnectPolicy = "remove_immediately";
  public readonly defaultSettings: Record<string, unknown> = {
    ...DEFAULT_UNO_SETTINGS,
  };

  public validateSettings(
    settings: Record<string, unknown>
  ): ValidationOutcome & { normalized?: Record<string, unknown> } {
    return validateUnoSettings(settings);
  }

  public createInitialState(options?: Record<string, unknown>): UnoGameState {
    return createUnoInitialState(options);
  }

  public validateAction(
    state: UnoGameState,
    action: UnoAction,
    playerId: string
  ): ValidationOutcome {
    return validateUnoAction(state, action, playerId);
  }

  public applyAction(
    state: UnoGameState,
    action: UnoAction,
    playerId: string
  ): ActionResult<UnoGameState> {
    return applyUnoAction(state, action, playerId);
  }

  public projectStateForPlayer(
    state: UnoGameState,
    playerId: string
  ): UnoPublicPlayerView {
    return projectUnoStateForPlayer(state, playerId);
  }

  public handleImmediateRemove(
    state: UnoGameState,
    playerId: string,
    reason: "disconnected" | "afk_timeout"
  ): ImmediateRemoveResult<UnoGameState> {
    return removeUnoPlayer(state, playerId, reason);
  }

  public getTurnDeadline(state: UnoGameState): TurnDeadlineInfo | null {
    if (state.status !== "in_progress" || !state.activeActorId || state.turnDeadlineAt === null) {
      return null;
    }
    return {
      activeActorId: state.activeActorId,
      deadlineAt: state.turnDeadlineAt,
      timeoutMs: state.settings.turnTimeoutMs,
    };
  }
}
