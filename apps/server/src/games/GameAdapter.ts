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

export interface GameAdapter<TState = unknown, TAction = unknown, TResult = unknown> {
  readonly gameId: string;
  createInitialState(options?: Record<string, unknown>): TState;
  validateAction(state: TState, action: TAction, playerId: string): ValidationOutcome;
  applyAction(state: TState, action: TAction, playerId: string): ActionResult<TState, TResult>;
  serializeState?(state: TState, forPlayerId?: string): unknown;
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
