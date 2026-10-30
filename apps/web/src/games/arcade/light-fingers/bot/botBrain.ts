import { BOT_CONFIG, VAULT_TOP_Y, type BotDifficulty } from "../config/constants";
import type { LightFingersState, LightFingersAction } from "../logic/types";

interface BotTargetIntent {
  touchId: number;
  targetItemId: string;
  reactionTimer: number; // counts down to 0 before grabbing
  state: "waiting" | "grabbing" | "dragging";
  currentX: number;
  currentY: number;
}

export class BotBrain {
  private difficulty: BotDifficulty;
  private intents: Map<number, BotTargetIntent> = new Map();
  private nextTouchId: number = -100;

  constructor(difficulty: BotDifficulty = "medium") {
    this.difficulty = difficulty;
  }

  public reset(difficulty?: BotDifficulty): void {
    if (difficulty) this.difficulty = difficulty;
    this.intents.clear();
    this.nextTouchId = -100;
  }

  /**
   * Pure update step for the bot.
   * Returns a list of actions (POINTER_DOWN, POINTER_MOVE, POINTER_UP) to apply to the game.
   */
  public update(state: LightFingersState, dt: number): LightFingersAction[] {
    if (state.status !== "playing" || state.mode !== "bot") {
      return [];
    }

    const actions: LightFingersAction[] = [];
    const config = BOT_CONFIG[this.difficulty] || BOT_CONFIG.medium;

    // 1. Clean up invalid intents (items collected, destroyed, or ripped)
    const activeItemIds = new Set(state.items.map((i) => i.id));
    for (const [touchId, intent] of this.intents.entries()) {
      if (!activeItemIds.has(intent.targetItemId)) {
        if (intent.state === "dragging" || intent.state === "grabbing") {
          actions.push({
            type: "POINTER_UP",
            playerId: "blue",
            touchId,
          });
        }
        this.intents.delete(touchId);
      }
    }

    // 2. Select new targets if under maxClaws limit
    const currentClawsCount = this.intents.size;
    if (currentClawsCount < config.maxClaws && state.items.length > 0) {
      // Find candidate items not already targeted by bot
      const targetedItemIds = new Set(Array.from(this.intents.values()).map((it) => it.targetItemId));
      const availableItems = state.items.filter((it) => !targetedItemIds.has(it.id));

      if (availableItems.length > 0) {
        // Sort candidates:
        // 1. Banknotes (especially if contested by Orange, since bot wants to contest or rip them)
        // 2. Closeness to Blue vault (top)
        availableItems.sort((a, b) => {
          if (a.kind === "banknote" && b.kind !== "banknote") return -1;
          if (b.kind === "banknote" && a.kind !== "banknote") return 1;
          return a.y - b.y; // smaller Y is closer to Blue vault at top
        });

        const chosenItem = availableItems[0];
        const touchId = this.nextTouchId--;

        const delay =
          config.reactionDelayMin +
          Math.random() * (config.reactionDelayMax - config.reactionDelayMin);

        this.intents.set(touchId, {
          touchId,
          targetItemId: chosenItem.id,
          reactionTimer: delay,
          state: "waiting",
          currentX: chosenItem.x,
          currentY: chosenItem.y,
        });
      }
    }

    // 3. Process active intents
    for (const [touchId, intent] of this.intents.entries()) {
      const targetItem = state.items.find((it) => it.id === intent.targetItemId);
      if (!targetItem) {
        this.intents.delete(touchId);
        continue;
      }

      if (intent.state === "waiting") {
        intent.reactionTimer -= dt;
        if (intent.reactionTimer <= 0) {
          // Time to grab!
          intent.state = "grabbing";
          intent.currentX = targetItem.x;
          intent.currentY = targetItem.y;

          actions.push({
            type: "POINTER_DOWN",
            playerId: "blue",
            touchId,
            x: targetItem.x,
            y: targetItem.y,
          });
        }
      } else if (intent.state === "grabbing" || intent.state === "dragging") {
        intent.state = "dragging";

        // Drag toward Blue Vault at top in BOTH X and Y
        // Destination is distributed along the vault entrance
        const slotOffset = ((Math.abs(touchId) % 5) - 2) * 50;
        const targetX = 300 + slotOffset;
        const targetY = VAULT_TOP_Y - 25;

        const dx = targetX - intent.currentX;
        const dy = targetY - intent.currentY;
        const dist = Math.hypot(dx, dy);
        const moveDist = config.dragSpeed * dt;

        if (dist <= moveDist) {
          intent.currentX = targetX;
          intent.currentY = targetY;
        } else {
          intent.currentX += (dx / dist) * moveDist;
          intent.currentY += (dy / dist) * moveDist;
        }

        actions.push({
          type: "POINTER_MOVE",
          playerId: "blue",
          touchId,
          x: intent.currentX,
          y: intent.currentY,
        });
      }
    }

    return actions;
  }
}
