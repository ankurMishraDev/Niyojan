import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";
import { getPaginationParams } from "../../utils/pagination";

type VolunteerRow = {
	id: string;
	org_id: string | null;
	user_id: string;
	availability_status: string;
	location_text: string | null;
	latitude: string | number | null;
	longitude: string | number | null;
	gender: string | null;
	age: number | null;
	phone_number: string | null;
	profession: string | null;
	primary_domain: string | null;
	profile_summary: string | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
};

type VolunteerSkillRow = {
	volunteer_id: string;
	skill_id: string;
	proficiency: number;
	key: string;
	name: string;
	category: string;
};

type CreateVolunteerInput = {
	org_id?: string;
	user_id: string;
	availability_status?: string;
	location_text?: string;
	latitude?: number | null;
	longitude?: number | null;
	is_active?: boolean;
};

type UpdateVolunteerInput = {
	availability_status?: string;
	location_text?: string;
	latitude?: number | null;
	longitude?: number | null;
	gender?: string;
	age?: number | null;
	phone_number?: string;
	profession?: string;
	primary_domain?: string;
	profile_summary?: string;
	is_active?: boolean;
};

type VolunteerSkillInput = {
	skill_id: string;
	proficiency: number;
};

type AttachVolunteerSkillsInput = {
	replace?: boolean;
	skills: VolunteerSkillInput[];
};

type ListVolunteersQuery = {
	page?: string | number;
	pageSize?: string | number;
	org_id?: string;
	availability_status?: string;
	is_active?: string;
	user_id?: string;
	skill_id?: string;
};

