import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import {
	AppRole,
	AuthenticatedClaims,
	ResolvedAppUser,
	UserStatus,
} from "../../types/auth";

type UserRow = {
	id: string;
	org_id: string | null;
	firebase_uid: string;
	name: string;
	email: string;
	role: AppRole;
	status: string;
	created_at: Date;
	updated_at: Date;
	org_name?: string | null;
	org_status?: string | null;
};

type RegisterNgoInput = {
	organization_name: string;
	organization_type: string;
	region?: string;
	admin_name?: string;
	registration_id?: string;
	contact_phone?: string;
	website?: string;
	address_text?: string;
	focus_areas?: string[];
	operating_regions?: string[];
	team_size?: number;
	founded_year?: number;
};

type RegisterVolunteerInput = {
	org_id?: string;
	volunteer_name?: string;
	availability_status?: string;
	location_text?: string;
	latitude?: number;
	longitude?: number;
	gender?: string;
	age?: number;
	phone_number?: string;
	profession?: string;
	primary_domain?: string;
	profile_summary?: string;
	skills?: Array<{
		skill_id: string;
		proficiency: number;
	}>;
};

type ListOnboardingOrganizationsQuery = {
	status?: string;
};

const ALL_ACCOUNT_STATUSES = ["pending", "active", "rejected", "inactive"] as const;
const VOLUNTEER_DOMAINS = [
	"medical",
	"counsellor",
	"distributor",
	"technical",
	"manager",
	"community_outreach",
	"logistics",
	"other",
] as const;

const resolveSafeEmail = (firebaseUid: string, email?: string) => {
	if (email && email.includes("@")) {
		return email.trim().toLowerCase();
	}

	return `${firebaseUid}@niyojan.local`;
};

const normalizeStatus = (status: string): UserStatus | string => {
	return ALL_ACCOUNT_STATUSES.includes(status as UserStatus)
		? (status as UserStatus)
		: status;
};

const getEffectiveStatus = (user: UserRow) => {
	if (user.role !== "superadmin" && user.org_status && user.org_status !== "active") {
		return normalizeStatus(user.org_status);
	}

	return normalizeStatus(user.status);
};

const mapToProfile = (user: UserRow) => {
	return {
		id: user.id,
		orgId: user.org_id,
		firebaseUid: user.firebase_uid,
		name: user.name,
		email: user.email,
		role: user.role,
		status: getEffectiveStatus(user),
		userStatus: normalizeStatus(user.status),
		organizationStatus: user.org_status ? normalizeStatus(user.org_status) : null,
		organizationName: user.org_name || null,
		createdAt: user.created_at,
		updatedAt: user.updated_at,
	};
};

const mapToResolvedUser = (user: UserRow): ResolvedAppUser => {
	return {
		id: user.id,
		orgId: user.org_id,
		firebaseUid: user.firebase_uid,
		name: user.name,
		email: user.email,
		role: user.role,
		status: getEffectiveStatus(user),
		createdAt: user.created_at,
		updatedAt: user.updated_at,
	};
};

const getUserByFirebaseUid = async (firebaseUid: string) => {
	return (await db("users as u")
		.leftJoin("organizations as o", "u.org_id", "o.id")
		.where("u.firebase_uid", firebaseUid)
		.select(
			"u.id",
			"u.org_id",
			"u.firebase_uid",
			"u.name",
			"u.email",
			"u.role",
			"u.status",
			"u.created_at",
			"u.updated_at",
			"o.name as org_name",
			"o.status as org_status",
		)
		.first()) as UserRow | undefined;
};

const getOrganizationById = async (organizationId: string) => {
	return (await db("organizations")
		.where({ id: organizationId })
		.first()) as
		| {
				id: string;
				name: string;
				type: string;
				region: string | null;
				status: string;
				created_at: Date;
				updated_at: Date;
		  }
		| undefined;
};

const ensureSkillsExist = async (skillIds: string[]) => {
	if (skillIds.length === 0) {
		return;
	}

	const rows = await db("skills").whereIn("id", skillIds).select("id");
	const existingIds = new Set(rows.map((row) => row.id as string));
	const missingIds = skillIds.filter((skillId) => !existingIds.has(skillId));
	if (missingIds.length > 0) {
		throw new AppError(400, `Unknown skill ids: ${missingIds.join(", ")}`);
	}
};

const syncProfileFields = async (user: UserRow, claims: AuthenticatedClaims) => {
	const updatePayload: Record<string, unknown> = {};

	if (claims.name && claims.name !== user.name) {
		updatePayload.name = claims.name;
	}

	if (claims.email && claims.email !== user.email) {
		updatePayload.email = resolveSafeEmail(claims.firebaseUid, claims.email);
	}

	if (Object.keys(updatePayload).length === 0) {
		return user;
	}

	const [updatedUser] = (await db("users")
		.where({ id: user.id })
		.update({
			...updatePayload,
			updated_at: new Date(),
		})
		.returning("*")) as UserRow[];

	return {
		...user,
		...updatedUser,
	};
};

