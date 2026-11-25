/**
 * Generic game adapter interface.
 * Decouples game-specific rules, state transitions, and validation
 * from the transport and room lifecycle management layers.
 */
export interface ActionResult<TState = unknown, TResult = unknown> {
  nextState: TState;
  result?: TResult;
  events?: unknown[];
}

export interface ValidationOutcome {
  valid: boolean;
  error?: string;
}

export type DisconnectPolicy = "grace_forfeit" | "remove_immediately";

export interface TurnDeadlineInfo {
  activeActorId: string | null;
  deadlineAt: number | null;
  timeoutMs: number;
}

export interface ImmediateRemoveResult<TState = unknown> {
  nextState: TState;
  isCompleted: boolean;
  events?: unknown[];
}

export interface GameAdapter<TState = unknown, TAction = unknown, TResult = unknown> {
  readonly gameId: string;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  readonly manualStart?: boolean;
  readonly disconnectPolicy?: DisconnectPolicy;
  readonly defaultSettings?: Record<string, unknown>;

  createInitialState(options?: Record<string, unknown>): TState;
  validateAction(state: TState, action: TAction, playerId: string): ValidationOutcome;
  applyAction(state: TState, action: TAction, playerId: string): ActionResult<TState, TResult>;
  validateSettings?(
    settings: Record<string, unknown>
  ): ValidationOutcome & { normalized?: Record<string, unknown> };
  projectStateForPlayer?(state: TState, playerId: string): unknown;
  serializeState?(state: TState, forPlayerId?: string): unknown;
  handlePlayerDisconnect?(state: TState, playerId: string, graceExpiresAt: number): TState;
  handlePlayerReconnect?(state: TState, playerId: string): TState;
  handleForfeit?(
    state: TState,
    forfeitedPlayerId: string,
    remainingPlayerIds: string[]
  ): { nextState: TState; isCompleted: boolean };
  handleImmediateRemove?(
    state: TState,
    playerId: string,
    reason: "disconnected" | "afk_timeout"
  ): ImmediateRemoveResult<TState>;
  getTurnDeadline?(state: TState): TurnDeadlineInfo | null;
}

/**
 * Registry holding pluggable game adapters.
 */
export class GameAdapterRegistry {
  private adapters = new Map<string, GameAdapter>();

  public register(adapter: GameAdapter): void {
    this.adapters.set(adapter.gameId, adapter);
  }

  public get(gameId: string): GameAdapter | undefined {
    return this.adapters.get(gameId);
  }

  public has(gameId: string): boolean {
    return this.adapters.has(gameId);
  }

  public unregister(gameId: string): boolean {
    return this.adapters.delete(gameId);
  }
}
