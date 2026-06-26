import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, LoaderBlock, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { needsApi, pipelineApi, surveysApi } from "@/lib/services";

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function toneForUrgency(value: unknown) {
  const label = String(value ?? "").toLowerCase();

  if (label === "critical" || label === "high") {
    return "danger" as const;
  }

  if (label === "medium") {
    return "warning" as const;
  }

  if (label === "low") {
    return "success" as const;
  }

  return "default" as const;
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-hairline bg-canvas p-4 shadow-sm">
      <p className="label-caps mb-1.5">{label}</p>
      <p className="break-words text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function EditableAssessmentField({
  label,
  value,
  isEditing,
  onChange,
  onEdit,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (nextValue: string) => void;
  onEdit: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-md border border-hairline bg-canvas-soft-2 p-4 transition-colors hover:border-hairline-strong">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <Button 
          disabled={disabled} 
          onClick={isEditing ? onSave : onEdit} 
          type="button" 
          variant={isEditing ? "primary" : "ghost"}
          className={isEditing ? "px-3 py-1 text-xs" : "px-2 py-1 text-[11px]"}
        >
          {isEditing ? "Save" : "Edit"}
        </Button>
      </div>
      {isEditing ? (
        <Textarea className="mt-3 min-h-[90px] text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-body">{value || "Not provided"}</p>
      )}
    </div>
  );
}

const sentenceLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

