"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHostProps, IGameController } from "@/games/common/types";

/**
 * Phase 1 Preview cartridge for Brick Blast.
 * Redesigned with the calm design language:
 * - Canvas frame with warm border and clean contrast
 * - Player 1 Orange ball (#e0530a)
 * - Player 2 Blue paddle (#2563eb)
 * - Muted brick palette
 */
export default function BrickBlastPreview({
  mode,
  onGameOver,
  onScoreUpdate,
  onReady,
}: GameHostProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const gameStateRef = useRef({
    score: 0,
    paddleX: 160,
    paddleWidth: 60,
    ballX: 160,
    ballY: 200,
    ballVx: 2.8,
    ballVy: -2.8,
    ballRadius: 5.5,
    running: true,
    paused: false,
    bricks: Array.from({ length: 15 }, (_, i) => ({
      x: 30 + (i % 5) * 55,
      y: 30 + Math.floor(i / 5) * 24,
      w: 46,
      h: 16,
      alive: true,
      color: i < 5 ? "#e0530a" : i < 10 ? "#64748b" : "#2563eb",
    })),
  });

  const handleRestart = useCallback(() => {
    const s = gameStateRef.current;
    s.score = 0;
    s.paddleX = 160;
    s.ballX = 160;
    s.ballY = 200;
    s.ballVx = 2.8;
    s.ballVy = -2.8;
    s.running = true;
    s.paused = false;
    s.bricks.forEach((b) => (b.alive = true));
    setScore(0);
    setIsPaused(false);
    onScoreUpdate?.(0);
  }, [onScoreUpdate]);

  useEffect(() => {
    const controller: IGameController = {
      restart: handleRestart,
      pause: () => {
        gameStateRef.current.paused = true;
        setIsPaused(true);
      },
      resume: () => {
        gameStateRef.current.paused = false;
        setIsPaused(false);
      },
      destroy: () => {
        gameStateRef.current.running = false;
      },
    };

    onReady(controller);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const gameLoop = () => {
      const s = gameStateRef.current;

      if (s.running && !s.paused) {
        // Physics update
        s.ballX += s.ballVx;
        s.ballY += s.ballVy;

        // Wall collisions
        if (s.ballX - s.ballRadius <= 0 || s.ballX + s.ballRadius >= canvas.width) {
          s.ballVx = -s.ballVx;
        }
        if (s.ballY - s.ballRadius <= 0) {
          s.ballVy = -s.ballVy;
        }

        // Paddle collision
        const paddleY = canvas.height - 24;
        if (
          s.ballY + s.ballRadius >= paddleY &&
          s.ballY - s.ballRadius <= paddleY + 8 &&
          s.ballX >= s.paddleX - s.paddleWidth / 2 &&
          s.ballX <= s.paddleX + s.paddleWidth / 2
        ) {
          s.ballVy = -Math.abs(s.ballVy);
          const offset = (s.ballX - s.paddleX) / (s.paddleWidth / 2);
          s.ballVx = offset * 3.5;
        }

        // Brick collisions
        s.bricks.forEach((b) => {
          if (
            b.alive &&
            s.ballX >= b.x &&
            s.ballX <= b.x + b.w &&
            s.ballY >= b.y &&
            s.ballY <= b.y + b.h
          ) {
            b.alive = false;
            s.ballVy = -s.ballVy;
            s.score += 20;
            setScore(s.score);
            onScoreUpdate?.(s.score);
          }
        });

        // Bottom boundary
        if (s.ballY - s.ballRadius > canvas.height) {
          s.running = false;
          onGameOver({ score: s.score });
        }
      }

      // Render calm light-slate canvas
      ctx.fillStyle = "#faf9f6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle boundary outline
      ctx.strokeStyle = "#e6e3dc";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Bricks
      s.bricks.forEach((b) => {
        if (b.alive) {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, 3);
          ctx.fill();
        }
      });

      // Paddle (Player 2 Blue)
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.roundRect(s.paddleX - s.paddleWidth / 2, canvas.height - 22, s.paddleWidth, 8, 4);
      ctx.fill();

      // Ball (Player 1 Orange)
      ctx.fillStyle = "#e0530a";
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, s.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      gameStateRef.current.paddleX = Math.max(30, Math.min(canvas.width - 30, x));
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("touchmove", handlePointerMove, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
    };
  }, [handleRestart, onGameOver, onReady, onScoreUpdate]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-2 select-none">
      <div className="flex items-center justify-between w-full max-w-xs mb-2.5 text-xs text-[#6b665f]">
        <span>Mode: <strong className="text-[#1c1917]">{mode}</strong></span>
        <span className="font-mono text-[#1c1917]">Score: {score}</span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-[#e6e3dc] shadow-sm bg-white">
        <canvas
          ref={canvasRef}
          width={320}
          height={380}
          className="touch-none cursor-ew-resize block"
        />

        {isPaused && (
          <div className="absolute inset-0 bg-[#f7f6f2]/85 backdrop-blur-[1px] flex items-center justify-center text-[#1c1917] text-sm font-semibold">
            PAUSED
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-[#9c978e] text-center">
        Slide horizontally to deflect the ball
      </p>
    </div>
  );
}
