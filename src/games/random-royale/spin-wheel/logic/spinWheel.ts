/**
 * Legacy compatibility entrypoint.
 * All logic has been modularized into separate, dedicated modules:
 * - ../config
 * - ../types
 * - ./participantUtils
 * - ./winnerSelection
 * - ./wheelGeometry
 * - ./spinCalculation
 */

export {
  SPIN_WHEEL_CONFIG,
  MAX_PARTICIPANTS,
  SPIN_DURATION_MS,
  MIN_SPIN_TURNS,
  EXTRA_SPIN_TURNS,
  WHEEL_COLORS,
} from "../config";

export type { Participant, SpinPlan, WheelSegment } from "../types";

export {
  normalizeParticipantName,
  addParticipant,
  removeParticipant,
  clearParticipants,
} from "./participantUtils";

export {
  secureUint32,
  secureRandomIndex,
  selectRandomWinner,
} from "./winnerSelection";

export {
  normalizeDegrees,
  pointOnCircle,
  getWheelSegmentPath,
  getSegmentCenterAngle,
} from "./wheelGeometry";

export {
  calculateTargetRotation,
  getSegmentAtPointer,
  createSpinPlan,
  requestSpin,
  completeSpin,
} from "./spinCalculation";
