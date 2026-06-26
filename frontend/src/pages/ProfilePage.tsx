import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { volunteersApi } from "@/lib/services";
import { formatDateTime, sentence } from "@/lib/format";

// ─── Read-only profile row ────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="label-caps">{label}</p>
      <p className="text-sm font-medium text-ink break-words">{value || "—"}</p>
    </div>
  );
}

// ─── Volunteer editable profile ───────────────────────────────────────────────
function VolunteerProfileEditor({ volunteerId }: { volunteerId: string }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);

  const volQuery = useQuery({
    queryKey: ["volunteer-self", volunteerId],
    queryFn: () => volunteersApi.get(volunteerId),
  });

  const vol = volQuery.data;

  // Local draft state — mirrors all editable volunteer fields
  const [draft, setDraft] = useState({
    availability_status: "",
    location_text: "",
    latitude: "",
    longitude: "",
    phone_number: "",
    profession: "",
    primary_domain: "",
    profile_summary: "",
    gender: "",
    age: "",
  });

  useEffect(() => {
    if (vol) {
      setDraft({
        availability_status: vol.availabilityStatus ?? "",
        location_text: vol.locationText ?? "",
        latitude: vol.latitude != null ? String(vol.latitude) : "",
        longitude: vol.longitude != null ? String(vol.longitude) : "",
        phone_number: (vol as any).phoneNumber ?? "",
        profession: vol.profession ?? "",
        primary_domain: vol.primaryDomain ?? "",
        profile_summary: (vol as any).profileSummary ?? "",
        gender: (vol as any).gender ?? "",
        age: (vol as any).age != null ? String((vol as any).age) : "",
      });
    }
  }, [vol]);

  const updateMutation = useMutation({
    mutationFn: () =>
      volunteersApi.update(volunteerId, {
        availability_status: draft.availability_status || undefined,
        location_text: draft.location_text || undefined,
        latitude: draft.latitude ? Number(draft.latitude) : undefined,
        longitude: draft.longitude ? Number(draft.longitude) : undefined,
        phone_number: draft.phone_number || undefined,
        profession: draft.profession || undefined,
        primary_domain: draft.primary_domain || undefined,
        profile_summary: draft.profile_summary || undefined,
        gender: (draft.gender as any) || undefined,
        age: draft.age ? Number(draft.age) : undefined,
      }),
    onSuccess: async () => {
      setFeedback("Profile updated successfully.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["volunteer-self", volunteerId] });
      setTimeout(() => setFeedback(""), 3000);
    },
    onError: (err: any) => {
      setFeedback(err?.message ?? "Update failed. Please try again.");
    },
  });

  if (volQuery.isLoading) return <LoaderBlock label="Loading volunteer profile…" />;
  if (!vol) return null;

  return (
    <Panel className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold tracking-tight text-ink">Volunteer Profile</p>
          <p className="mt-1 text-sm text-body">
            Keep your profile accurate so the system can match you to the right cases.
          </p>
        </div>
        <StatusBadge tone={(vol as any).isActive ? "success" : "warning"}>
          {(vol as any).isActive ? "Active" : "Inactive"}
        </StatusBadge>
      </div>

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink">
          {feedback}
        </div>
      ) : null}

      {!editing ? (
        /* ── Read-only view ── */
        <>
          <div className="grid gap-5 sm:grid-cols-2 pt-4 border-t border-hairline">
            <InfoRow label="Availability" value={sentence(vol.availabilityStatus ?? "")} />
            <InfoRow label="Phone" value={(vol as any).phoneNumber ?? "—"} />
            <InfoRow label="Profession" value={vol.profession ?? "—"} />
            <InfoRow label="Primary Domain" value={sentence(vol.primaryDomain ?? "")} />
            <InfoRow label="Gender" value={sentence((vol as any).gender ?? "")} />
            <InfoRow label="Age" value={(vol as any).age != null ? String((vol as any).age) : "—"} />
            <InfoRow label="Location" value={vol.locationText ?? "—"} />
            {vol.latitude != null && (
              <InfoRow label="Coordinates" value={`${Number(vol.latitude).toFixed(5)}, ${Number(vol.longitude).toFixed(5)}`} />
            )}
            <div className="sm:col-span-2 space-y-1">
              <p className="label-caps">Profile Summary</p>
              <p className="text-sm text-body leading-relaxed whitespace-pre-wrap">
                {(vol as any).profileSummary || "—"}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={() => setEditing(true)} type="button">
              Edit Profile
            </Button>
          </div>
        </>
      ) : (
        /* ── Edit form ── */
        <form
          className="space-y-5 pt-4 border-t border-hairline"
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Availability Status</label>
              <Select
                value={draft.availability_status}
                onChange={(e) => setDraft({ ...draft, availability_status: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="part_time">Part-time</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Phone Number</label>
              <Input
                placeholder="e.g. +91 98765 43210"
                value={draft.phone_number}
                onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Profession</label>
              <Input
                placeholder="e.g. Social Worker, Doctor"
                value={draft.profession}
                onChange={(e) => setDraft({ ...draft, profession: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Primary Domain</label>
              <Input
                placeholder="e.g. health, education, food_distribution"
                value={draft.primary_domain}
                onChange={(e) => setDraft({ ...draft, primary_domain: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Gender</label>
              <Select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Age</label>
              <Input
                type="number"
                min="16"
                max="100"
                placeholder="e.g. 28"
                value={draft.age}
                onChange={(e) => setDraft({ ...draft, age: e.target.value })}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-body px-1">Location</label>
              <Input
                placeholder="Village, District, State"
                value={draft.location_text}
                onChange={(e) => setDraft({ ...draft, location_text: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Latitude</label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 22.5726"
                value={draft.latitude}
                onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">Longitude</label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 88.3639"
                value={draft.longitude}
                onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-body px-1">Profile Summary</label>
              <Textarea
                placeholder="Brief description of your skills, background, and field experience…"
                value={draft.profile_summary}
                onChange={(e) => setDraft({ ...draft, profile_summary: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setEditing(false); setFeedback(""); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading profile…" />
      </div>
    );
  }

  // For volunteers: look up their volunteer record by user_id
  const volunteerQuery = useQuery({
    enabled: user.role === "volunteer",
    queryKey: ["volunteer-by-user", user.id],
    queryFn: () => volunteersApi.list({ user_id: user.id, page: 1, pageSize: 1 }),
  });

  const volunteerId = volunteerQuery.data?.items?.[0]?.id;

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader eyebrow="Identity" title="Profile" />

      {/* Account details — everyone */}
      <Panel className="space-y-6">
        <div>
          <p className="text-xl font-semibold tracking-tight text-ink">Account Details</p>
          <p className="mt-1 text-sm text-body">Your account identity and access scope.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-hairline">
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={sentence(user.role.replace("_", " "))} />
          <InfoRow
            label="Organization"
            value={user.organizationName ?? (user.orgId ?? "Platform scope")}
          />
          <div className="space-y-1 sm:col-span-2 pt-4 border-t border-hairline">
            <p className="label-caps">Account Created</p>
            <p className="text-sm font-medium text-body">{formatDateTime(user.createdAt)}</p>
          </div>
        </div>
      </Panel>

      {/* Volunteer profile editor */}
      {user.role === "volunteer" && (
        volunteerQuery.isLoading ? (
          <LoaderBlock label="Loading volunteer profile…" />
        ) : volunteerId ? (
          <VolunteerProfileEditor volunteerId={volunteerId} />
        ) : (
          <Panel>
            <p className="text-sm text-body">Volunteer profile not found. Contact your coordinator.</p>
          </Panel>
        )
      )}
    </div>
  );
}
