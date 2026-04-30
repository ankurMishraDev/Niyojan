import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { formatDateTime, formatPercent, sentence, toneForStatus } from "@/lib/format";
import { documentsApi, pipelineApi } from "@/lib/services";

function parseJsonInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  return JSON.parse(value);
}

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

function normalizeReason(item: string) {
  const lower = item.toLowerCase();

  if (lower.includes("fallback reasoning generated from extracted field density")) {
    return "The system estimated urgency from the amount of case information captured because a fuller AI explanation was not available.";
  }

  if (lower.includes("fallback reasoning used due to unavailable or invalid model output")) {
    return "This case needs manual verification because the AI could not produce a complete reasoning response.";
  }

  return item;
}

function isCrypticEvidenceReference(item: string) {
  return /^p\d+:b\d+$/i.test(item.trim());
}

function buildEvidenceList(items: string[], fieldLabels: string[]) {
  const readableItems = items.filter((item) => !isCrypticEvidenceReference(item));
  if (readableItems.length > 0) {
    return readableItems;
  }

  if (fieldLabels.length > 0) {
    return [
      `The intake includes these reported details: ${fieldLabels.slice(0, 4).join(", ")}.`,
    ];
  }

  return [];
}

function buildSummary(
  reasoning: Record<string, unknown>,
  trustedFields: Record<string, unknown>,
  untrustedFields: Record<string, unknown>,
) {
  const storedSummary = String(reasoning.case_summary ?? "").trim();
  if (storedSummary) {
    return storedSummary;
  }

  const category = String(reasoning.need_category ?? "case support").replace(/_/g, " ").trim();
  const urgency = String(reasoning.urgency_label ?? "under review").replace(/_/g, " ").trim();
  const labels = [...Object.keys(trustedFields), ...Object.keys(untrustedFields)]
    .map(sentenceLabel)
    .slice(0, 4);

  if (labels.length > 0) {
    return `This intake appears to be about ${category} and includes details about ${labels.join(", ")}. It is currently marked ${urgency} priority and should be reviewed by an admin.`;
  }

  return `This intake appears to be about ${category}. It is currently marked ${urgency} priority and should be reviewed by an admin.`;
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function ReviewList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
      <p className="label-caps">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface">
          {items.map((item, index) => (
            <li
              className="break-words rounded-md border border-outline-variant/60 bg-surface-container-lowest px-3 py-2"
              key={`${title}-${index}`}
            >
              {item}
            </li>
          ))}
        </ul>
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

  const documentsQuery = useQuery({
    queryKey: ["review-candidates"],
    queryFn: () => documentsApi.list({ page: 1, pageSize: 20 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess: async () => {
      setFeedback("Review package deleted.");
      await documentsQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  if (documentsQuery.isLoading) {
    return <LoaderBlock label="Loading review candidates..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Review"
        title="Select a review package"
        description="Review packages are attached to documents that have pipeline artifacts available."
      />

      {feedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {documentsQuery.data?.items.map((document) => (
          <Panel className="space-y-3" key={document.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">{document.fileName}</p>
                <StatusBadge tone={toneForStatus(document.status)}>{document.status}</StatusBadge>
              </div>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete review package ${document.fileName}?`)) {
                    return;
                  }
                  void deleteMutation.mutate(document.id);
                }}
                type="button"
                variant="danger"
              >
                Delete
              </Button>
            </div>
            <Link className="action-button-secondary" to={`/ai-review/${document.id}`}>
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
  const { documentId = "" } = useParams();
  const [reviewAction, setReviewAction] = useState("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [correctionsText, setCorrectionsText] = useState("");
  const [approvedFieldsText, setApprovedFieldsText] = useState("");
  const [formName, setFormName] = useState("");
  const [feedback, setFeedback] = useState("");

  const reviewQuery = useQuery({
    queryKey: ["review-package", documentId],
    queryFn: () => pipelineApi.reviewPackage(documentId),
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () =>
      pipelineApi.submitReview(documentId, {
        review_action: reviewAction,
        review_notes: reviewNotes || undefined,
        field_corrections: parseJsonInput(correctionsText),
        approved_fields: parseJsonInput(approvedFieldsText),
      }),
    onSuccess: async () => {
      setFeedback("Review submitted.");
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Review submission failed.");
    },
  });

  const createFormMutation = useMutation({
    mutationFn: () => pipelineApi.createForm(documentId, { name: formName || undefined }),
    onSuccess: async () => {
      setFeedback("Draft form created from approved review.");
      await reviewQuery.refetch();
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Draft form creation failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(documentId),
    onSuccess: async () => {
      navigate("/ai-review");
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  if (reviewQuery.isLoading) {
    return <LoaderBlock label="Loading review package..." />;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return <LoaderBlock label="Review package is unavailable for this document." />;
  }

  const reviewPackage = reviewQuery.data;
  const trustedFields =
    (reviewPackage.validatedCandidate?.trusted_fields as Record<string, unknown> | undefined) ?? {};
  const untrustedFields =
    (reviewPackage.validatedCandidate?.untrusted_fields as Record<string, unknown> | undefined) ?? {};
  const reasoning = (reviewPackage.reasoningOutput as Record<string, unknown> | null) ?? {};
  const verificationLabels = Object.keys(untrustedFields).map(sentenceLabel);
  const allFieldLabels = [...Object.keys(trustedFields), ...Object.keys(untrustedFields)].map(sentenceLabel);
  const urgencyReasons = stringList(reasoning.urgency_reasons).map(normalizeReason);
  const urgencyEvidence = buildEvidenceList(stringList(reasoning.urgency_evidence_refs), allFieldLabels);
  const recommendedSkills = stringList(reasoning.recommended_skill_keys);
  const verificationRiskReasons = stringList(reasoning.verification_risk_reasons).map(normalizeReason);
  const confidence =
    typeof reasoning.reasoning_confidence === "number"
      ? formatPercent(reasoning.reasoning_confidence, 0)
      : "Not available";
  const urgencyScore =
    typeof reasoning.urgency_score === "number" ? `${reasoning.urgency_score}/100` : "Not available";
  const trustedCount = Object.keys(trustedFields).length;
  const untrustedCount = Object.keys(untrustedFields).length;
  const summary = buildSummary(reasoning, trustedFields, untrustedFields);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        eyebrow="AI Review"
        title={reviewPackage.document.fileName}
        description="Review the AI case summary, verify extracted fields, and record the final human decision before form generation."
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
              <p className="text-xl font-black text-white">Original document</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Signed URL expires at {formatDateTime(reviewPackage.document.readUrlExpiresAt)}
              </p>
            </div>
            <StatusBadge tone={toneForStatus(reviewPackage.document.status)}>
              {reviewPackage.document.status}
            </StatusBadge>
          </div>

          <div className="h-[min(58vh,540px)] overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
            {reviewPackage.document.fileType.includes("pdf") ? (
              <iframe className="h-full w-full" src={reviewPackage.document.readUrl} title="Document preview" />
            ) : (
              <img
                alt={reviewPackage.document.fileName}
                className="h-full w-full object-contain"
                src={reviewPackage.document.readUrl}
              />
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

            <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
              <p className="label-caps">Case summary</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">{summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ReviewMetric label="Urgency score" value={urgencyScore} />
              <ReviewMetric label="Need category" value={displayValue(reasoning.need_category)} />
              <ReviewMetric label="Need subcategory" value={displayValue(reasoning.need_subcategory)} />
              <ReviewMetric label="Verification risk" value={displayValue(reasoning.verification_risk)} />
              <ReviewMetric label="Confidence" value={confidence} />
              <ReviewMetric label="Validated fields" value={`${trustedCount} trusted / ${untrustedCount} flagged`} />
            </div>

            <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
              <p className="label-caps">Recommended action</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface">
                {displayValue(reasoning.recommended_action)}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ReviewList
                emptyMessage="AI did not provide urgency reasons."
                items={urgencyReasons}
                title="Why AI marked this urgency"
              />
              <ReviewList
                emptyMessage="AI did not provide readable evidence from the intake."
                items={urgencyEvidence}
                title="Evidence from the intake"
              />
              <ReviewList
                emptyMessage="No skill recommendations were provided."
                items={recommendedSkills.map(sentenceLabel)}
                title="Recommended skills"
              />
              <ReviewList
                emptyMessage="No verification concerns were noted."
                items={verificationRiskReasons}
                title="Why this case still needs verification"
              />
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
