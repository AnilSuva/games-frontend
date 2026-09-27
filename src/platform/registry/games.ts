import type { GameManifest } from "./types";

/**
 * Master Registry of all platform games.
 * Single source of truth for metadata, categories, engine classification, and dynamic loaders.
 *
 * NOTE: Adding a new game requires ONLY adding an entry here.
 * The dashboard, routing, dynamic loading, and SEO adapt automatically.
 */
export const GAME_MANIFESTS: GameManifest[] = [
  // ==========================================
  // Board Games
  // ==========================================
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    shortDescription: "The classic 3x3 strategic grid game.",
    description:
      "Align three of your marks horizontally, vertically, or diagonally to claim victory. Supports local 2-player and AI bot modes.",
    category: "board",
    engine: "react-dom",
    status: "available",
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "1/1",
    iconName: "grid",
    badgeText: "Classic",
    tags: ["Strategy", "Casual", "2-Player"],
    loader: () =>
      import("@/games/board/tic-tac-toe/components/TicTacToeGame"),
  },
  {
    id: "connect-four",
    title: "Connect Four",
    shortDescription: "Drop discs to connect four in a row.",
    description:
      "A vertical battle of wits. Drop checkers into the grid and be the first to connect four in a line while blocking your opponent.",
    category: "board",
    engine: "react-dom",
    status: "available",
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "circle-dot",
    badgeText: "Popular",
    tags: ["Strategy", "Turn-Based"],
    loader: () =>
      import("@/games/board/connect-four/components/ConnectFourGame"),
  },
  {
    id: "checkers",
    title: "Checkers",
    shortDescription: "Jump opponent pieces and king your checkers.",
    description:
      "Diagonal movement, multi-jumps, and crowned kings. Classic board gaming experience optimized for mobile touch.",
    category: "board",
    engine: "react-dom",
    status: "coming-soon",
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "1/1",
    iconName: "shield",
    tags: ["Tactics", "Classic"],
  },
  {
    id: "chess",
    title: "Chess",
    shortDescription: "The timeless battle of kings, queens, and pawns.",
    description:
      "Deep tactical strategy powered by Web Worker Minimax evaluation. Play local matches or challenge intelligent bots.",
    category: "board",
    engine: "react-dom",
    status: "coming-soon",
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "1/1",
    iconName: "crown",
    badgeText: "Grandmaster",
    tags: ["Strategy", "Hardcore"],
  },

  // ==========================================
  // Graphical / Arcade Games
  // ==========================================
  {
    id: "brick-blast",
    title: "Brick Blast",
    shortDescription: "Breakout-style arcade block buster.",
    description:
      "Control the paddle, deflect the high-speed ball, and shatter all descending brick formations before they breach your defense.",
    category: "arcade",
    engine: "phaser",
    status: "available",
    supportedModes: ["local-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "layers",
    badgeText: "Fast Action",
    tags: ["Arcade", "Physics", "Reflexes"],
    loader: () =>
      import("@/games/arcade/brick-blast/preview/BrickBlastPreview"),
  },
  {
    id: "archery",
    title: "Archery",
    shortDescription: "Precision target shooting with dynamic wind.",
    description:
      "Draw your bow, calculate wind resistance, and hit the bullseye in challenging arcade archery rounds.",
    category: "arcade",
    engine: "phaser",
    status: "coming-soon",
    supportedModes: ["local-2p"],
    defaultOrientation: "landscape",
    aspectRatio: "16/9",
    iconName: "target",
    tags: ["Arcade", "Aim", "Physics"],
  },
  {
    id: "platformer",
    title: "Pixel Platformer",
    shortDescription: "Jump, dash, and collect coins across levels.",
    description:
      "Classic side-scrolling platformer featuring responsive mobile touch controls and challenging jump mechanics.",
    category: "arcade",
    engine: "phaser",
    status: "coming-soon",
    supportedModes: ["local-2p"],
    defaultOrientation: "landscape",
    aspectRatio: "16/9",
    iconName: "gamepad",
    tags: ["Platformer", "Action"],
  },
  {
    id: "endless-runner",
    title: "Endless Runner",
    shortDescription: "Dodge obstacles and set high score records.",
    description:
      "Fast-paced infinite running game testing your reflexes with procedurally generated courses.",
    category: "arcade",
    engine: "phaser",
    status: "coming-soon",
    supportedModes: ["local-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "responsive",
    iconName: "zap",
    tags: ["Runner", "High Score"],
  },
];
