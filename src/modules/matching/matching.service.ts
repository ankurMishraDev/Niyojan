import { db } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { weightedMatchScoreV2 } from "../../utils/scoring";

type NeedRow = {
  id: string;
  org_id: string;
  survey_id?: string;
  category: string;
  summary: string;
  urgency_score: string | number;
  priority_level: string;
  status: string;
  survey_location_text: string | null;
  survey_latitude: string | number | null;
  survey_longitude: string | number | null;
  created_at: Date;
  updated_at: Date;
  is_aggregate?: boolean;
  member_count?: number;
};

type NeedSkillRow = {
  skill_id: string;
  key: string;
  name: string;
  category: string;
};

type VolunteerRow = {
  id: string;
  org_id: string;
  user_id: string;
  availability_status: string;
  location_text: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  user_name: string;
  user_email: string;
  user_role: string;
};

type VolunteerSkillRow = {
  volunteer_id: string;
  skill_id: string;
  proficiency: number;
  key: string;
  name: string;
  category: string;
};

type RankedMatch = {
  volunteerId: string;
  userId: string;
  name: string;
  email: string;
  availabilityStatus: string;
  locationText: string | null;
  distanceKm: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
  breakdown: {
    skillScore: number;
    availabilityScore: number;
    locationScore: number | null;
  };
  effectiveWeights: { skill: number; availability: number; location: number };
  matchReason: {
    skill_overlap: number;
    availability: number;
    distance: number;
    explanation: string;
    matchedSkills: string[];
    missingSkills: string[];
    distanceKm: number | null;
  };
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
  if (user.role === "superadmin") return;
  if (!user.orgId || user.orgId !== orgId) {
    throw new AppError(403, "Cross-organization access is not allowed");
  }
};

