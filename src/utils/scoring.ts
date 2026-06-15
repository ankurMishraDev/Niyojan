import { AppError } from "../middleware/errorHandler";

export type MatchScoreBreakdown = {
  skillScore: number;
  availabilityScore: number;
  locationScore: number;
  finalScore: number;
};

export type MatchScoreBreakdownV2 = {
  skillScore: number;
  availabilityScore: number;
  locationScore: number | null; // null = geo unavailable (neutral)
  finalScore: number;
  effectiveWeights: { skill: number; availability: number; location: number };
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Original scoring function — kept for backward compatibility.
 * Treats null location as 0 (not neutral). Does not normalize weights.
 */
export const weightedMatchScore = (
  skillScore: number,
  availabilityScore: number,
  locationScore: number,
  skillWeight: number,
  availabilityWeight: number,
  locationWeight: number,
): MatchScoreBreakdown => {
  const normalizedSkill = clamp01(skillScore);
  const normalizedAvailability = clamp01(availabilityScore);
  const normalizedLocation = clamp01(locationScore);

  const finalScore =
    normalizedSkill * skillWeight +
    normalizedAvailability * availabilityWeight +
    normalizedLocation * locationWeight;

  return {
    skillScore: normalizedSkill,
    availabilityScore: normalizedAvailability,
    locationScore: normalizedLocation,
    finalScore: Number(finalScore.toFixed(4)),
  };
};

/**
 * v2 scoring function:
 * - Normalizes weights so they always sum to 1.
 * - When locationScore is null (distance unknown), drops the location term and
 *   redistributes its weight proportionally across skill + availability (neutral geo).
 * - Returns effectiveWeights to make the applied normalization transparent.
 * - Throws AppError(400) if any weight is negative or all three sum to zero.
 */
export const weightedMatchScoreV2 = (
  skillScore: number,
  availabilityScore: number,
  locationScore: number | null,
  skillWeight: number,
  availabilityWeight: number,
  locationWeight: number,
): MatchScoreBreakdownV2 => {
  // Validate weights
  if (skillWeight < 0 || availabilityWeight < 0 || locationWeight < 0) {
    throw new AppError(400, "Match weights must be non-negative");
  }

  const s = clamp01(skillScore);
  const a = clamp01(availabilityScore);
  const l = locationScore === null ? null : clamp01(locationScore);

  // Neutral geo: if location is unknown, drop wLoc and renormalize remaining
  const wSkill = skillWeight;
  const wAvail = availabilityWeight;
  const wLoc = l === null ? 0 : locationWeight;
  const totalW = wSkill + wAvail + wLoc;

  if (totalW <= 0) {
    throw new AppError(400, "Match weights must not all be zero");
  }

  let nSkill = wSkill / totalW;
  let nAvail = wAvail / totalW;
  const nLoc = wLoc / totalW;

  // Edge case: if after dropping location both skill+avail are zero, default each to 0.5
  if (l === null && wSkill === 0 && wAvail === 0) {
    nSkill = 0.5;
    nAvail = 0.5; // nLoc stays 0
  }

  const finalScore = nSkill * s + nAvail * a + nLoc * (l ?? 0);

  return {
    skillScore: s,
    availabilityScore: a,
    locationScore: l,
    finalScore: Number(clamp01(finalScore).toFixed(4)),
    effectiveWeights: {
      skill: Number(nSkill.toFixed(4)),
      availability: Number(nAvail.toFixed(4)),
      location: Number(nLoc.toFixed(4)),
    },
  };
};
