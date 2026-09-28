import { GameAdapterRegistry } from "./GameAdapter.js";
import { TicTacToeAdapter } from "./tic-tac-toe/TicTacToeAdapter.js";

export * from "./GameAdapter.js";
export * from "./tic-tac-toe/index.js";

export function createDefaultGameRegistry(): GameAdapterRegistry {
  const registry = new GameAdapterRegistry();
  registry.register(new TicTacToeAdapter());
  return registry;
}
