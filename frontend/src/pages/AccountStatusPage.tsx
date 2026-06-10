import { Navigate } from "react-router-dom";
import { Button, Panel, StatusBadge } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

export function AccountStatusPage() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "active") {
    return <Navigate to={user.role === "volunteer" ? "/assignments" : "/dashboard"} replace />;
  }

  const tone =
    user.status === "pending" ? "warning" : user.status === "rejected" ? "danger" : "default";

  return (
    <div className="min-h-screen bg-canvas-soft px-4 py-12 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full max-w-[800px] h-[500px] bg-mesh-hero opacity-20 -z-10 pointer-events-none rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3"></div>

      <div className="w-full max-w-2xl mx-auto relative z-10 space-y-6">
        <Panel className="space-y-6 sm:p-10 shadow-card-float border-hairline-strong">
          <div>
            <div className="mb-4">
              <StatusBadge tone={tone}>{user.status}</StatusBadge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Account Status</h1>
            <p className="mt-3 text-base leading-relaxed text-body">
              {user.status === "pending"
                ? "This account is pending activation. Operational routes remain locked until the account is active. Please wait for an administrator to review your registration."
                : user.status === "rejected"
                  ? "This account was rejected. Review the organization details with the NIYOJAN admin before attempting access again."
                  : "This account is inactive and cannot access operational routes."}
            </p>
          </div>

          <div className="rounded-md border border-hairline bg-canvas p-5 text-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <p className="label-caps mb-1">Identity</p>
                <p className="font-semibold text-ink">{user.name}</p>
                <p className="text-body mt-0.5">{user.email}</p>
              </div>
              <div className="sm:text-right">
                <p className="label-caps mb-1">Role Request</p>
                <p className="font-medium text-ink capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-hairline">
               <p className="label-caps mb-1">Organization Scope</p>
               <p className="font-medium text-ink">{user.organizationName ?? user.orgId ?? "Pending assignment"}</p>
               <p className="text-body mt-0.5">Organization status: <span className="font-mono text-[11px] text-mute">{user.organizationStatus ?? user.status}</span></p>
            </div>
          </div>

          <div className="pt-4 border-t border-hairline flex justify-end">
            <Button className="w-full sm:w-auto px-8" onClick={() => void signOut()} variant="secondary">
              Sign Out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
