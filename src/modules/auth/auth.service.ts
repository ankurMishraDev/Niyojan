import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { AppRole, AuthenticatedUser } from "../../types/auth";

type UserRecord = {
	id: string;
	org_id: string | null;
	firebase_uid: string;
	name: string;
	email: string;
	role: AppRole;
	status: string;
	created_at: Date;
	updated_at: Date;
};

const resolveSafeEmail = (firebaseUid: string, email?: string) => {
	if (email && email.includes("@")) {
		return email;
	}

	return `${firebaseUid}@niyojan.local`;
};

const mapToProfile = (user: UserRecord) => {
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

export class AuthService {
	async getOrCreateCurrentUser(authUser: AuthenticatedUser) {
		let user = (await db("users")
			.where({ firebase_uid: authUser.firebaseUid })
			.first()) as UserRecord | undefined;

		if (!user) {
			if (authUser.role !== "superadmin" && !authUser.orgId) {
				throw new AppError(
					400,
					"Organization context is required for non-superadmin users",
				);
			}

			const [createdUser] = (await db("users")
				.insert({
					org_id: authUser.role === "superadmin" ? null : authUser.orgId,
					firebase_uid: authUser.firebaseUid,
					name: authUser.name || "New User",
					email: resolveSafeEmail(authUser.firebaseUid, authUser.email),
					role: authUser.role,
					status: "active",
				})
				.returning("*")) as UserRecord[];

			user = createdUser;
		} else {
			const updatePayload: Partial<UserRecord> = {};

			if (authUser.name && authUser.name !== user.name) {
				updatePayload.name = authUser.name;
			}

			if (authUser.email && authUser.email !== user.email) {
				updatePayload.email = authUser.email;
			}

			if (Object.keys(updatePayload).length > 0) {
				const [updatedUser] = (await db("users")
					.where({ id: user.id })
					.update({
						...updatePayload,
						updated_at: new Date(),
					})
					.returning("*")) as UserRecord[];

				user = updatedUser;
			}
		}

		return mapToProfile(user);
	}
}

export const authService = new AuthService();
