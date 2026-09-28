"use client";

import type { ConnectionState, RoomDto } from "@/platform/multiplayer/types";
import { OnlineMatchLobby } from "@/components/game-ui/OnlineMatchLobby";

export interface OnlineLobbyProps {
  connectionState: ConnectionState;
  room: RoomDto | null;
  errorMessage: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onReturnToModes: () => void;
}

/**
 * Tic-Tac-Toe Online Lobby.
 * Thin wrapper around the reusable OnlineMatchLobby component.
 */
export function OnlineLobby(props: OnlineLobbyProps) {
  return (
    <OnlineMatchLobby
      gameTitle="Tic-Tac-Toe"
      {...props}
    />
  );
}
