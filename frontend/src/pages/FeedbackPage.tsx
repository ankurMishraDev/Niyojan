import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { assignmentsApi, feedbackApi } from "@/lib/services";
import { useAuth } from "@/features/auth/useAuth";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { useTranslation } from "react-i18next";

function StatusPill({ value }: { value: string }) {
  return <StatusBadge tone={toneForStatus(value)}>{value}</StatusBadge>;
}

export function FeedbackIndexPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canListAssignments =
    user?.role === "superadmin" ||
    user?.role === "volunteer" ||
    user?.role === "ngo_admin" ||
    user?.role === "field_worker";
  
  const assignmentsQuery = useQuery({
    enabled: canListAssignments,
    queryKey: ["feedback-assignments"],
    queryFn: () => assignmentsApi.list({ page: 1, pageSize: 20 }),
  });

  const availableAssignments = assignmentsQuery.data?.items ?? [];

  if (assignmentsQuery.isLoading && canListAssignments) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading feedback workspace…" />
      </div>
    );
  }

  if (!canListAssignments) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
        <PageHeader
          eyebrow={t("NGO_Feedback_Header_CaseFeedback")}
          title={t("NGO_Feedback_Text_CaseFeedback")}
          description={t("NGO_Feedback_Description_CaseFeedback")}
        />
        <Panel className="space-y-4">
          <p className="text-xl font-semibold tracking-tight text-ink">{t("NGO_Feedback_Label_CaseFeedback")}</p>
          <p className="text-sm leading-relaxed text-body">
            {t("NGO_Feedback_Reason_CaseFeedback")}
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow={t("NGO_Feedback_Header_Feedback")}
        title={user?.role === "volunteer" ? t("NGO_Feedback_Title_Volunteer") : user?.role === "superadmin" ? t("NGO_Feedback_Title_Superadmin") : t("NGO_Feedback_Title_Review")}
        description={user?.role === "volunteer"
          ? t("NGO_Feedback_Description_Volunteer")
          : user?.role === "superadmin"
            ? t("NGO_Feedback_Description_Superadmin")
            : t("NGO_Feedback_Description_Review")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {availableAssignments.map((assignment) => (
          <Panel className="space-y-5 flex flex-col justify-between" key={assignment.id}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
              <div className="space-y-1">
                <p className="text-lg font-semibold tracking-tight text-ink line-clamp-2">{assignment.needSummary}</p>
                <p className="text-sm font-medium text-body truncate">
                  {user?.role === "volunteer"
                    ? assignment.needPriorityLevel
                    : user?.role === "superadmin"
                      ? assignment.volunteerName
                      : assignment.needPriorityLevel}
                </p>
              </div>
              <div className="shrink-0">
                <StatusPill value={assignment.status} />
              </div>
            </div>
            <Link className="action-button-secondary w-full text-center mt-auto" to={`/feedback/assignments/${assignment.id}`}>
              {user?.role === "volunteer"
                ? t("NGO_Feedback_Button_OpenFieldFeedback")
                : user?.role === "superadmin"
                  ? t("NGO_Feedback_Button_OpenFeedbackRecord")
                  : t("NGO_Feedback_Button_ReviewVolunteerResponse")}
            </Link>
          </Panel>
        ))}
        {availableAssignments.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-body border-2 border-dashed border-hairline rounded-md">
            {t("NGO_Feedback_NoAssignments")}
          </div>
        )}
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const { assignmentId = "" } = useParams();
  const { user } = useAuth();
  const [evidencePaths, setEvidencePaths] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const { t } = useTranslation();
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
      setMessage("Feedback submitted successfully.");
      await Promise.all([feedbackQuery.refetch(), assignmentQuery.refetch()]);
    },
  });

  const closeNeedMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      feedbackApi.closeNeed(assignmentQuery.data?.needId ?? "", payload),
    onSuccess: () => {
      setMessage("Need closure submitted successfully.");
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
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading feedback detail…" />
      </div>
    );
  }

  const assignment = assignmentQuery.data;
  const feedback = feedbackQuery.data;

  if (!assignment) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Assignment not found." />
      </div>
    );
  }

  const canCloseNeed = Boolean(
    user && feedback && (user.role === "superadmin" || user.role === "ngo_admin"),
  );
  const isVolunteer = user?.role === "volunteer";
  const isNgo = user?.role === "ngo_admin" || user?.role === "field_worker";

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow={t("NGO_Feedback_Detailed_Header_Part")}
        title={assignment.needSummary}
        description={t("NGO_Feedback_Detailed_Description_Part")}
        actions={
          <Link className="action-button-secondary" to={user?.role === "superadmin" ? "/assignments" : "/feedback"}>
            {t("NGO_Feedback_Detailed_Button_BackToAssignments")}
          </Link>
        }
      />

      {message ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <InfoCell label="Volunteer" value={assignment.volunteerName} />
              <InfoCell label="Status" value={assignment.status} />
              <InfoCell label="Priority" value={assignment.needPriorityLevel} />
              <InfoCell label="Assigned" value={formatDateTime(assignment.assignedAt)} />
            </div>

            {assignment.survey ? (
              <div className="rounded-md border border-hairline bg-canvas-soft-2 p-5 space-y-4">
                <p className="text-lg font-semibold tracking-tight text-ink">Survey details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCell label="Respondent" value={assignment.survey.respondentName || "Unnamed respondent"} />
                  <InfoCell label="Location" value={assignment.survey.locationText || "No location"} />
                  <InfoCell label="Survey status" value={assignment.survey.status} />
                  <InfoCell label="Submitted" value={formatDateTime(assignment.survey.submittedAt)} />
                </div>
              </div>
            ) : null}

            {assignment.aiReview ? (
              <div className="rounded-md border border-hairline bg-canvas-soft p-5">
                <p className="label-caps mb-2 text-primary">AI review assessment</p>
                <p className="text-sm leading-relaxed text-body">
                  {assignment.aiReview.caseSummary || "No AI summary available."}
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel className="space-y-6 bg-canvas-soft">
            <p className="text-xl font-semibold tracking-tight text-ink">Feedback Response</p>
            {!feedback && isVolunteer ? (
              <form
                className="space-y-5"
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Visit Status</label>
                    <Select name="visit_completed">
                      <option value="true">Visit completed</option>
                      <option value="false">Visit not completed</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Date of Visit</label>
                    <Input name="visit_date" type="date" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Need Confirmation</label>
                    <Select name="need_confirmed">
                      <option value="true">Need confirmed</option>
                      <option value="false">Need not confirmed</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Affected Count</label>
                    <Input name="actual_affected_count" placeholder="Actual affected count" type="number" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Urgency Assessment</label>
                    <Select name="actual_urgency_assessment">
                      <option value="correct">Urgency correct</option>
                      <option value="higher">Higher</option>
                      <option value="lower">Lower</option>
                      <option value="not_applicable">Not applicable</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">AI Extraction Accuracy</label>
                    <Select name="was_ai_extraction_accurate">
                      <option value="true">AI extraction accurate</option>
                      <option value="false">AI extraction inaccurate</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-hairline">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Observed Field Situation</label>
                    <Textarea name="actual_situation_summary" placeholder="Describe the ground truth" className="min-h-[100px]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Action Taken</label>
                    <Textarea name="action_taken" placeholder="What actions were performed?" className="min-h-[100px]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Extraction Inaccuracies</label>
                    <Textarea name="extraction_inaccuracies" placeholder="Note any errors in the initial report" className="min-h-[80px]" />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-hairline bg-canvas p-5">
                  <p className="label-caps">Evidence Upload</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Input
                      className="py-1.5"
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
                    <ul className="space-y-2 mt-3 pt-3 border-t border-hairline text-xs font-mono text-mute">
                      {evidencePaths.map((path) => (
                        <li key={path} className="truncate">{path}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-mute mt-2">Attach photos or documents as proof.</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-hairline">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Resolution Status</label>
                    <Select name="resolution_status">
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="partially_resolved">Partially Resolved</option>
                      <option value="escalated">Escalated</option>
                      <option value="unresolved">Unresolved</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-body px-1">Escalation Reason</label>
                    <Input name="escalation_reason" placeholder="If applicable" />
                  </div>
                </div>

                <div className="pt-4 border-t border-hairline flex justify-end">
                  <Button className="w-full sm:w-auto" disabled={submitMutation.isPending} type="submit">
                    {submitMutation.isPending ? "Submitting…" : "Submit Feedback"}
                  </Button>
                </div>
              </form>
            ) : feedback ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCell label="Visit completed" value={String(feedback.visitCompleted)} />
                  <InfoCell label="Visit date" value={formatDateTime(feedback.visitDate)} />
                  <InfoCell label="Resolution" value={feedback.resolutionStatus} />
                  <InfoCell label="Affected count" value={String(feedback.actualAffectedCount ?? "n/a")} />
                </div>
                <div className="rounded-md border border-hairline bg-canvas p-5 space-y-4">
                  <div>
                    <p className="label-caps mb-2 text-primary">Actual situation</p>
                    <p className="text-sm leading-relaxed text-body">
                      {feedback.actualSituationSummary ?? "No summary provided"}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-hairline">
                    <p className="label-caps mb-2">Evidence paths</p>
                    <div className="space-y-2 text-[11px] font-mono text-mute break-all">
                      {feedback.evidenceGcsPaths.map((path) => (
                        <div key={path}>{path}</div>
                      ))}
                      {feedback.evidenceGcsPaths.length === 0 && <p className="italic">No evidence attached.</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-center text-sm text-body border-2 border-dashed border-hairline rounded-md">
                {isNgo
                  ? "The assigned volunteer has not submitted any field feedback yet. Once they submit their response, you can review it here and verify the actions taken."
                  : "No feedback has been submitted for this assignment yet."}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {canCloseNeed ? (
            <Panel className="space-y-5 shadow-card-float">
              <p className="text-xl font-semibold tracking-tight text-ink">Close Need</p>
              <form
                className="space-y-5"
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
                <div className="space-y-1">
                  <label className="text-xs font-medium text-body px-1">Final Outcome</label>
                  <Select name="outcome">
                    <option value="resolved">Resolved</option>
                    <option value="partially_resolved">Partially Resolved</option>
                    <option value="escalated">Escalated</option>
                    <option value="unresolved">Unresolved</option>
                    <option value="duplicate">Duplicate</option>
                  </Select>
                </div>
                <div className="space-y-3">
                  <p className="label-caps">Accuracy Review</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select name="extraction_was_accurate" className="text-sm">
                      <option value="true">Extraction accurate</option>
                      <option value="false">Extraction inaccurate</option>
                    </Select>
                    <Select name="urgency_was_accurate" className="text-sm">
                      <option value="true">Urgency accurate</option>
                      <option value="false">Urgency inaccurate</option>
                    </Select>
                    <Select name="category_was_accurate" className="text-sm">
                      <option value="true">Category accurate</option>
                      <option value="false">Category inaccurate</option>
                    </Select>
                    <Select name="matching_was_appropriate" className="text-sm">
                      <option value="true">Matching appropriate</option>
                      <option value="false">Matching inappropriate</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-body px-1">Coordinator Notes</label>
                  <Textarea name="coordinator_notes" placeholder="Final closure notes" />
                </div>
                <Button className="w-full" disabled={closeNeedMutation.isPending} type="submit">
                  {closeNeedMutation.isPending ? "Closing…" : "Close need"}
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
    <div className="space-y-1">
      <p className="label-caps">{label}</p>
      <p className="text-sm font-medium text-ink break-words">{value || "—"}</p>
    </div>
  );
}
