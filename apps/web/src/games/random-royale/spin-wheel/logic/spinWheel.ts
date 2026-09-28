/**
 * Unified test and external import surface for all spin-wheel logic.
 *
 * Application code should import directly from the individual modules for
 * tree-shaking efficiency. This barrel file exists so that tests can import
 * all logic symbols from a single path instead of chasing individual modules.
 *
 * Module map:
 *   Config & constants  → ../config
 *   Types               → ../types
 *   Participant helpers → ./participantUtils
 *   Winner selection    → ./winnerSelection
 *   Wheel geometry      → ./wheelGeometry
 *   Spin calculation    → ./spinCalculation
 */

export {
  SPIN_WHEEL_CONFIG,
  MAX_PARTICIPANTS,
  SPIN_DURATION_MS,
  MIN_SPIN_TURNS,
  EXTRA_SPIN_TURNS,
  WHEEL_COLORS,
  PEAK_SPEED_MULTIPLIER,
  calculatePeakAngularVelocity,
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
