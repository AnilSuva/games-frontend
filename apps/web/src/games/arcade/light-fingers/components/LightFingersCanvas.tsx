"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type {
  LightFingersState,
  PlayerId,
  MoneyItem,
  TouchClaw,
} from "../logic/types";
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  WINNING_SCORE,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MAX_X,
  VAULT_TOP_Y,
  VAULT_BOTTOM_Y,
  VAULT_MOUTH_MIN_X,
  VAULT_MOUTH_MAX_X,
} from "../config/constants";

interface LightFingersCanvasProps {
  state: LightFingersState;
  onPointerDown: (playerId: PlayerId, touchId: number, x: number, y: number) => void;
  onPointerMove: (playerId: PlayerId, touchId: number, x: number, y: number) => void;
  onPointerUp: (playerId: PlayerId, touchId: number) => void;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const LightFingersCanvas: React.FC<LightFingersCanvasProps> = ({
  state,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active touch assignments (pointerId -> PlayerId)
  const touchPlayerMap = useRef<Map<number, PlayerId>>(new Map());

  // Visual effects state
  const floatingTexts = useRef<FloatingText[]>([]);
  const particles = useRef<Particle[]>([]);
  const nextParticleId = useRef<number>(1);
  const prevEventsRef = useRef<number>(0);

  // Vault animation flash timers
  const blueVaultFlash = useRef<number>(0);
  const orangeVaultFlash = useRef<number>(0);

  // Screen shake on banknote rip
  const screenShake = useRef<number>(0);

  // Process game events into visual feedback
  useEffect(() => {
    if (state.recentEvents && state.recentEvents.length > 0) {
      for (const ev of state.recentEvents) {
        if (ev.kind === "coin_collected" || ev.kind === "banknote_collected") {
          const isBlue = ev.playerId === "blue";
          const color = isBlue ? "#3b82f6" : "#f97316";
          const val = ev.value || (ev.kind === "coin_collected" ? 1 : 3);

          if (isBlue) blueVaultFlash.current = 0.35;
          else orangeVaultFlash.current = 0.35;

          // Floating score text
          floatingTexts.current.push({
            id: nextParticleId.current++,
            text: `+${val}`,
            x: ev.x || VIRTUAL_WIDTH / 2,
            y: isBlue ? VAULT_TOP_Y + 50 : VAULT_BOTTOM_Y - 50,
            color,
            alpha: 1.0,
            scale: val === 3 ? 1.5 : 1.15,
          });

          // Particle burst
          const burstColor = ev.kind === "coin_collected" ? "#f59e0b" : "#22c55e";
          for (let p = 0; p < 16; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 90 + Math.random() * 180;
            particles.current.push({
              x: ev.x || VIRTUAL_WIDTH / 2,
              y: isBlue ? VAULT_TOP_Y + 20 : VAULT_BOTTOM_Y - 20,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: burstColor,
              size: 3 + Math.random() * 4,
              alpha: 1.0,
              life: 0,
              maxLife: 0.45 + Math.random() * 0.25,
            });
          }
        } else if (ev.kind === "banknote_ripped") {
          screenShake.current = 0.25;

          // Paper fiber burst!
          for (let p = 0; p < 28; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 140 + Math.random() * 260;
            particles.current.push({
              x: ev.x || VIRTUAL_WIDTH / 2,
              y: ev.y || VIRTUAL_HEIGHT / 2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: Math.random() > 0.4 ? "#ffffff" : "#4ade80",
              size: 4 + Math.random() * 5,
              alpha: 1.0,
              life: 0,
              maxLife: 0.6 + Math.random() * 0.3,
            });
          }
        }
      }
    }
    prevEventsRef.current = state.recentEvents.length;
  }, [state.recentEvents]);

  // Coordinate converter: maps screen pointer event into virtual (600x800) coordinates
  const getVirtualCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_WIDTH / rect.width;
    const scaleY = VIRTUAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = getVirtualCoords(e);

      let playerId: PlayerId;
      if (state.mode === "bot") {
        playerId = "orange"; // human always plays Orange (Bottom) vs Bot
      } else {
        // In local 1v1 split screen, assign player by starting quadrant
        playerId = y < VIRTUAL_HEIGHT / 2 ? "blue" : "orange";
      }

      touchPlayerMap.current.set(e.pointerId, playerId);
      onPointerDown(playerId, e.pointerId, x, y);
    },
    [getVirtualCoords, state.mode, onPointerDown]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const playerId = touchPlayerMap.current.get(e.pointerId);
      if (!playerId) return;
      const { x, y } = getVirtualCoords(e);
      onPointerMove(playerId, e.pointerId, x, y);
    },
    [getVirtualCoords, onPointerMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      const playerId = touchPlayerMap.current.get(e.pointerId);
      if (playerId) {
        touchPlayerMap.current.delete(e.pointerId);
        onPointerUp(playerId, e.pointerId);
      }
    },
    [onPointerUp]
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Update flash & shake timers
      if (blueVaultFlash.current > 0) blueVaultFlash.current -= dt;
      if (orangeVaultFlash.current > 0) orangeVaultFlash.current -= dt;
      if (screenShake.current > 0) screenShake.current -= dt;

