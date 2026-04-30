import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { assignmentsApi, feedbackApi } from "@/lib/services";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export function FeedbackIndexPage() {
  const { user } = useAuth();
  const canListAssignments = user?.role === "superadmin" || user?.role === "volunteer";
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const assignmentsQuery = useQuery({
    enabled: canListAssignments,
    queryKey: ["feedback-assignments"],
    queryFn: () => assignmentsApi.list({ page: 1, pageSize: 20 }),
  });

  const availableAssignments = assignmentsQuery.data?.items ?? [];

  useEffect(() => {
    if (!selectedAssignmentId && availableAssignments[0]?.id) {
      setSelectedAssignmentId(availableAssignments[0].id);
    }
  }, [availableAssignments, selectedAssignmentId]);

  if (assignmentsQuery.isLoading && canListAssignments) {
    return <LoaderBlock label="Loading feedback workspace..." />;
  }

  if (!canListAssignments) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Feedback"
          title="Feedback workspace"
          description="NGO accounts can submit and review feedback when an admin-created assignment is opened for follow-up."
        />
        <Panel className="space-y-3">
          <p className="text-lg font-bold text-white">No direct assignment controls</p>
          <p className="text-sm leading-6 text-on-surface-variant">
            Matching and assignment management are reserved for the NIYOJAN superadmin.
            Use this section for feedback records linked from an assigned case.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Feedback"
        title={user?.role === "volunteer" ? "Select an open case" : "Choose an assignment"}
        description={user?.role === "volunteer"
          ? "Choose one of your assigned cases and submit the observed ground reality after the field visit."
          : "Assignments drive volunteer feedback submission and admin case closure."}
      />
      {user?.role === "volunteer" ? (
        <Panel className="max-w-3xl space-y-4">
          <Select
            value={selectedAssignmentId}
            onChange={(event) => setSelectedAssignmentId(event.target.value)}
          >
            {availableAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.needSummary} ({assignment.status})
              </option>
            ))}
          </Select>
          <Link
            className="action-button-secondary"
            to={selectedAssignmentId ? `/feedback/assignments/${selectedAssignmentId}` : "/feedback"}
          >
            Open selected case
          </Link>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {availableAssignments.map((assignment) => (
            <Panel className="space-y-3" key={assignment.id}>
              <p className="text-lg font-bold text-white">{assignment.needSummary}</p>
              <p className="text-sm text-on-surface-variant">{assignment.volunteerName}</p>
              <Link className="action-button-secondary" to={`/feedback/assignments/${assignment.id}`}>
                Open feedback record
              </Link>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedbackPage() {
  const { assignmentId = "" } = useParams();
  const { user } = useAuth();
  const [evidencePaths, setEvidencePaths] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const assignmentQuery = useQuery({
    queryKey: ["feedback-assignment", assignmentId],
    queryFn: () => assignmentsApi.get(assignmentId),
  });

  const feedbackQuery = useQuery({
    enabled: Boolean(assignmentId),
    queryKey: ["assignment-feedback", assignmentId],
    queryFn: async () => {
      try {
        return await feedbackApi.get(assignmentId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => feedbackApi.submit(assignmentId, payload),
    onSuccess: async () => {
      setMessage("Feedback submitted.");
      await Promise.all([feedbackQuery.refetch(), assignmentQuery.refetch()]);
    },
  });

  const closeNeedMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      feedbackApi.closeNeed(assignmentQuery.data?.needId ?? "", payload),
    onSuccess: () => {
      setMessage("Need closure submitted.");
    },
  });

  const uploadEvidence = async (file: File) => {
    const signed = await feedbackApi.evidenceUrl(assignmentId, {
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
    });

    await api.uploadToSignedUrl(signed.uploadUrl, file, signed.requiredHeaders);
    setEvidencePaths((current) => [...current, signed.gcsPath]);
    setMessage(`Uploaded evidence: ${file.name}`);
  };

  if (assignmentQuery.isLoading || feedbackQuery.isLoading) {
    return <LoaderBlock label="Loading feedback detail..." />;
  }

  const assignment = assignmentQuery.data;
  const feedback = feedbackQuery.data;

  if (!assignment) {
    return <LoaderBlock label="Assignment not found." />;
  }

  const canCloseNeed = Boolean(
    user && feedback && (user.role === "superadmin" || user.role === "ngo_admin"),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ground Truth"
        title={assignment.needSummary}
        description="Field verification against the original need and AI-derived routing decision."
        actions={
          <Link className="action-button-secondary" to={user?.role === "superadmin" ? "/assignments" : "/feedback"}>
            Back
          </Link>
        }
      />

      {message ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCell label="Volunteer" value={assignment.volunteerName} />
            <InfoCell label="Status" value={assignment.status} />
            <InfoCell label="Priority" value={assignment.needPriorityLevel} />
            <InfoCell label="Assigned" value={formatDateTime(assignment.assignedAt)} />
          </div>

          {!feedback ? (
            <form
              className="space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                submitMutation.mutate({
                  visit_completed: formData.get("visit_completed") === "true",
                  visit_date: formData.get("visit_date") || undefined,
                  need_confirmed: formData.get("need_confirmed") === "true",
                  actual_situation_summary: formData.get("actual_situation_summary") || undefined,
                  actual_urgency_assessment: formData.get("actual_urgency_assessment") || undefined,
                  actual_affected_count: formData.get("actual_affected_count")
                    ? Number(formData.get("actual_affected_count"))
                    : undefined,
                  was_ai_extraction_accurate:
                    formData.get("was_ai_extraction_accurate") === "true",
                  extraction_inaccuracies: formData.get("extraction_inaccuracies") || undefined,
                  evidence_gcs_paths: evidencePaths,
                  action_taken: formData.get("action_taken") || undefined,
                  resolution_status: formData.get("resolution_status") || undefined,
                  escalation_reason: formData.get("escalation_reason") || undefined,
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Select name="visit_completed">
                  <option value="true">Visit completed</option>
                  <option value="false">Visit not completed</option>
                </Select>
                <Input name="visit_date" type="date" />
                <Select name="need_confirmed">
                  <option value="true">Need confirmed</option>
                  <option value="false">Need not confirmed</option>
                </Select>
                <Input name="actual_affected_count" placeholder="Actual affected count" type="number" />
                <Select name="actual_urgency_assessment">
                  <option value="correct">Urgency correct</option>
                  <option value="higher">Higher</option>
                  <option value="lower">Lower</option>
                  <option value="not_applicable">Not applicable</option>
                </Select>
                <Select name="was_ai_extraction_accurate">
                  <option value="true">AI extraction accurate</option>
                  <option value="false">AI extraction inaccurate</option>
                </Select>
              </div>

              <Textarea name="actual_situation_summary" placeholder="Observed field situation" />
              <Textarea name="action_taken" placeholder="Action taken" />
              <Textarea name="extraction_inaccuracies" placeholder="Extraction inaccuracies" />

              <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-low p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    accept=".jpg,.jpeg,.png,.pdf,.gpx"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0];
                      if (nextFile) {
                        void uploadEvidence(nextFile);
                      }
                    }}
                    type="file"
                  />
                </div>
                {evidencePaths.length > 0 ? (
                  <ul className="space-y-2 text-xs text-on-surface-variant">
                    {evidencePaths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <Select name="resolution_status">
                <option value="pending">pending</option>
                <option value="resolved">resolved</option>
                <option value="partially_resolved">partially_resolved</option>
                <option value="escalated">escalated</option>
                <option value="unresolved">unresolved</option>
              </Select>
              <Textarea name="escalation_reason" placeholder="Escalation reason if applicable" />

              <Button disabled={submitMutation.isPending} type="submit">
                {submitMutation.isPending ? "Submitting..." : "Submit feedback"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <InfoCell label="Visit completed" value={String(feedback.visitCompleted)} />
              <InfoCell label="Visit date" value={formatDateTime(feedback.visitDate)} />
              <InfoCell label="Resolution" value={feedback.resolutionStatus} />
              <InfoCell label="Affected count" value={String(feedback.actualAffectedCount ?? "n/a")} />
              <Panel className="bg-surface-container-low">
                <p className="label-caps">Actual situation</p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  {feedback.actualSituationSummary ?? "No summary provided"}
                </p>
              </Panel>
              <Panel className="bg-surface-container-low">
                <p className="label-caps">Evidence paths</p>
                <div className="mt-3 space-y-2 text-xs text-on-surface-variant">
                  {feedback.evidenceGcsPaths.map((path) => (
                    <div key={path}>{path}</div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {canCloseNeed ? (
            <Panel className="space-y-4">
              <p className="text-xl font-black text-white">Close need</p>
              <form
                className="space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  closeNeedMutation.mutate({
                    assignment_id: assignment.id,
                    feedback_id: feedback?.id,
                    outcome: formData.get("outcome"),
                    extraction_was_accurate: formData.get("extraction_was_accurate") === "true",
                    urgency_was_accurate: formData.get("urgency_was_accurate") === "true",
                    category_was_accurate: formData.get("category_was_accurate") === "true",
                    matching_was_appropriate: formData.get("matching_was_appropriate") === "true",
                    coordinator_notes: formData.get("coordinator_notes"),
                  });
                }}
              >
                <Select name="outcome">
                  <option value="resolved">resolved</option>
                  <option value="partially_resolved">partially_resolved</option>
                  <option value="escalated">escalated</option>
                  <option value="unresolved">unresolved</option>
                  <option value="duplicate">duplicate</option>
                </Select>
                <div className="grid gap-4 md:grid-cols-2">
                  <Select name="extraction_was_accurate">
                    <option value="true">Extraction accurate</option>
                    <option value="false">Extraction inaccurate</option>
                  </Select>
                  <Select name="urgency_was_accurate">
                    <option value="true">Urgency accurate</option>
                    <option value="false">Urgency inaccurate</option>
                  </Select>
                  <Select name="category_was_accurate">
                    <option value="true">Category accurate</option>
                    <option value="false">Category inaccurate</option>
                  </Select>
                  <Select name="matching_was_appropriate">
                    <option value="true">Matching appropriate</option>
                    <option value="false">Matching inappropriate</option>
                  </Select>
                </div>
                <Textarea name="coordinator_notes" placeholder="Coordinator closure notes" />
                <Button disabled={closeNeedMutation.isPending} type="submit">
                  {closeNeedMutation.isPending ? "Closing..." : "Close need"}
                </Button>
              </form>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
