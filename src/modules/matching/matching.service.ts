import { db } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { weightedMatchScore } from "../../utils/scoring";

type NeedRow = {
	id: string;
	org_id: string;
	survey_id: string;
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
		locationScore: number;
	};
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
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const toNumberOrNull = (value: string | number | null) => {
	if (value === null) {
		return null;
	}

	return Number(value);
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (
	fromLat: number | null,
	fromLon: number | null,
	toLat: number | null,
	toLon: number | null,
) => {
	if (fromLat === null || fromLon === null || toLat === null || toLon === null) {
		return null;
	}

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

const getAvailabilityScore = (availabilityStatus: string, isActive: boolean) => {
	if (!isActive) {
		return 0;
	}

	if (availabilityStatus === "available") {
		return 1;
	}

	if (availabilityStatus === "part_time") {
		return 0.75;
	}

	if (availabilityStatus === "busy") {
		return 0.25;
	}

	return 0;
	};

const getLocationScore = (distanceKm: number | null) => {
	if (distanceKm === null) {
		return 0;
	}

	if (distanceKm <= 10) {
		return 1;
	}

	if (distanceKm <= 25) {
		return 0.75;
	}

	if (distanceKm <= 50) {
		return 0.5;
	}

	if (distanceKm <= 100) {
		return 0.25;
	}

	return 0;
};

const getNeedById = async (needId: string) => {
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

const getNeedSkills = async (needId: string) => {
	return (await db("need_skills as ns")
		.join("skills as s", "ns.skill_id", "s.id")
		.where("ns.need_id", needId)
		.select("ns.skill_id", "s.key", "s.name", "s.category")) as NeedSkillRow[];
};

const getVolunteersForOrg = async (orgId: string) => {
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

const getVolunteerSkills = async (volunteerIds: string[]) => {
	if (volunteerIds.length === 0) {
		return [] as VolunteerSkillRow[];
	}

	return (await db("volunteer_skills as vs")
		.join("skills as s", "vs.skill_id", "s.id")
		.whereIn("vs.volunteer_id", volunteerIds)
		.select("vs.volunteer_id", "vs.skill_id", "vs.proficiency", "s.key", "s.name", "s.category")) as VolunteerSkillRow[];
};

const buildExplanation = (
	need: NeedRow,
	volunteer: VolunteerRow,
	matchedSkills: string[],
	missingSkills: string[],
	distanceKm: number | null,
) => {
	const distancePart = distanceKm === null ? "unknown distance" : `${distanceKm} km away`;
	const skillPart = matchedSkills.length > 0
		? `matched skills: ${matchedSkills.join(", ")}`
		: "no required skills matched";
	const missingPart = missingSkills.length > 0
		? `missing: ${missingSkills.join(", ")}`
		: "all required skills covered";

	return `${volunteer.user_name} is ${volunteer.availability_status}, ${distancePart}, with ${skillPart}; ${missingPart} for ${need.category}.`;
};

export class MatchingService {
	async getMatchesForNeed(needId: string, user: AuthenticatedUser) {
		const need = await getNeedById(needId);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);

		const needSkills = await getNeedSkills(needId);
		const volunteers = await getVolunteersForOrg(need.org_id);
		const volunteerSkills = await getVolunteerSkills(volunteers.map((volunteer) => volunteer.id));

		const needSkillKeys = needSkills.map((skill) => skill.key);
		const needSkillIds = new Set(needSkills.map((skill) => skill.skill_id));
		const skillsByVolunteer = new Map<string, VolunteerSkillRow[]>();

		for (const skill of volunteerSkills) {
			const existing = skillsByVolunteer.get(skill.volunteer_id) || [];
			existing.push(skill);
			skillsByVolunteer.set(skill.volunteer_id, existing);
		}

		const ranked = volunteers
			.map((volunteer) => {
				const volunteerSkillRows = skillsByVolunteer.get(volunteer.id) || [];
				const volunteerSkillsById = new Map(volunteerSkillRows.map((skill) => [skill.skill_id, skill]));
				const matchedRows = needSkills.filter((skill) => volunteerSkillsById.has(skill.skill_id));
				const missingRows = needSkills.filter((skill) => !volunteerSkillsById.has(skill.skill_id));
				const matchedSkills = matchedRows.map((skill) => skill.key);
				const missingSkills = missingRows.map((skill) => skill.key);

				const matchedRatio = needSkills.length === 0 ? 0 : matchedRows.length / needSkills.length;
				const proficiencyBonus = matchedRows.length === 0
					? 0
					: matchedRows.reduce((sum, skill) => {
						const volunteerSkill = volunteerSkillsById.get(skill.skill_id) as VolunteerSkillRow;
						return sum + volunteerSkill.proficiency / 5;
					}, 0) / matchedRows.length;
				const skillScore = Math.min(1, matchedRatio * 0.8 + proficiencyBonus * 0.2);
				const availabilityScore = getAvailabilityScore(volunteer.availability_status, volunteer.is_active);
				const distanceKm = haversineKm(
					toNumberOrNull(need.survey_latitude),
					toNumberOrNull(need.survey_longitude),
					toNumberOrNull(volunteer.latitude),
					toNumberOrNull(volunteer.longitude),
				);
				const locationScore = getLocationScore(distanceKm);

				const weighted = weightedMatchScore(
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
					matchReason: {
						skill_overlap: weighted.skillScore,
						availability: weighted.availabilityScore,
						distance: weighted.locationScore,
						explanation: explanation,
						matchedSkills,
						missingSkills,
						distanceKm,
					},
				} as RankedMatch;
			})
			.sort((left, right) => {
				if (right.matchScore !== left.matchScore) {
					return right.matchScore - left.matchScore;
				}

				const leftMatched = left.matchedSkills.length;
				const rightMatched = right.matchedSkills.length;
				if (rightMatched !== leftMatched) {
					return rightMatched - leftMatched;
				}

				return left.name.localeCompare(right.name);
			})
			.slice(0, 10);

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
				requiredSkills: needSkillKeys,
			},
			matches: ranked,
		};
	}
}

export const matchingService = new MatchingService();