const toNumberOrNull = (value: string | number | null) => {
  if (value === null) return null;
  return Number(value);
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (
  fromLat: number | null,
  fromLon: number | null,
  toLat: number | null,
  toLon: number | null,
): number | null => {
  if (fromLat === null || fromLon === null || toLat === null || toLon === null) return null;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
};

const getAvailabilityScore = (availabilityStatus: string, isActive: boolean): number => {
  if (!isActive) return 0;
  if (availabilityStatus === "available") return 1;
  if (availabilityStatus === "part_time") return 0.75;
  if (availabilityStatus === "busy") return 0.25;
  return 0;
};

/**
 * Converts distance to a location score [0,1].
 * Returns null when distanceKm is null — callers use null as "neutral" in v2 scoring.
 */
const getLocationScore = (distanceKm: number | null): number | null => {
  if (distanceKm === null) return null; // neutral — not zero
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.75;
  if (distanceKm <= 50) return 0.5;
  if (distanceKm <= 100) return 0.25;
  return 0;
};

const getNeedById = async (needId: string): Promise<NeedRow | undefined> => {
  return (await db("needs_analysis as n")
    .join("surveys as s", "n.survey_id", "s.id")
    .where("n.id", needId)
    .select(
      "n.id",
      "n.org_id",
      "n.survey_id",
      "n.category",
      "n.summary",
      "n.urgency_score",
      "n.priority_level",
      "n.status",
      "n.created_at",
      "n.updated_at",
      "s.location_text as survey_location_text",
      "s.latitude as survey_latitude",
      "s.longitude as survey_longitude",
    )
    .first()) as NeedRow | undefined;
};

const getAggregateNeedById = async (aggregateId: string): Promise<NeedRow | undefined> => {
  const row = await db("aggregate_needs")
    .where("id", aggregateId)
    .select(
      "id",
      "org_id",
      "need_category as category",
      "title as summary",
      "urgency_score",
      "urgency_label as priority_level",
      "status",
      "created_at",
      "updated_at",
      "centroid_lat as survey_latitude",
      "centroid_lng as survey_longitude",
      "member_count",
    )
    .first();

  if (row) {
    return {
      ...row,
      survey_location_text: `Cluster Center (${row.member_count} needs)`,
      is_aggregate: true,
    } as NeedRow;
  }
  return undefined;
};

const getNeedSkills = async (needId: string, isAggregate = false): Promise<NeedSkillRow[]> => {
  const query = db("need_skills as ns").join("skills as s", "ns.skill_id", "s.id");
  if (isAggregate) {
    query.where("ns.aggregate_need_id", needId);
  } else {
    query.where("ns.need_id", needId);
  }
  return (await query.select("ns.skill_id", "s.key", "s.name", "s.category")) as NeedSkillRow[];
};

const getVolunteersForOrg = async (orgId: string): Promise<VolunteerRow[]> => {
  return (await db("volunteers as v")
    .join("users as u", "v.user_id", "u.id")
    .where("v.org_id", orgId)
    .select(
      "v.id",
      "v.org_id",
      "v.user_id",
      "v.availability_status",
      "v.location_text",
      "v.latitude",
      "v.longitude",
      "v.is_active",
      "v.created_at",
      "v.updated_at",
      "u.name as user_name",
      "u.email as user_email",
      "u.role as user_role",
    )
    .orderBy("v.created_at", "desc")) as VolunteerRow[];
};

const getVolunteerSkills = async (volunteerIds: string[]): Promise<VolunteerSkillRow[]> => {
  if (volunteerIds.length === 0) return [];
  return (await db("volunteer_skills as vs")
    .join("skills as s", "vs.skill_id", "s.id")
    .whereIn("vs.volunteer_id", volunteerIds)
    .select(
      "vs.volunteer_id",
      "vs.skill_id",
      "vs.proficiency",
      "s.key",
      "s.name",
      "s.category",
    )) as VolunteerSkillRow[];
};

const buildExplanation = (
  need: NeedRow,
  volunteer: VolunteerRow,
  matchedSkills: string[],
  missingSkills: string[],
  distanceKm: number | null,
) => {
  const distancePart =
    distanceKm === null ? "unknown distance (neutral)" : `${distanceKm} km away`;
  const skillPart =
    matchedSkills.length > 0
      ? `matched skills: ${matchedSkills.join(", ")}`
      : "no required skills matched";
  const missingPart =
    missingSkills.length > 0
      ? `missing: ${missingSkills.join(", ")}`
      : "all required skills covered";
  return `${volunteer.user_name} is ${volunteer.availability_status}, ${distancePart}, with ${skillPart}; ${missingPart} for ${need.category}.`;
};

/**
 * Rank volunteers for a need using v2 scoring (neutral geo + normalized weights).
 * Returns at most `limit` results.
 */
function rankVolunteers(
  need: NeedRow,
  volunteers: VolunteerRow[],
  needSkills: NeedSkillRow[],
  skillsByVolunteer: Map<string, VolunteerSkillRow[]>,
  limit = 10,
): RankedMatch[] {
  const ranked = volunteers.map((volunteer) => {
    const volunteerSkillRows = skillsByVolunteer.get(volunteer.id) || [];
    const volunteerSkillsById = new Map(volunteerSkillRows.map((s) => [s.skill_id, s]));
    const matchedRows = needSkills.filter((s) => volunteerSkillsById.has(s.skill_id));
    const missingRows = needSkills.filter((s) => !volunteerSkillsById.has(s.skill_id));
    const matchedSkills = matchedRows.map((s) => s.key);
    const missingSkills = missingRows.map((s) => s.key);

    const matchedRatio = needSkills.length === 0 ? 0 : matchedRows.length / needSkills.length;
    const proficiencyBonus =
      matchedRows.length === 0
        ? 0
        : matchedRows.reduce((sum, s) => {
            const vs = volunteerSkillsById.get(s.skill_id)!;
            return sum + vs.proficiency / 5;
          }, 0) / matchedRows.length;
    const skillScore = Math.min(1, matchedRatio * 0.8 + proficiencyBonus * 0.2);
    const availabilityScore = getAvailabilityScore(
      volunteer.availability_status,
      volunteer.is_active,
    );
    const distanceKm = haversineKm(
      toNumberOrNull(need.survey_latitude),
      toNumberOrNull(need.survey_longitude),
      toNumberOrNull(volunteer.latitude),
      toNumberOrNull(volunteer.longitude),
    );
    // v2: null distance = neutral (not zero)
    const locationScore = getLocationScore(distanceKm);

    const weighted = weightedMatchScoreV2(
      skillScore,
      availabilityScore,
      locationScore,
      env.MATCH_SKILL_WEIGHT,
      env.MATCH_AVAILABILITY_WEIGHT,
      env.MATCH_LOCATION_WEIGHT,
    );

    const explanation = buildExplanation(need, volunteer, matchedSkills, missingSkills, distanceKm);

    return {
      volunteerId: volunteer.id,
      userId: volunteer.user_id,
      name: volunteer.user_name,
      email: volunteer.user_email,
      availabilityStatus: volunteer.availability_status,
      locationText: volunteer.location_text,
      distanceKm,
      matchedSkills,
      missingSkills,
      matchScore: weighted.finalScore,
      breakdown: {
        skillScore: weighted.skillScore,
        availabilityScore: weighted.availabilityScore,
        locationScore: weighted.locationScore,
      },
      effectiveWeights: weighted.effectiveWeights,
      matchReason: {
        skill_overlap: weighted.skillScore,
        availability: weighted.availabilityScore,
        distance: weighted.locationScore ?? 0,
        explanation,
        matchedSkills,
        missingSkills,
        distanceKm,
      },
    } satisfies RankedMatch;
  });

  // 4-level deterministic tie-break
  ranked.sort((left, right) => {
    if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
    if (right.matchedSkills.length !== left.matchedSkills.length)
      return right.matchedSkills.length - left.matchedSkills.length;
    if (right.breakdown.availabilityScore !== left.breakdown.availabilityScore)
      return right.breakdown.availabilityScore - left.breakdown.availabilityScore;
    // distanceKm: nulls last, smaller is better
    const ld = left.distanceKm,
      rd = right.distanceKm;
    if (ld !== rd) {
      if (ld === null) return 1;
      if (rd === null) return -1;
      if (ld !== rd) return ld - rd;
    }
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;
    return left.volunteerId.localeCompare(right.volunteerId);
  });

  return ranked.slice(0, limit);
}

export class MatchingService {
  async getMatchesForNeed(
    needId: string,
    user: AuthenticatedUser,
    isAggregate = false,
  ) {
    const need = isAggregate ? await getAggregateNeedById(needId) : await getNeedById(needId);
    if (!need) {
      throw new AppError(404, isAggregate ? "Aggregate need not found" : "Need not found");
    }

    assertOrgScope(user, need.org_id);

    const needSkills = await getNeedSkills(needId, isAggregate);
    const volunteers = await getVolunteersForOrg(need.org_id);
    const volunteerSkills = await getVolunteerSkills(volunteers.map((v) => v.id));

    const skillsByVolunteer = new Map<string, VolunteerSkillRow[]>();
    for (const skill of volunteerSkills) {
      const existing = skillsByVolunteer.get(skill.volunteer_id) || [];
      existing.push(skill);
      skillsByVolunteer.set(skill.volunteer_id, existing);
    }

    const matches = rankVolunteers(need, volunteers, needSkills, skillsByVolunteer);

    return {
      need: {
        id: need.id,
        orgId: need.org_id,
        surveyId: need.survey_id,
        category: need.category,
        summary: need.summary,
        urgencyScore: Number(need.urgency_score),
        priorityLevel: need.priority_level,
        status: need.status,
        locationText: need.survey_location_text,
        latitude: toNumberOrNull(need.survey_latitude),
        longitude: toNumberOrNull(need.survey_longitude),
        requiredSkills: needSkills.map((s) => s.key),
      },
      matches,
    };
  }

  async proposeGlobalAssignment(
    body: {
      needs: { id: string; type: "need" | "aggregate"; slots: number }[];
      maxConcurrentPerVolunteer: number;
      dryRun: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const { needs: needInputs, maxConcurrentPerVolunteer, dryRun } = body;

    // Load all requested needs
    const loadedNeeds: NeedRow[] = [];
    for (const ni of needInputs) {
      const need =
        ni.type === "aggregate" ? await getAggregateNeedById(ni.id) : await getNeedById(ni.id);
      if (!need) {
        throw new AppError(400, `Need not found or out of scope: ${ni.id}`);
      }
      // Org scope check
      if (user.role !== "superadmin") {
        if (!user.orgId || user.orgId !== need.org_id) {
          throw new AppError(400, `Need ${ni.id} is outside your organization scope`);
        }
      }
      loadedNeeds.push(need);
    }

    // Determine org for volunteer pool (first need's org)
    const orgId = loadedNeeds[0]?.org_id;
    if (!orgId) {
      throw new AppError(400, "Cannot determine organization for assignment");
    }

    const volunteers = await getVolunteersForOrg(orgId);
    const volunteerSkills = await getVolunteerSkills(volunteers.map((v) => v.id));
    const skillsByVolunteer = new Map<string, VolunteerSkillRow[]>();
    for (const skill of volunteerSkills) {
      const existing = skillsByVolunteer.get(skill.volunteer_id) || [];
      existing.push(skill);
      skillsByVolunteer.set(skill.volunteer_id, existing);
    }

    // Build all (need, volunteer) scored pairs
    type ScoredPair = {
      needId: string;
      needType: "need" | "aggregate";
      needUrgency: number;
      volunteerId: string;
      score: number;
      matchedSkillsCount: number;
      availabilityScore: number;
      distanceKm: number | null;
    };

    const allPairs: ScoredPair[] = [];

    for (const ni of needInputs) {
      const need = loadedNeeds.find((n) => n.id === ni.id)!;
      const needSkills = await getNeedSkills(ni.id, ni.type === "aggregate");

      for (const vol of volunteers) {
        const volunteerSkillRows = skillsByVolunteer.get(vol.id) || [];
        const volunteerSkillsById = new Map(volunteerSkillRows.map((s) => [s.skill_id, s]));
        const matchedRows = needSkills.filter((s) => volunteerSkillsById.has(s.skill_id));

        const matchedRatio =
          needSkills.length === 0 ? 0 : matchedRows.length / needSkills.length;
        const proficiencyBonus =
          matchedRows.length === 0
            ? 0
            : matchedRows.reduce((sum, s) => {
                const vs = volunteerSkillsById.get(s.skill_id)!;
                return sum + vs.proficiency / 5;
              }, 0) / matchedRows.length;
        const skillScore = Math.min(1, matchedRatio * 0.8 + proficiencyBonus * 0.2);
        const availabilityScore = getAvailabilityScore(vol.availability_status, vol.is_active);
        const distanceKm = haversineKm(
          toNumberOrNull(need.survey_latitude),
          toNumberOrNull(need.survey_longitude),
          toNumberOrNull(vol.latitude),
          toNumberOrNull(vol.longitude),
        );
        const locationScore = getLocationScore(distanceKm);

        const weighted = weightedMatchScoreV2(
          skillScore,
          availabilityScore,
          locationScore,
          env.MATCH_SKILL_WEIGHT,
          env.MATCH_AVAILABILITY_WEIGHT,
          env.MATCH_LOCATION_WEIGHT,
        );

        if (weighted.finalScore > 0) {
          allPairs.push({
            needId: ni.id,
            needType: ni.type,
            needUrgency: Number(need.urgency_score),
            volunteerId: vol.id,
            score: weighted.finalScore,
            matchedSkillsCount: matchedRows.length,
            availabilityScore,
            distanceKm,
          });
        }
      }
    }

    // Sort deterministically
    allPairs.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.needUrgency !== a.needUrgency) return b.needUrgency - a.needUrgency;
      if (b.matchedSkillsCount !== a.matchedSkillsCount)
        return b.matchedSkillsCount - a.matchedSkillsCount;
      if (b.availabilityScore !== a.availabilityScore)
        return b.availabilityScore - a.availabilityScore;
      const ad = a.distanceKm,
        bd = b.distanceKm;
      if (ad !== bd) {
        if (ad === null) return 1;
        if (bd === null) return -1;
        if (ad !== bd) return ad - bd;
      }
      const needCompare = a.needId.localeCompare(b.needId);
      if (needCompare !== 0) return needCompare;
      return a.volunteerId.localeCompare(b.volunteerId);
    });

    // Greedy allocation
    const needRemaining = new Map(needInputs.map((ni) => [ni.id, ni.slots]));
    const volLoad = new Map(volunteers.map((v) => [v.id, 0]));
    const assignments: {
      needId: string;
      needType: string;
      volunteerId: string;
      score: number;
    }[] = [];

    for (const pair of allPairs) {
      const remaining = needRemaining.get(pair.needId) ?? 0;
      const load = volLoad.get(pair.volunteerId) ?? 0;
      if (remaining > 0 && load < maxConcurrentPerVolunteer) {
        assignments.push({
          needId: pair.needId,
          needType: pair.needType,
          volunteerId: pair.volunteerId,
          score: pair.score,
        });
        needRemaining.set(pair.needId, remaining - 1);
        volLoad.set(pair.volunteerId, load + 1);
      }
    }

    const unfilled = needInputs
      .filter((ni) => (needRemaining.get(ni.id) ?? 0) > 0)
      .map((ni) => ({ needId: ni.id, remainingSlots: needRemaining.get(ni.id) }));

    const leftoverVolunteers = volunteers
      .filter((v) => (volLoad.get(v.id) ?? 0) === 0)
      .map((v) => ({ volunteerId: v.id, name: v.user_name }));

    // Persist if dryRun=false
    if (!dryRun) {
      await db.transaction(async (trx) => {
        for (const assignment of assignments) {
          const isAggregate = assignment.needType === "aggregate";
          await trx("task_assignments").insert({
            org_id: orgId,
            need_id: isAggregate ? null : assignment.needId,
            aggregate_need_id: isAggregate ? assignment.needId : null,
            volunteer_id: assignment.volunteerId,
            match_score: assignment.score,
            match_reason_json: { score: assignment.score, source: "greedy_global" },
            status: "suggested",
            assignment_scope: isAggregate ? "cluster" : "solo",
          });
        }
      });
    }

    return { assignments, unfilled, leftoverVolunteers, dryRun };
  }
}

export const matchingService = new MatchingService();
