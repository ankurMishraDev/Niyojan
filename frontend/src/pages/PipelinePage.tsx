import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { documentsApi, pipelineApi, surveysApi } from "@/lib/services";
import { getApiErrorMessage } from "@/lib/api";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { Button, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";

export function PipelinePage() {
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [actionFeedback, setActionFeedback] = useState("");

  const intakeQuery = useQuery({
    queryKey: ["pipeline-intake"],
    queryFn: pipelineApi.intake,
  });

  const queueQuery = useQuery({
    queryKey: ["pipeline-queue"],
    queryFn: () => pipelineApi.queue(),
  });

  useEffect(() => {
    if ((!selectedSurveyId || !intakeQuery.data?.some((item) => item.surveyId === selectedSurveyId)) && intakeQuery.data?.[0]) {
      setSelectedSurveyId(intakeQuery.data[0].surveyId);
    }
  }, [intakeQuery.data, selectedSurveyId]);

  const selectedIntakeItem = useMemo(
    () => intakeQuery.data?.find((item) => item.surveyId === selectedSurveyId) ?? null,
    [intakeQuery.data, selectedSurveyId],
  );
  const selectedDocumentId = selectedIntakeItem?.sourceDocumentId ?? "";

  const statusQuery = useQuery({
    enabled: Boolean(selectedDocumentId),
    queryKey: ["pipeline-status", selectedDocumentId],
    queryFn: () => pipelineApi.status(selectedDocumentId),
  });

  const startPipelineMutation = useMutation({
    mutationFn: (documentId: string) => pipelineApi.start(documentId),
    onSuccess: async () => {
      setActionFeedback("Pipeline run completed. Check the backend terminal for stage-by-stage logs.");
      await statusQuery.refetch();
      await queueQuery.refetch();
      await intakeQuery.refetch();
    },
    onError: (error) => {
      setActionFeedback(`Pipeline start failed: ${getApiErrorMessage(error)}`);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess: async () => {
      setActionFeedback("Source document deleted from the selected survey.");
      await intakeQuery.refetch();
      await queueQuery.refetch();
    },
    onError: (error) => {
      setActionFeedback(`Document delete failed: ${getApiErrorMessage(error)}`);
    },
  });

  const deleteSurveyMutation = useMutation({
    mutationFn: (surveyId: string) => surveysApi.delete(surveyId),
    onSuccess: async () => {
      setActionFeedback("Survey and all associated data deleted.");
      setSelectedSurveyId("");
      await intakeQuery.refetch();
      await queueQuery.refetch();
    },
    onError: (error) => {
      setActionFeedback(`Survey delete failed: ${getApiErrorMessage(error)}`);
    },
  });

  const analyzeSurveyMutation = useMutation({
    mutationFn: (surveyId: string) => surveysApi.analyzeNeeds(surveyId),
    onSuccess: async (result) => {
      setActionFeedback(
        result.createdCount > 0
          ? `Survey pipeline completed and ${result.createdCount} need record(s) were created.`
          : "Survey pipeline was already completed. Existing needs were loaded.",
      );
      await intakeQuery.refetch();
    },
    onError: (error) => {
      setActionFeedback(`Survey analysis failed: ${getApiErrorMessage(error)}`);
    },
  });

  if (intakeQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading submitted survey intake…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow="Operation Pipeline"
        title="Submitted Case Pipeline"
        description="Starting the survey pipeline extracts the needs from the submitted survey responses."
      />

      {actionFeedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {actionFeedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel className="space-y-4 max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-card-medium">
          <div className="p-5 border-b border-hairline bg-canvas-soft">
            <p className="text-lg font-semibold tracking-tight text-ink">Submitted Survey Intake</p>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-canvas-soft-2 text-body border-b border-hairline sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 font-medium">Survey</th>
                  <th className="px-5 py-3 font-medium">Source document</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Submitted</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {intakeQuery.data?.map((item) => (
                  <tr
                    className={`cursor-pointer transition-colors ${
                      selectedSurveyId === item.surveyId ? "bg-canvas-soft shadow-sm" : "hover:bg-canvas-soft-2"
                    }`}
                    key={item.surveyId}
                    onClick={() => setSelectedSurveyId(item.surveyId)}
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-ink truncate max-w-[200px]">{item.respondentName || "Unnamed respondent"}</p>
                      <p className="mt-1 text-xs text-body truncate max-w-[200px]">{item.locationText || "No location"}</p>
                      <div className="mt-2.5">
                        <StatusBadge tone={toneForStatus(item.surveyStatus)}>{item.surveyStatus}</StatusBadge>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {item.sourceDocumentId ? (
                        <>
                          <p className="font-medium text-ink truncate max-w-[200px]">{item.sourceDocumentName}</p>
                          <p className="mt-1 font-mono text-[10px] text-mute uppercase">{item.sourceDocumentType}</p>
                          <div className="mt-2.5">
                            <StatusBadge tone={toneForStatus(item.sourceDocumentStatus || "uploaded")}>
                              {item.sourceDocumentStatus}
                            </StatusBadge>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-mute italic">No source document</p>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top text-body text-xs hidden md:table-cell">
                      {formatDateTime(item.submittedAt || item.createdAt)}
                    </td>
                    <td className="px-5 py-4 align-top text-right space-y-2">
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          className="px-2.5 py-1 text-[11px]"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await navigator.clipboard.writeText(item.surveyId);
                            setActionFeedback(`Survey ID copied: ${item.surveyId}`);
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Copy ID
                        </Button>
                        <div className="flex gap-2">
                          {item.sourceDocumentId ? (
                            <Button
                              className="px-2.5 py-1 text-[11px]"
                              disabled={deleteDocumentMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                const documentId = item.sourceDocumentId;
                                if (!documentId) return;
                                if (!window.confirm(`Delete ${item.sourceDocumentName} from this survey?`)) return;
                                void deleteDocumentMutation.mutate(documentId);
                              }}
                              type="button"
                              variant="danger"
                            >
                              Del Doc
                            </Button>
                          ) : null}
                          <Button
                            className="px-2.5 py-1 text-[11px]"
                            disabled={deleteSurveyMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!window.confirm("Delete this entire survey?")) return;
                              void deleteSurveyMutation.mutate(item.surveyId);
                            }}
                            type="button"
                            variant="danger"
                          >
                            Del Survey
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {intakeQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-body">
                      No surveys in the pipeline intake.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
          <Panel className="space-y-5 bg-canvas-soft">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-hairline">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">Selected Survey</p>
                <p className="mt-1 text-sm text-body leading-relaxed max-w-sm">
                  Start the review flow for the selected submission. Document-backed surveys use the document pipeline, while manual surveys go straight into survey analysis.
                </p>
              </div>
              {selectedIntakeItem ? (
                <Button
                  className="w-full sm:w-auto shrink-0"
                  disabled={analyzeSurveyMutation.isPending || startPipelineMutation.isPending}
                  onClick={() => {
                    setActionFeedback("");
                    if (selectedDocumentId) {
                      void startPipelineMutation.mutate(selectedDocumentId);
                      return;
                    }
                    void analyzeSurveyMutation.mutate(selectedIntakeItem.surveyId);
                  }}
                  type="button"
                >
                  {analyzeSurveyMutation.isPending || startPipelineMutation.isPending
                    ? "Starting…"
                    : selectedDocumentId
                      ? "Start Doc Pipeline"
                      : "Start Survey Pipeline"}
                </Button>
              ) : null}
            </div>

            {selectedIntakeItem ? (
              <div className="space-y-4">
                <div className="rounded-md border border-hairline bg-canvas p-4 shadow-sm">
                  <p className="font-semibold text-ink">{selectedIntakeItem.respondentName || "Unnamed respondent"}</p>
                  <p className="mt-1 text-sm text-body">{selectedIntakeItem.locationText || "No location"}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-hairline">
                    <StatusBadge tone={toneForStatus(selectedIntakeItem.surveyStatus)}>
                      {selectedIntakeItem.surveyStatus}
                    </StatusBadge>
                    <span className="text-xs font-mono text-mute">
                      Submitted {formatDateTime(selectedIntakeItem.submittedAt || selectedIntakeItem.createdAt)}
                    </span>
                  </div>
                </div>

                {selectedDocumentId ? (
                  <div className="rounded-md border border-hairline bg-canvas p-4 shadow-sm space-y-4">
                    <div>
                      <p className="label-caps mb-1.5">Source Document</p>
                      <p className="font-medium text-ink truncate">{selectedIntakeItem.sourceDocumentName}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <StatusBadge tone={toneForStatus(selectedIntakeItem.sourceDocumentStatus || "uploaded")}>
                          {selectedIntakeItem.sourceDocumentStatus}
                        </StatusBadge>
                        <span className="text-[11px] font-mono text-mute">
                          {selectedIntakeItem.sourceDocumentCreatedAt
                            ? formatDateTime(selectedIntakeItem.sourceDocumentCreatedAt)
                            : "No upload date"}
                        </span>
                      </div>
                    </div>

                    {statusQuery.data ? (
                      <div className="space-y-3 pt-4 border-t border-hairline">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-body font-medium">Current stage</span>
                          <span className="font-semibold text-ink">{statusQuery.data.manifest.currentStage}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-body font-medium">Pipeline status</span>
                          <StatusBadge tone={toneForStatus(statusQuery.data.manifest.pipelineStatus)}>
                            {statusQuery.data.manifest.pipelineStatus}
                          </StatusBadge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-body font-medium">Last job</span>
                          <span className="font-mono text-xs text-ink truncate max-w-[200px] text-right">
                            {statusQuery.data.job?.type ?? "No job recorded"}
                          </span>
                        </div>
                        <div className="pt-3">
                          <Link className="action-button-secondary w-full text-center" to={`/ai-review/${selectedDocumentId}`}>
                            Open AI Review
                          </Link>
                        </div>
                      </div>
                    ) : statusQuery.isError ? (
                      <div className="pt-4 border-t border-hairline text-sm text-danger bg-danger/5 p-3 rounded mt-2">
                        {getApiErrorMessage(statusQuery.error).includes("Pipeline manifest not found")
                          ? "No pipeline manifest has been created for this survey document yet."
                          : getApiErrorMessage(statusQuery.error)}
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-hairline text-sm text-mute flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-hairline border-t-ink animate-spin" />
                        Loading pipeline status…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-hairline border-dashed bg-canvas p-5 space-y-4">
                    <p className="text-sm leading-relaxed text-body">
                      This survey has no source document attached, but the same pipeline and AI review flow still works from the submitted responses.
                    </p>
                    {selectedIntakeItem.surveyStatus === "analyzed" ? (
                      <Link className="action-button-secondary w-full text-center" to={`/ai-review/surveys/${selectedIntakeItem.surveyId}`}>
                        Open AI Review
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-center text-sm text-mute border-2 border-dashed border-hairline rounded-md">
                Select a submitted survey from the intake table to inspect status and actions.
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-lg font-semibold tracking-tight text-ink">Pipeline Queue</p>
              <p className="mt-1 text-sm text-body">
                Manifest-level overview across current document review pipeline runs.
              </p>
            </div>
            <div className="space-y-3">
              {queueQuery.data?.map((item) => (
                <div
                  className="rounded-md border border-hairline bg-canvas-soft-2 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-hairline-strong"
                  key={item.id}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate text-sm">{item.fileName}</p>
                    <p className="mt-1 font-mono text-[10px] text-mute truncate">
                      {item.currentStage} • {formatDateTime(item.startedAt)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge tone={toneForStatus(item.pipelineStatus)}>
                      {item.pipelineStatus}
                    </StatusBadge>
                  </div>
                </div>
              ))}
              {queueQuery.data?.length === 0 && (
                <p className="text-sm text-mute text-center py-4 border border-dashed border-hairline rounded">
                  No active items in pipeline queue.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
