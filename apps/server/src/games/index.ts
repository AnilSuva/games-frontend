import { GameAdapterRegistry } from "./GameAdapter.js";
import { TicTacToeAdapter } from "./tic-tac-toe/TicTacToeAdapter.js";
import { ConnectFourAdapter } from "./connect-four/ConnectFourAdapter.js";
import { BrickBlastAdapter } from "./brick-blast/BrickBlastAdapter.js";

export * from "./GameAdapter.js";
export * from "./tic-tac-toe/index.js";
export { ConnectFourAdapter } from "./connect-four/ConnectFourAdapter.js";
export type {
  ConnectFourGameState,
  ConnectFourAction,
  PlayerDisc,
  WinningLine as ConnectFourWinningLine,
} from "./connect-four/types.js";
export { BrickBlastAdapter } from "./brick-blast/BrickBlastAdapter.js";
export type {
  BrickBlastGameState,
  BrickBlastAction,
  PlatformPlayer as BrickBlastPlayer,
} from "./brick-blast/types.js";

export function createDefaultGameRegistry(): GameAdapterRegistry {
  const registry = new GameAdapterRegistry();
  registry.register(new TicTacToeAdapter());
  registry.register(new ConnectFourAdapter());
  registry.register(new BrickBlastAdapter());
  return registry;
}

