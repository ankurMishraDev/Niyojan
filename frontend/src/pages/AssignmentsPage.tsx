import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderBlock, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { assignmentsApi } from "@/lib/services";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";

export function AssignmentsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const isVolunteer = user?.role === "volunteer";

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
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => assignmentsApi.updateStatus(selectedAssignmentId, status),
    onSuccess: async () => {
      await Promise.all([assignmentsQuery.refetch(), detailQuery.refetch()]);
    },
  });

  if (assignmentsQuery.isLoading) {
    return <LoaderBlock label="Loading assignments..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isVolunteer ? "Volunteer Workboard" : "Execution"}
        title={isVolunteer ? "Assignment queue" : "Assignments"}
        description={isVolunteer
          ? "Review newly assigned cases, inspect NGO-submitted details, and open the linked feedback workflow."
          : "Track dispatched matches, update operational status, and route into field feedback."}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel className="space-y-4">
          <p className="text-xl font-black text-white">Assignment list</p>
          <div className="space-y-3">
            {assignmentsQuery.data?.items.map((assignment) => (
              <button
                className={`w-full rounded-md border px-4 py-4 text-left ${
                  selectedAssignmentId === assignment.id
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant bg-surface-container-low hover:border-primary/50"
                }`}
                key={assignment.id}
                onClick={() => setSelectedAssignmentId(assignment.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{assignment.needSummary}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {assignment.volunteerName} - {assignment.volunteerAvailabilityStatus}
                    </p>
                  </div>
                  <StatusBadge tone={toneForStatus(assignment.status)}>{assignment.status}</StatusBadge>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          {!detailQuery.data ? (
            <p className="text-sm text-on-surface-variant">Select an assignment to inspect its operational detail.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-white">{detailQuery.data.needSummary}</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Assigned to {detailQuery.data.volunteerName} ({detailQuery.data.volunteerEmail})
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(detailQuery.data.status)}>
                  {detailQuery.data.status}
                </StatusBadge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Priority" value={detailQuery.data.needPriorityLevel} />
                <InfoRow label="Volunteer availability" value={detailQuery.data.volunteerAvailabilityStatus} />
                <InfoRow label="Assigned at" value={formatDateTime(detailQuery.data.assignedAt)} />
                <InfoRow label="Completed at" value={formatDateTime(detailQuery.data.completedAt)} />
              </div>

              {detailQuery.data.survey ? (
                <Panel className="bg-surface-container-low space-y-4">
                  <p className="text-lg font-black text-white">Survey details</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow label="Respondent" value={detailQuery.data.survey.respondentName || "Unnamed respondent"} />
                    <InfoRow label="Location" value={detailQuery.data.survey.locationText || "No location"} />
                    <InfoRow label="Survey status" value={detailQuery.data.survey.status} />
                    <InfoRow label="Submitted" value={formatDateTime(detailQuery.data.survey.submittedAt)} />
                  </div>
                  <div className="space-y-2">
                    <p className="label-caps">Submitted responses</p>
                    <div className="space-y-2">
                      {detailQuery.data.survey.responses.map((response) => (
                        <div className="rounded-md border border-outline-variant px-3 py-3" key={response.label}>
                          <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">{response.label}</p>
                          <p className="mt-2 text-sm text-white">{response.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              ) : null}

              {detailQuery.data.aiReview ? (
                <Panel className="bg-surface-container-low space-y-4">
                  <p className="text-lg font-black text-white">AI review assessment</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow label="Urgency" value={detailQuery.data.aiReview.urgencyLabel || "Not set"} />
                    <InfoRow label="Verification risk" value={detailQuery.data.aiReview.verificationRisk || "Not set"} />
                  </div>
                  <div>
                    <p className="label-caps">Case summary</p>
                    <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                      {detailQuery.data.aiReview.caseSummary || "No AI summary available."}
                    </p>
                  </div>
                  <div>
                    <p className="label-caps">Recommended action</p>
                    <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                      {detailQuery.data.aiReview.recommendedAction || "No AI action recommendation available."}
                    </p>
                  </div>
                </Panel>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {!isVolunteer ? (
                  <Select
                    defaultValue={detailQuery.data.status}
                    onChange={(event) => void updateStatusMutation.mutate(event.target.value)}
                  >
                    <option value="suggested">suggested</option>
                    <option value="accepted">accepted</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </Select>
                ) : null}
                <Link
                  className="action-button-secondary"
                  to={`/feedback/assignments/${detailQuery.data.id}`}
                >
                  {isVolunteer ? "Submit field feedback" : "Open feedback"}
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
