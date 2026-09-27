/**
 * Power-Up definitions and balancing for Brick Blast.
 */

export type PowerUpType =
  | "extra_ball"
  | "speed_up"
  | "speed_down"
  | "size_up"
  | "size_down"
  | "power_up";

export interface PowerUpDefinition {
  type: PowerUpType;
  label: string;
  symbol: string;
  color: number;
  description: string;
}

export const POWER_UP_DEFINITIONS: Record<PowerUpType, PowerUpDefinition> = {
  extra_ball: {
    type: "extra_ball",
    label: "Extra Ball",
    symbol: "+●",
    color: 0x059669, // Emerald
    description: "Launches an additional active ball into play",
  },
  speed_up: {
    type: "speed_up",
    label: "Speed Up",
    symbol: "▲",
    color: 0xd97706, // Amber
    description: "Increases ball velocity by 15%",
  },
  speed_down: {
    type: "speed_down",
    label: "Speed Down",
    symbol: "▼",
    color: 0x0284c7, // Sky
    description: "Slows down ball velocity by 15%",
  },
  size_up: {
    type: "size_up",
    label: "Size Up",
    symbol: "⊕",
    color: 0x7c3aed, // Violet
    description: "Expands ball radius for easier deflections",
  },
  size_down: {
    type: "size_down",
    label: "Size Down",
    symbol: "⊖",
    color: 0xdb2777, // Pink
    description: "Reduces ball radius for tighter maneuvers",
  },
  power_up: {
    type: "power_up",
    label: "Power Up",
    symbol: "⚡",
    color: 0xe11d48, // Rose
    description: "Empowers the ball to shatter 2-hit bricks in 1 hit",
  },
};

export const ALL_POWER_UP_TYPES: readonly PowerUpType[] = [
  "extra_ball",
  "speed_up",
  "speed_down",
  "size_up",
  "size_down",
  "power_up",
];
