export interface Participant {
  id: string;
  name: string;
}

export interface SpinPlan {
  winner: Participant;
  winnerIndex: number;
  targetRotation: number;
}

export interface WheelSegment extends Participant {
  color: string;
  path: string;
  angle: number;
}
