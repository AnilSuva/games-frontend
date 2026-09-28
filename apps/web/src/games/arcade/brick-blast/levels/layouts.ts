/**
 * Exactly 5 structural brick layout templates.
 * All templates are vertically symmetric (Row r matches Row 7 - r)
 * and horizontally symmetric (Col c matches Col 6 - c), ensuring
 * mathematically fair conditions for both top (Blue) and bottom (Orange) players.
 */

export interface LevelTemplate {
  name: string;
  description: string;
  grid: number[][]; // 8 rows x 7 columns (1 = brick eligible, 0 = empty)
}

export const TEMPLATES: readonly LevelTemplate[] = [
  {
    name: "Symmetric Rows",
    description: "Alternating structured bands with tactical pass-through gaps",
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    name: "Diamond Core",
    description: "A centralized diamond cluster flanked by open deflection corridors",
    grid: [
      [0, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 0, 1, 1, 1],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
    ],
  },
  {
    name: "Twin Fortress",
    description: "Mirrored outer bastions guarding an inner tactical core",
    grid: [
      [1, 1, 0, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 1, 0, 1, 1],
    ],
  },
  {
    name: "Hourglass",
    description: "Broad perimeter ramparts tapering toward a narrow central choke",
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 1, 1, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 0, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    name: "Dual Chevron",
    description: "Interlocking angled wings creating rich multi-deflection angles",
    grid: [
      [1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1, 0, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1, 0, 1],
    ],
  },
];
