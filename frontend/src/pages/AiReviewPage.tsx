import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { ObjectView } from "@/components/ObjectView";
import { documentsApi, pipelineApi } from "@/lib/services";
import { toneForStatus } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

function parseJsonInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  return JSON.parse(value);
}

export function AiReviewIndexPage() {
  const documentsQuery = useQuery({
    queryKey: ["review-candidates"],
    queryFn: () => documentsApi.list({ page: 1, pageSize: 20 }),
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
      <div className="grid gap-4 xl:grid-cols-2">
        {documentsQuery.data?.items.map((document) => (
          <Panel className="space-y-3" key={document.id}>
            <p className="text-lg font-bold text-white">{document.fileName}</p>
            <StatusBadge tone={toneForStatus(document.status)}>{document.status}</StatusBadge>
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Review"
        title={reviewPackage.document.fileName}
        description="Inspect extracted fields, confidence layers, and human review history before routing the document into form generation."
        actions={
          <Link className="action-button-secondary" to="/pipeline">
            Back to pipeline
          </Link>
        }
      />

      {feedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">Original document</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Signed URL expires at {reviewPackage.document.readUrlExpiresAt}
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

          <ObjectView label="Canonical projection" value={reviewPackage.canonicalProjection} />
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-black text-white">Validated candidate</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Trusted and untrusted field partitions from the pipeline.
                </p>
              </div>
              <StatusBadge tone="success">Human review required</StatusBadge>
            </div>

            <ObjectView label="Trusted fields" value={trustedFields} />
            <ObjectView label="Untrusted fields" value={untrustedFields} />
            <ObjectView label="Reasoning output" value={reviewPackage.reasoningOutput} />
          </Panel>

          <Panel className="space-y-4">
            <p className="text-xl font-black text-white">Submit human review</p>
            <div className="grid gap-4">
              <Select value={reviewAction} onChange={(event) => setReviewAction(event.target.value)}>
                <option value="approved">approved</option>
                <option value="edited">edited</option>
                <option value="rejected">rejected</option>
                <option value="requested_reextraction">requested_reextraction</option>
              </Select>
              <Textarea
                placeholder='Optional JSON object, e.g. {"priority_level":"high"}'
                value={correctionsText}
                onChange={(event) => setCorrectionsText(event.target.value)}
              />
              <Textarea
                placeholder='Optional approved field object'
                value={approvedFieldsText}
                onChange={(event) => setApprovedFieldsText(event.target.value)}
              />
              <Textarea
                placeholder="Reviewer notes"
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
              />
              <Button
                disabled={submitReviewMutation.isPending}
                onClick={() => void submitReviewMutation.mutate()}
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit review"}
              </Button>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <p className="text-xl font-black text-white">Draft form generation</p>
            <Input
              placeholder="Optional form template name"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
            />
            <Button
              disabled={createFormMutation.isPending}
              onClick={() => void createFormMutation.mutate()}
              variant="secondary"
            >
              {createFormMutation.isPending ? "Creating..." : "Create draft form"}
            </Button>
          </Panel>

          <Panel className="space-y-4">
            <p className="text-xl font-black text-white">Review history</p>
            {reviewPackage.humanReviews.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No human reviews have been submitted yet.</p>
            ) : (
              reviewPackage.humanReviews.map((review, index) => (
                <div
                  className="rounded-md border border-outline-variant bg-surface-container-low p-4"
                  key={`${review.reviewed_at as string}-${index}`}
                >
                  <p className="font-semibold text-white">{String(review.review_action)}</p>
                  <p className="mt-2 text-xs leading-6 text-on-surface-variant">
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
