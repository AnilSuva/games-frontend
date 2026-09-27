"use client";

import { useEffect, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";

/**
 * Phase 1 Preview cartridge for Tic-Tac-Toe.
 * Redesigned with the calm, tactile design system:
 * - Player 1 (X): Orange (#e0530a)
 * - Player 2 (O): Blue (#2563eb)
 * - Restrained tactile ceramic tiles with crisp contrast.
 */
export default function TicTacToePreview({
  mode,
  onGameOver,
  onScoreUpdate,
  onReady,
}: GameHostProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [status, setStatus] = useState<string>("In Progress");

  const handleRestart = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setStatus("In Progress");
    onScoreUpdate?.(0);
  }, [onScoreUpdate]);

  useEffect(() => {
    const controller: IGameController = {
      restart: handleRestart,
      pause: () => {
        setStatus("Paused");
      },
      resume: () => {
        setStatus("In Progress");
      },
    };

    onReady(controller);
  }, [handleRestart, onReady]);

  const handleCellClick = (index: number) => {
    if (board[index] || status !== "In Progress") return;

    const newBoard = [...board];
    newBoard[index] = turn;
    setBoard(newBoard);

    // Win evaluation
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    let hasWinner = false;
    for (const [a, b, c] of wins) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        hasWinner = true;
        const winner = newBoard[a];
        setStatus(`Player ${winner === "X" ? "1" : "2"} Won`);
        onScoreUpdate?.(100);
        onGameOver({ winner, score: 100 });
        break;
      }
    }

    if (!hasWinner && newBoard.every((cell) => cell !== null)) {
      setStatus("Game Drawn");
      onGameOver({ winner: "draw", score: 50 });
    } else if (!hasWinner) {
      setTurn(turn === "X" ? "O" : "X");
    }
  };

  const isPlayer1 = turn === "X";

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-2 select-none">
      {/* Turn Indicator */}
      <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e6e3dc] text-xs shadow-xs">
        <span
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
            isPlayer1 ? "bg-[#e0530a]" : "bg-[#2563eb]"
          }`}
        />
        <span className="font-medium text-[#1c1917]">
          {status === "In Progress" ? (
            isPlayer1 ? (
              <span>Player 1 (Orange)&apos;s turn</span>
            ) : (
              <span>{mode === "pvp-bot" ? "Bot (Blue)" : "Player 2 (Blue)"}&apos;s turn</span>
            )
          ) : (
            status
          )}
        </span>
      </div>

      {/* Tactile 3x3 Ceramic Board */}
      <div 
        className="grid grid-cols-3 gap-2.5 p-3 bg-[#faf9f6] rounded-2xl border border-[#e6e3dc] shadow-sm"
        role="grid"
        aria-label="Tic-Tac-Toe Grid"
      >
        {board.map((val, i) => (
          <button
            key={i}
            onClick={() => handleCellClick(i)}
            disabled={val !== null || status !== "In Progress"}
            className="w-18 h-18 sm:w-22 sm:h-22 rounded-xl bg-white hover:bg-[#faf9f6] disabled:hover:bg-white text-3xl sm:text-4xl font-black flex items-center justify-center transition-all duration-100 active:scale-95 border border-[#e6e3dc] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]"
            aria-label={`Cell ${i + 1}, ${val ? `marked ${val}` : "empty"}`}
          >
            {val === "X" && <span className="text-[#e0530a]">X</span>}
            {val === "O" && <span className="text-[#2563eb]">O</span>}
          </button>
        ))}
      </div>

      {/* Reset button */}
      <div className="mt-5">
        <button
          onClick={handleRestart}
          className="px-3.5 py-1 text-xs font-medium text-[#6b665f] hover:text-[#1c1917] bg-white hover:bg-[#faf9f6] border border-[#e6e3dc] rounded-md transition active:scale-95"
        >
          Reset Match
        </button>
      </div>
    </div>
  );
}
