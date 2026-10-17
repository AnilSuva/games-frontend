export type PlayerRole = "orange" | "blue";
export type KnifeOwner = PlayerRole | "neutral";

export interface EmbeddedKnife {
  id: number;
  owner: KnifeOwner;
  angle: number; // in radians relative to trunk coordinate frame
  container: Phaser.GameObjects.Container;
}

export interface KnifeThrowerScore {
  orange: number;
  blue: number;
}

export interface KnifeThrowerInventory {
  orange: number;
  blue: number;
}

export interface KnifeThrowerCallbacks {
  onScoreChange?: (scores: KnifeThrowerScore) => void;
  onGameOver?: (result: {
    winner: PlayerRole;
    score: KnifeThrowerScore;
  }) => void;
  onKnifeInventoryChange?: (inventory: KnifeThrowerInventory, maxKnives?: number) => void;
  onRoundResult?: (winner: PlayerRole | "tie") => void;
  onLifecycleChange?: (state: "playing" | "finished") => void;
  onSetChange?: (setIndex: number) => void;
}

export interface KnifeThrowerInitData {
  mode: "1v1" | "bot";
  difficulty: "easy" | "medium" | "hard";
  callbacks?: KnifeThrowerCallbacks;
}
