import { Navigate } from "react-router-dom";
import { Button, Panel, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

export function AccountStatusPage() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "active") {
    return <Navigate to="/dashboard" replace />;
  }

  const tone =
    user.status === "pending" ? "warning" : user.status === "rejected" ? "danger" : "default";

  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-4">
      <Panel className="space-y-4">
        <StatusBadge tone={tone}>{user.status}</StatusBadge>
        <h1 className="text-3xl font-black text-white">Account status</h1>
        <p className="text-sm leading-6 text-on-surface-variant">
          {user.status === "pending"
            ? "This account is pending activation. Operational routes remain locked until the account is active."
            : user.status === "rejected"
              ? "This account was rejected. Review the organization details with the NIYOJAN admin before attempting access again."
              : "This account is inactive and cannot access operational routes."}
        </p>

        <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm">
          <p className="font-semibold text-white">{user.name}</p>
          <p className="mt-1 text-on-surface-variant">{user.email}</p>
          <p className="mt-3 text-on-surface-variant">
            Organization: {user.organizationName ?? user.orgId ?? "Pending assignment"}
          </p>
          <p className="mt-1 text-on-surface-variant">
            Organization status: {user.organizationStatus ?? user.status}
          </p>
        </div>

        <Button onClick={() => void signOut()} variant="secondary">
          Sign Out
        </Button>
      </Panel>
    </div>
  );
}
