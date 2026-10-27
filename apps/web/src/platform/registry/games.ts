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
    isVisible: true,
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
    isVisible: true,
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
    status: "available",
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot", "online-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "1/1",
    iconName: "shield",
    badgeText: "New",
    tags: ["Tactics", "Classic", "Strategy"],
    loader: () =>
      import("@/games/board/checkers/components/CheckersGame"),
  },
  {
    id: "dots-and-boxes",
    title: "Dots and Boxes",
    shortDescription: "Draw lines, complete squares, and outsmart your opponent.",
    description:
      "Connect dots on a 5x5 grid. Complete a box to capture points and take an extra turn. Challenge intelligent bots or play local and online 2-player matches.",
    category: "board",
    engine: "react-dom",
    status: "available",
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot", "online-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "1/1",
    iconName: "grid",
    badgeText: "Classic",
    tags: ["Strategy", "Turn-Based", "2-Player"],
    loader: () =>
      import("@/games/board/dots-and-boxes/components/DotsAndBoxesGame"),
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
    isVisible: false,
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
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "layers",
    badgeText: "Fast Action",
    tags: ["Arcade", "Physics", "Reflexes"],
    loader: () =>
      import("@/games/arcade/brick-blast/components/BrickBlastGame"),
  },
  {
    id: "ping-pong",
    title: "Ping Pong",
    shortDescription: "Fast-paced top-down table tennis duel.",
    description:
      "Swipe to slice, apply Magnus spin curves, and outplay your opponent in tactical top-down arcade table tennis.",
    category: "arcade",
    engine: "phaser",
    status: "available",
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot", "online-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "activity",
    badgeText: "New",
    tags: ["Arcade", "Table Tennis", "Physics", "2-Player"],
    loader: () =>
      import("@/games/arcade/ping-pong/components/PingPongGame"),
  },
  {
    id: "knife-thrower",
    title: "Knife Thrower",
    shortDescription: "Head-to-head 2-player spinning trunk knife duel.",
    description:
      "Throw knives from opposite sides into a shared rotating trunk. Embed your blades without hitting existing knives in tense local 2-player or bot matches.",
    category: "arcade",
    engine: "phaser",
    status: "available",
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "target",
    badgeText: "New",
    tags: ["Arcade", "2-Player", "Duel", "Reflexes", "Timing"],
    loader: () =>
      import("@/games/arcade/knife-thrower/components/KnifeThrowerGame"),
  },
  {
    id: "star-catcher",
    title: "Star Catcher",
    shortDescription: "High-speed 2-player spaceship dogfight for stars.",
    description:
      "Pilot starfighters in cosmic space drift duels. Collect radiant stars while navigating screen-warp boundaries, gravitational black holes, and drifting asteroids.",
    category: "arcade",
    engine: "phaser",
    status: "available",
    isVisible: true,
    supportedModes: ["local-2p", "pvp-bot", "online-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "4/3",
    iconName: "zap",
    badgeText: "New",
    tags: ["Arcade", "Space", "Physics", "2-Player", "Duel", "Online"],
    loader: () =>
      import("@/games/arcade/star-catcher/components/StarCatcherGame"),
  },
  {
    id: "typing-race",
    title: "Typing Race",
    shortDescription: "High-speed 2-player multiplayer typing sprint.",
    description:
      "Two players race head-to-head on a dual-lane asphalt track. Speed and keystroke precision drive your car to the checkered finish line in real-time online competition.",
    category: "arcade",
    engine: "react-dom",
    status: "available",
    isVisible: true,
    supportedModes: ["online-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "responsive",
    iconName: "zap",
    badgeText: "Online",
    tags: ["Arcade", "Multiplayer", "Typing", "Speed", "Racing", "2-Player"],
    loader: () =>
      import("@/games/arcade/typing-race/components/TypingRaceGame"),
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
    isVisible: false,
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
    isVisible: false,
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
    isVisible: false,
    supportedModes: ["local-2p"],
    defaultOrientation: "portrait",
    aspectRatio: "responsive",
    iconName: "zap",
    tags: ["Runner", "High Score"],
  },
  // ==========================================
  // Random Royale tools
  // ==========================================
  {
    id: "spin-wheel",
    title: "Spin Wheel",
    shortDescription: "Add names, spin the wheel, and choose one winner fairly.",
    description:
      "A simple, fair way to pick one name from your group. Add participants and spin to choose a winner.",
    category: "random-royale",
    engine: "react-dom",
    status: "available",
    isVisible: true,
    supportedModes: [],
    defaultOrientation: "any",
    aspectRatio: "responsive",
    iconName: "circle-dot",
    badgeText: "Random Royale",
    tags: ["Random", "Picker", "Wheel", "Names"],
  },
];
