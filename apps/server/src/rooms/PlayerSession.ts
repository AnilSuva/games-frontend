export type { PlayerSession } from "../auth/session.js";

export interface ActivePlayerState {
  playerId: string;
  sessionToken: string;
  currentRoomId?: string;
  lastConnectedAt: number;
}
