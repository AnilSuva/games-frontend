import type { CourseDef } from "./types";
import { BALL_RADIUS, GAME_HEIGHT, GAME_WIDTH, MAX_STROKES_PER_HOLE } from "../config/constants";

export { BALL_RADIUS, MAX_STROKES_PER_HOLE };

export const COURSES: CourseDef[] = [
  // -------------------------------------------------------------
  // Course 1: Garden Path (Par 3)
  // Gentle angles, a central dogleg island barrier, and a sand bunker.
  // -------------------------------------------------------------
  {
    id: "garden-path",
    name: "Garden Path",
    par: 3,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    startPositions: {
      orange: { x: 150, y: 520 },
      blue: { x: 230, y: 520 },
    },
    hole: {
      x: 190,
      y: 90,
      radius: 14,
      captureRadius: 13,
      maxCaptureSpeed: 145,
      lipOutSpeed: 230,
    },
    walls: [
      // Outer perimeter border
      { p1: { x: 25, y: 25 }, p2: { x: 355, y: 25 }, restitution: 0.75 },
      { p1: { x: 355, y: 25 }, p2: { x: 355, y: 575 }, restitution: 0.75 },
      { p1: { x: 355, y: 575 }, p2: { x: 25, y: 575 }, restitution: 0.75 },
      { p1: { x: 25, y: 575 }, p2: { x: 25, y: 25 }, restitution: 0.75 },

      // Central divider wall (island barrier)
      { p1: { x: 100, y: 310 }, p2: { x: 280, y: 310 }, restitution: 0.7 },
      { p1: { x: 280, y: 310 }, p2: { x: 280, y: 330 }, restitution: 0.7 },
      { p1: { x: 280, y: 330 }, p2: { x: 100, y: 330 }, restitution: 0.7 },
      { p1: { x: 100, y: 330 }, p2: { x: 100, y: 310 }, restitution: 0.7 },

      // Slight angle guide near fairway entry
      { p1: { x: 25, y: 440 }, p2: { x: 70, y: 410 }, restitution: 0.72 },
      { p1: { x: 355, y: 440 }, p2: { x: 310, y: 410 }, restitution: 0.72 },
    ],
    bumpers: [
      // One friendly bounce bumper in the central path
      { id: "b1", x: 190, y: 220, radius: 18, restitution: 1.15 },
    ],
    surfaces: [
      // Sand bunker on the right side of the green
      {
        id: "sand1",
        type: "sand",
        x: 270,
        y: 130,
        width: 75,
        height: 110,
      },
    ],
    movingObstacles: [],
  },

  // -------------------------------------------------------------
  // Course 2: Bumper Alley (Par 3)
  // Narrow chicane, multiple high-energy bumpers, and angled bank walls.
  // -------------------------------------------------------------
  {
    id: "bumper-alley",
    name: "Bumper Alley",
    par: 3,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    startPositions: {
      orange: { x: 150, y: 530 },
      blue: { x: 230, y: 530 },
    },
    hole: {
      x: 190,
      y: 75,
      radius: 14,
      captureRadius: 13,
      maxCaptureSpeed: 140,
      lipOutSpeed: 225,
    },
    walls: [
      // Outer perimeter border
      { p1: { x: 25, y: 25 }, p2: { x: 355, y: 25 }, restitution: 0.75 },
      { p1: { x: 355, y: 25 }, p2: { x: 355, y: 575 }, restitution: 0.75 },
      { p1: { x: 355, y: 575 }, p2: { x: 25, y: 575 }, restitution: 0.75 },
      { p1: { x: 25, y: 575 }, p2: { x: 25, y: 25 }, restitution: 0.75 },

      // Funneling walls creating a narrow chicane passage
      { p1: { x: 25, y: 390 }, p2: { x: 125, y: 330 }, restitution: 0.78 },
      { p1: { x: 355, y: 390 }, p2: { x: 255, y: 330 }, restitution: 0.78 },

      // Bank reflectors on the sides of the green
      { p1: { x: 25, y: 170 }, p2: { x: 95, y: 120 }, restitution: 0.8 },
      { p1: { x: 355, y: 170 }, p2: { x: 285, y: 120 }, restitution: 0.8 },
    ],
    bumpers: [
      // Left and right pinball bumpers in the mid court
      { id: "ba1", x: 110, y: 230, radius: 21, restitution: 1.2 },
      { id: "ba2", x: 270, y: 230, radius: 21, restitution: 1.2 },
      // Central apex bumper
      { id: "ba3", x: 190, y: 290, radius: 23, restitution: 1.25 },
    ],
    surfaces: [
      // Sand trap guarding the back approach
      {
        id: "sand2",
        type: "sand",
        x: 130,
        y: 125,
        width: 120,
        height: 38,
      },
    ],
    movingObstacles: [],
  },

  // -------------------------------------------------------------
  // Course 3: Water Challenge (Par 4)
  // Two large water hazards, narrow fairway bridge, moving hazard bar, and sand behind green.
  // -------------------------------------------------------------
  {
    id: "water-challenge",
    name: "Water Challenge",
    par: 4,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    startPositions: {
      orange: { x: 150, y: 540 },
      blue: { x: 230, y: 540 },
    },
    hole: {
      x: 190,
      y: 80,
      radius: 14,
      captureRadius: 13,
      maxCaptureSpeed: 140,
      lipOutSpeed: 220,
    },
    walls: [
      // Outer perimeter border
      { p1: { x: 25, y: 25 }, p2: { x: 355, y: 25 }, restitution: 0.75 },
      { p1: { x: 355, y: 25 }, p2: { x: 355, y: 575 }, restitution: 0.75 },
      { p1: { x: 355, y: 575 }, p2: { x: 25, y: 575 }, restitution: 0.75 },
      { p1: { x: 25, y: 575 }, p2: { x: 25, y: 25 }, restitution: 0.75 },

      // Fairway side barriers to keep balls from easily avoiding bridge
      { p1: { x: 25, y: 350 }, p2: { x: 130, y: 350 }, restitution: 0.7 },
      { p1: { x: 250, y: 350 }, p2: { x: 355, y: 350 }, restitution: 0.7 },

      // Upper barriers framing the green
      { p1: { x: 25, y: 170 }, p2: { x: 110, y: 170 }, restitution: 0.7 },
      { p1: { x: 270, y: 170 }, p2: { x: 355, y: 170 }, restitution: 0.7 },
    ],
    bumpers: [
      // Bumper positioned to reward brave bank shots around the moving hazard
      { id: "wc1", x: 65, y: 260, radius: 18, restitution: 1.15 },
      { id: "wc2", x: 315, y: 260, radius: 18, restitution: 1.15 },
    ],
    surfaces: [
      // Left water hazard
      {
        id: "water1",
        type: "water",
        x: 25,
        y: 175,
        width: 105,
        height: 170,
      },
      // Right water hazard
      {
        id: "water2",
        type: "water",
        x: 250,
        y: 175,
        width: 105,
        height: 170,
      },
      // Sand bunker directly behind the cup for overshots
      {
        id: "sand3",
        type: "sand",
        x: 135,
        y: 35,
        width: 110,
        height: 30,
      },
    ],
    movingObstacles: [
      // Horizontally oscillating sweeper bar across the central fairway bridge
      {
        id: "sweeper1",
        type: "horizontal",
        startX: 130,
        startY: 250,
        endX: 250,
        endY: 250,
        width: 36,
        height: 14,
        speed: 1,
        periodMs: 3200,
      },
    ],
  },
];
