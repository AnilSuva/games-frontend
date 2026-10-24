/**
 * Star Catcher High-DPI Vector Texture Generator
 * Generates sharp procedural textures for spaceships, shields, stars, hazards, and VFX.
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
  // 1. Spaceships with metallic plating and glowing cockpit
  createShipTexture(scene, "ship_orange", COLOR_ORANGE, COLOR_ORANGE_LIGHT, 0xfed7aa, 0xf97316);
  createShipTexture(scene, "ship_blue", COLOR_BLUE, COLOR_BLUE_LIGHT, 0xbfdbfe, 0x3b82f6);

  // 2. Plasma Shields (Hexagonal energy barrier)
  createShieldTexture(scene, "shield_orange", 0xf97316);
  createShieldTexture(scene, "shield_blue", 0x38bdf8);

  // 3. Golden Star with Radiant Core
  createStarTexture(scene, "star_gold");
  createStarHaloTexture(scene, "star_halo");

  // 4. Black Hole Accretion Disk & Vortex
  createBlackHoleTexture(scene, "black_hole");
  createShockwaveRingTexture(scene, "shockwave_ring");

  // 5. Asteroid Textures with Crater Depth & Shading
  createAsteroidTexture(scene, "asteroid_1", 0x64748b, 0x334155, 1);
  createAsteroidTexture(scene, "asteroid_2", 0x475569, 0x1e293b, 2);

  // 6. High-Energy Thruster Plumes
  createFlameTexture(scene, "flame_orange", 0xf97316, 0xfef08a, 0xffffff);
  createFlameTexture(scene, "flame_blue", 0x0284c7, 0x38bdf8, 0xffffff);

  // 7. Particles & VFX
  createSparkTexture(scene, "spark_particle");
  createStardustTexture(scene, "stardust_particle");
  createPlasmaSmokeTexture(scene, "plasma_smoke");
  createWarpFlashTexture(scene, "warp_flash");
}

function createShipTexture(
  scene: Phaser.Scene,
  key: string,
  primaryColor: number,
  accentColor: number,
  cockpitColor: number,
  glowColor: number
): void {
  if (scene.textures.exists(key)) return;

  const size = 52 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Outer hull glow
  ctx.shadowColor = `#${glowColor.toString(16).padStart(6, "0")}`;
  ctx.shadowBlur = 8 * DIL;

  // Wings / Main Hull
  ctx.beginPath();
  // Sleek Nose tip at (+20, 0)
  ctx.moveTo(20 * DIL, 0);
  // Upper wing sweep
  ctx.lineTo(-6 * DIL, -9 * DIL);
  // Upper wingtip
  ctx.lineTo(-15 * DIL, -17 * DIL);
  // Upper wing trailing edge
  ctx.lineTo(-11 * DIL, -8 * DIL);
  // Center engine notch
  ctx.lineTo(-14 * DIL, 0);
  // Lower wing trailing edge
  ctx.lineTo(-11 * DIL, 8 * DIL);
  // Lower wingtip
  ctx.lineTo(-15 * DIL, 17 * DIL);
  // Lower wing sweep
  ctx.lineTo(-6 * DIL, 9 * DIL);
  ctx.closePath();

  // Primary Hull Gradient (directional specular sheen)
  const hullGrad = ctx.createLinearGradient(-15 * DIL, -17 * DIL, 20 * DIL, 17 * DIL);
  hullGrad.addColorStop(0, `#${accentColor.toString(16).padStart(6, "0")}`);
  hullGrad.addColorStop(0.5, `#${primaryColor.toString(16).padStart(6, "0")}`);
  hullGrad.addColorStop(1, `#${accentColor.toString(16).padStart(6, "0")}`);
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.shadowBlur = 0; // Clear blur for crisp outlines

  // Crisp armor border
  ctx.lineWidth = 1.8 * DIL;
  ctx.strokeStyle = "#090d16";
  ctx.stroke();

  // Armor Plating Seams
  ctx.beginPath();
  ctx.moveTo(8 * DIL, 0);
  ctx.lineTo(-6 * DIL, -7 * DIL);
  ctx.moveTo(8 * DIL, 0);
  ctx.lineTo(-6 * DIL, 7 * DIL);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1 * DIL;
  ctx.stroke();

  // Wingtip Plasma Beacons
  ctx.beginPath();
  ctx.arc(-14 * DIL, -16 * DIL, 2 * DIL, 0, Math.PI * 2);
  ctx.arc(-14 * DIL, 16 * DIL, 2 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Glowing Cockpit Canopy
  ctx.beginPath();
  ctx.ellipse(4 * DIL, 0, 7.5 * DIL, 3.8 * DIL, 0, 0, Math.PI * 2);
  const cockpitGrad = ctx.createRadialGradient(3 * DIL, -1 * DIL, 1 * DIL, 4 * DIL, 0, 7 * DIL);
  cockpitGrad.addColorStop(0, "#ffffff");
  cockpitGrad.addColorStop(0.4, `#${cockpitColor.toString(16).padStart(6, "0")}`);
  cockpitGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = cockpitGrad;
  ctx.fill();
  ctx.lineWidth = 1.2 * DIL;
  ctx.strokeStyle = "#090d16";
  ctx.stroke();

  // Dual Rear Thruster Nozzles
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-15 * DIL, -7 * DIL, 4.5 * DIL, 3.5 * DIL);
  ctx.fillRect(-15 * DIL, 3.5 * DIL, 4.5 * DIL, 3.5 * DIL);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1 * DIL;
  ctx.strokeRect(-15 * DIL, -7 * DIL, 4.5 * DIL, 3.5 * DIL);
  ctx.strokeRect(-15 * DIL, 3.5 * DIL, 4.5 * DIL, 3.5 * DIL);

  ctx.restore();
  canvas.refresh();
}

function createShieldTexture(scene: Phaser.Scene, key: string, color: number): void {
  if (scene.textures.exists(key)) return;

  const size = 56 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const r = 24 * DIL;

  // Outer Glow
  const grad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  const hex = color.toString(16).padStart(6, "0");
  grad.addColorStop(0, `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, 0.05)`);
  grad.addColorStop(0.8, `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, 0.35)`);
  grad.addColorStop(1, `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, 0.9)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Sharp Shield Rim
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1 * DIL, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5 * DIL;
  ctx.stroke();

  // Subtle Hexagonal Lattice Arc
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI) / 3;
    const x = cx + Math.cos(angle) * (r * 0.85);
    const y = cy + Math.sin(angle) * (r * 0.85);
    ctx.beginPath();
    ctx.arc(x, y, 3 * DIL, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
  }

  canvas.refresh();
}

function createFlameTexture(
  scene: Phaser.Scene,
  key: string,
  outerColor: number,
  midColor: number,
  coreColor: number
): void {
  if (scene.textures.exists(key)) return;

  const width = 30 * DIL;
  const height = 14 * DIL;
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return;

  const ctx = canvas.getContext();

  // Outer Flame Plume (Pointing Left from x = width to x = 0)
  ctx.beginPath();
  ctx.moveTo(width, height / 2);
  ctx.quadraticCurveTo(width * 0.55, 0, 0, height / 2);
  ctx.quadraticCurveTo(width * 0.55, height, width, height / 2);
  ctx.closePath();
  ctx.fillStyle = `#${outerColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  // Mid Flame
  ctx.beginPath();
  ctx.moveTo(width, height / 2);
  ctx.quadraticCurveTo(width * 0.65, height * 0.18, width * 0.2, height / 2);
  ctx.quadraticCurveTo(width * 0.65, height * 0.82, width, height / 2);
  ctx.closePath();
  ctx.fillStyle = `#${midColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  // White-Hot Inner Core
  ctx.beginPath();
  ctx.moveTo(width, height / 2);
  ctx.quadraticCurveTo(width * 0.75, height * 0.32, width * 0.45, height / 2);
  ctx.quadraticCurveTo(width * 0.75, height * 0.68, width, height / 2);
  ctx.closePath();
  ctx.fillStyle = `#${coreColor.toString(16).padStart(6, "0")}`;
  ctx.fill();

  canvas.refresh();
}

function createStarTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 56 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const spikes = 5;
  const outerRadius = 19 * DIL;
  const innerRadius = 8.5 * DIL;

  // 1. Soft Corona Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius * 1.35);
  glowGrad.addColorStop(0, "rgba(254, 240, 138, 0.6)");
  glowGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.3)");
  glowGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // 2. 5-Point Golden Star Path
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

  // Radiant Gradient Fill
  const grad = ctx.createLinearGradient(cx - outerRadius, cy - outerRadius, cx + outerRadius, cy + outerRadius);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.25, "#fef08a");
  grad.addColorStop(0.65, "#f59e0b");
  grad.addColorStop(1, "#b45309");
  ctx.fillStyle = grad;
  ctx.fill();

  // Crisp border
  ctx.lineWidth = 1.8 * DIL;
  ctx.strokeStyle = "#78350f";
  ctx.stroke();

  // Facet highlights for crystalline 3D look
  ctx.beginPath();
  rot = (Math.PI / 2) * 3;
  for (let i = 0; i < spikes; i++) {
    const x = cx + Math.cos(rot) * outerRadius;
    const y = cy + Math.sin(rot) * outerRadius;
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    rot += step * 2;
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1 * DIL;
  ctx.stroke();

  // Bright Center Diamond Spark
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  canvas.refresh();
}

function createStarHaloTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 64 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const r = 30 * DIL;

  const grad = ctx.createRadialGradient(cx, cy, 2 * DIL, cx, cy, r);
  grad.addColorStop(0, "rgba(254, 240, 138, 0.75)");
  grad.addColorStop(0.35, "rgba(245, 158, 11, 0.35)");
  grad.addColorStop(0.7, "rgba(217, 119, 6, 0.12)");
  grad.addColorStop(1, "rgba(217, 119, 6, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 4-Point cross flare
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1.5 * DIL;
  ctx.beginPath();
  ctx.moveTo(cx - 24 * DIL, cy);
  ctx.lineTo(cx + 24 * DIL, cy);
  ctx.moveTo(cx, cy - 24 * DIL);
  ctx.lineTo(cx, cy + 24 * DIL);
  ctx.stroke();

  canvas.refresh();
}

function createBlackHoleTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 88 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  // 1. Relativistic Outer Lensing Glow
  const outerGrad = ctx.createRadialGradient(cx, cy, 14 * DIL, cx, cy, 42 * DIL);
  outerGrad.addColorStop(0, "rgba(168, 85, 247, 0.35)");
  outerGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.2)");
  outerGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 42 * DIL, 0, Math.PI * 2);
  ctx.fill();

  // 2. Accretion Disk Spiral Infall Arms
  for (let a = 0; a < 4; a++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((a * Math.PI) / 2);

    const grad = ctx.createRadialGradient(0, 0, 12 * DIL, 0, 0, 36 * DIL);
    grad.addColorStop(0, "rgba(192, 132, 252, 0.9)");
    grad.addColorStop(0.4, "rgba(147, 51, 234, 0.5)");
    grad.addColorStop(0.8, "rgba(79, 70, 229, 0.25)");
    grad.addColorStop(1, "rgba(79, 70, 229, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(6 * DIL, 0, 35 * DIL, 16 * DIL, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Einstein Ring Photon Sphere (Luminous boundary)
  ctx.beginPath();
  ctx.arc(cx, cy, 17 * DIL, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(233, 213, 255, 0.85)";
  ctx.lineWidth = 2 * DIL;
  ctx.stroke();

  // 4. Dark Singularity Core
  ctx.beginPath();
  ctx.arc(cx, cy, 15.5 * DIL, 0, Math.PI * 2);
  ctx.fillStyle = "#020204";
  ctx.fill();

  canvas.refresh();
}

function createShockwaveRingTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 64 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const r = 28 * DIL;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3 * DIL;
  ctx.stroke();

  // Soft inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3 * DIL, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
  ctx.lineWidth = 2 * DIL;
  ctx.stroke();

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

  const size = 64 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const radius = 22 * DIL;

  // Multi-octave organic rock contour vertices (asymmetrical, rugged silhouette)
  // sharp: true marks major shear fractures and angular cleavage corners
  const points = seed === 1 ? [
    { a: 0.0, r: 0.98, sharp: false },
    { a: 0.22, r: 1.06, sharp: false },
    { a: 0.45, r: 1.14, sharp: true },  // Fracture corner
    { a: 0.68, r: 0.98, sharp: false },
    { a: 0.90, r: 0.86, sharp: true },  // Deep impact gorge
    { a: 1.14, r: 0.82, sharp: false },
    { a: 1.36, r: 0.92, sharp: false },
    { a: 1.60, r: 1.05, sharp: false },
    { a: 1.84, r: 1.15, sharp: true },  // Crest apex
    { a: 2.08, r: 1.08, sharp: false },
    { a: 2.32, r: 0.92, sharp: false },
    { a: 2.56, r: 0.84, sharp: true },  // Sheared cliff notch
    { a: 2.80, r: 0.96, sharp: false },
    { a: 3.04, r: 1.12, sharp: false },
    { a: 3.28, r: 1.18, sharp: true },  // Elongated boulder nose
    { a: 3.52, r: 1.08, sharp: false },
    { a: 3.76, r: 0.94, sharp: false },
    { a: 4.00, r: 0.84, sharp: true },  // Ancient impact bay
    { a: 4.24, r: 0.92, sharp: false },
    { a: 4.48, r: 1.06, sharp: false },
    { a: 4.72, r: 1.14, sharp: true },  // Ridge spur
    { a: 4.98, r: 1.04, sharp: false },
    { a: 5.24, r: 0.90, sharp: false },
    { a: 5.48, r: 0.82, sharp: true },  // Gouged saddle
    { a: 5.74, r: 0.94, sharp: false },
    { a: 6.00, r: 1.06, sharp: false },
  ] : [
    { a: 0.0, r: 1.08, sharp: true },   // Crystalline corner
    { a: 0.24, r: 0.92, sharp: false },
    { a: 0.48, r: 0.80, sharp: true },  // Deep cleavage indentation
    { a: 0.72, r: 0.96, sharp: false },
    { a: 0.96, r: 1.14, sharp: true },  // Protruding angular peak
    { a: 1.20, r: 1.18, sharp: false },
    { a: 1.44, r: 1.02, sharp: false },
    { a: 1.68, r: 0.86, sharp: true },  // Sheared fault drop
    { a: 1.92, r: 0.78, sharp: false },
    { a: 2.16, r: 0.94, sharp: false },
    { a: 2.40, r: 1.12, sharp: true },  // Horn terrace
    { a: 2.64, r: 1.16, sharp: false },
    { a: 2.88, r: 1.04, sharp: false },
    { a: 3.12, r: 0.86, sharp: true },  // Concave impact notch
    { a: 3.36, r: 0.80, sharp: false },
    { a: 3.60, r: 0.94, sharp: false },
    { a: 3.84, r: 1.10, sharp: true },  // Sharp tetrahedral vertex
    { a: 4.08, r: 1.18, sharp: false },
    { a: 4.34, r: 1.06, sharp: false },
    { a: 4.58, r: 0.90, sharp: true },  // Fracture step
    { a: 4.82, r: 0.82, sharp: false },
    { a: 5.08, r: 0.96, sharp: false },
    { a: 5.34, r: 1.12, sharp: true },  // Metallic ridge spur
    { a: 5.60, r: 1.16, sharp: false },
    { a: 5.84, r: 1.02, sharp: false },
    { a: 6.06, r: 0.92, sharp: true },
  ];

  // Helper to construct the organic contour path
  const buildContourPath = () => {
    const coords = points.map((p) => ({
      x: cx + Math.cos(p.a) * (radius * p.r),
      y: cy + Math.sin(p.a) * (radius * p.r),
      sharp: p.sharp,
    }));

    ctx.beginPath();
    const n = coords.length;
    ctx.moveTo((coords[0].x + coords[1].x) / 2, (coords[0].y + coords[1].y) / 2);

    for (let i = 0; i < n; i++) {
      const curr = coords[(i + 1) % n];
      const next = coords[(i + 2) % n];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;

      if (curr.sharp) {
        ctx.lineTo(curr.x, curr.y);
        ctx.lineTo(midX, midY);
      } else {
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
    }
    ctx.closePath();
  };

  // 1. Subtle Outer Cosmic Aura
  ctx.save();
  buildContourPath();
  ctx.shadowColor = seed === 1 ? "rgba(100, 116, 139, 0.35)" : "rgba(56, 189, 248, 0.25)";
  ctx.shadowBlur = 6 * DIL;
  ctx.fillStyle = "#090d16";
  ctx.fill();
  ctx.restore();

  // 2. Base Volumetric 3D Shading
  buildContourPath();
  const mainGrad = ctx.createLinearGradient(
    cx - radius * 1.1,
    cy - radius * 1.1,
    cx + radius * 1.0,
    cy + radius * 1.0
  );
  mainGrad.addColorStop(0, "#e2e8f0"); // Specular rock crust highlight
  mainGrad.addColorStop(0.2, `#${baseColor.toString(16).padStart(6, "0")}`); // Sunlit rock
  mainGrad.addColorStop(0.55, `#${shadowColor.toString(16).padStart(6, "0")}`); // Mid-tone basalt
  mainGrad.addColorStop(0.85, "#1e293b"); // Deep shadow
  mainGrad.addColorStop(1, "#070b14"); // Dark abyss side
  ctx.fillStyle = mainGrad;
  ctx.fill();

  // 3. Clip internal geological details to rock boundary
  ctx.save();
  buildContourPath();
  ctx.clip();

  // 4. 3D Structural Relief Facets & Cleavage Planes
  const facets = seed === 1 ? [
    // Facet 1: Sunward high plateau
    {
      pts: [{ x: -14, y: -18 }, { x: 4, y: -16 }, { x: -2, y: -4 }, { x: -18, y: -6 }],
      fill: "rgba(241, 245, 249, 0.22)",
    },
    // Facet 2: Upper flank cliff
    {
      pts: [{ x: 4, y: -16 }, { x: 18, y: -8 }, { x: 14, y: 2 }, { x: -2, y: -4 }],
      fill: "rgba(148, 163, 184, 0.14)",
    },
    // Facet 3: Central terrace
    {
      pts: [{ x: -18, y: -6 }, { x: -2, y: -4 }, { x: 10, y: 6 }, { x: 2, y: 16 }, { x: -12, y: 12 }],
      fill: "rgba(100, 116, 139, 0.12)",
    },
    // Facet 4: Deep cast shadow cliff
    {
      pts: [{ x: 14, y: 2 }, { x: 22, y: 12 }, { x: 8, y: 18 }, { x: 10, y: 6 }],
      fill: "rgba(15, 23, 42, 0.58)",
    },
    // Facet 5: Bottom abyss ravine
    {
      pts: [{ x: -12, y: 12 }, { x: 2, y: 16 }, { x: 6, y: 22 }, { x: -10, y: 22 }],
      fill: "rgba(7, 11, 20, 0.68)",
    },
  ] : [
    // Angular crystalline facets (Siderite)
    {
      pts: [{ x: -14, y: -16 }, { x: 2, y: -22 }, { x: 12, y: -12 }, { x: -2, y: -6 }],
      fill: "rgba(226, 232, 240, 0.24)",
    },
    {
      pts: [{ x: -14, y: -16 }, { x: -2, y: -6 }, { x: -8, y: 12 }, { x: -20, y: 2 }],
      fill: "rgba(148, 163, 184, 0.16)",
    },
    {
      pts: [{ x: -2, y: -6 }, { x: 12, y: -12 }, { x: 18, y: 4 }, { x: 4, y: 8 }],
      fill: "rgba(100, 116, 139, 0.15)",
    },
    {
      pts: [{ x: 12, y: -12 }, { x: 22, y: -4 }, { x: 20, y: 14 }, { x: 18, y: 4 }],
      fill: "rgba(15, 23, 42, 0.62)",
    },
    {
      pts: [{ x: -8, y: 12 }, { x: 4, y: 8 }, { x: 14, y: 18 }, { x: -4, y: 22 }],
      fill: "rgba(7, 11, 20, 0.72)",
    },
  ];

  for (const f of facets) {
    ctx.beginPath();
    ctx.moveTo(cx + f.pts[0].x * DIL, cy + f.pts[0].y * DIL);
    for (let i = 1; i < f.pts.length; i++) {
      ctx.lineTo(cx + f.pts[i].x * DIL, cy + f.pts[i].y * DIL);
    }
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();

    // 3D Ridge boundaries
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1 * DIL;
    ctx.stroke();
  }

  // 5. Deep Structural Stress Fractures & Fault Lines
  const fractures = seed === 1 ? [
    [{ x: -4, y: -18 }, { x: -2, y: -10 }, { x: 4, y: -4 }, { x: 2, y: 4 }, { x: 8, y: 12 }],
    [{ x: -12, y: -2 }, { x: -6, y: 2 }, { x: -2, y: 10 }],
  ] : [
    [{ x: 12, y: -14 }, { x: 6, y: -4 }, { x: 2, y: 4 }, { x: -4, y: 14 }],
    [{ x: 6, y: -4 }, { x: 12, y: 4 }, { x: 16, y: 12 }],
  ];

  for (const frac of fractures) {
    // Shadow crevice
    ctx.beginPath();
    ctx.moveTo(cx + frac[0].x * DIL, cy + frac[0].y * DIL);
    for (let i = 1; i < frac.length; i++) {
      ctx.lineTo(cx + frac[i].x * DIL, cy + frac[i].y * DIL);
    }
    ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
    ctx.lineWidth = 1.6 * DIL;
    ctx.stroke();

    // Highlighted sun-facing lip
    ctx.beginPath();
    ctx.moveTo(cx + (frac[0].x - 0.7) * DIL, cy + (frac[0].y - 0.7) * DIL);
    for (let i = 1; i < frac.length; i++) {
      ctx.lineTo(cx + (frac[i].x - 0.7) * DIL, cy + (frac[i].y - 0.7) * DIL);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 0.9 * DIL;
    ctx.stroke();
  }

  // 6. Multi-Scale Impact Craters
  const drawCrater = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    hasPeak: boolean = false
  ) => {
    const px = cx + x * DIL;
    const py = cy + y * DIL;
    const rxd = rx * DIL;
    const ryd = ry * DIL;

    // Ejecta blanket wash
    ctx.beginPath();
    ctx.ellipse(px, py, rxd * 1.35, ryd * 1.35, rot, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(203, 213, 225, 0.12)";
    ctx.fill();

    // Crater bowl interior shadow
    ctx.beginPath();
    ctx.ellipse(px, py, rxd, ryd, rot, 0, Math.PI * 2);
    const craterGrad = ctx.createRadialGradient(
      px - rxd * 0.3,
      py - ryd * 0.3,
      rxd * 0.1,
      px + rxd * 0.4,
      py + ryd * 0.4,
      rxd
    );
    craterGrad.addColorStop(0, "rgba(51, 65, 85, 0.7)");
    craterGrad.addColorStop(0.5, "rgba(15, 23, 42, 0.95)");
    craterGrad.addColorStop(1, "#030712");
    ctx.fillStyle = craterGrad;
    ctx.fill();

    // Sunlit rim crest (facing sun at ~135 deg)
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rxd, ryd, 0, Math.PI * 0.7, Math.PI * 1.8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.4 * DIL;
    ctx.stroke();

    // Shadowed rim crest (opposite sun)
    ctx.beginPath();
    ctx.ellipse(0, 0, rxd, ryd, 0, Math.PI * 1.8, Math.PI * 0.7);
    ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
    ctx.lineWidth = 1.4 * DIL;
    ctx.stroke();
    ctx.restore();

    // Central rebound peak in ancient craters
    if (hasPeak) {
      ctx.beginPath();
      ctx.arc(px - 0.5 * DIL, py - 0.5 * DIL, 1.2 * DIL, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px + 0.8 * DIL, py + 0.8 * DIL, 1.0 * DIL, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
      ctx.fill();
    }
  };

  if (seed === 1) {
    // Primary basin with central peak
    drawCrater(-5, -6, 6.8, 5.2, 0.25, true);
    // Secondary craters
    drawCrater(8, 4, 4.4, 3.8, -0.2);
    drawCrater(-8, 8, 3.4, 2.8, 0.4);
    drawCrater(5, -10, 3.0, 2.4, 0.1);
  } else {
    // Primary basin with central peak
    drawCrater(5, -5, 6.5, 5.0, -0.3, true);
    // Secondary craters
    drawCrater(-6, 6, 4.2, 3.6, 0.3);
    drawCrater(7, 8, 3.2, 2.6, -0.1);
    drawCrater(-10, -6, 2.8, 2.4, 0.5);
  }

  // Micro-meteorite pits
  const microPits = seed === 1 ? [
    { x: -14, y: -2, r: 1.5 },
    { x: 12, y: -4, r: 1.7 },
    { x: 2, y: 14, r: 1.9 },
    { x: 14, y: 10, r: 1.4 },
    { x: -4, y: 16, r: 1.3 },
    { x: -10, y: -12, r: 1.5 },
  ] : [
    { x: -4, y: -14, r: 1.6 },
    { x: 14, y: -2, r: 1.4 },
    { x: -14, y: 4, r: 1.6 },
    { x: 0, y: 12, r: 1.5 },
    { x: 12, y: 14, r: 1.3 },
    { x: -2, y: 2, r: 1.4 },
  ];

  for (const mp of microPits) {
    ctx.beginPath();
    ctx.arc(cx + mp.x * DIL, cy + mp.y * DIL, mp.r * DIL, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + mp.x * DIL, cy + mp.y * DIL, mp.r * DIL, Math.PI * 0.75, Math.PI * 1.75);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 0.8 * DIL;
    ctx.stroke();
  }

  // 7. Crystalline Mineral Veins & Ore Inclusions
  if (seed === 1) {
    // Gold-pyrite mineral vein network
    ctx.beginPath();
    ctx.moveTo(cx - 10 * DIL, cy - 8 * DIL);
    ctx.lineTo(cx - 3 * DIL, cy - 1 * DIL);
    ctx.lineTo(cx + 4 * DIL, cy + 2 * DIL);
    ctx.lineTo(cx + 9 * DIL, cy + 9 * DIL);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
    ctx.lineWidth = 1 * DIL;
    ctx.stroke();

    // Ore glints
    const glints = [{ x: -3, y: -1 }, { x: 4, y: 2 }, { x: 7, y: -8 }, { x: -8, y: 6 }];
    for (const g of glints) {
      ctx.beginPath();
      ctx.arc(cx + g.x * DIL, cy + g.y * DIL, 0.9 * DIL, 0, Math.PI * 2);
      ctx.fillStyle = "#fef08a";
      ctx.fill();
    }
  } else {
    // Nickel-iron crystalline striations
    ctx.beginPath();
    ctx.moveTo(cx - 8 * DIL, cy - 14 * DIL);
    ctx.lineTo(cx + 2 * DIL, cy - 8 * DIL);
    ctx.moveTo(cx - 12 * DIL, cy + 2 * DIL);
    ctx.lineTo(cx - 2 * DIL, cy + 8 * DIL);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1 * DIL;
    ctx.stroke();

    // Metallic glints
    const glints = [{ x: 2, y: -8 }, { x: -2, y: 8 }, { x: 10, y: -2 }, { x: -8, y: -10 }];
    for (const g of glints) {
      ctx.beginPath();
      ctx.arc(cx + g.x * DIL, cy + g.y * DIL, 0.9 * DIL, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }

  // 8. Surface Regolith Dust Stippling (Deterministic Porous Texture)
  for (let i = 0; i < 70; i++) {
    const angle = ((i * 137.5) % 360) * (Math.PI / 180);
    const dist = Math.sqrt((i + 1) / 70) * (radius * 0.85);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const isLight = (i * 7 + seed) % 3 === 0;
    ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.22)" : "rgba(2, 6, 23, 0.35)";
    ctx.beginPath();
    ctx.arc(px, py, ((i % 3) + 1) * 0.4 * DIL, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9. Surface Boulders (Protruding Rock Formations)
  const boulders = seed === 1 ? [
    { x: -12, y: -14, r: 2.4 },
    { x: 10, y: -2, r: 2.1 },
    { x: -4, y: 12, r: 1.9 },
  ] : [
    { x: -14, y: -8, r: 2.3 },
    { x: 8, y: 2, r: 2.2 },
    { x: -2, y: 14, r: 2.0 },
  ];

  for (const b of boulders) {
    const bx = cx + b.x * DIL;
    const by = cy + b.y * DIL;
    const br = b.r * DIL;

    // Boulder shadow cast onto asteroid
    ctx.beginPath();
    ctx.arc(bx + 1 * DIL, by + 1 * DIL, br, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
    ctx.fill();

    // Boulder body
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = seed === 1 ? "#64748b" : "#475569";
    ctx.fill();

    // Boulder sunward highlight
    ctx.beginPath();
    ctx.arc(bx, by, br, Math.PI * 0.8, Math.PI * 1.8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 0.9 * DIL;
    ctx.stroke();
  }

  ctx.restore(); // Restore unclipped state

  // 10. Outer Silhouette Edge Lighting & High-Contrast Outline
  buildContourPath();
  ctx.strokeStyle = "#070b14";
  ctx.lineWidth = 1.8 * DIL;
  ctx.stroke();

  // Sunlit specular rim along upper-left
  ctx.save();
  ctx.beginPath();
  const coords = points.map((p) => ({
    x: cx + Math.cos(p.a) * (radius * p.r),
    y: cy + Math.sin(p.a) * (radius * p.r),
    a: p.a,
  }));
  // Stroke only vertices on sunward side (angles between PI*0.75 and PI*1.85)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.2 * DIL;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    // Facing upper-left sun
    if (c.a > Math.PI * 0.65 && c.a < Math.PI * 1.85) {
      const next = coords[(i + 1) % coords.length];
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
  }
  ctx.restore();

  canvas.refresh();
}

function createSparkTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 16 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7 * DIL);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, "rgba(253, 224, 71, 0.9)");
  grad.addColorStop(0.75, "rgba(249, 115, 22, 0.4)");
  grad.addColorStop(1, "rgba(249, 115, 22, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 7 * DIL, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();
}

function createStardustTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 12 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5 * DIL);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.5, "rgba(147, 197, 253, 0.8)");
  grad.addColorStop(1, "rgba(147, 197, 253, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 5 * DIL, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();
}

function createPlasmaSmokeTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 20 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9 * DIL);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
  grad.addColorStop(0.4, "rgba(148, 163, 184, 0.35)");
  grad.addColorStop(1, "rgba(148, 163, 184, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 9 * DIL, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();
}

function createWarpFlashTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;

  const size = 32 * DIL;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return;

  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15 * DIL);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.4, "rgba(192, 132, 252, 0.8)");
  grad.addColorStop(0.8, "rgba(99, 102, 241, 0.3)");
  grad.addColorStop(1, "rgba(99, 102, 241, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 15 * DIL, 0, Math.PI * 2);
  ctx.fill();

  canvas.refresh();
}
