import {
  WINNING_SCORE,
  MAX_ITEMS_ON_TABLE,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_MAX,
  BANKNOTE_SPAWN_CHANCE,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MIN_Y,
  PLAYFIELD_MAX_Y,
  VAULT_TOP_Y,
  VAULT_BOTTOM_Y,
  VAULT_MOUTH_MIN_X,
  VAULT_MOUTH_MAX_X,
  COIN_RADIUS,
  COIN_HIT_RADIUS,
  COIN_VALUE,
  BANKNOTE_WIDTH,
  BANKNOTE_HEIGHT,
  BANKNOTE_HIT_RADIUS,
  BANKNOTE_VALUE,
  TORN_PIECE_WIDTH,
  TORN_PIECE_HEIGHT,
  TORN_PIECE_VALUE,
  TEAR_DISTANCE_THRESHOLD,
  TEAR_FLING_VELOCITY,
  INERTIA_FRICTION,
  BOUNCE_RESTITUTION,
  type BotDifficulty,
} from "../config/constants";
import type {
  LightFingersState,
  LightFingersAction,
  MoneyItem,
  TouchClaw,
  PlayerId,
} from "./types";

/**
 * Creates a fresh initial game state.
 */
export function createInitialState(
  mode: LightFingersState["mode"] = "1v1",
  difficulty: BotDifficulty = "medium"
): LightFingersState {
  const state: LightFingersState = {
    status: "playing",
    winner: null,
    score: { orange: 0, blue: 0 },
    items: [],
    claws: [],
    spawnTimer: 0.5,
    nextItemId: 1,
    mode,
    difficulty,
    recentEvents: [],
  };

  // Seed table with initial items (1 Banknote + 3 Coins)
  spawnItem(state, true);
  spawnItem(state, false);
  spawnItem(state, false);
  spawnItem(state, false);

  return state;
}

/**
 * Validates player or system action.
 */
