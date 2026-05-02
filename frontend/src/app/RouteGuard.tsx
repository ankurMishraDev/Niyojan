import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderBlock, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import type { AppRole } from "@/types/api";

export function RouteGuard({ roles }: { roles?: AppRole[] }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <LoaderBlock label="Authorizing command channel..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.status !== "active" && location.pathname !== "/account-status") {
    return <Navigate to="/account-status" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Panel className="mx-auto mt-20 max-w-2xl space-y-4">
        <p className="label-caps text-danger">Access Denied</p>
        <h1 className="text-2xl font-black text-white">This route is outside your command scope</h1>
        <p className="text-sm text-on-surface-variant">
          Your backend role is still the source of truth. The frontend blocked this section
          because the current role does not map to the required capability.
        </p>
      </Panel>
    );
  }

  return <Outlet />;
}
