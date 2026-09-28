import { SPIN_WHEEL_CONFIG } from "../config";

/**
 * Normalizes any degree value into the canonical [0, 360) range.
 */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Calculates (x, y) coordinates for a point on a circle at a given radius and angle.
 */
export function pointOnCircle(
  radius: number,
  degrees: number,
  center = SPIN_WHEEL_CONFIG.centerCoord
): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

/**
 * Generates an SVG path description for a single wheel segment wedge.
 * Returns an empty string for a single segment (which is rendered as a full circle).
 */
export function getWheelSegmentPath(
  index: number,
  count: number,
  radius = SPIN_WHEEL_CONFIG.wheelRadius,
  center = SPIN_WHEEL_CONFIG.centerCoord
): string {
  if (count <= 1) return "";
  const startAngle = (index * 360) / count - 90;
  const endAngle = ((index + 1) * 360) / count - 90;
  const start = pointOnCircle(radius, startAngle, center);
  const end = pointOnCircle(radius, endAngle, center);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/**
 * Returns the angular center (in degrees) of a given segment index.
 */
export function getSegmentCenterAngle(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + 0.5) * 360) / count - 90;
}
