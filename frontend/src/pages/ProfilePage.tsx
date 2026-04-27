import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { volunteersApi } from "@/lib/services";
import { formatDateTime } from "@/lib/format";

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const volunteerQuery = useQuery({
    enabled: Boolean(user),
    queryKey: ["current-volunteer", user?.id],
    queryFn: async () => {
      const result = await volunteersApi.list({ user_id: user?.id, pageSize: 1 });
      return result.items[0] ?? null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      volunteersApi.update(volunteerQuery.data?.id ?? "", payload),
    onSuccess: () => {
      void volunteerQuery.refetch();
      void refreshProfile();
    },
  });

  if (!user) {
    return <LoaderBlock label="Loading profile..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Profile"
        description="Core identity is read-only from `/api/auth/me`. Volunteer-specific operational attributes remain editable when a volunteer record exists."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-4">
          <p className="label-caps">Current User</p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Name</p>
              <p className="mt-1 text-lg font-bold text-white">{user.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Email</p>
              <p className="mt-1">{user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Role</p>
              <p className="mt-1">{user.role}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Organization</p>
              <p className="mt-1">{user.orgId ?? "Platform scope"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Created</p>
              <p className="mt-1">{formatDateTime(user.createdAt)}</p>
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <p className="label-caps">Volunteer Operations Profile</p>
          {!volunteerQuery.data ? (
            <p className="text-sm text-on-surface-variant">
              No linked volunteer record was found for the current user. Identity editing remains deferred until the backend exposes a general profile update route.
            </p>
          ) : (
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                updateMutation.mutate({
                  availability_status: formData.get("availability_status"),
                  location_text: formData.get("location_text"),
                  latitude: formData.get("latitude")
                    ? Number(formData.get("latitude"))
                    : null,
                  longitude: formData.get("longitude")
                    ? Number(formData.get("longitude"))
                    : null,
                  is_active: formData.get("is_active") === "true",
                });
              }}
            >
              <Select
                defaultValue={volunteerQuery.data.availabilityStatus}
                name="availability_status"
              >
                <option value="available">available</option>
                <option value="part_time">part_time</option>
                <option value="busy">busy</option>
              </Select>
              <Select defaultValue={String(volunteerQuery.data.isActive)} name="is_active">
                <option value="true">active</option>
                <option value="false">inactive</option>
              </Select>
              <Input
                defaultValue={volunteerQuery.data.locationText ?? ""}
                name="location_text"
                placeholder="Location text"
              />
              <Input
                defaultValue={volunteerQuery.data.latitude ?? ""}
                name="latitude"
                placeholder="Latitude"
                type="number"
              />
              <Input
                defaultValue={volunteerQuery.data.longitude ?? ""}
                name="longitude"
                placeholder="Longitude"
                type="number"
              />
              <div className="md:col-span-2">
                <Button disabled={updateMutation.isPending} type="submit">
                  {updateMutation.isPending ? "Saving..." : "Save Volunteer Profile"}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}
