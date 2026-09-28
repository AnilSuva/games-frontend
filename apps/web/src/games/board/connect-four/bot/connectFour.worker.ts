import { getBotMoveByDifficulty, type BotDifficulty } from "./difficulty";
import type { Board, Player } from "../logic/types";

export interface BotWorkerRequest {
  id: number;
  board: Board;
  columnCounts: readonly [number, number, number, number, number, number, number];
  botPlayer: Player;
  difficulty: BotDifficulty;
}

export interface BotWorkerResponse {
  id: number;
  move: number;
}

addEventListener("message", (event: MessageEvent<BotWorkerRequest>) => {
  const { id, board, columnCounts, botPlayer, difficulty } = event.data;
  try {
    const move = getBotMoveByDifficulty(board, columnCounts, botPlayer, difficulty);
    postMessage({ id, move });
  } catch {
    postMessage({ id, move: -1 });
  }
});
