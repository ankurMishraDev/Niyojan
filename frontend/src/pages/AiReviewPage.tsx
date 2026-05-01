import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, LoaderBlock, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime, sentence, toneForStatus } from "@/lib/format";
import { documentsApi, pipelineApi, surveysApi } from "@/lib/services";

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function sentenceLabel(value: string) {
  return sentence(value).replace(/\s+/g, " ").trim();
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const primitiveValues = value.filter(
      (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    );

    if (primitiveValues.length === value.length) {
      return primitiveValues.map((item) => String(item)).join(", ");
    }

    return "Structured response captured";
  }

  return "Structured response captured";
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
    <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-white">{value}</p>
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
    <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <Button disabled={disabled} onClick={isEditing ? onSave : onEdit} type="button" variant="ghost">
          {isEditing ? "Save" : "Edit"}
        </Button>
      </div>
      {isEditing ? (
        <Textarea className="mt-3 min-h-[90px]" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">{value || "Not provided"}</p>
      )}
    </div>
  );
}

function TrustedFieldGroup({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold text-white">Trusted fields</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          These extracted fields look reliable and can usually be approved after a quick check.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          No trusted fields available.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map(([key, value]) => (
            <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-4 py-3" key={key}>
              <p className="label-caps">{sentenceLabel(key)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
                {displayValue(value)}
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
    <div className="space-y-3">
      <div>
        <p className="text-base font-bold text-white">Needs verification</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          These field labels need extra attention before approval.
        </p>
      </div>
      {labels.length === 0 ? (
        <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          No extra verification flags were raised.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <span
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning"
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
    return <LoaderBlock label="Loading review candidates..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Review"
        title="Select a review package"
        description="Every submitted survey has an AI review package, whether it was filled manually or backed by an uploaded document."
      />

      {feedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {reviewCandidatesQuery.data?.map((item) => (
          <Panel className="space-y-3" key={item.surveyId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">{item.respondentName || "Unnamed respondent"}</p>
                <p className="text-sm text-on-surface-variant">{item.locationText || "No location"}</p>
                <StatusBadge tone={toneForStatus(item.surveyStatus)}>{item.surveyStatus}</StatusBadge>
              </div>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete review package for survey ${item.surveyId}?`)) {
                    return;
                  }
                  void deleteMutation.mutate(item.surveyId);
                }}
                type="button"
                variant="danger"
              >
                Delete
              </Button>
            </div>
            <Link
              className="action-button-secondary"
              to={item.sourceDocumentId ? `/ai-review/${item.sourceDocumentId}` : `/ai-review/surveys/${item.surveyId}`}
            >
              Open review screen
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function AiReviewPage() {
  const navigate = useNavigate();
  const { documentId = "", surveyId = "" } = useParams();
  const [reviewAction, setReviewAction] = useState("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingAssessmentField, setEditingAssessmentField] = useState<string | null>(null);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, string>>({});
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
    mutationFn: async () =>
      (isSurveyReview ? pipelineApi.submitSurveyReview(reviewTargetId, {
        review_action: reviewAction,
        review_notes: reviewNotes || undefined,
        field_corrections: {},
        approved_fields: {},
      }) : pipelineApi.submitReview(reviewTargetId, {
        review_action: reviewAction,
        review_notes: reviewNotes || undefined,
        field_corrections: {},
        approved_fields: {},
      })),
    onSuccess: async () => {
      setFeedback("Review submitted.");
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Review submission failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (isSurveyReview || !reviewQuery.data?.sourceDocumentId) {
        await surveysApi.delete(reviewQuery.data?.sourceSurveyId || reviewTargetId);
        return;
      }

      await documentsApi.delete(reviewQuery.data.sourceDocumentId);
    },
    onSuccess: async () => {
      navigate("/ai-review");
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
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

      return isSurveyReview
        ? pipelineApi.updateSurveyReviewAssessment(reviewTargetId, {
            field: payload.field,
            value: normalizedValue,
          })
        : pipelineApi.updateReviewAssessment(reviewTargetId, {
            field: payload.field,
            value: normalizedValue,
          });
    },
    onSuccess: async () => {
      setFeedback("AI assessment field updated.");
      setEditingAssessmentField(null);
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Assessment update failed.");
    },
  });

  if (reviewQuery.isLoading) {
    return <LoaderBlock label="Loading review package..." />;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return <LoaderBlock label="Review package is unavailable for this submission." />;
  }

  const resolvedReviewPackage = reviewQuery.data;
  const untrustedFields =
    (resolvedReviewPackage.validatedCandidate?.untrusted_fields as Record<string, unknown> | undefined) ?? {};
  const reasoning = (resolvedReviewPackage.reasoningOutput as Record<string, unknown> | null) ?? {};
  const verificationLabels = Object.keys(untrustedFields).map(sentenceLabel);
  const trustedCount = Object.keys(trustedFields).length;
  const untrustedCount = Object.keys(untrustedFields).length;
  const surveyNeeds = resolvedReviewPackage.surveyNeeds ?? [];
  const reviewPackage = resolvedReviewPackage;

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
  }, [reviewTargetId, reasoning]);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        eyebrow="AI Review"
        title={reviewPackage.document.fileName}
        description="Review the AI case summary, verify extracted fields, and record the final human decision before moving this case to matching."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!window.confirm(`Delete review package ${reviewPackage.document.fileName}?`)) {
                  return;
                }
                void deleteMutation.mutate();
              }}
              type="button"
              variant="danger"
            >
              Delete package
            </Button>
            <Link className="action-button-secondary" to="/pipeline">
              Back to pipeline
            </Link>
          </div>
        }
      />

      {feedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Panel className="min-w-0 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-white">
                {reviewPackage.sourceDocumentId ? "Original document" : "Submitted survey"}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {reviewPackage.sourceDocumentId
                  ? `Signed URL expires at ${formatDateTime(reviewPackage.document.readUrlExpiresAt)}`
                  : "This review package was created from a manually filled survey submission."}
              </p>
            </div>
            <StatusBadge tone={toneForStatus(reviewPackage.document.status)}>
              {reviewPackage.document.status}
            </StatusBadge>
          </div>

          <div className="h-[min(58vh,540px)] overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
            {reviewPackage.sourceDocumentId && reviewPackage.document.fileType.includes("pdf") ? (
              <iframe className="h-full w-full" src={reviewPackage.document.readUrl} title="Document preview" />
            ) : reviewPackage.sourceDocumentId ? (
              <img
                alt={reviewPackage.document.fileName}
                className="h-full w-full object-contain"
                src={reviewPackage.document.readUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm leading-6 text-on-surface-variant">
                Manual survey submissions do not have an uploaded document preview. This AI review is based on the survey responses and generated needs.
              </div>
            )}
          </div>
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel className="min-w-0 space-y-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xl font-black text-white">AI assessment report</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Readable case summary generated by AI from the survey and attached document.
                </p>
              </div>
              <StatusBadge tone={toneForUrgency(reasoning.urgency_label)}>
                {String(reasoning.urgency_label ?? "not rated")}
              </StatusBadge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ReviewMetric label="Validated fields" value={`${trustedCount} trusted / ${untrustedCount} flagged`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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
          </Panel>

          <Panel className="min-w-0 space-y-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xl font-black text-white">Validated candidate</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  AI extracted fields separated by confidence so the admin can quickly review them.
                </p>
              </div>
              <StatusBadge tone="success">Human review required</StatusBadge>
            </div>

            <TrustedFieldGroup fields={trustedFields} />
            <VerificationFieldGroup labels={verificationLabels} />
          </Panel>

          <Panel className="min-w-0 space-y-4 overflow-hidden">
            <div>
              <p className="text-xl font-black text-white">AI-defined needs</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                These needs were generated from the submitted survey and will be used for volunteer matching.
              </p>
            </div>

            {surveyNeeds.length === 0 ? (
              <p className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                No needs have been generated for this survey yet.
              </p>
            ) : (
              <div className="space-y-3">
                {surveyNeeds.map((need) => (
                  <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-4" key={need.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{need.summary}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {sentenceLabel(need.category)}
                          {need.locationText ? ` • ${need.locationText}` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={toneForStatus(need.priorityLevel)}>{need.priorityLevel}</StatusBadge>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <ReviewMetric label="Urgency" value={`${need.urgencyScore}`} />
                      <ReviewMetric label="Status" value={sentenceLabel(need.status)} />
                      <ReviewMetric label="Skills" value={`${need.skills.length}`} />
                    </div>

                    {need.skills.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {need.skills.map((skill) => (
                          <span
                            className="rounded-md border border-outline-variant px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-on-surface-variant"
                            key={skill.skillId}
                          >
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="min-w-0 space-y-4 overflow-hidden">
            <p className="text-xl font-black text-white">Submit human review</p>
            <div className="grid gap-4">
              <div className="space-y-2">
                <p className="label-caps">Decision</p>
                <Select value={reviewAction} onChange={(event) => setReviewAction(event.target.value)}>
                  <option value="approved">Approved</option>
                  <option value="edited">Edited</option>
                  <option value="rejected">Rejected</option>
                  <option value="requested_reextraction">Re-extraction</option>
                </Select>
              </div>
              {/* <div className="space-y-2">
                <p className="label-caps">Field corrections JSON</p>
                <Textarea
                  placeholder='Optional JSON object, e.g. {"priority_level":"high"}'
                  value={correctionsText}
                  onChange={(event) => setCorrectionsText(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="label-caps">Approved fields JSON</p>
                <Textarea
                  placeholder="Optional approved field object"
                  value={approvedFieldsText}
                  onChange={(event) => setApprovedFieldsText(event.target.value)}
                />
              </div> */}
              <div className="space-y-2">
                <p className="label-caps">Reviewer notes</p>
                <Textarea
                  placeholder="Reviewer notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                />
              </div>
              <Button
                className="w-full sm:w-fit"
                disabled={submitReviewMutation.isPending}
                onClick={() => void submitReviewMutation.mutate()}
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit human review"}
              </Button>
              {reviewPackage.sourceSurveyId ? (
                <Link
                  className="action-button-secondary w-full justify-center sm:w-fit"
                  to={`/matching?surveyId=${reviewPackage.sourceSurveyId}`}
                >
                  Open matching
                </Link>
              ) : null}
            </div>
          </Panel>

          {/* <Panel className="min-w-0 space-y-4 overflow-hidden">
            <p className="text-xl font-black text-white">Draft form generation</p>
            <div className="space-y-2">
              <p className="label-caps">Form template name</p>
              <Input
                placeholder="Optional form template name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
              />
            </div>
            <Button
              disabled={createFormMutation.isPending}
              onClick={() => void createFormMutation.mutate()}
              variant="secondary"
            >
              {createFormMutation.isPending ? "Creating..." : "Create draft form"}
            </Button>
          </Panel> */}

          <Panel className="min-w-0 space-y-4 overflow-hidden">
            <p className="text-xl font-black text-white">Review history</p>
            {reviewPackage.humanReviews.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No human reviews have been submitted yet.</p>
            ) : (
              reviewPackage.humanReviews.map((review, index) => (
                <div
                  className="rounded-md border border-outline-variant bg-surface-container-low p-4"
                  key={`${review.reviewed_at as string}-${index}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-white">{String(review.review_action)}</p>
                    <p className="text-xs text-on-surface-variant">{formatDateTime(String(review.reviewed_at ?? ""))}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-on-surface-variant">
                    {String(review.review_notes ?? "No reviewer note")}
                  </p>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
