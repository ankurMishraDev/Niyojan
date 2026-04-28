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
};

type ListOnboardingOrganizationsQuery = {
	status?: string;
};

const ALL_ACCOUNT_STATUSES = ["pending", "active", "rejected", "inactive"] as const;

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

const validateRoleForAutoCreate = (role?: AppRole) => {
	if (!role) {
		throw new AppError(400, "Mock auth requires a requested role");
	}

	return role;
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

	async getOrCreateMockUserFromClaims(claims: AuthenticatedClaims) {
		const existing = await getUserByFirebaseUid(claims.firebaseUid);
		if (existing) {
			return mapToProfile(await syncProfileFields(existing, claims));
		}

		const role = validateRoleForAutoCreate(claims.requestedRole);
		const orgId = role === "superadmin" ? null : claims.requestedOrgId || null;

		if (role !== "superadmin" && !orgId) {
			throw new AppError(
				400,
				"Organization context is required for non-superadmin mock users",
			);
		}

		if (orgId) {
			const organization = await getOrganizationById(orgId);
			if (!organization) {
				throw new AppError(404, "Mock organization not found");
			}
		}

		const [createdUser] = (await db("users")
			.insert({
				...(claims.requestedUserId ? { id: claims.requestedUserId } : {}),
				org_id: orgId,
				firebase_uid: claims.firebaseUid,
				name: claims.name || "Mock User",
				email: resolveSafeEmail(claims.firebaseUid, claims.email),
				role,
				status: "active",
			})
			.returning("*")) as UserRow[];

		return this.getCurrentUserProfile(mapToResolvedUser(createdUser));
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
					status: "pending",
				})
				.returning(["id", "name", "type", "region", "status", "created_at", "updated_at"]);

			const [createdUser] = await trx("users")
				.insert({
					org_id: createdOrganization.id,
					firebase_uid: claims.firebaseUid,
					name: (input.admin_name || claims.name || "NGO Administrator").trim(),
					email: resolveSafeEmail(claims.firebaseUid, claims.email),
					role: "ngo_admin",
					status: "pending",
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