function TrustedFieldGroup({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields);
  return (
    <div className="space-y-4 pt-2">
      <div>
        <p className="text-base font-semibold text-ink">Trusted fields</p>
        <p className="mt-1 text-sm text-body">These extracted fields look reliable.</p>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline px-4 py-6 text-center text-sm text-mute">
          No trusted fields available.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div className="min-w-0 rounded-md border border-hairline bg-canvas p-4 shadow-sm" key={key}>
              <p className="label-caps mb-2">{sentenceLabel(key)}</p>
              <p className="whitespace-pre-wrap break-words text-sm font-medium text-ink">
                {value === null || value === undefined ? "—" : String(value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationFieldGroup({ labels }: { labels: string[] }) {
  return (
    <div className="space-y-4 pt-4 border-t border-hairline mt-2">
      <div>
        <p className="text-base font-semibold text-ink text-danger">Needs verification</p>
        <p className="mt-1 text-sm text-body">These fields need attention before approval.</p>
      </div>
      {labels.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline px-4 py-6 text-center text-sm text-mute">
          No verification flags raised.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <span
              className="rounded border border-warning/30 bg-warning/5 px-2.5 py-1 text-xs font-mono text-warning-deep"
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiReviewIndexPage() {
  const [feedback, setFeedback] = useState("");

  const reviewCandidatesQuery = useQuery({
    queryKey: ["review-candidates"],
    queryFn: pipelineApi.intake,
  });

  const deleteMutation = useMutation({
    mutationFn: (surveyId: string) => surveysApi.delete(surveyId),
    onSuccess: async () => {
      setFeedback("Review package deleted.");
      await reviewCandidatesQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  if (reviewCandidatesQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading review candidates…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="AI Review"
        title="Select a review package"
        description="Every submitted survey has an AI review package, whether it was filled manually or backed by an uploaded document."
      />

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {reviewCandidatesQuery.data?.map((item) => (
          <Panel className="space-y-5 flex flex-col" key={item.surveyId}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-lg font-semibold tracking-tight text-ink truncate">{item.respondentName || "Unnamed respondent"}</p>
                <p className="text-sm text-body truncate">{item.locationText || "No location"}</p>
                <div className="pt-1">
                  <StatusBadge tone={toneForStatus(item.surveyStatus)}>{item.surveyStatus}</StatusBadge>
                </div>
              </div>
              <Button
                className="shrink-0 text-xs px-2.5 py-1.5 self-start"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete review package for survey ${item.surveyId}?`)) return;
                  void deleteMutation.mutate(item.surveyId);
                }}
                type="button"
                variant="danger"
              >
                Delete
              </Button>
            </div>
            <Link
              className="action-button-secondary w-full text-center mt-auto"
              to={`/ai-review/surveys/${item.surveyId}`}
            >
              Open Review Screen
            </Link>
          </Panel>
        ))}
        {reviewCandidatesQuery.data?.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-body border-2 border-dashed border-hairline rounded-md">
            No active review candidates found.
          </div>
        )}
      </div>
    </div>
  );
}

export function AiReviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { documentId = "", surveyId = "" } = useParams();
  const [reviewAction, setReviewAction] = useState("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingAssessmentField, setEditingAssessmentField] = useState<string | null>(null);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, string>>({});
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [needDrafts, setNeedDrafts] = useState<Record<string, { summary: string; urgencyScore: string; priorityLevel: string }>>({});
  const isSurveyReview = Boolean(surveyId);
  const reviewTargetId = surveyId || documentId;

  const reviewQuery = useQuery({
    queryKey: ["review-package", isSurveyReview ? "survey" : "document", reviewTargetId],
    queryFn: () =>
      isSurveyReview ? pipelineApi.surveyReviewPackage(reviewTargetId) : pipelineApi.reviewPackage(reviewTargetId),
  });

  const reviewPackageData = reviewQuery.data;
  const trustedFields =
    (reviewPackageData?.validatedCandidate?.trusted_fields as Record<string, unknown> | undefined) ?? {};

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const reviewPayload = {
        review_action: reviewAction,
        review_notes: reviewNotes || undefined,
        field_corrections: {},
        approved_fields: {},
      };
      // For document-backed surveys (accessed via /ai-review/surveys/:id), the pipeline
      // data lives in the documents pipeline tables. Use the document endpoint so the
      // review is written to the correct table and shows in the review history.
      const docId = reviewQuery.data?.sourceDocumentId;
      if (docId) return pipelineApi.submitReview(docId, reviewPayload);
      if (isSurveyReview) return pipelineApi.submitSurveyReview(reviewTargetId, reviewPayload);
      return pipelineApi.submitReview(reviewTargetId, reviewPayload);
    },
    onSuccess: async () => {
      setFeedback("Review submitted successfully.");
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Review submission failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Always delete the survey record (cascades to linked document via DB constraints).
      // For document-backed surveys, the sourceSurveyId is the survey we're reviewing.
      await surveysApi.delete(reviewQuery.data?.sourceSurveyId || reviewTargetId);
    },
    onSuccess: async () => {
      navigate("/ai-review");
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  const updateNeedMutation = useMutation({
    mutationFn: async (payload: { needId: string; summary: string; urgencyScore: number; priorityLevel: string }) =>
      needsApi.update(payload.needId, {
        summary: payload.summary,
        urgency_score: payload.urgencyScore,
        priority_level: payload.priorityLevel,
      }),
    onSuccess: async () => {
      setFeedback("Need updated.");
      setEditingNeedId(null);
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Need update failed.");
    },
  });

  const updateAssessmentMutation = useMutation({
    mutationFn: async (payload: { field: string; value: string; kind: "text" | "number" | "list" }) => {
      const normalizedValue =
        payload.kind === "number"
          ? Number(payload.value)
          : payload.kind === "list"
            ? payload.value
                .split(/\r?\n/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : payload.value;

      // For document-backed surveys, assessment overrides are stored against the document.
      // Use the document endpoint so overrides actually apply to the correct record.
      const docId = reviewQuery.data?.sourceDocumentId;
      if (docId) {
        return pipelineApi.updateReviewAssessment(docId, { field: payload.field, value: normalizedValue });
      }
      return isSurveyReview
        ? pipelineApi.updateSurveyReviewAssessment(reviewTargetId, { field: payload.field, value: normalizedValue })
        : pipelineApi.updateReviewAssessment(reviewTargetId, { field: payload.field, value: normalizedValue });
    },
    onSuccess: async () => {
      setFeedback("AI assessment field updated.");
      setEditingAssessmentField(null);
      // Invalidate all assignment detail caches so the updated overrides show immediately
      await queryClient.invalidateQueries({ queryKey: ["assignment-detail"] });
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Assessment update failed.");
    },
  });

  const resolvedReviewPackage = reviewQuery.data!;
  const untrustedFields =
    (resolvedReviewPackage?.validatedCandidate?.untrusted_fields as Record<string, unknown> | undefined) ?? {};
  const reasoning = (resolvedReviewPackage?.reasoningOutput as Record<string, unknown> | null) ?? {};
  const assessmentFields = [
    { key: "case_summary", label: "Case summary", kind: "text" as const, value: String(reasoning.case_summary ?? "") },
    { key: "urgency_score", label: "Urgency score", kind: "number" as const, value: String(reasoning.urgency_score ?? "") },
    { key: "urgency_label", label: "Urgency label", kind: "text" as const, value: String(reasoning.urgency_label ?? "") },
    { key: "need_category", label: "Need category", kind: "text" as const, value: String(reasoning.need_category ?? "") },
    { key: "need_subcategory", label: "Need subcategory", kind: "text" as const, value: String(reasoning.need_subcategory ?? "") },
    { key: "verification_risk", label: "Verification risk", kind: "text" as const, value: String(reasoning.verification_risk ?? "") },
    { key: "reasoning_confidence", label: "Confidence", kind: "number" as const, value: String(reasoning.reasoning_confidence ?? "") },
    { key: "recommended_action", label: "Recommended action", kind: "text" as const, value: String(reasoning.recommended_action ?? "") },
    { key: "urgency_reasons", label: "Urgency reasons", kind: "list" as const, value: stringList(reasoning.urgency_reasons).join("\n") },
    { key: "urgency_evidence_refs", label: "Evidence from intake", kind: "list" as const, value: stringList(reasoning.urgency_evidence_refs).join("\n") },
    { key: "recommended_skill_keys", label: "Recommended skills", kind: "list" as const, value: stringList(reasoning.recommended_skill_keys).join("\n") },
    { key: "verification_risk_reasons", label: "Verification risk reasons", kind: "list" as const, value: stringList(reasoning.verification_risk_reasons).join("\n") },
  ];

  useEffect(() => {
    setAssessmentDrafts(
      Object.fromEntries(assessmentFields.map((field) => [field.key, field.value])),
    );
  }, [reviewTargetId, reviewQuery.data]);

  if (reviewQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading review package…" />
      </div>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Review package is unavailable for this submission." />
      </div>
    );
  }

  const trustedCount = Object.keys(trustedFields).length;
  const untrustedCount = Object.keys(untrustedFields).length;
  const verificationLabels = Object.keys(untrustedFields).map(sentenceLabel);
  const surveyNeeds = resolvedReviewPackage.surveyNeeds ?? [];
  const reviewPackage = resolvedReviewPackage;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="AI Review"
        title={reviewPackage.document?.fileName || "Survey Review"}
        description="Review the AI case summary, verify extracted fields, and record the final human decision before moving this case to matching."
        actions={
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            { (surveyId || reviewPackage.sourceSurveyId) && (
              <Link 
                to={`/surveys/${surveyId || reviewPackage.sourceSurveyId}`} 
                className="inline-flex flex-1 sm:flex-none items-center justify-center rounded-md border border-hairline bg-canvas px-4 py-2 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                View Full Survey
              </Link>
            )}
            <Button
              className="flex-1 sm:flex-none text-xs px-4"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!window.confirm(`Delete review package ${reviewPackage.document?.fileName || 'survey'}?`)) return;
                void deleteMutation.mutate();
              }}
              type="button"
              variant="danger"
            >
              Delete Package
            </Button>
            <Link className="action-button-secondary flex-1 sm:flex-none text-center text-xs px-4" to="/ai-review">
              Back to List
            </Link>
          </div>
        }
      />

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel className="min-w-0 space-y-4 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-hairline">
            <div>
              <p className="text-xl font-semibold tracking-tight text-ink">
                {reviewPackage.sourceDocumentId ? "Uploaded document" : "Submitted survey"}
              </p>
              <p className="mt-1 text-[11px] font-mono text-mute">
                {reviewPackage.sourceDocumentId && reviewPackage.document.readUrl
                  ? `Signed URL expires at ${formatDateTime(reviewPackage.document.readUrlExpiresAt)}`
                  : reviewPackage.sourceDocumentId
                    ? `File: ${reviewPackage.document.fileName}`
                    : "Created from a manually filled survey submission."}
              </p>
            </div>
            {reviewPackage.sourceDocumentId && (
              <StatusBadge tone={toneForStatus(reviewPackage.document.status)}>
                {reviewPackage.document.status}
              </StatusBadge>
            )}
          </div>

          <div className="flex-1 overflow-hidden rounded-md border border-hairline bg-canvas-soft relative min-h-[300px]">
            {reviewPackage.sourceDocumentId && reviewPackage.document.readUrl && reviewPackage.document.fileType.includes("pdf") ? (
              <iframe className="absolute inset-0 h-full w-full border-0" src={reviewPackage.document.readUrl} title="Document preview" />
            ) : reviewPackage.sourceDocumentId && reviewPackage.document.readUrl ? (
              <img
                alt={reviewPackage.document.fileName}
                className="absolute inset-0 h-full w-full object-contain p-2"
                src={reviewPackage.document.readUrl}
              />
            ) : reviewPackage.sourceDocumentId ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-body border-2 border-dashed border-hairline/50 m-4 rounded">
                The uploaded document preview could not be loaded. The signed URL may have expired or the file may be unavailable. The AI review below is still valid.
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-body border-2 border-dashed border-hairline/50 m-4 rounded">
                Manual survey submissions do not have an uploaded document preview. This AI review is based on the survey responses and generated needs.
              </div>
            )}
          </div>
        </Panel>

        <div className="min-w-0 space-y-6 max-h-[85vh] overflow-y-auto pr-2">
          <Panel className="min-w-0 space-y-6 bg-canvas-soft">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-hairline">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">AI Assessment Report</p>
                <p className="mt-1 text-sm text-body">
                  Case summary generated by AI from the survey. Run the pipeline first if fields are empty.
                </p>
              </div>
              <StatusBadge tone={toneForUrgency(reasoning.urgency_label)}>
                {String(reasoning.urgency_label ?? "not rated")}
              </StatusBadge>
            </div>

            {/* Show clear message when pipeline hasn't been run yet */}
            {!reasoning.case_summary && !reasoning.urgency_label ? (
              <div className="rounded-md border border-dashed border-hairline px-5 py-6 text-center space-y-2">
                <p className="text-sm font-medium text-ink">No AI assessment available yet.</p>
                <p className="text-xs text-body">
                  This survey has not been processed by the AI pipeline. Go to the Pipeline section, find this survey's document, and run the pipeline to generate the assessment.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ReviewMetric label="Validated fields" value={`${trustedCount} trusted / ${untrustedCount} flagged`} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {assessmentFields.map((field) => (
                    <EditableAssessmentField
                      disabled={updateAssessmentMutation.isPending}
                      isEditing={editingAssessmentField === field.key}
                      key={field.key}
                      label={field.label}
                      onChange={(nextValue) =>
                        setAssessmentDrafts((current) => ({
                          ...current,
                          [field.key]: nextValue,
                        }))
                      }
                      onEdit={() => setEditingAssessmentField(field.key)}
                      onSave={() =>
                        void updateAssessmentMutation.mutate({
                          field: field.key,
                          kind: field.kind,
                          value: assessmentDrafts[field.key] ?? field.value,
                        })
                      }
                      value={assessmentDrafts[field.key] ?? field.value}
                    />
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel className="min-w-0 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-hairline">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">Validated candidate</p>
                <p className="mt-1 text-sm text-body">
                  AI extracted fields separated by confidence.
                </p>
              </div>
              <StatusBadge tone="warning">Human review required</StatusBadge>
            </div>

            <TrustedFieldGroup fields={trustedFields} />
            <VerificationFieldGroup labels={verificationLabels} />
          </Panel>

          <Panel className="min-w-0 space-y-5">
            <div className="pb-3 border-b border-hairline">
              <p className="text-xl font-semibold tracking-tight text-ink">AI-defined needs</p>
              <p className="mt-1 text-sm text-body">
                Generated from the survey. Click Edit on any need to adjust urgency, summary, or priority.
              </p>
            </div>

            {surveyNeeds.length === 0 ? (
              <div className="rounded-md border border-dashed border-hairline px-4 py-6 text-center text-sm text-mute">
                No needs have been generated for this survey yet.
              </div>
            ) : (
              <div className="space-y-4">
                {surveyNeeds.map((need) => {
                  const isEditingNeed = editingNeedId === need.id;
                  const draft = needDrafts[need.id] ?? {
                    summary: need.summary ?? "",
                    urgencyScore: String(need.urgencyScore ?? ""),
                    priorityLevel: need.priorityLevel ?? "medium",
                  };
                  return (
                    <div className="rounded-md border border-hairline bg-canvas p-5 shadow-sm" key={need.id}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {isEditingNeed ? (
                            <textarea
                            title="Draft summary"
                              className="w-full rounded border border-hairline bg-canvas-soft-2 p-2 text-sm text-ink resize-none"
                              rows={3}
                              value={draft.summary}
                              onChange={(e) => setNeedDrafts(prev => ({
                                ...prev,
                                [need.id]: { ...draft, summary: e.target.value }
                              }))}
                            />
                          ) : (
                            <p className="font-semibold text-ink">{need.summary}</p>
                          )}
                          <p className="mt-1 text-sm text-body">{sentenceLabel(need.category)}</p>
                        </div>
                        <div className="flex gap-2 items-start shrink-0">
                          {isEditingNeed ? (
                            <>
                              <Button
                                className="text-xs px-3 py-1"
                                disabled={updateNeedMutation.isPending}
                                onClick={() => void updateNeedMutation.mutate({
                                  needId: need.id,
                                  summary: draft.summary,
                                  urgencyScore: Number(draft.urgencyScore),
                                  priorityLevel: draft.priorityLevel,
                                })}
                                type="button"
                              >
                                {updateNeedMutation.isPending ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                className="text-xs px-3 py-1"
                                onClick={() => setEditingNeedId(null)}
                                type="button"
                                variant="secondary"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                className="text-xs px-2 py-1"
                                onClick={() => {
                                  setNeedDrafts(prev => ({
                                    ...prev,
                                    [need.id]: {
                                      summary: need.summary ?? "",
                                      urgencyScore: String(need.urgencyScore ?? ""),
                                      priorityLevel: need.priorityLevel ?? "medium",
                                    }
                                  }));
                                  setEditingNeedId(need.id);
                                }}
                                type="button"
                                variant="ghost"
                              >
                                Edit
                              </Button>
                              <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3">
                        {isEditingNeed ? (
                          <>
                            <div className="space-y-1">
                              <p className="label-caps">Urgency Score</p>
                              <input
                              title="Draft urgency score"
                                type="number"
                                min={0}
                                max={100}
                                className="w-full rounded border border-hairline bg-canvas-soft-2 px-2 py-1 text-sm text-ink"
                                value={draft.urgencyScore}
                                onChange={(e) => setNeedDrafts(prev => ({
                                  ...prev,
                                  [need.id]: { ...draft, urgencyScore: e.target.value }
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="label-caps">Priority Level</p>
                              <select
                              title="Draft priority level"
                                className="w-full rounded border border-hairline bg-canvas-soft-2 px-2 py-1 text-sm text-ink"
                                value={draft.priorityLevel}
                                onChange={(e) => setNeedDrafts(prev => ({
                                  ...prev,
                                  [need.id]: { ...draft, priorityLevel: e.target.value }
                                }))}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            <ReviewMetric label="Urgency" value={String(need.urgencyScore)} />
                            <ReviewMetric label="Status" value={sentenceLabel(need.status)} />
                            <ReviewMetric label="Skills" value={String(need.skills.length)} />
                          </>
                        )}
                      </div>

                      {need.skills.length > 0 && !isEditingNeed ? (
                        <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap gap-2">
                          {need.skills.map((skill) => (
                            <span
                              className="rounded bg-canvas-soft-2 border border-hairline px-2 py-0.5 text-[10px] font-mono text-ink"
                              key={skill.skillId}
                            >
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="min-w-0 space-y-5 shadow-card-float">
            <p className="text-xl font-semibold tracking-tight text-ink pb-3 border-b border-hairline">Submit human review</p>
            <div className="grid gap-5">
              <div className="space-y-2">
                <p className="label-caps">Decision</p>
                <Select value={reviewAction} onChange={(event) => setReviewAction(event.target.value)}>
                  <option value="approved">Approved</option>
                  <option value="edited">Edited</option>
                  <option value="rejected">Rejected</option>
                  <option value="requested_reextraction">Re-extraction</option>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="label-caps">Reviewer Notes</p>
                <Textarea
                  placeholder="Additional context or reasoning…"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <Button
                  className="w-full sm:flex-1"
                  disabled={submitReviewMutation.isPending}
                  onClick={() => void submitReviewMutation.mutate()}
                >
                  {submitReviewMutation.isPending ? "Submitting…" : "Submit Review"}
                </Button>
                {reviewPackage.sourceSurveyId ? (
                  <Link
                    className="action-button-secondary w-full sm:flex-1 text-center"
                    to={`/matching?surveyId=${reviewPackage.sourceSurveyId}`}
                  >
                    Open Matching
                  </Link>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel className="min-w-0 space-y-4">
            <p className="text-lg font-semibold tracking-tight text-ink pb-2 border-b border-hairline">Review history</p>
            {reviewPackage.humanReviews.length === 0 ? (
              <p className="text-sm text-mute italic">No human reviews have been submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {reviewPackage.humanReviews.map((review, index) => (
                  <div
                    className="rounded-md border border-hairline bg-canvas-soft-2 p-4"
                    key={`${review.reviewed_at as string}-${index}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-ink text-sm capitalize">{String(review.review_action)}</p>
                      <p className="text-[11px] font-mono text-mute">{formatDateTime(String(review.reviewed_at ?? ""))}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-body break-words">
                      {String(review.review_notes ?? "No reviewer note")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
