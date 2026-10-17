/**
 * Star Catcher High-DPI Vector Texture Generator
 * Generates sharp procedural textures for spaceships, stars, hazards, and VFX.
 */

import Phaser from "phaser";
import {
  COLOR_ORANGE,
  COLOR_ORANGE_LIGHT,
  COLOR_BLUE,
  COLOR_BLUE_LIGHT,
} from "../config/constants";

const DIL = 2; // Supersampling factor for crisp edges

export function createStarCatcherTextures(scene: Phaser.Scene): void {
  // 1. Orange Spaceship
  createShipTexture(scene, "ship_orange", COLOR_ORANGE, COLOR_ORANGE_LIGHT, 0xfed7aa);

  // 2. Blue Spaceship
  createShipTexture(scene, "ship_blue", COLOR_BLUE, COLOR_BLUE_LIGHT, 0xbfdbfe);

  // 3. Golden Star
  createStarTexture(scene, "star_gold");

  // 4. Black Hole
  createBlackHoleTexture(scene, "black_hole");

  // 5. Asteroid Textures
  createAsteroidTexture(scene, "asteroid_1", 0x64748b, 0x334155, 1);
  createAsteroidTexture(scene, "asteroid_2", 0x475569, 0x1e293b, 2);

  // 6. Thruster Engine Flame
  createFlameTexture(scene, "flame_orange", 0xf97316, 0xfef08a);
  createFlameTexture(scene, "flame_blue", 0x38bdf8, 0xe0f2fe);

  // 7. Spark Particle
  createSparkTexture(scene, "spark_particle");

  // 8. Stardust Twinkle
  createStardustTexture(scene, "stardust_particle");
}

function createShipTexture(
  scene: Phaser.Scene,
  key: string,
  primaryColor: number,
  accentColor: number,
  cockpitColor: number
): void {
  if (scene.textures.exists(key)) return;

  const size = 48 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Rotate so ship faces angle 0 (pointing to the right in Phaser standard 0 rad)
  // Wings / Main Hull
  ctx.beginPath();
  // Nose tip at (+18, 0)
  ctx.moveTo(18 * DIL, 0);
  // Bottom-right wing tip at (-14, +15)
  ctx.lineTo(-14 * DIL, 15 * DIL);
  // Rear notch bottom (-8, +8)
  ctx.lineTo(-8 * DIL, 8 * DIL);
  // Rear center notch (-12, 0)
  ctx.lineTo(-12 * DIL, 0);
  // Rear notch top (-8, -8)
  ctx.lineTo(-8 * DIL, -8 * DIL);
  // Top-left wing tip at (-14, -15)
  ctx.lineTo(-14 * DIL, -15 * DIL);
  ctx.closePath();

  // Primary Hull Fill
  ctx.fillStyle = `#${primaryColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  // Dark border
  ctx.lineWidth = 2 * DIL;
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();

  // Accent Wing Stripes
  ctx.beginPath();
  ctx.moveTo(4 * DIL, -5 * DIL);
  ctx.lineTo(-12 * DIL, -13 * DIL);
  ctx.lineTo(-10 * DIL, -15 * DIL);
  ctx.lineTo(8 * DIL, -3 * DIL);
  ctx.closePath();
  ctx.fillStyle = `#${accentColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(4 * DIL, 5 * DIL);
  ctx.lineTo(-12 * DIL, 13 * DIL);
  ctx.lineTo(-10 * DIL, 15 * DIL);
  ctx.lineTo(8 * DIL, 3 * DIL);
  ctx.closePath();
  ctx.fillStyle = `#${accentColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  // Cockpit Canopy (rounded diamond / oval)
  ctx.beginPath();
  ctx.ellipse(3 * DIL, 0, 7 * DIL, 3.5 * DIL, 0, 0, Math.PI * 2);
  ctx.fillStyle = `#${cockpitColor.toString(16).padStart(6, "0")}`;
  ctx.fill();
  ctx.lineWidth = 1.2 * DIL;
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();

  // Cockpit glass highlight
  ctx.beginPath();
  ctx.ellipse(4 * DIL, -1 * DIL, 3 * DIL, 1.2 * DIL, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Dual Thruster Nozzles at rear (-10, -5) and (-10, +5)
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-13 * DIL, -7 * DIL, 4 * DIL, 3 * DIL);
  ctx.fillRect(-13 * DIL, 4 * DIL, 4 * DIL, 3 * DIL);

  ctx.restore();
  canvas.refresh();
}