export function validateAction(
  state: LightFingersState,
  action: LightFingersAction
): boolean {
  if (action.type === "START_GAME" || action.type === "RESTART_GAME") {
    return true;
  }

  if (state.status !== "playing") {
    return false;
  }

  if (action.type === "TICK") {
    return typeof action.dt === "number" && action.dt > 0 && action.dt <= 1.0;
  }

  if (
    action.type === "POINTER_DOWN" ||
    action.type === "POINTER_MOVE" ||
    action.type === "POINTER_UP"
  ) {
    if (action.playerId !== "orange" && action.playerId !== "blue") {
      return false;
    }
    if (typeof action.touchId !== "number" || Number.isNaN(action.touchId)) {
      return false;
    }
    if (action.type !== "POINTER_UP") {
      if (
        typeof action.x !== "number" ||
        typeof action.y !== "number" ||
        Number.isNaN(action.x) ||
        Number.isNaN(action.y)
      ) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Pure Game Reducer:
 * Game State + Player Action → Validate → Apply Action → New Game State
 */
export function gameReducer(
  state: LightFingersState,
  action: LightFingersAction
): LightFingersState {
  if (!validateAction(state, action)) {
    return state;
  }

  switch (action.type) {
    case "START_GAME":
      return createInitialState(action.mode, action.difficulty);

    case "RESTART_GAME":
      return createInitialState(state.mode, state.difficulty);

    case "TICK":
      return tickGame(state, action.dt);

    case "POINTER_DOWN":
      return handlePointerDown(state, action.playerId, action.touchId, action.x, action.y);

    case "POINTER_MOVE":
      return handlePointerMove(state, action.playerId, action.touchId, action.x, action.y);

    case "POINTER_UP":
      return handlePointerUp(state, action.playerId, action.touchId);

    default:
      return state;
  }
}

/**
 * Computes arm anchor point inside the vault opening.
 */
function getVaultAnchor(playerId: PlayerId, touchX: number): { x: number; y: number } {
  // Anchor slides along vault mouth width for natural reaching
  const clampedX = Math.max(VAULT_MOUTH_MIN_X + 40, Math.min(VAULT_MOUTH_MAX_X - 40, touchX));
  const anchorY = playerId === "blue" ? 25 : 775;
  return { x: clampedX, y: anchorY };
}

/**
 * Spawn a new money item (coin or banknote) on the table.
 */
function spawnItem(state: LightFingersState, forceBanknote?: boolean): void {
  const isBanknote =
    forceBanknote !== undefined ? forceBanknote : Math.random() < BANKNOTE_SPAWN_CHANCE;

  const id = `item_${state.nextItemId++}`;
  const paddingX = isBanknote ? BANKNOTE_WIDTH / 2 + 20 : COIN_RADIUS + 20;
  const paddingY = isBanknote ? BANKNOTE_HEIGHT / 2 + 20 : COIN_RADIUS + 20;

  const x = PLAYFIELD_MIN_X + paddingX + Math.random() * (PLAYFIELD_MAX_X - PLAYFIELD_MIN_X - paddingX * 2);
  const y = PLAYFIELD_MIN_Y + paddingY + Math.random() * (PLAYFIELD_MAX_Y - PLAYFIELD_MIN_Y - paddingY * 2);

  const item: MoneyItem = isBanknote
    ? {
        id,
        kind: "banknote",
        value: BANKNOTE_VALUE,
        x,
        y,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        rotation: (Math.random() - 0.5) * 0.4,
        width: BANKNOTE_WIDTH,
        height: BANKNOTE_HEIGHT,
        radius: Math.max(BANKNOTE_WIDTH, BANKNOTE_HEIGHT) / 2,
        grabbedBy: [],
        spawnTime: Date.now(),
      }
    : {
        id,
        kind: "coin",
        value: COIN_VALUE,
        x,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        rotation: 0,
        width: COIN_RADIUS * 2,
        height: COIN_RADIUS * 2,
        radius: COIN_RADIUS,
        grabbedBy: [],
        spawnTime: Date.now(),
      };

  state.items.push(item);
  state.recentEvents.push({
    kind: "item_spawned",
    itemId: id,
    x,
    y,
    value: item.value,
  });
}

/**
 * Finds an item at (x, y) with generous hit radius.
 */
function findItemAt(items: MoneyItem[], x: number, y: number): MoneyItem | null {
  let closestItem: MoneyItem | null = null;
  let minDistance = Infinity;

  for (const item of items) {
    const dx = x - item.x;
    const dy = y - item.y;
    const dist = Math.hypot(dx, dy);

    const hitRadius = item.kind === "banknote" ? BANKNOTE_HIT_RADIUS : COIN_HIT_RADIUS;
    if (dist <= hitRadius && dist < minDistance) {
      minDistance = dist;
      closestItem = item;
    }
  }

  return closestItem;
}

/**
 * Handles pointer down (touch start / mouse click).
 */
function handlePointerDown(
  state: LightFingersState,
  playerId: PlayerId,
  touchId: number,
  x: number,
  y: number
): LightFingersState {
  if (state.status !== "playing") return state;

  const nextState: LightFingersState = {
    ...state,
    items: state.items.map((it) => ({
      ...it,
      grabbedBy: it.grabbedBy.map((g) => ({ ...g })),
    })),
    claws: state.claws.map((c) => ({ ...c })),
    recentEvents: [],
  };

  const anchor = getVaultAnchor(playerId, x);
  const angle = Math.atan2(y - anchor.y, x - anchor.x);

  // Check if an item was touched directly
  const touchedItem = findItemAt(nextState.items, x, y);

  const claw: TouchClaw = {
    touchId,
    playerId,
    x,
    y,
    originX: anchor.x,
    originY: anchor.y,
    angle,
    isGrabbing: touchedItem !== null,
    targetItemId: touchedItem ? touchedItem.id : null,
    active: true,
  };

  const existingClawIndex = nextState.claws.findIndex(
    (c) => c.touchId === touchId && c.playerId === playerId
  );
  if (existingClawIndex >= 0) {
    nextState.claws[existingClawIndex] = claw;
  } else {
    nextState.claws.push(claw);
  }

  if (touchedItem) {
    const alreadyGrabbedByPlayer = touchedItem.grabbedBy.some((g) => g.playerId === playerId);
    if (!alreadyGrabbedByPlayer) {
      touchedItem.grabbedBy.push({
        playerId,
        touchId,
        offsetX: x - touchedItem.x,
        offsetY: y - touchedItem.y,
      });

      nextState.recentEvents.push({
        kind: "item_grabbed",
        playerId,
        itemId: touchedItem.id,
        x,
        y,
      });
    }
  }

  return nextState;
}

/**
 * Handles pointer move (drag).
 */
function handlePointerMove(
  state: LightFingersState,
  playerId: PlayerId,
  touchId: number,
  x: number,
  y: number
): LightFingersState {
  if (state.status !== "playing") return state;

  const nextState: LightFingersState = {
    ...state,
    items: state.items.map((it) => ({
      ...it,
      grabbedBy: it.grabbedBy.map((g) => ({ ...g })),
    })),
    claws: state.claws.map((c) => ({ ...c })),
    recentEvents: [],
  };

  const claw = nextState.claws.find((c) => c.touchId === touchId && c.playerId === playerId);
  if (!claw) return nextState;

  // Update claw position & 2D reach angle
  claw.x = x;
  claw.y = y;
  claw.angle = Math.atan2(y - claw.originY, x - claw.originX);

  // Swipe-to-grab: if hand isn't holding anything, snatch any item finger passes over
  if (claw.targetItemId === null) {
    const itemUnderFinger = findItemAt(nextState.items, x, y);
    if (itemUnderFinger) {
      const alreadyGrabbedByPlayer = itemUnderFinger.grabbedBy.some((g) => g.playerId === playerId);
      if (!alreadyGrabbedByPlayer) {
        claw.targetItemId = itemUnderFinger.id;
        claw.isGrabbing = true;
        itemUnderFinger.grabbedBy.push({
          playerId,
          touchId,
          offsetX: x - itemUnderFinger.x,
          offsetY: y - itemUnderFinger.y,
        });

        nextState.recentEvents.push({
          kind: "item_grabbed",
          playerId,
          itemId: itemUnderFinger.id,
          x,
          y,
        });
      }
    }
  }

  return nextState;
}

/**
 * Handles pointer up / release.
 */
function handlePointerUp(
  state: LightFingersState,
  playerId: PlayerId,
  touchId: number
): LightFingersState {
  const nextState: LightFingersState = {
    ...state,
    items: state.items.map((it) => ({
      ...it,
      grabbedBy: it.grabbedBy.map((g) => ({ ...g })),
    })),
    claws: state.claws.filter((c) => !(c.touchId === touchId && c.playerId === playerId)),
    recentEvents: [],
  };

  // Remove grab from all items
  for (const item of nextState.items) {
    const grabIndex = item.grabbedBy.findIndex(
      (g) => g.touchId === touchId && g.playerId === playerId
    );
    if (grabIndex >= 0) {
      item.grabbedBy.splice(grabIndex, 1);
      nextState.recentEvents.push({
        kind: "item_released",
        playerId,
        itemId: item.id,
        x: item.x,
        y: item.y,
      });
    }
  }

  return nextState;
}

/**
 * Core simulation tick: advances physics, checks tearing, vault collection, and spawning.
 */
export function tickGame(state: LightFingersState, dt: number): LightFingersState {
  if (state.status !== "playing" || dt <= 0) {
    return state;
  }

  // Cap dt to avoid delta explosion on background tab
  const cappedDt = Math.min(dt, 0.05);

  const nextState: LightFingersState = {
    ...state,
    score: { ...state.score },
    items: state.items.map((it) => ({
      ...it,
      grabbedBy: it.grabbedBy.map((g) => ({ ...g })),
    })),
    claws: state.claws.map((c) => ({ ...c })),
    recentEvents: [],
  };

  // 1. Process items being dragged or in inertia
  const itemsToKeep: MoneyItem[] = [];

  for (let i = 0; i < nextState.items.length; i++) {
    const item = nextState.items[i];

    // Check if banknote is in a tug-of-war (grabbed by BOTH Orange and Blue)
    if (item.kind === "banknote" && item.grabbedBy.length >= 2) {
      const orangeGrab = item.grabbedBy.find((g) => g.playerId === "orange");
      const blueGrab = item.grabbedBy.find((g) => g.playerId === "blue");

      if (orangeGrab && blueGrab) {
        const orangeClaw = nextState.claws.find(
          (c) => c.touchId === orangeGrab.touchId && c.playerId === "orange"
        );
        const blueClaw = nextState.claws.find(
          (c) => c.touchId === blueGrab.touchId && c.playerId === "blue"
        );

        if (orangeClaw && blueClaw) {
          // Center the bill between the two pulling hands
          item.x = (orangeClaw.x + blueClaw.x) / 2;
          item.y = (orangeClaw.y + blueClaw.y) / 2;
          item.rotation = Math.atan2(blueClaw.y - orangeClaw.y, blueClaw.x - orangeClaw.x) + Math.PI / 2;

          const totalDistance = Math.hypot(orangeClaw.x - blueClaw.x, orangeClaw.y - blueClaw.y);

          // If distance exceeds tear threshold: RIP BANKNOTE!
          if (totalDistance >= TEAR_DISTANCE_THRESHOLD) {
            // Rip into two pieces!
            const topPiece: MoneyItem = {
              id: `item_${nextState.nextItemId++}`,
              kind: "torn_piece",
              value: TORN_PIECE_VALUE,
              x: item.x,
              y: item.y - 12,
              vx: (blueClaw.x - item.x) * 3,
              vy: -TEAR_FLING_VELOCITY, // flings toward Blue vault
              rotation: -0.25,
              width: TORN_PIECE_WIDTH,
              height: TORN_PIECE_HEIGHT,
              radius: TORN_PIECE_WIDTH / 2,
              grabbedBy: [],
              half: "top",
              spawnTime: Date.now(),
            };

            const bottomPiece: MoneyItem = {
              id: `item_${nextState.nextItemId++}`,
              kind: "torn_piece",
              value: TORN_PIECE_VALUE,
              x: item.x,
              y: item.y + 12,
              vx: (orangeClaw.x - item.x) * 3,
              vy: TEAR_FLING_VELOCITY, // flings toward Orange vault
              rotation: 0.25,
              width: TORN_PIECE_WIDTH,
              height: TORN_PIECE_HEIGHT,
              radius: TORN_PIECE_WIDTH / 2,
              grabbedBy: [],
              half: "bottom",
              spawnTime: Date.now(),
            };

            itemsToKeep.push(topPiece, bottomPiece);

            // Both players instantly score +1 point each for tearing the bill
            nextState.score.orange += TORN_PIECE_VALUE;
            nextState.score.blue += TORN_PIECE_VALUE;

            nextState.recentEvents.push({
              kind: "banknote_ripped",
              itemId: item.id,
              x: item.x,
              y: item.y,
              value: TORN_PIECE_VALUE,
            });

            // Disengage claws from the ripped original
            for (const claw of nextState.claws) {
              if (claw.targetItemId === item.id) {
                claw.targetItemId = null;
                claw.isGrabbing = false;
              }
            }

            continue; // original banknote destroyed
          }
        }
      }
    }

    // Single player drag or collaborative same-team drag
    if (item.grabbedBy.length > 0) {
      let targetX = 0;
      let targetY = 0;
      let validGrabs = 0;

      for (const grab of item.grabbedBy) {
        const claw = nextState.claws.find(
          (c) => c.touchId === grab.touchId && c.playerId === grab.playerId
        );
        if (claw) {
          targetX += claw.x - grab.offsetX;
          targetY += claw.y - grab.offsetY;
          validGrabs++;
          claw.isGrabbing = true;
        }
      }

      if (validGrabs > 0) {
        targetX /= validGrabs;
        targetY /= validGrabs;

        const prevX = item.x;
        const prevY = item.y;

        // Direct responsive tracking
        item.x = targetX;
        item.y = targetY;

        item.vx = (item.x - prevX) / cappedDt;
        item.vy = (item.y - prevY) / cappedDt;
      }
    } else {
      // Free inertia physics
      item.x += item.vx * cappedDt;
      item.y += item.vy * cappedDt;

      item.vx *= Math.pow(INERTIA_FRICTION, cappedDt * 60);
      item.vy *= Math.pow(INERTIA_FRICTION, cappedDt * 60);
      item.rotation += item.vx * 0.002;

      // Bounce on lateral bounds
      if (item.x - item.radius < PLAYFIELD_MIN_X) {
        item.x = PLAYFIELD_MIN_X + item.radius;
        item.vx = -item.vx * BOUNCE_RESTITUTION;
      } else if (item.x + item.radius > PLAYFIELD_MAX_X) {
        item.x = PLAYFIELD_MAX_X - item.radius;
        item.vx = -item.vx * BOUNCE_RESTITUTION;
      }
    }

    // 2. Vault Entry Detection (Blue = Top, Orange = Bottom)
    let collectedBy: PlayerId | null = null;

    const inVaultMouth = item.x >= VAULT_MOUTH_MIN_X && item.x <= VAULT_MOUTH_MAX_X;

    if (inVaultMouth && item.y <= VAULT_TOP_Y + 18) {
      collectedBy = "blue";
    } else if (inVaultMouth && item.y >= VAULT_BOTTOM_Y - 18) {
      collectedBy = "orange";
    }

    if (collectedBy) {
      nextState.score[collectedBy] += item.value;

      nextState.recentEvents.push({
        kind: item.kind === "coin" ? "coin_collected" : "banknote_collected",
        playerId: collectedBy,
        itemId: item.id,
        x: item.x,
        y: collectedBy === "blue" ? VAULT_TOP_Y : VAULT_BOTTOM_Y,
        value: item.value,
      });

      // Detach claws targeting this item
      for (const claw of nextState.claws) {
        if (claw.targetItemId === item.id) {
          claw.targetItemId = null;
          claw.isGrabbing = false;
        }
      }
      continue; // Item collected and removed
    }

    itemsToKeep.push(item);
  }

  nextState.items = itemsToKeep;

  // 3. Spawning Timer & Maintenance
  if (nextState.items.length < MAX_ITEMS_ON_TABLE) {
    nextState.spawnTimer -= cappedDt;
    if (nextState.spawnTimer <= 0) {
      spawnItem(nextState);
      nextState.spawnTimer =
        SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }
  }

  // 4. Winner Determination (First to 15 points wins)
  if (nextState.score.orange >= WINNING_SCORE || nextState.score.blue >= WINNING_SCORE) {
    nextState.status = "finished";
    if (nextState.score.orange > nextState.score.blue) {
      nextState.winner = "orange";
    } else if (nextState.score.blue > nextState.score.orange) {
      nextState.winner = "blue";
    } else {
      nextState.winner = "draw";
    }

    nextState.recentEvents.push({
      kind: "game_won",
      playerId: nextState.winner === "draw" ? undefined : (nextState.winner as PlayerId),
    });
  }

  return nextState;
}
