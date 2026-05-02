export type AppRole = "superadmin" | "ngo_admin" | "field_worker" | "volunteer";

export type UserStatus = "pending" | "active" | "rejected" | "inactive";

export interface AuthenticatedClaims {
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  authSource: "firebase";
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