const parseOptionalBoolean = (value?: string) => {
	if (value === undefined) {
		return undefined;
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return undefined;
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const canAccessVolunteerRecord = (user: AuthenticatedUser, volunteer: VolunteerRow) => {
	if (user.role === "superadmin") {
		return true;
	}

	if (user.role === "volunteer" && volunteer.user_id === user.id) {
		return true;
	}

	return Boolean(user.orgId && volunteer.org_id && user.orgId === volunteer.org_id);
};

const resolveTargetOrgId = (user: AuthenticatedUser, orgIdFromInput?: string) => {
	if (user.role === "superadmin") {
		if (!orgIdFromInput) {
			throw new AppError(400, "org_id is required for superadmin requests");
		}

		return orgIdFromInput;
	}

	if (!user.orgId) {
		throw new AppError(400, "Authenticated user organization context is missing");
	}

	if (orgIdFromInput && orgIdFromInput !== user.orgId) {
		throw new AppError(403, "Organization scope mismatch");
	}

	return user.orgId;
};

const mapVolunteer = (volunteer: VolunteerRow, skills: VolunteerSkillRow[]) => {
	return {
		id: volunteer.id,
		orgId: volunteer.org_id,
		userId: volunteer.user_id,
		availabilityStatus: volunteer.availability_status,
		locationText: volunteer.location_text,
		latitude: volunteer.latitude === null ? null : Number(volunteer.latitude),
		longitude: volunteer.longitude === null ? null : Number(volunteer.longitude),
		gender: volunteer.gender,
		age: volunteer.age,
		phoneNumber: volunteer.phone_number,
		profession: volunteer.profession,
		primaryDomain: volunteer.primary_domain,
		profileSummary: volunteer.profile_summary,
		isActive: volunteer.is_active,
		createdAt: volunteer.created_at,
		updatedAt: volunteer.updated_at,
		skills: skills.map((skill) => ({
			skillId: skill.skill_id,
			key: skill.key,
			name: skill.name,
			category: skill.category,
			proficiency: skill.proficiency,
		})),
	};
};

const fetchVolunteerSkills = async (volunteerIds: string[]) => {
	if (volunteerIds.length === 0) {
		return [] as VolunteerSkillRow[];
	}

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

const ensureSkillsExist = async (skillIds: string[]) => {
	const rows = await db("skills").whereIn("id", skillIds).select("id");
	const existing = new Set(rows.map((row) => row.id as string));
	const missing = skillIds.filter((skillId) => !existing.has(skillId));

	if (missing.length > 0) {
		throw new AppError(400, `Unknown skill ids: ${missing.join(", ")}`);
	}
};

export class VolunteersService {
	async createVolunteer(input: CreateVolunteerInput, user: AuthenticatedUser) {
		const orgId = resolveTargetOrgId(user, input.org_id);

		const targetUser = await db("users").where({ id: input.user_id }).first();
		if (!targetUser) {
			throw new AppError(404, "Target user not found");
		}

		if (targetUser.org_id !== orgId) {
			throw new AppError(400, "Target user does not belong to the specified organization");
		}

		const [volunteer] = (await db("volunteers")
			.insert({
				org_id: orgId,
				user_id: input.user_id,
				availability_status: input.availability_status || "available",
				location_text: input.location_text || null,
				latitude: input.latitude ?? null,
				longitude: input.longitude ?? null,
				is_active: input.is_active ?? true,
			})
			.returning("*")) as VolunteerRow[];

		return mapVolunteer(volunteer, []);
	}

	async getVolunteerById(volunteerId: string, user: AuthenticatedUser) {
		const volunteer = (await db("volunteers").where({ id: volunteerId }).first()) as
			| VolunteerRow
			| undefined;

		if (!volunteer) {
			throw new AppError(404, "Volunteer not found");
		}

		if (!canAccessVolunteerRecord(user, volunteer)) {
			throw new AppError(403, "Cross-organization access is not allowed");
		}

		const skills = await fetchVolunteerSkills([volunteer.id]);
		return mapVolunteer(volunteer, skills);
	}

	async listVolunteers(query: ListVolunteersQuery, user: AuthenticatedUser) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);

		const baseQuery = db("volunteers as v").select("v.*");

		if (user.role === "superadmin") {
			if (query.org_id) {
				baseQuery.andWhere("v.org_id", query.org_id);
			}
		} else if (user.role === "volunteer") {
			baseQuery.andWhere("v.user_id", user.id);
		} else {
			if (!user.orgId) {
				throw new AppError(400, "Authenticated user organization context is missing");
			}

			baseQuery.andWhere("v.org_id", user.orgId);
		}

		if (query.availability_status) {
			baseQuery.andWhere("v.availability_status", query.availability_status);
		}

		const isActive = parseOptionalBoolean(query.is_active);
		if (isActive !== undefined) {
			baseQuery.andWhere("v.is_active", isActive);
		}

		if (query.user_id) {
			baseQuery.andWhere("v.user_id", query.user_id);
		}

		if (query.skill_id) {
			baseQuery
				.join("volunteer_skills as filter_vs", "filter_vs.volunteer_id", "v.id")
				.andWhere("filter_vs.skill_id", query.skill_id)
				.distinct("v.id", "v.org_id", "v.user_id", "v.availability_status", "v.location_text", "v.latitude", "v.longitude", "v.is_active", "v.created_at", "v.updated_at");
		}

		const volunteers = (await baseQuery
			.clone()
			.orderBy("v.created_at", "desc")
			.offset(offset)
			.limit(pageSize)) as VolunteerRow[];

		const countResult = (await baseQuery
			.clone()
			.clearSelect()
			.clearOrder()
			.countDistinct({ count: "v.id" })
			.first()) as { count: string } | undefined;

		const volunteerIds = volunteers.map((volunteer) => volunteer.id);
		const skills = await fetchVolunteerSkills(volunteerIds);
		const skillsByVolunteer = new Map<string, VolunteerSkillRow[]>();

		for (const skill of skills) {
			const existing = skillsByVolunteer.get(skill.volunteer_id) || [];
			existing.push(skill);
			skillsByVolunteer.set(skill.volunteer_id, existing);
		}

		return {
			items: volunteers.map((volunteer) => {
				return mapVolunteer(volunteer, skillsByVolunteer.get(volunteer.id) || []);
			}),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async updateVolunteer(
		volunteerId: string,
		input: UpdateVolunteerInput,
		user: AuthenticatedUser,
	) {
		const volunteer = (await db("volunteers").where({ id: volunteerId }).first()) as
			| VolunteerRow
			| undefined;

		if (!volunteer) {
			throw new AppError(404, "Volunteer not found");
		}

		if (!canAccessVolunteerRecord(user, volunteer)) {
			throw new AppError(403, "Cross-organization access is not allowed");
		}

		const payload: Record<string, unknown> = {};

		if (input.availability_status !== undefined) {
			payload.availability_status = input.availability_status;
		}

		if (input.location_text !== undefined) {
			payload.location_text = input.location_text;
		}

		if (input.latitude !== undefined) {
			payload.latitude = input.latitude;
		}

		if (input.longitude !== undefined) {
			payload.longitude = input.longitude;
		}

		if (input.gender !== undefined) {
			payload.gender = input.gender;
		}

		if (input.age !== undefined) {
			payload.age = input.age;
		}

		if (input.phone_number !== undefined) {
			payload.phone_number = input.phone_number;
		}

		if (input.profession !== undefined) {
			payload.profession = input.profession;
		}

		if (input.primary_domain !== undefined) {
			payload.primary_domain = input.primary_domain;
		}

		if (input.profile_summary !== undefined) {
			payload.profile_summary = input.profile_summary;
		}

		if (input.is_active !== undefined) {
			payload.is_active = input.is_active;
		}

		if (Object.keys(payload).length === 0) {
			throw new AppError(400, "No volunteer fields provided for update");
		}

		const [updatedVolunteer] = (await db("volunteers")
			.where({ id: volunteerId })
			.update({
				...payload,
				updated_at: new Date(),
			})
			.returning("*")) as VolunteerRow[];

		const skills = await fetchVolunteerSkills([volunteerId]);
		return mapVolunteer(updatedVolunteer, skills);
	}

	async attachVolunteerSkills(
		volunteerId: string,
		input: AttachVolunteerSkillsInput,
		user: AuthenticatedUser,
	) {
		const volunteer = (await db("volunteers").where({ id: volunteerId }).first()) as
			| VolunteerRow
			| undefined;

		if (!volunteer) {
			throw new AppError(404, "Volunteer not found");
		}

		if (!volunteer.org_id) {
			throw new AppError(400, "Volunteer is not linked to an organization");
		}

		assertOrgScope(user, volunteer.org_id);

		if (input.skills.length === 0) {
			throw new AppError(400, "At least one skill is required");
		}

		const uniqueSkillIds = Array.from(new Set(input.skills.map((skill) => skill.skill_id)));
		await ensureSkillsExist(uniqueSkillIds);

		await db.transaction(async (trx) => {
			if (input.replace) {
				await trx("volunteer_skills").where({ volunteer_id: volunteerId }).del();
			}

			const rows = input.skills.map((skill) => ({
				volunteer_id: volunteerId,
				skill_id: skill.skill_id,
				proficiency: skill.proficiency,
			}));

			await trx("volunteer_skills")
				.insert(rows)
				.onConflict(["volunteer_id", "skill_id"])
				.merge({
					proficiency: trx.raw("excluded.proficiency"),
					updated_at: trx.fn.now(),
				});
		});

		const refreshedVolunteer = (await db("volunteers").where({ id: volunteerId }).first()) as
			| VolunteerRow
			| undefined;

		if (!refreshedVolunteer) {
			throw new AppError(404, "Volunteer not found after skill update");
		}

		const skills = await fetchVolunteerSkills([volunteerId]);
		return mapVolunteer(refreshedVolunteer, skills);
	}
}

export const volunteersService = new VolunteersService();
