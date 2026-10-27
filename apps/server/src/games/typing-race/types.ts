export type PlatformPlayer = "orange" | "blue";

export type TypingRaceStatus = "waiting" | "in_progress" | "won" | "abandoned";

export interface PlayerRaceStats {
  correctChars: number; // Length of current contiguous matching prefix
  totalTypedChars: number; // Raw length of currently typed string
  totalKeystrokes: number; // Cumulative keystrokes typed
  errorCount: number; // Keystrokes that did not match
  wpm: number;
  accuracy: number; // 0 to 100
  progress: number; // 0.0 to 1.0 (correctChars / passage.length)
  isFinished: boolean;
  finishTimeMs?: number; // Total ms to complete race
}

export interface TypingRaceGameState {
  status: TypingRaceStatus;
  passageId: string;
  passageText: string;
  wordCount: number;
  countdownStartAt?: number | null;
  raceStartAt?: number | null;
  players: Record<PlatformPlayer, PlayerRaceStats>;
  playerRoles: Record<string, PlatformPlayer>; // playerId -> "orange" | "blue"
  readyPlayers: string[]; // playerIds that have rendered and reported ready
  winner: PlatformPlayer | null;
  resultReason?: "win" | "disconnect_forfeit";
  rematchRequests: string[];
  disconnectGraceExpiresAt?: number | null;
  disconnectedPlayerId?: string | null;
  matchStartTime: number;
}

export type TypingRaceAction =
  | {
      type: "INPUT";
      input: "progress";
      data: {
        text: string;
        totalKeystrokes?: number;
      };
    }
  | {
      type: "EVENT";
      event: "player_ready";
      data?: unknown;
    }
  | {
      type: "EVENT";
      event: "countdown_start";
      data?: {
        countdownStartAt: number;
        raceStartAt: number;
      };
    }
  | {
      type: "REMATCH";
    };
