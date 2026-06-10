import { LoaderBlock, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { formatDateTime } from "@/lib/format";

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading profile…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Identity"
        title="Profile"
      />

      <Panel className="space-y-6">
        <div>
          <p className="text-xl font-semibold tracking-tight text-ink">Current User Details</p>
          <p className="mt-1 text-sm text-body">
            Verify the active account identity and role configuration.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-hairline">
          <div className="space-y-1">
            <p className="label-caps">Name</p>
            <p className="text-lg font-medium text-ink">{user.name}</p>
          </div>
          <div className="space-y-1">
            <p className="label-caps">Email</p>
            <p className="text-sm font-medium text-body">{user.email}</p>
          </div>
          <div className="space-y-1">
            <p className="label-caps">Role</p>
            <p className="text-sm font-medium text-body capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <div className="space-y-1">
            <p className="label-caps">Organization Scope</p>
            <p className="text-sm font-medium text-body">
              {user.organizationName ? user.organizationName : (user.orgId ?? "Platform scope")}
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2 pt-4 border-t border-hairline">
            <p className="label-caps">Account Created</p>
            <p className="text-sm font-medium text-body">{formatDateTime(user.createdAt)}</p>
          </div>
        </div>

        {user.role === 'volunteer' && (
          <div className="mt-8 pt-6 border-t border-hairline border-dashed">
            <p className="label-caps text-primary mb-3">Volunteer Operations Profile</p>
            <p className="text-sm text-body leading-relaxed bg-canvas-soft-2 p-4 rounded-md border border-hairline">
              Your detailed volunteer profile and availability settings are managed through your initial onboarding. Identity editing is currently deferred to platform administrators. If you need to change your availability, please contact your coordinator.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
