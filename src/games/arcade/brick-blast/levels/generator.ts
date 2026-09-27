import {
  BRICK_COLS,
  BRICK_ROWS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_GAP_X,
  BRICK_GAP_Y,
  BRICK_START_Y,
  GAME_WIDTH,
  INITIAL_BALL_SPEED,
  LEVEL_SPEED_MULTIPLIER,
  COLOR_BRICK_NORMAL,
  COLOR_BRICK_STRONG,
  COLOR_SPECIAL,
} from "../config/balance";
import { TEMPLATES } from "./layouts";

export interface BrickDefinition {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  isSpecial: boolean;
  color: number;
}

export interface LevelData {
  levelNumber: number;
  templateIndex: number;
  templateName: string;
  bricks: BrickDefinition[];
  specialBrickCount: number;
  strongBrickCount: number;
  totalBricks: number;
  baseBallSpeed: number;
}

/**
 * Deterministic pseudo-random number generator for fair, reproducible levels.
 */
function createPrng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return function nextFloat(): number {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Computes the speed for a given level using the geometric progression:
 * baseBallSpeed = INITIAL_BALL_SPEED * (1.05 ^ (levelNumber - 1))
 */
export function getLevelBaseSpeed(levelNumber: number): number {
  const exponent = Math.max(0, levelNumber - 1);
  return INITIAL_BALL_SPEED * Math.pow(LEVEL_SPEED_MULTIPLIER, exponent);
}

/**
 * Generates fair, symmetrical brick layout from the 5 templates.
 */
export function generateLevel(levelNumber: number, seed?: number): LevelData {
  const templateIndex = Math.max(0, (levelNumber - 1) % TEMPLATES.length);
  const template = TEMPLATES[templateIndex];
  const prng = createPrng(seed !== undefined ? seed : levelNumber * 7919 + 104729);

  const totalGridWidth = BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP_X;
  const startX = (GAME_WIDTH - totalGridWidth) / 2;

  const bricks: BrickDefinition[] = [];
  let specialBrickCount = 0;
  let strongBrickCount = 0;

  // Process rows symmetrically in pairs (Row r and Row BRICK_ROWS - 1 - r)
  const halfRows = BRICK_ROWS / 2; // 4 rows

  for (let r = 0; r < halfRows; r++) {
    const oppR = BRICK_ROWS - 1 - r;

    for (let c = 0; c < BRICK_COLS; c++) {
      if (template.grid[r][c] !== 1) continue;

      // Symmetric cell pair determination
      const isStrong = prng() < 0.20; // 20% strong 2-hit bricks
      const isSpecial = prng() < 0.055; // ~5.5% special bricks

      const maxHp = isStrong ? 2 : 1;
      const color = isSpecial
        ? COLOR_SPECIAL
        : isStrong
        ? COLOR_BRICK_STRONG
        : COLOR_BRICK_NORMAL;

      // Top-half brick
      const x1 = startX + c * (BRICK_WIDTH + BRICK_GAP_X) + BRICK_WIDTH / 2;
      const y1 = BRICK_START_Y + r * (BRICK_HEIGHT + BRICK_GAP_Y) + BRICK_HEIGHT / 2;

      bricks.push({
        id: `brick_${r}_${c}`,
        row: r,
        col: c,
        x: x1,
        y: y1,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        hp: maxHp,
        maxHp,
        isSpecial,
        color,
      });

      if (isSpecial) specialBrickCount++;
      if (isStrong) strongBrickCount++;

      // Symmetrically mirrored bottom-half brick
      const y2 = BRICK_START_Y + oppR * (BRICK_HEIGHT + BRICK_GAP_Y) + BRICK_HEIGHT / 2;

      // Bottom counterpart has identical strength and layout symmetry
      // Special is also mirrored to preserve absolute vertical fairness
      bricks.push({
        id: `brick_${oppR}_${c}`,
        row: oppR,
        col: c,
        x: x1,
        y: y2,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        hp: maxHp,
        maxHp,
        isSpecial,
        color,
      });

      if (isSpecial) specialBrickCount++;
      if (isStrong) strongBrickCount++;
    }
  }

  // Safety fallback: ensure at least one special brick if none spawned
  if (specialBrickCount === 0 && bricks.length >= 2) {
    bricks[0].isSpecial = true;
    bricks[0].color = COLOR_SPECIAL;
    bricks[1].isSpecial = true;
    bricks[1].color = COLOR_SPECIAL;
    specialBrickCount = 2;
  }

  return {
    levelNumber,
    templateIndex,
    templateName: template.name,
    bricks,
    specialBrickCount,
    strongBrickCount,
    totalBricks: bricks.length,
    baseBallSpeed: getLevelBaseSpeed(levelNumber),
  };
}
