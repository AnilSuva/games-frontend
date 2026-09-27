export type MatchMode = "1v1" | "vs-bot";
export type ResultSound = "victory" | "lose";

interface ResultSoundInput {
  mode: MatchMode;
  winner: string | null | undefined;
  humanPlayer: string;
}

/** Selects a match result sound from the human player's perspective. */
export function getResultSound({
  mode,
  winner,
  humanPlayer,
}: ResultSoundInput): ResultSound | null {
  if (!winner || winner === "draw") return null;
  if (mode === "1v1") return "victory";
  return winner === humanPlayer ? "victory" : "lose";
}

/** A lightweight, resettable gate that allows one result sound per match. */
export function createResultSoundGuard() {
  let hasPlayed = false;

  return {
    claim(sound: ResultSound | null): ResultSound | null {
      if (!sound || hasPlayed) return null;
      hasPlayed = true;
      return sound;
    },
    reset(): void {
      hasPlayed = false;
    },
  };
}
