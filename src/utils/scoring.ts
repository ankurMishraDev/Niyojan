export type MatchScoreBreakdown = {
  skillScore: number;
  availabilityScore: number;
  locationScore: number;
  finalScore: number;
};

export const weightedMatchScore = (
  skillScore: number,
  availabilityScore: number,
  locationScore: number,
  skillWeight: number,
  availabilityWeight: number,
  locationWeight: number,
): MatchScoreBreakdown => {
  const normalizedSkill = Math.max(0, Math.min(1, skillScore));
  const normalizedAvailability = Math.max(0, Math.min(1, availabilityScore));
  const normalizedLocation = Math.max(0, Math.min(1, locationScore));

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
