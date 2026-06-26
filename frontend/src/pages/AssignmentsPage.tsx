import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderBlock, PageHeader, Panel, Select, StatusBadge, Input } from "@/components/ui";
import { assignmentsApi, organizationsApi, volunteersApi } from "@/lib/services";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { useAuth } from "@/features/auth/useAuth";

// ── DownloadSurveyButton ──────────────────────────────────────────────────────
// Uses the API client (which injects the Bearer token) to fetch the HTML,
// then opens it as a blob URL so the browser can display/print it.
function DownloadSurveyButton({ surveyId }: { surveyId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { buildAuthHeaders } = await import("@/features/auth/authSession");
      const headers = buildAuthHeaders() as Record<string, string>;
      const response = await fetch(`/api/surveys/${surveyId}/download`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="action-button-secondary w-full sm:w-auto text-center"
      onClick={() => void handleDownload()}
      disabled={loading}
      type="button"
    >
      {loading ? "Loading…" : "Download Survey"}
    </button>
  );
}

/** buildAuthHeader is no longer needed as a separate function */

export function AssignmentsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const isVolunteer = user?.role === "volunteer";
  const [showReassign, setShowReassign] = useState(false);
  const [newVolunteerId, setNewVolunteerId] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentsApi.list({ page: 1, pageSize: 25 }),
  });

  useEffect(() => {
    const preferred = (location.state as { assignmentId?: string } | null)?.assignmentId;
    if (preferred) {
      setSelectedAssignmentId(preferred);
      return;
    }

    if (!selectedAssignmentId && assignmentsQuery.data?.items[0]) {
      setSelectedAssignmentId(assignmentsQuery.data.items[0].id);
    }
  }, [assignmentsQuery.data, location.state, selectedAssignmentId]);

  const detailQuery = useQuery({
    enabled: Boolean(selectedAssignmentId),
    queryKey: ["assignment-detail", selectedAssignmentId],
    queryFn: () => assignmentsApi.get(selectedAssignmentId),
    staleTime: 0, // always re-fetch so assessment overrides from AI Review are reflected
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => assignmentsApi.updateStatus(selectedAssignmentId, status),
    onSuccess: async () => {
      await Promise.all([assignmentsQuery.refetch(), detailQuery.refetch()]);
    },
  });

  // Load NGO contact details once we know the org ID from the assignment
  const orgId = detailQuery.data?.orgId;
  const orgQuery = useQuery({
    enabled: Boolean(orgId),
    queryKey: ["org-contact", orgId],
    queryFn: () => organizationsApi.get(orgId!),
  });

  const volunteersQuery = useQuery({
    enabled: !isVolunteer && Boolean(selectedAssignmentId),
    queryKey: ["volunteers-for-reassign"],
    queryFn: () => volunteersApi.list({ page: 1, pageSize: 100, is_active: "true" }),
  });

  const reassignMutation = useMutation({
    mutationFn: () => assignmentsApi.reassignVolunteer(selectedAssignmentId, {
      volunteer_id: newVolunteerId,
      reason: reassignReason || undefined,
    }),
    onSuccess: async () => {
      setShowReassign(false);
      setNewVolunteerId("");
      setReassignReason("");
      await Promise.all([assignmentsQuery.refetch(), detailQuery.refetch()]);
    },
    onError: (err: any) => {
      alert(err?.message ?? "Reassign failed");
    },
  });

  if (assignmentsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading assignments…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow={isVolunteer ? "Volunteer Workboard" : "Execution"}
        title={isVolunteer ? "Assignment Queue" : "Assignments"}
        description={isVolunteer
          ? "Review newly assigned cases, inspect NGO-submitted details, and open the linked feedback workflow."
          : "Track dispatched matches, update operational status, and route into field feedback."}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr] xl:grid-cols-[420px_1fr] min-h-[70vh]">
        <Panel className="space-y-0 max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-card-medium">
          <div className="p-5 border-b border-hairline bg-canvas-soft shrink-0">
            <p className="text-lg font-semibold tracking-tight text-ink">Assignment List</p>
            <p className="mt-1 text-xs text-body">
              {assignmentsQuery.data?.items.length ?? 0} assignment{(assignmentsQuery.data?.items.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {assignmentsQuery.data?.items.map((assignment) => (
              <button
                className={`w-full rounded-md border px-4 py-4 text-left transition-colors ${
                  selectedAssignmentId === assignment.id
                    ? "border-ink bg-canvas-soft shadow-sm"
                    : "border-hairline bg-canvas hover:border-hairline-strong hover:bg-canvas-soft-2"
                }`}
                key={assignment.id}
                onClick={() => setSelectedAssignmentId(assignment.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink text-sm leading-snug line-clamp-2">{assignment.needSummary}</p>
                    <p className="mt-1.5 font-mono text-[10px] text-mute truncate">
                      {assignment.volunteerName} · {assignment.volunteerAvailabilityStatus}
                    </p>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    <StatusBadge tone={toneForStatus(assignment.status)}>{assignment.status}</StatusBadge>
                  </div>
                </div>
              </button>
            ))}
            {assignmentsQuery.data?.items.length === 0 && (
              <div className="text-center text-sm text-body py-12 border-2 border-dashed border-hairline rounded-md">
                No assignments found.
              </div>
            )}
          </div>
        </Panel>

        <Panel className="space-y-6 max-h-[85vh] overflow-y-auto">
          {!detailQuery.data ? (
            <div className="h-full flex items-center justify-center p-12 border-2 border-dashed border-hairline rounded-lg text-sm text-mute">
              Select an assignment to inspect its operational detail.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-hairline">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-ink">{detailQuery.data.needSummary}</p>
                  <p className="mt-2 text-sm text-body">
                    Assigned to <span className="font-medium text-ink">{detailQuery.data.volunteerName}</span> ({detailQuery.data.volunteerEmail})
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(detailQuery.data.status)}>
                  {detailQuery.data.status}
                </StatusBadge>
              </div>

              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <InfoRow label="Priority" value={detailQuery.data.needPriorityLevel} />
                <InfoRow label="Availability" value={detailQuery.data.volunteerAvailabilityStatus} />
                <InfoRow label="Assigned at" value={formatDateTime(detailQuery.data.assignedAt)} />
                <InfoRow label="Completed at" value={formatDateTime(detailQuery.data.completedAt)} />
              </div>

              {/* NGO contact block — always show when org data is available */}
              {orgQuery.data && (
                <div className="rounded-md border border-hairline bg-canvas-soft-2 px-5 py-4 space-y-3">
                  <p className="label-caps">NGO Contact</p>
                  <div className="grid gap-3 grid-cols-2">
                    <InfoRow label="Organization" value={orgQuery.data?.name ?? "—"} />
                    {orgQuery.data?.contactPhone ? (
                      <div className="space-y-1">
                        <p className="label-caps">Phone</p>
                        <a
                          href={`tel:${orgQuery.data.contactPhone}`}
                          className="text-sm font-medium text-link hover:text-link-deep transition-colors"
                        >
                          {orgQuery.data.contactPhone}
                        </a>
                      </div>
                    ) : (
                      <InfoRow label="Phone" value="Not provided" />
                    )}
                    {orgQuery.data?.contactEmail ? (
                      <div className="space-y-1">
                        <p className="label-caps">Email</p>
                        <a
                          href={`mailto:${orgQuery.data.contactEmail}`}
                          className="text-sm font-medium text-link hover:text-link-deep transition-colors break-all"
                        >
                          {orgQuery.data.contactEmail}
                        </a>
                      </div>
                    ) : (
                      <InfoRow label="Email" value="Not provided" />
                    )}
                    {orgQuery.data?.addressText && (
                      <div className="sm:col-span-2 space-y-1">
                        <p className="label-caps">Address</p>
                        <p className="text-sm font-medium text-ink break-words">{orgQuery.data.addressText}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailQuery.data.survey ? (
                <div className="rounded-md border border-hairline bg-canvas-soft p-5 space-y-5">
                  <p className="text-lg font-semibold tracking-tight text-ink">Survey details</p>
                  <div className="grid gap-4 grid-cols-2">
                    <InfoRow label="Respondent" value={detailQuery.data.survey.respondentName || "Unnamed respondent"} />
                    <InfoRow label="Location" value={detailQuery.data.survey.locationText || "No location"} />
                    <InfoRow label="Survey status" value={detailQuery.data.survey.status} />
                    <InfoRow label="Submitted" value={formatDateTime(detailQuery.data.survey.submittedAt)} />
                  </div>
                  <div className="space-y-3 pt-3 border-t border-hairline">
                    <p className="label-caps">Submitted responses</p>
                    <div className="space-y-2">
                      {detailQuery.data.survey.responses.map((response) => (
                        <div className="rounded border border-hairline bg-canvas px-4 py-3" key={response.label}>
                          <p className="font-mono text-[10px] uppercase text-mute mb-1">{response.label}</p>
                          <p className="text-sm text-ink">{response.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {detailQuery.data.aiReview ? (
                <div className="rounded-md border border-hairline bg-canvas-soft-2 p-5 space-y-5">
                  <p className="text-lg font-semibold tracking-tight text-ink">AI review assessment</p>
                  <div className="grid gap-4 grid-cols-2">
                    <InfoRow label="Urgency" value={detailQuery.data.aiReview.urgencyLabel || "Not set"} />
                    <InfoRow label="Verification risk" value={detailQuery.data.aiReview.verificationRisk || "Not set"} />
                  </div>
                  <div className="space-y-4 pt-3 border-t border-hairline">
                    <div>
                      <p className="label-caps mb-2">Case summary</p>
                      <p className="text-sm leading-relaxed text-body">
                        {detailQuery.data.aiReview.caseSummary || "No AI summary available."}
                      </p>
                    </div>
                    <div>
                      <p className="label-caps mb-2 text-primary">Recommended action</p>
                      <p className="text-sm leading-relaxed text-body">
                        {detailQuery.data.aiReview.recommendedAction || "No AI action recommendation available."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-hairline">
                {!isVolunteer ? (
                  <Select
                    className="w-full sm:w-auto"
                    defaultValue={detailQuery.data.status}
                    onChange={(event) => void updateStatusMutation.mutate(event.target.value)}
                    disabled={updateStatusMutation.isPending}
                  >
                    <option value="suggested">Suggested</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                ) : null}
                {/* Admin/NGO: view survey inside the app */}
                {detailQuery.data.surveyId && !isVolunteer && (
                  <Link
                    className="action-button-secondary w-full sm:w-auto text-center"
                    to={`/surveys/${detailQuery.data.surveyId}`}
                  >
                    View Full Survey
                  </Link>
                )}
                {/* Volunteer: download printable HTML — fetch with auth token, open as blob */}
                {detailQuery.data.surveyId && isVolunteer && (
                  <DownloadSurveyButton surveyId={detailQuery.data.surveyId} />
                )}
                <Link
                  className="action-button-secondary w-full sm:w-auto text-center"
                  to={`/feedback/assignments/${detailQuery.data.id}`}
                >
                  {isVolunteer ? "Submit Field Feedback" : "Open Feedback"}
                </Link>
              </div>

              {!isVolunteer && (
                <div className="pt-4 border-t border-hairline space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">Reassign Volunteer</p>
                    <button
                      type="button"
                      onClick={() => setShowReassign(!showReassign)}
                      className="text-xs text-link hover:text-link-deep"
                    >
                      {showReassign ? "Cancel" : "Change Volunteer"}
                    </button>
                  </div>
                  {showReassign && (
                    <div className="space-y-3 p-4 rounded-md border border-hairline bg-canvas-soft-2">
                      <div className="space-y-1">
                        <p className="label-caps">Select New Volunteer</p>
                        <Select
                          value={newVolunteerId}
                          onChange={(e) => setNewVolunteerId(e.target.value)}
                        >
                          <option value="">Choose a volunteer…</option>
                          {(volunteersQuery.data?.items ?? []).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name || v.email || v.id} · {v.availabilityStatus}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="label-caps">Reason (optional)</p>
                        <Input
                          placeholder="Why is this volunteer being changed?"
                          value={reassignReason}
                          onChange={(e) => setReassignReason(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void reassignMutation.mutate()}
                        disabled={!newVolunteerId || reassignMutation.isPending}
                        className="w-full rounded-pill bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50 hover:bg-ink/90 transition-colors"
                      >
                        {reassignMutation.isPending ? "Reassigning…" : "Confirm Reassign"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="label-caps">{label}</p>
      <p className="text-sm font-medium text-ink break-words">{value || "—"}</p>
    </div>
  );
}
