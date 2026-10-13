import { GameAdapterRegistry } from "./GameAdapter.js";
import { TicTacToeAdapter } from "./tic-tac-toe/TicTacToeAdapter.js";
import { ConnectFourAdapter } from "./connect-four/ConnectFourAdapter.js";
import { BrickBlastAdapter } from "./brick-blast/BrickBlastAdapter.js";
import { CheckersAdapter } from "./checkers/CheckersAdapter.js";
import { PingPongAdapter } from "./ping-pong/PingPongAdapter.js";

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
export { CheckersAdapter } from "./checkers/CheckersAdapter.js";
export type {
  CheckersGameState,
  CheckersAction,
  CheckersPlayer,
} from "./checkers/types.js";
export { PingPongAdapter } from "./ping-pong/PingPongAdapter.js";
export type {
  PingPongGameState,
  PingPongAction,
  PlatformPlayer as PingPongPlayer,
} from "./ping-pong/types.js";

export function createDefaultGameRegistry(): GameAdapterRegistry {
  const registry = new GameAdapterRegistry();
  registry.register(new TicTacToeAdapter());
  registry.register(new ConnectFourAdapter());
  registry.register(new BrickBlastAdapter());
  registry.register(new CheckersAdapter());
  registry.register(new PingPongAdapter());
  return registry;
}