function createFlameTexture(
  scene: Phaser.Scene,
  key: string,
  outerColor: number,
  coreColor: number
): void {
  if (scene.textures.exists(key)) return;

  const width = 24 * DIL;
  const height = 12 * DIL;
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return;

  const ctx = canvas.getContext();

  // Outer Flame (pointing left, from x=width to x=0)
  ctx.beginPath();
  ctx.moveTo(width, height / 2);
  ctx.quadraticCurveTo(width * 0.5, 0, 0, height / 2);
  ctx.quadraticCurveTo(width * 0.5, height, width, height / 2);
  ctx.closePath();
  ctx.fillStyle = `#${outerColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  // Inner Core Flame
  ctx.beginPath();
  ctx.moveTo(width, height / 2);
  ctx.quadraticCurveTo(width * 0.7, height * 0.25, width * 0.3, height / 2);
  ctx.quadraticCurveTo(width * 0.7, height * 0.75, width, height / 2);
  ctx.closePath();
  ctx.fillStyle = `#${coreColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  canvas.refresh();
}

function createStarTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 52 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const spikes = 5;
  const outerRadius = 18 * DIL;
  const innerRadius = 8 * DIL;

  // Soft Radial Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius * 1.3);
  glowGrad.addColorStop(0, "rgba(251, 191, 36, 0.45)");
  glowGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // 5-Point Golden Star Path
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius;
    let y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();

  // Gradient Fill
  const grad = ctx.createLinearGradient(cx - outerRadius, cy - outerRadius, cx + outerRadius, cy + outerRadius);
  grad.addColorStop(0, "#fef08a");
  grad.addColorStop(0.5, "#f59e0b");
  grad.addColorStop(1, "#d97706");
  ctx.fillStyle = grad;
  ctx.fill();

  // Crisp border
  ctx.lineWidth = 2 * DIL;
  ctx.strokeStyle = "#78350f";
  ctx.stroke();

  // Center bright spark
  ctx.beginPath();
  ctx.arc(cx, cy, 3 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  canvas.refresh();
}

function createBlackHoleTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 76 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  // Accretion disk spiral arms
  for (let a = 0; a < 3; a++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((a * Math.PI * 2) / 3);

    const grad = ctx.createRadialGradient(0, 0, 10 * DIL, 0, 0, 32 * DIL);
    grad.addColorStop(0, "rgba(168, 85, 247, 0.85)");
    grad.addColorStop(0.6, "rgba(99, 102, 241, 0.4)");
    grad.addColorStop(1, "rgba(99, 102, 241, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(4 * DIL, 0, 30 * DIL, 18 * DIL, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Event horizon glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, 15 * DIL, 0, Math.PI * 2);
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 2.5 * DIL;
  ctx.stroke();

  // Event horizon dark singularity core
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#030206";
  ctx.fill();

  canvas.refresh();
}

function createAsteroidTexture(
  scene: Phaser.Scene,
  key: string,
  baseColor: number,
  shadowColor: number,
  seed: number
): void {
  if (scene.textures.exists(key)) return;

  const size = 56 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const radius = 20 * DIL;

  // Irregular polygon vertices based on seed
  const points = seed === 1 ? [
    { a: 0, r: 0.95 },
    { a: 0.55, r: 1.05 },
    { a: 1.15, r: 0.85 },
    { a: 1.75, r: 1.0 },
    { a: 2.3, r: 0.9 },
    { a: 2.9, r: 1.08 },
    { a: 3.6, r: 0.88 },
    { a: 4.25, r: 1.02 },
    { a: 4.9, r: 0.92 },
    { a: 5.65, r: 1.06 },
  ] : [
    { a: 0, r: 1.0 },
    { a: 0.6, r: 0.85 },
    { a: 1.25, r: 1.08 },
    { a: 1.9, r: 0.92 },
    { a: 2.5, r: 1.04 },
    { a: 3.2, r: 0.86 },
    { a: 3.8, r: 1.05 },
    { a: 4.5, r: 0.9 },
    { a: 5.1, r: 1.08 },
    { a: 5.7, r: 0.88 },
  ];

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const x = cx + Math.cos(pt.a) * (radius * pt.r);
    const y = cy + Math.sin(pt.a) * (radius * pt.r);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  ctx.lineWidth = 2 * DIL;
  ctx.strokeStyle = "#1e293b";
  ctx.stroke();

  // Shading / Craters
  ctx.fillStyle = `#${shadowColor.toString(16).padStart(6, "0")}`;
  ctx.beginPath();
  ctx.arc(cx - 5 * DIL, cy - 4 * DIL, 3.5 * DIL, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + 6 * DIL, cy + 3 * DIL, 4.5 * DIL, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - 2 * DIL, cy + 7 * DIL, 2.5 * DIL, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();
}

function createSparkTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 12 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, 4 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#fef08a";
  ctx.fill();

  canvas.refresh();
}

function createStardustTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 8 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, 2 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  canvas.refresh();
}
