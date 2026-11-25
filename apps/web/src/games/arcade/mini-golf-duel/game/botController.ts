import type { BotDifficulty, CourseDef, Vector2 } from "./types";
import { clamp, simulateShot, vecDistance } from "./physics";

export interface BotDecision {
  aim: Vector2;
  power: number;
}

export class MiniGolfBotController {
  public static calculateShot(
    course: CourseDef,
    ballPos: Vector2,
    difficulty: BotDifficulty = "medium"
  ): BotDecision {
    const holePos = course.hole;
    const directAngle = Math.atan2(holePos.y - ballPos.y, holePos.x - ballPos.x);
    const directDist = vecDistance(ballPos, holePos);

    // Exact kinematic distance-to-power calibration based on rolling friction
    // v0 = sqrt(2 * a * d) where a ~ 135 px/s^2 -> v0 = sqrt(270 * d)
    // power = ((v0 - 25) / 495)^0.77
    const targetV0 = Math.sqrt(270 * directDist);
    const estimatedPower = clamp(
      Math.pow(Math.max(0, targetV0 - 20) / 495, 0.77),
      0.15,
      0.95
    );

    // Mirror points for bank shots off left wall (x=25) and right wall (x=355)
    const mirrorLeftX = 50 - holePos.x;
    const bankLeftAngle = Math.atan2(holePos.y - ballPos.y, mirrorLeftX - ballPos.x);

    const mirrorRightX = 710 - holePos.x;
    const bankRightAngle = Math.atan2(holePos.y - ballPos.y, mirrorRightX - ballPos.x);

    interface Candidate {
      angle: number;
      power: number;
      score: number;
    }

    const candidates: Candidate[] = [];

    // Angle sets based on difficulty
    let angleList: number[];
    let powerMultipliers: number[];

    if (difficulty === "easy") {
      angleList = [
        directAngle,
        directAngle - 0.12,
        directAngle + 0.12,
        directAngle - 0.22,
        directAngle + 0.22,
      ];
      powerMultipliers = [0.85, 1.0, 1.15];
    } else if (difficulty === "medium") {
      angleList = [
        directAngle,
        directAngle - 0.05,
        directAngle + 0.05,
        directAngle - 0.1,
        directAngle + 0.1,
        directAngle - 0.18,
        directAngle + 0.18,
        bankLeftAngle,
        bankLeftAngle - 0.06,
        bankLeftAngle + 0.06,
        bankRightAngle,
        bankRightAngle - 0.06,
        bankRightAngle + 0.06,
      ];
      powerMultipliers = [0.8, 0.95, 1.05, 1.2];
    } else {
      // Hard: extensive exploration
      angleList = [
        directAngle,
        directAngle - 0.03,
        directAngle + 0.03,
        directAngle - 0.07,
        directAngle + 0.07,
        directAngle - 0.12,
        directAngle + 0.12,
        directAngle - 0.2,
        directAngle + 0.2,
        bankLeftAngle,
        bankLeftAngle - 0.04,
        bankLeftAngle + 0.04,
        bankLeftAngle - 0.08,
        bankLeftAngle + 0.08,
        bankRightAngle,
        bankRightAngle - 0.04,
        bankRightAngle + 0.04,
        bankRightAngle - 0.08,
        bankRightAngle + 0.08,
      ];
      powerMultipliers = [0.75, 0.9, 1.0, 1.1, 1.25, 1.35];
    }

    for (const ang of angleList) {
      const aimVec: Vector2 = { x: Math.cos(ang), y: Math.sin(ang) };
      for (const pMult of powerMultipliers) {
        const testPower = clamp(estimatedPower * pMult, 0.1, 0.98);
        const sim = simulateShot(course, ballPos, aimVec, testPower, Date.now());

        let score = -vecDistance(sim.finalPosition, holePos);

        if (sim.sunk) {
          // Significant bonus for sinking
          score = 100000 - testPower * 50;
        } else if (sim.waterHazard) {
          // Severe penalty for hazard
          score = -50000;
        } else {
          // Penalty if stuck inside sand
          const inSand = course.surfaces.some(
            (s) =>
              s.type === "sand" &&
              sim.finalPosition.x >= s.x &&
              sim.finalPosition.x <= s.x + s.width &&
              sim.finalPosition.y >= s.y &&
              sim.finalPosition.y <= s.y + s.height
          );
          if (inSand) score -= 150;
        }

        candidates.push({ angle: ang, power: testPower, score });
      }
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    // Pick according to difficulty
    let chosen: Candidate;
    if (difficulty === "easy") {
      const pickIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
      chosen = candidates[pickIdx] || candidates[0];
      const angleJitter = (Math.random() - 0.5) * 0.15; // ~8.5 degrees jitter
      const powerJitter = (Math.random() - 0.5) * 0.18;
      return {
        aim: {
          x: Math.cos(chosen.angle + angleJitter),
          y: Math.sin(chosen.angle + angleJitter),
        },
        power: clamp(chosen.power + powerJitter, 0.1, 1.0),
      };
    } else if (difficulty === "medium") {
      chosen = candidates[0];
      const angleJitter = (Math.random() - 0.5) * 0.04; // ~2.3 degrees jitter
      const powerJitter = (Math.random() - 0.5) * 0.06;
      return {
        aim: {
          x: Math.cos(chosen.angle + angleJitter),
          y: Math.sin(chosen.angle + angleJitter),
        },
        power: clamp(chosen.power + powerJitter, 0.1, 1.0),
      };
    } else {
      // Hard: precise best candidate
      chosen = candidates[0];
      return {
        aim: {
          x: Math.cos(chosen.angle),
          y: Math.sin(chosen.angle),
        },
        power: chosen.power,
      };
    }
  }
}