export class AuthService {
	async resolveUserFromClaims(claims: AuthenticatedClaims) {
		const user = await getUserByFirebaseUid(claims.firebaseUid);
		if (!user) {
			return null;
		}

		const synced = await syncProfileFields(user, claims);
		return mapToResolvedUser(synced);
	}

	async getCurrentUserProfile(user: ResolvedAppUser) {
		const current = await getUserByFirebaseUid(user.firebaseUid);
		if (!current) {
			throw new AppError(404, "Application profile not found for authenticated identity");
		}

		return mapToProfile(current);
	}

	async registerNgo(claims: AuthenticatedClaims, input: RegisterNgoInput) {
		const existing = await getUserByFirebaseUid(claims.firebaseUid);
		if (existing) {
			return mapToProfile(existing);
		}

		const [organization, user] = await db.transaction(async (trx) => {
			const [createdOrganization] = await trx("organizations")
				.insert({
					name: input.organization_name.trim(),
					type: input.organization_type.trim(),
					region: input.region?.trim() || null,
					registration_id: input.registration_id?.trim() || null,
					contact_email: resolveSafeEmail(claims.firebaseUid, claims.email),
					contact_phone: input.contact_phone?.trim() || null,
					website: input.website?.trim() || null,
					address_text: input.address_text?.trim() || null,
					focus_areas: JSON.stringify(input.focus_areas || []),
					operating_regions: JSON.stringify(input.operating_regions || []),
					team_size: input.team_size || null,
					founded_year: input.founded_year || null,
					status: "active",
				})
				.returning(["id", "name", "type", "region", "status", "created_at", "updated_at"]);

			const [createdUser] = await trx("users")
				.insert({
					org_id: createdOrganization.id,
					firebase_uid: claims.firebaseUid,
					name: (input.admin_name || claims.name || "NGO Administrator").trim(),
					email: resolveSafeEmail(claims.firebaseUid, claims.email),
					role: "ngo_admin",
					status: "active",
				})
				.returning("*");

			return [createdOrganization, createdUser];
		});

		return mapToProfile({
			...(user as UserRow),
			org_name: organization.name as string,
			org_status: organization.status as string,
		});
	}

	async getVolunteerOnboardingOptions() {
		const [organizations, skills] = await Promise.all([
			db("organizations")
				.where({ status: "active" })
				.orderBy("name", "asc")
				.select("id", "name", "region"),
			db("skills").orderBy(["category", "name"]).select("id", "key", "name", "category"),
		]);

		return {
			domains: [...VOLUNTEER_DOMAINS],
			organizations: organizations.map((organization) => ({
				id: organization.id as string,
				name: organization.name as string,
				region: (organization.region as string | null) || null,
			})),
			skills: skills.map((skill) => ({
				id: skill.id as string,
				key: skill.key as string,
				name: skill.name as string,
				category: skill.category as string,
			})),
		};
	}

	async registerVolunteer(claims: AuthenticatedClaims, input: RegisterVolunteerInput) {
		const existing = await getUserByFirebaseUid(claims.firebaseUid);
		if (existing) {
			return mapToProfile(existing);
		}

		const organization = input.org_id ? await getOrganizationById(input.org_id) : undefined;
		if (input.org_id && (!organization || organization.status !== "active")) {
			throw new AppError(404, "Active organization not found for volunteer onboarding");
		}

		if (input.primary_domain && !VOLUNTEER_DOMAINS.includes(input.primary_domain as (typeof VOLUNTEER_DOMAINS)[number])) {
			throw new AppError(400, "Invalid volunteer domain");
		}

		const requestedSkills = input.skills || [];
		await ensureSkillsExist(requestedSkills.map((skill) => skill.skill_id));

		const [user] = await db.transaction(async (trx) => {
			const [createdUser] = await trx("users")
				.insert({
					org_id: organization?.id || null,
					firebase_uid: claims.firebaseUid,
					name: (input.volunteer_name || claims.name || "Volunteer").trim(),
					email: resolveSafeEmail(claims.firebaseUid, claims.email),
					role: "volunteer",
					status: "active",
				})
				.returning("*");

			const [createdVolunteer] = await trx("volunteers")
				.insert({
					org_id: organization?.id || null,
					user_id: createdUser.id,
					availability_status: input.availability_status?.trim() || "available",
					location_text: input.location_text?.trim() || null,
					latitude: input.latitude ?? null,
					longitude: input.longitude ?? null,
					gender: input.gender?.trim() || null,
					age: input.age ?? null,
					phone_number: input.phone_number?.trim() || null,
					profession: input.profession?.trim() || null,
					primary_domain: input.primary_domain?.trim() || null,
					profile_summary: input.profile_summary?.trim() || null,
					is_active: true,
				})
				.returning("id");

			if (requestedSkills.length > 0) {
				await trx("volunteer_skills").insert(
					requestedSkills.map((skill) => ({
						volunteer_id: createdVolunteer.id,
						skill_id: skill.skill_id,
						proficiency: skill.proficiency,
					})),
				);
			}

			return [createdUser];
		});

		return mapToProfile({
			...(user as UserRow),
			org_name: organization?.name || null,
			org_status: organization?.status || null,
		});
	}

