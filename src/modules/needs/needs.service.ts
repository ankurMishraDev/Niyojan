import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { auditService } from "../../services/auditService";
import { getPaginationParams } from "../../utils/pagination";

type NeedRow = {
	id: string;
	org_id: string;
	survey_id: string;
	category: string;
	summary: string;
	urgency_score: string | number;
	priority_level: string;
	status: string;
	created_at: Date;
	updated_at: Date;
	survey_location_text?: string | null;
	survey_latitude?: string | number | null;
	survey_longitude?: string | number | null;
	respondent_name?: string | null;
	template_version_id?: string;
};

type NeedSkillRow = {
	skill_id: string;
	key: string;
	name: string;
	category: string;
};

type ListNeedsQuery = {
	page?: string | number;
	pageSize?: string | number;
	org_id?: string;
	survey_id?: string;
	status?: string;
	priority_level?: string;
	category?: string;
};

type AttachNeedSkillsInput = {
	replace?: boolean;
	skill_ids: string[];
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const mapNeedSkill = (skill: NeedSkillRow) => {
	return {
		skillId: skill.skill_id,
		key: skill.key,
		name: skill.name,
		category: skill.category,
	};
};

const mapNeed = (need: NeedRow, skills: NeedSkillRow[]) => {
	return {
		id: need.id,
		orgId: need.org_id,
		surveyId: need.survey_id,
		category: need.category,
		summary: need.summary,
		urgencyScore: Number(need.urgency_score),
		priorityLevel: need.priority_level,
		status: need.status,
		createdAt: need.created_at,
		updatedAt: need.updated_at,
		locationText: need.survey_location_text ?? null,
		latitude: need.survey_latitude === undefined || need.survey_latitude === null ? null : Number(need.survey_latitude),
		longitude: need.survey_longitude === undefined || need.survey_longitude === null ? null : Number(need.survey_longitude),
		respondentName: need.respondent_name ?? null,
		templateVersionId: need.template_version_id ?? null,
		skills: skills.map(mapNeedSkill),
	};
};

const getNeedSkills = async (needIds: string[]) => {
	if (needIds.length === 0) {
		return [] as (NeedSkillRow & { need_id: string })[];
	}

	return (await db("need_skills as ns")
		.join("skills as s", "ns.skill_id", "s.id")
		.whereIn("ns.need_id", needIds)
		.select("ns.need_id", "ns.skill_id", "s.key", "s.name", "s.category")) as (NeedSkillRow & { need_id: string })[];
};

const getNeedRowById = async (needId: string) => {
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
			"s.respondent_name",
			"s.template_version_id",
		)
		.first()) as NeedRow | undefined;
};

export class NeedsService {
	async listNeeds(query: ListNeedsQuery, user: AuthenticatedUser) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);
		const baseQuery = db("needs_analysis as n").join("surveys as s", "n.survey_id", "s.id");

		if (user.role === "superadmin") {
			if (query.org_id) {
				baseQuery.andWhere("n.org_id", query.org_id);
			}
		} else {
			if (!user.orgId) {
				throw new AppError(400, "Authenticated user organization context is missing");
			}

			baseQuery.andWhere("n.org_id", user.orgId);
		}

		if (query.survey_id) {
			baseQuery.andWhere("n.survey_id", query.survey_id);
		}

		if (query.status) {
			baseQuery.andWhere("n.status", query.status);
		}

		if (query.priority_level) {
			baseQuery.andWhere("n.priority_level", query.priority_level);
		}

		if (query.category) {
			baseQuery.andWhere("n.category", query.category);
		}

		const rows = (await baseQuery
			.clone()
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
				"s.respondent_name",
				"s.template_version_id",
			)
			.orderBy("n.created_at", "desc")
			.offset(offset)
			.limit(pageSize)) as NeedRow[];

		const countResult = (await baseQuery.clone().clearSelect().countDistinct({ count: "n.id" }).first()) as
			| { count: string }
			| undefined;

		const skillRows = await getNeedSkills(rows.map((need) => need.id));
		const skillsByNeed = new Map<string, NeedSkillRow[]>();
		for (const skill of skillRows) {
			const existing = skillsByNeed.get(skill.need_id) || [];
			existing.push(skill);
			skillsByNeed.set(skill.need_id, existing);
		}

		return {
			items: rows.map((need) => mapNeed(need, skillsByNeed.get(need.id) || [])),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async getNeedById(needId: string, user: AuthenticatedUser) {
		const need = await getNeedRowById(needId);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);
		const skillRows = await getNeedSkills([needId]);
		return mapNeed(need, skillRows);
	}

	async attachNeedSkills(needId: string, input: AttachNeedSkillsInput, user: AuthenticatedUser) {
		const need = await getNeedRowById(needId);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);
		const rows = await db("skills").whereIn("id", input.skill_ids).select("id");
		const existing = new Set(rows.map((row) => row.id as string));
		const missing = input.skill_ids.filter((skillId) => !existing.has(skillId));
		if (missing.length > 0) {
			throw new AppError(400, `Unknown skill ids: ${missing.join(", ")}`);
		}

		const previousSkills = await getNeedSkills([needId]);

		await db.transaction(async (trx) => {
			if (input.replace) {
				await trx("need_skills").where({ need_id: needId }).del();
			}

			await trx("need_skills")
				.insert(input.skill_ids.map((skillId) => ({ need_id: needId, skill_id: skillId })))
				.onConflict(["need_id", "skill_id"])
				.ignore();

			const refreshedRows = await trx("need_skills as ns")
				.join("skills as s", "ns.skill_id", "s.id")
				.where("ns.need_id", needId)
				.select("ns.skill_id", "s.key", "s.name", "s.category");

			await auditService.writeEvent(trx, {
				orgId: need.org_id,
				eventType: "need_skills_updated",
				entityType: "need",
				entityId: needId,
				actorId: user.id,
				oldValue: { skills: previousSkills.map(mapNeedSkill) },
				newValue: {
					skills: refreshedRows.map((skill) =>
						mapNeedSkill(skill as NeedSkillRow),
					),
				},
				metadata: { replace: Boolean(input.replace) },
			});
		});

		return this.getNeedById(needId, user);
	}
}

export const needsService = new NeedsService();
