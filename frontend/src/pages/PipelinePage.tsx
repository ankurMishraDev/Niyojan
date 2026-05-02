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
    return <LoaderBlock label="Loading submitted survey intake..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operation Pipeline"
        title="Submitted Case Pipeline"
        description="Starting the survey pipeline extracts the needs from the submitted survey responses."
      />

      {actionFeedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {actionFeedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-5">
          <div>
            <p className="text-xl font-black text-white">Submitted survey intake</p>
            {/* <p className="mt-1 text-sm text-on-surface-variant">
              Intake is driven by submitted surveys, not raw uploads. Manual and document-backed submissions both appear here.
            </p> */}
          </div>

          <div className="overflow-hidden rounded-md border border-outline-variant">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Survey</th>
                  <th className="px-4 py-3">Source document</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Survey ID</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {intakeQuery.data?.map((item) => (
                  <tr
                    className={`cursor-pointer border-t border-outline-variant/60 ${
                      selectedSurveyId === item.surveyId ? "bg-primary/10" : "hover:bg-surface-container-low"
                    }`}
                    key={item.surveyId}
                    onClick={() => setSelectedSurveyId(item.surveyId)}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">{item.respondentName || "Unnamed respondent"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.locationText || "No location"}</p>
                      <div className="mt-2">
                        <StatusBadge tone={toneForStatus(item.surveyStatus)}>{item.surveyStatus}</StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {item.sourceDocumentId ? (
                        <>
                          <p className="font-semibold text-white">{item.sourceDocumentName}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.sourceDocumentType}</p>
                          <div className="mt-2">
                            <StatusBadge tone={toneForStatus(item.sourceDocumentStatus || "uploaded")}>
                              {item.sourceDocumentStatus}
                            </StatusBadge>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-on-surface-variant">No source document attached</p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-on-surface-variant">
                      {formatDateTime(item.submittedAt || item.createdAt)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-on-surface-variant">{item.surveyId}</span>
                        <Button
                          className="px-2 py-1 text-xs"
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
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {item.sourceDocumentId ? (
                        <Button
                          disabled={deleteDocumentMutation.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            const documentId = item.sourceDocumentId;
                            if (!documentId) {
                              return;
                            }

                            if (!window.confirm(`Delete ${item.sourceDocumentName} from this survey?`)) {
                              return;
                            }

                            void deleteDocumentMutation.mutate(documentId);
                          }}
                          type="button"
                          variant="danger"
                        >
                          Delete doc
                        </Button>
                      ) : null}
                      <Button
                        className="ml-2"
                        disabled={deleteSurveyMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!window.confirm("Delete this entire survey?")) {
                            return;
                          }
                          void deleteSurveyMutation.mutate(item.surveyId);
                        }}
                        type="button"
                        variant="danger"
                      >
                        Delete survey
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-black text-white">Selected survey</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Start the survey pipeline to generate operational needs. If a source document exists, you can also run the document review pipeline.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {selectedIntakeItem ? (
                  <Button
                    disabled={analyzeSurveyMutation.isPending}
                    onClick={() => {
                      setActionFeedback("");
                      void analyzeSurveyMutation.mutate(selectedIntakeItem.surveyId);
                    }}
                    type="button"
                  >
                    {analyzeSurveyMutation.isPending ? "Starting..." : "Start pipeline"}
                  </Button>
                ) : null}
                {selectedDocumentId ? (
                  <Button
                    disabled={startPipelineMutation.isPending}
                    onClick={() => {
                      setActionFeedback("");
                      void startPipelineMutation.mutate(selectedDocumentId);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {startPipelineMutation.isPending ? "Starting..." : "Start document pipeline"}
                  </Button>
                ) : null}
              </div>
            </div>

            {selectedIntakeItem ? (
              <>
                <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-semibold text-white">{selectedIntakeItem.respondentName || "Unnamed respondent"}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{selectedIntakeItem.locationText || "No location"}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <StatusBadge tone={toneForStatus(selectedIntakeItem.surveyStatus)}>
                      {selectedIntakeItem.surveyStatus}
                    </StatusBadge>
                    <span className="text-xs text-on-surface-variant">
                      Submitted {formatDateTime(selectedIntakeItem.submittedAt || selectedIntakeItem.createdAt)}
                    </span>
                  </div>
                </div>

                {selectedDocumentId ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                      <p className="font-semibold text-white">{selectedIntakeItem.sourceDocumentName}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <StatusBadge tone={toneForStatus(selectedIntakeItem.sourceDocumentStatus || "uploaded")}>
                          {selectedIntakeItem.sourceDocumentStatus}
                        </StatusBadge>
                        <span className="text-xs text-on-surface-variant">
                          {selectedIntakeItem.sourceDocumentCreatedAt
                            ? formatDateTime(selectedIntakeItem.sourceDocumentCreatedAt)
                            : "No upload date"}
                        </span>
                      </div>
                    </div>

                    {statusQuery.data ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-on-surface-variant">Current stage</span>
                          <span className="font-semibold text-white">
                            {statusQuery.data.manifest.currentStage}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-on-surface-variant">Pipeline status</span>
                          <StatusBadge tone={toneForStatus(statusQuery.data.manifest.pipelineStatus)}>
                            {statusQuery.data.manifest.pipelineStatus}
                          </StatusBadge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-on-surface-variant">Last job</span>
                          <span className="text-sm text-white">
                            {statusQuery.data.job?.type ?? "No job recorded"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-3">
                          <Link className="action-button-secondary" to={`/ai-review/${selectedDocumentId}`}>
                            Open AI review
                          </Link>
                        </div>
                      </div>
                    ) : statusQuery.isError ? (
                      <p className="text-sm text-on-surface-variant">
                        {getApiErrorMessage(statusQuery.error).includes("Pipeline manifest not found")
                          ? "No pipeline manifest has been created for this survey document yet."
                          : getApiErrorMessage(statusQuery.error)}
                      </p>
                    ) : (
                      <p className="text-sm text-on-surface-variant">Loading pipeline status...</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-on-surface-variant">
                      This survey has no source document attached, but the same pipeline and AI review flow still works from the submitted responses.
                    </p>
                    {selectedIntakeItem.surveyStatus === "analyzed" ? (
                      <Link className="action-button-secondary" to={`/ai-review/surveys/${selectedIntakeItem.surveyId}`}>
                        Open AI review
                      </Link>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Select a submitted survey from the intake table to inspect status and actions.
              </p>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-xl font-black text-white">Pipeline queue</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manifest-level overview across current document review pipeline runs.
              </p>
            </div>
            <div className="space-y-3">
              {queueQuery.data?.map((item) => (
                <div
                  className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.fileName}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {item.currentStage} - {formatDateTime(item.startedAt)}
                      </p>
                    </div>
                    <StatusBadge tone={toneForStatus(item.pipelineStatus)}>
                      {item.pipelineStatus}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
