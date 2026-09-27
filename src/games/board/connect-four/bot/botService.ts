import { getBotMoveByDifficulty, type BotDifficulty } from "./difficulty";
import type { Board, Player } from "../logic/types";
import type { BotWorkerRequest, BotWorkerResponse } from "./connectFour.worker";

export type { BotDifficulty };

export interface BotRequestOptions {
  difficulty?: BotDifficulty;
  delayMs?: number;
  signal?: AbortSignal;
}

let sharedWorker: Worker | null = null;
let currentRequestId = 0;

function getBotWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL("./connectFour.worker.ts", import.meta.url));
    } catch {
      return null;
    }
  }
  return sharedWorker;
}

export function terminateBotWorker(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
}

export async function requestBotMove(
  board: Board,
  columnCounts: readonly [number, number, number, number, number, number, number],
  botPlayer: Player,
  options: BotRequestOptions = {}
): Promise<number> {
  const { difficulty = "medium", delayMs = 300, signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  const startTime = Date.now();
  const worker = getBotWorker();

  let calculationPromise: Promise<number>;

  if (worker) {
    calculationPromise = new Promise<number>((resolve, reject) => {
      const requestId = ++currentRequestId;

      const handleMessage = (event: MessageEvent<BotWorkerResponse>) => {
        if (event.data?.id === requestId) {
          cleanup();
          resolve(event.data.move);
        }
      };

      const handleError = (error: ErrorEvent) => {
        cleanup();
        reject(error);
      };

      const handleAbort = () => {
        cleanup();
        reject(new DOMException("Bot calculation aborted", "AbortError"));
      };

      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        signal?.removeEventListener("abort", handleAbort);
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      signal?.addEventListener("abort", handleAbort, { once: true });

      const request: BotWorkerRequest = {
        id: requestId,
        board,
        columnCounts,
        botPlayer,
        difficulty,
      };

      worker.postMessage(request);
    });
  } else {
    calculationPromise = Promise.resolve().then(() => {
      if (signal?.aborted) {
        throw new DOMException("Bot calculation aborted", "AbortError");
      }
      return getBotMoveByDifficulty(board, columnCounts, botPlayer, difficulty);
    });
  }

  const bestMove = await calculationPromise;

  if (signal?.aborted) {
    throw new DOMException("Bot calculation aborted", "AbortError");
  }

  const elapsed = Date.now() - startTime;
  const remainingDelay = Math.max(0, delayMs - elapsed);

  if (remainingDelay > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, remainingDelay);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Bot calculation aborted", "AbortError"));
          },
          { once: true }
        );
      }
    });
  }

  return bestMove;
}