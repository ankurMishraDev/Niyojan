import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, LoaderBlock, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { assignmentsApi } from "@/lib/services";
import { formatDateTime, toneForStatus } from "@/lib/format";

export function AssignmentsPage() {
  const location = useLocation();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");

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
        eyebrow="Execution"
        title="Assignments"
        description="Track dispatched matches, update operational status, and route into field feedback."
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

              <div className="flex flex-wrap gap-3">
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
                <Link
                  className="action-button-secondary"
                  to={`/feedback/assignments/${detailQuery.data.id}`}
                >
                  Open feedback
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