	async listOnboardingOrganizations(query: ListOnboardingOrganizationsQuery) {
		const baseQuery = db("organizations as o")
			.leftJoin("users as u", function joinPrimaryAdmin() {
				this.on("u.org_id", "=", "o.id").andOnVal("u.role", "=", "ngo_admin");
			})
			.select(
				"o.id",
				"o.name",
				"o.type",
				"o.region",
				"o.registration_id",
				"o.contact_email",
				"o.contact_phone",
				"o.website",
				"o.address_text",
				"o.focus_areas",
				"o.operating_regions",
				"o.team_size",
				"o.founded_year",
				"o.status",
				"o.created_at",
				"o.updated_at",
				"u.id as admin_id",
				"u.name as admin_name",
				"u.email as admin_email",
				"u.firebase_uid as admin_firebase_uid",
				"u.status as admin_status",
			)
			.where("o.type", "NGO")
			.orderBy("o.created_at", "desc");

		if (query.status) {
			baseQuery.andWhere("o.status", query.status);
		}

		const rows = (await baseQuery) as Array<{
			id: string;
			name: string;
			type: string;
			region: string | null;
			registration_id: string | null;
			contact_email: string | null;
			contact_phone: string | null;
			website: string | null;
			address_text: string | null;
			focus_areas: string[] | null;
			operating_regions: string[] | null;
			team_size: number | null;
			founded_year: number | null;
			status: string;
			created_at: Date;
			updated_at: Date;
			admin_id: string | null;
			admin_name: string | null;
			admin_email: string | null;
			admin_firebase_uid: string | null;
			admin_status: string | null;
		}>;

		const seen = new Set<string>();
		return rows
			.filter((row) => {
				if (seen.has(row.id)) {
					return false;
				}

				seen.add(row.id);
				return true;
			})
			.map((row) => ({
				id: row.id,
				name: row.name,
				type: row.type,
				region: row.region,
				registrationId: row.registration_id,
				contactEmail: row.contact_email,
				contactPhone: row.contact_phone,
				website: row.website,
				addressText: row.address_text,
				focusAreas: row.focus_areas || [],
				operatingRegions: row.operating_regions || [],
				teamSize: row.team_size,
				foundedYear: row.founded_year,
				status: normalizeStatus(row.status),
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				primaryAdmin: row.admin_id
					? {
							id: row.admin_id,
							name: row.admin_name,
							email: row.admin_email,
							firebaseUid: row.admin_firebase_uid,
							status: row.admin_status ? normalizeStatus(row.admin_status) : null,
					  }
					: null,
			}));
	}

	async updateOnboardingStatus(
		orgId: string,
		decision: "approve" | "reject",
		actor: ResolvedAppUser,
	) {
		const organization = await getOrganizationById(orgId);
		if (!organization) {
			throw new AppError(404, "Organization not found");
		}

		const nextStatus = decision === "approve" ? "active" : "rejected";

		const result = await db.transaction(async (trx) => {
			const [updatedOrganization] = await trx("organizations")
				.where({ id: orgId })
				.update({
					status: nextStatus,
					updated_at: new Date(),
				})
				.returning("*");

			const updatedUsers = await trx("users")
				.where({ org_id: orgId, role: "ngo_admin" })
				.update({
					status: nextStatus,
					updated_at: new Date(),
				})
				.returning("*");

			await auditService.writeEvent(trx, {
				orgId,
				eventType: decision === "approve" ? "ngo_approved" : "ngo_rejected",
				entityType: "organization",
				entityId: orgId,
				actorId: actor.id,
				newValue: {
					organizationStatus: nextStatus,
					affectedAdmins: updatedUsers.map((row: UserRow) => row.id),
				},
				expectedNextState: nextStatus,
			});

			return {
				organization: updatedOrganization,
				users: updatedUsers,
			};
		});

		return {
			orgId,
			status: normalizeStatus(result.organization.status),
			organizationName: result.organization.name,
			primaryAdmins: result.users.map((row: UserRow) => ({
				id: row.id,
				email: row.email,
				name: row.name,
				status: normalizeStatus(row.status),
			})),
		};
	}
}

export const authService = new AuthService();