      // Clear Canvas
      ctx.save();

      // Screen shake translation
      if (screenShake.current > 0) {
        const shakeMag = screenShake.current * 14;
        const sx = (Math.random() - 0.5) * shakeMag;
        const sy = (Math.random() - 0.5) * shakeMag;
        ctx.translate(sx, sy);
      }

      ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // 1. Draw Table Surface & Rails
      drawBackground(ctx);

      // 2. Draw Vaults (Blue top, Orange bottom)
      drawVaults(ctx, state, blueVaultFlash.current > 0, orangeVaultFlash.current > 0);

      // 3. Draw Money Items (Coins, Banknotes, Torn Pieces)
      drawItems(ctx, state.items);

      // 4. Draw Elastic Arms & Cat Paws (Both X and Y movement)
      drawClaws(ctx, state.claws);

      // 5. Draw Particles
      drawParticles(ctx, particles.current, dt);

      // 6. Draw Floating Score Texts
      drawFloatingTexts(ctx, floatingTexts.current, dt);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full max-w-[560px] max-h-[750px] aspect-[3/4] mx-auto select-none touch-none flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border-2 border-[#1c1917] bg-[#0c120c]"
    >
      <canvas
        ref={canvasRef}
        width={VIRTUAL_WIDTH}
        height={VIRTUAL_HEIGHT}
        className="w-full h-full block cursor-pointer select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
};

/**
 * Draws the tactile tabletop felt with guide lines and wooden side rails.
 */
function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Rich Emerald Green Felt Table Surface
  const bgGrad = ctx.createRadialGradient(
    VIRTUAL_WIDTH / 2,
    VIRTUAL_HEIGHT / 2,
    50,
    VIRTUAL_WIDTH / 2,
    VIRTUAL_HEIGHT / 2,
    450
  );
  bgGrad.addColorStop(0, "#1b4d3e");
  bgGrad.addColorStop(0.7, "#143a2f");
  bgGrad.addColorStop(1, "#0d261e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // Subtle Felt Texture Grid Dots
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let x = PLAYFIELD_MIN_X; x <= PLAYFIELD_MAX_X; x += 36) {
    for (let y = VAULT_TOP_Y + 40; y <= VAULT_BOTTOM_Y - 40; y += 36) {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // Center subtle dividing line with circular emblem
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(PLAYFIELD_MIN_X, VIRTUAL_HEIGHT / 2);
  ctx.lineTo(PLAYFIELD_MAX_X, VIRTUAL_HEIGHT / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center circle emblem
  ctx.beginPath();
  ctx.arc(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, 54, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Polished Mahogany Side Rails (Left & Right)
  const leftRailWidth = PLAYFIELD_MIN_X;
  const rightRailX = PLAYFIELD_MAX_X;
  const rightRailWidth = VIRTUAL_WIDTH - PLAYFIELD_MAX_X;

  // Left wood rail
  const woodGradLeft = ctx.createLinearGradient(0, 0, leftRailWidth, 0);
  woodGradLeft.addColorStop(0, "#2c1810");
  woodGradLeft.addColorStop(0.7, "#4a2818");
  woodGradLeft.addColorStop(1, "#1e100a");
  ctx.fillStyle = woodGradLeft;
  ctx.fillRect(0, 0, leftRailWidth, VIRTUAL_HEIGHT);

  // Right wood rail
  const woodGradRight = ctx.createLinearGradient(rightRailX, 0, VIRTUAL_WIDTH, 0);
  woodGradRight.addColorStop(0, "#1e100a");
  woodGradRight.addColorStop(0.3, "#4a2818");
  woodGradRight.addColorStop(1, "#2c1810");
  ctx.fillStyle = woodGradRight;
  ctx.fillRect(rightRailX, 0, rightRailWidth, VIRTUAL_HEIGHT);

  // Rail inner gold edge line
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftRailWidth, 0);
  ctx.lineTo(leftRailWidth, VIRTUAL_HEIGHT);
  ctx.moveTo(rightRailX, 0);
  ctx.lineTo(rightRailX, VIRTUAL_HEIGHT);
  ctx.stroke();
}

/**
 * Draws the high-security Steel Safe Vaults at top and bottom.
 */
function drawVaults(
  ctx: CanvasRenderingContext2D,
  state: LightFingersState,
  blueFlash: boolean,
  orangeFlash: boolean
): void {
  // ================= Top Vault (Blue / Player 2 / Bot) =================
  const blueY = 0;
  const topVaultHeight = VAULT_TOP_Y;

  // Metallic safe door body
  const blueGrad = ctx.createLinearGradient(0, 0, 0, topVaultHeight);
  blueGrad.addColorStop(0, blueFlash ? "#3b82f6" : "#1e293b");
  blueGrad.addColorStop(1, blueFlash ? "#1d4ed8" : "#0f172a");
  ctx.fillStyle = blueGrad;
  ctx.fillRect(0, blueY, VIRTUAL_WIDTH, topVaultHeight);

  // Blue Accent Stripe
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, topVaultHeight - 6, VIRTUAL_WIDTH, 6);

  // Vault Intake Mouth
  ctx.fillStyle = "#020617";
  ctx.fillRect(VAULT_MOUTH_MIN_X, topVaultHeight - 16, VAULT_MOUTH_MAX_X - VAULT_MOUTH_MIN_X, 16);

  // Intake glow slit
  ctx.fillStyle = blueFlash ? "#93c5fd" : "#38bdf8";
  ctx.fillRect(VAULT_MOUTH_MIN_X + 20, topVaultHeight - 6, VAULT_MOUTH_MAX_X - VAULT_MOUTH_MIN_X - 40, 4);

  // Vault Combo Dial & Details
  drawVaultDial(ctx, 60, topVaultHeight / 2 - 3, "#3b82f6");

  // Top Vault HUD: Blue Score & Player Tag
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    state.mode === "bot" ? "CPU BOT (BLUE)" : "PLAYER 2 (BLUE)",
    105,
    topVaultHeight / 2 - 3
  );

  // Digital Score Badge
  drawScoreDisplay(ctx, VIRTUAL_WIDTH - 65, topVaultHeight / 2 - 3, state.score.blue, "#60a5fa");

  // ================= Bottom Vault (Orange / Player 1) =================
  const orangeY = VAULT_BOTTOM_Y;
  const bottomVaultHeight = VIRTUAL_HEIGHT - VAULT_BOTTOM_Y;

  // Metallic safe door body
  const orangeGrad = ctx.createLinearGradient(0, orangeY, 0, VIRTUAL_HEIGHT);
  orangeGrad.addColorStop(0, orangeFlash ? "#ea580c" : "#0f172a");
  orangeGrad.addColorStop(1, orangeFlash ? "#c2410c" : "#1e293b");
  ctx.fillStyle = orangeGrad;
  ctx.fillRect(0, orangeY, VIRTUAL_WIDTH, bottomVaultHeight);

  // Orange Accent Stripe
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(0, orangeY, VIRTUAL_WIDTH, 6);

  // Vault Intake Mouth
  ctx.fillStyle = "#020617";
  ctx.fillRect(VAULT_MOUTH_MIN_X, orangeY, VAULT_MOUTH_MAX_X - VAULT_MOUTH_MIN_X, 16);

  // Intake glow slit
  ctx.fillStyle = orangeFlash ? "#fdba74" : "#fb923c";
  ctx.fillRect(VAULT_MOUTH_MIN_X + 20, orangeY + 2, VAULT_MOUTH_MAX_X - VAULT_MOUTH_MIN_X - 40, 4);

  // Vault Combo Dial & Details
  drawVaultDial(ctx, 60, orangeY + bottomVaultHeight / 2 + 3, "#f97316");

  // Bottom Vault HUD: Orange Score & Player Tag
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    state.mode === "bot" ? "YOU (ORANGE)" : "PLAYER 1 (ORANGE)",
    105,
    orangeY + bottomVaultHeight / 2 + 3
  );

