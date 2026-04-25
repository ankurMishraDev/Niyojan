export type AppRole = "superadmin" | "ngo_admin" | "field_worker" | "volunteer";

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  orgId: string | null;
  role: AppRole;
  email?: string;
  name?: string;
}
