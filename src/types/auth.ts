export type AppRole = "superadmin" | "ngo_admin" | "field_worker" | "volunteer";

export type UserStatus = "pending" | "active" | "rejected" | "inactive";

export interface AuthenticatedClaims {
  firebaseUid: string;
  email?: string;
  name?: string;
  authSource: "firebase" | "mock";
  requestedRole?: AppRole;
  requestedOrgId?: string | null;
  requestedUserId?: string;
}

export interface ResolvedAppUser {
  id: string;
  firebaseUid: string;
  orgId: string | null;
  role: AppRole;
  status: UserStatus | string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthenticatedUser = ResolvedAppUser;
