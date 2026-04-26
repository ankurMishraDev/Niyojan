import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { getPaginationParams } from "../../utils/pagination";
import { AuthenticatedUser } from "../../types/auth";

type OrganizationRow = {
	id: string;
	name: string;
	type: string;
	region: string | null;
	status: string;
	created_at: Date;
	updated_at: Date;
};

type UserRow = {
	id: string;
	org_id: string | null;
	firebase_uid: string;
	name: string;
	email: string;
	role: string;
	status: string;
	created_at: Date;
	updated_at: Date;
};

export type CreateOrganizationInput = {
	name: string;
	type: string;
	region?: string;
	status?: string;
};

export type UpdateOrganizationInput = {
	name?: string;
	type?: string;
	region?: string;
	status?: string;
};

type ListOrganizationUsersQuery = {
	page?: string | number;
	pageSize?: string | number;
	role?: string;
	status?: string;
};

const mapOrganization = (organization: OrganizationRow) => {
	return {
		id: organization.id,
		name: organization.name,
		type: organization.type,
		region: organization.region,
		status: organization.status,
		createdAt: organization.created_at,
		updatedAt: organization.updated_at,
	};
};

const mapUser = (user: UserRow) => {
	return {
		id: user.id,
		orgId: user.org_id,
		firebaseUid: user.firebase_uid,
		name: user.name,
		email: user.email,
		role: user.role,
		status: user.status,
		createdAt: user.created_at,
		updatedAt: user.updated_at,
	};
};

const assertOrgReadAccess = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const assertOrgWriteAccess = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (user.role !== "ngo_admin") {
		throw new AppError(403, "Only superadmin or ngo_admin can update organizations");
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Organization scope mismatch");
	}
};

export class OrganizationsService {
	async createOrganization(input: CreateOrganizationInput, user: AuthenticatedUser) {
		if (user.role !== "superadmin") {
			throw new AppError(403, "Only superadmin can create organizations");
		}

		const [organization] = (await db("organizations")
			.insert({
				name: input.name,
				type: input.type,
				region: input.region || null,
				status: input.status || "active",
			})
			.returning("*")) as OrganizationRow[];

		return mapOrganization(organization);
	}

	async getOrganizationById(orgId: string, user: AuthenticatedUser) {
		const organization = (await db("organizations")
			.where({ id: orgId })
			.first()) as OrganizationRow | undefined;

		if (!organization) {
			throw new AppError(404, "Organization not found");
		}

		assertOrgReadAccess(user, orgId);

		return mapOrganization(organization);
	}

	async updateOrganization(
		orgId: string,
		input: UpdateOrganizationInput,
		user: AuthenticatedUser,
	) {
		await this.getOrganizationById(orgId, user);
		assertOrgWriteAccess(user, orgId);

		const updatePayload: Record<string, unknown> = {};

		if (input.name !== undefined) {
			updatePayload.name = input.name;
		}

		if (input.type !== undefined) {
			updatePayload.type = input.type;
		}

		if (input.region !== undefined) {
			updatePayload.region = input.region;
		}

		if (input.status !== undefined) {
			updatePayload.status = input.status;
		}

		if (Object.keys(updatePayload).length === 0) {
			throw new AppError(400, "No organization fields provided for update");
		}

		const [organization] = (await db("organizations")
			.where({ id: orgId })
			.update({
				...updatePayload,
				updated_at: new Date(),
			})
			.returning("*")) as OrganizationRow[];

		return mapOrganization(organization);
	}

	async listOrganizationUsers(
		orgId: string,
		query: ListOrganizationUsersQuery,
		user: AuthenticatedUser,
	) {
		await this.getOrganizationById(orgId, user);

		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);

		const baseQuery = db("users").where({ org_id: orgId });

		if (query.role) {
			baseQuery.andWhere({ role: query.role });
		}

		if (query.status) {
			baseQuery.andWhere({ status: query.status });
		}

		const users = (await baseQuery
			.clone()
			.orderBy("created_at", "desc")
			.offset(offset)
			.limit(pageSize)
			.select("*")) as UserRow[];

		const countResult = (await baseQuery.clone().clearSelect().count({ count: "*" }).first()) as
			| { count: string }
			| undefined;

		return {
			items: users.map(mapUser),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}
}

export const organizationsService = new OrganizationsService();