  // Digital Score Badge
  drawScoreDisplay(ctx, VIRTUAL_WIDTH - 65, orangeY + bottomVaultHeight / 2 + 3, state.score.orange, "#fb923c");
}

/**
 * Draws a detailed steel vault combination dial.
 */
function drawVaultDial(ctx: CanvasRenderingContext2D, x: number, y: number, accentColor: string): void {
  ctx.save();
  ctx.translate(x, y);

  // Outer bezel
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dial face
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();

  // Tick marks
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
    ctx.lineTo(Math.cos(angle) * 19, Math.sin(angle) * 19);
    ctx.stroke();
  }

  // Dial knob center
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an illuminated digital score readout.
 */
function drawScoreDisplay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  score: number,
  glowColor: string
): void {
  ctx.save();
  ctx.translate(x, y);

  // Display background
  ctx.fillStyle = "#020617";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-45, -20, 90, 40, [8]);
  ctx.fill();
  ctx.stroke();

  // Score text
  ctx.fillStyle = glowColor;
  ctx.font = "bold 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${score}/${WINNING_SCORE}`, 0, 1);

  ctx.restore();
}

/**
 * Draws active elastic arms and stylized cartoon Cat Paws extending in BOTH X and Y.
 */
function drawClaws(ctx: CanvasRenderingContext2D, claws: TouchClaw[]): void {
  for (const claw of claws) {
    const isBlue = claw.playerId === "blue";
    const primaryColor = isBlue ? "#2563eb" : "#ea580c";
    const padColor = isBlue ? "#bfdbfe" : "#fed7aa";
    const shadowColor = "rgba(0, 0, 0, 0.35)";

    // Vector from anchor to fingertip
    const originX = claw.originX;
    const originY = claw.originY;
    const dx = claw.x - originX;
    const dy = claw.y - originY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // ================= 1. Elastic Rope / Arm (Fune) =================
    // Drop shadow
    ctx.save();
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(originX, originY + 6);
    ctx.lineTo(claw.x, claw.y + 6);
    ctx.stroke();

    // Main thick braided elastic cable
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(claw.x, claw.y);
    ctx.stroke();

    // Inner bright player cable
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(claw.x, claw.y);
    ctx.stroke();

    // Cable tension stripes
    const numStripes = Math.floor(dist / 22);
    ctx.strokeStyle = padColor;
    ctx.lineWidth = 3;
    for (let s = 1; s < numStripes; s++) {
      const t = s / numStripes;
      const px = originX + dx * t;
      const py = originY + dy * t;
      const perpAngle = angle + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(perpAngle) * 4, py - Math.sin(perpAngle) * 4);
      ctx.lineTo(px + Math.cos(perpAngle) * 4, py + Math.sin(perpAngle) * 4);
      ctx.stroke();
    }

    // Vault anchor grommet / collar
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(originX, originY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // ================= 2. Touch Indicator Ring (Dito) =================
    ctx.save();
    ctx.strokeStyle = padColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(claw.x, claw.y, 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.arc(claw.x, claw.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ================= 3. Cartoon Cat Paw (Zampa) =================
    // Rotate paw towards reach direction (angle - PI/2 makes tip face forward)
    ctx.save();
    ctx.translate(claw.x, claw.y);
    ctx.rotate(angle - Math.PI / 2);

    drawCatPaw(ctx, primaryColor, padColor, claw.isGrabbing);

    ctx.restore();
  }
}

/**
 * Draws an expressive cartoon Cat Paw (ZampaGatto).
 * Curled inward when grabbing, open when reaching.
 */
function drawCatPaw(
  ctx: CanvasRenderingContext2D,
  pawColor: string,
  padColor: string,
  isGrabbing: boolean
): void {
  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 6, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main white/cream paw base
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wrist connector backing
  ctx.fillStyle = pawColor;
  ctx.beginPath();
  ctx.roundRect(-14, -28, 28, 20, [6]);
  ctx.fill();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Toe beans (4 toes at top edge)
  const toeCurl = isGrabbing ? 2 : 7; // toes extend out or curl in
  const toeSpread = [
    { x: -17, y: toeCurl - 2, r: 7 },
    { x: -7, y: toeCurl + 3, r: 8 },
    { x: 7, y: toeCurl + 3, r: 8 },
    { x: 17, y: toeCurl - 2, r: 7 },
  ];

  for (const toe of toeSpread) {
    // Toe outline & white fur
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(toe.x, toe.y, toe.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Colored soft toe bean pad
    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.arc(toe.x, toe.y, toe.r - 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Retractable claws extending forward when grasping
    if (isGrabbing) {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.moveTo(toe.x - 2, toe.y + toe.r);
      ctx.lineTo(toe.x, toe.y + toe.r + 6);
      ctx.lineTo(toe.x + 2, toe.y + toe.r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // Large central heart-shaped palm pad
  ctx.fillStyle = pawColor;
  ctx.beginPath();
  ctx.ellipse(0, -6, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Draws all money items (coins, banknotes, torn halves) with clean vector styling.
 */
function drawItems(ctx: CanvasRenderingContext2D, items: MoneyItem[]): void {
  for (const item of items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.kind === "coin") {
      drawCoin(ctx, item);
    } else if (item.kind === "banknote") {
      drawBanknote(ctx, item);
    } else if (item.kind === "torn_piece") {
      drawTornPiece(ctx, item);
    }

    ctx.restore();
  }
}

/**
 * Draws an embossed Gold Coin ($1).
 */
function drawCoin(ctx: CanvasRenderingContext2D, item: MoneyItem): void {
  const r = item.radius;

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.arc(3, 5, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer gold rim
  const rimGrad = ctx.createLinearGradient(-r, -r, r, r);
  rimGrad.addColorStop(0, "#fde047");
  rimGrad.addColorStop(0.5, "#d97706");
  rimGrad.addColorStop(1, "#92400e");

  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner milled ring
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Embossed numeral "1"
  ctx.fillStyle = "#78350f";
  ctx.font = "bold 22px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", 0, 1);

  // Gleam highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a Green Banknote ($3) with ornate currency details.
 */
function drawBanknote(ctx: CanvasRenderingContext2D, item: MoneyItem): void {
  const w = item.width;
  const h = item.height;

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, [6]);
  ctx.fill();

  // Outer border & paper texture
  ctx.fillStyle = "#15803d";
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [6]);
  ctx.fill();
  ctx.stroke();

  // Inner decorative border
  ctx.strokeStyle = "#bbf7d0";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, [4]);
  ctx.stroke();

  // Center Currency Oval
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Center "$" Symbol
  ctx.fillStyle = "#f0fdf4";
  ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 1);

  // Corner Numerals "3"
  ctx.fillStyle = "#bbf7d0";
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("3", -w / 2 + 10, -h / 2 + 11);
  ctx.fillText("3", w / 2 - 10, -h / 2 + 11);
  ctx.fillText("3", -w / 2 + 10, h / 2 - 9);
  ctx.fillText("3", w / 2 - 10, h / 2 - 9);

  // Tug-of-war tension indicator (if both players pulling!)
  if (item.grabbedBy.length >= 2) {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, 0);
    ctx.lineTo(w / 2 - 6, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Draws a Torn Banknote Piece with jagged rip seam ($1 each).
 */
function drawTornPiece(ctx: CanvasRenderingContext2D, item: MoneyItem): void {
  const w = item.width;
  const h = item.height;

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, -h / 2 + 4, w, h, [4]);
  ctx.fill();

  // Paper fill
  ctx.fillStyle = "#16a34a";
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [4]);
  ctx.fill();
  ctx.stroke();

  // Jagged rip seam along the tear edge
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const tearX = item.half === "top" ? -w / 2 : w / 2;
  const step = h / 6;
  ctx.moveTo(tearX, -h / 2);
  for (let i = 0; i <= 6; i++) {
    const offsetX = i % 2 === 0 ? 4 : -4;
    ctx.lineTo(tearX + offsetX, -h / 2 + i * step);
  }
  ctx.strokeStyle = "#dcfce7";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // +1 Point Value Badge
  ctx.fillStyle = "#f0fdf4";
  ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+1", 0, 1);
}

/**
 * Draws floating "+1" / "+3" score texts.
 */
function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  dt: number
): void {
  for (let i = texts.length - 1; i >= 0; i--) {
    const ft = texts[i];
    ft.y -= 50 * dt; // float upwards
    ft.alpha -= 1.5 * dt; // fade out

    if (ft.alpha <= 0) {
      texts.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.fillStyle = ft.color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.font = `bold ${Math.round(26 * ft.scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

/**
 * Draws particle bursts for item collection and tearing.
 */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  parts: Particle[],
  dt: number
): void {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      parts.splice(i, 1);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha = 1 - p.life / p.maxLife;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
