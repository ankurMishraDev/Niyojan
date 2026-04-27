import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { documentsApi, pipelineApi } from "@/lib/services";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { Button, Input, LoaderBlock, PageHeader, Panel, StatusBadge } from "@/components/ui";

export function PipelinePage() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list({ page: 1, pageSize: 25 }),
  });

  const queueQuery = useQuery({
    queryKey: ["pipeline-queue"],
    queryFn: () => pipelineApi.queue(),
  });

  useEffect(() => {
    if (!selectedDocumentId && documentsQuery.data?.items[0]) {
      setSelectedDocumentId(documentsQuery.data.items[0].id);
    }
  }, [documentsQuery.data, selectedDocumentId]);

  const statusQuery = useQuery({
    enabled: Boolean(selectedDocumentId),
    queryKey: ["pipeline-status", selectedDocumentId],
    queryFn: () => pipelineApi.status(selectedDocumentId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: { file: File; fileName: string }) => {
      const signed = await documentsApi.uploadUrl({
        file_name: payload.fileName,
        file_type: payload.file.type || "application/octet-stream",
      });

      await api.uploadToSignedUrl(signed.uploadUrl, payload.file, signed.requiredHeaders);

      return documentsApi.create({
        file_name: payload.fileName,
        file_type: payload.file.type || "application/octet-stream",
        gcs_path: signed.gcsPath,
      });
    },
    onSuccess: async (document) => {
      setUploadError("");
      setSelectedDocumentId(document.id);
      setFile(null);
      await documentsQuery.refetch();
      await queueQuery.refetch();
    },
    onError: (error) => {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    },
  });

  const startPipelineMutation = useMutation({
    mutationFn: (documentId: string) => pipelineApi.start(documentId),
    onSuccess: async () => {
      await statusQuery.refetch();
      await queueQuery.refetch();
      await documentsQuery.refetch();
    },
  });

  const selectedDocument = documentsQuery.data?.items.find((item) => item.id === selectedDocumentId);

  if (documentsQuery.isLoading) {
    return <LoaderBlock label="Loading document workbench..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operation Pipeline"
        title="Document Pipeline"
        description="Upload source documents, track orchestration state, and route ready items into human review and form generation."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">Document intake</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Signed upload followed by backend document registration.
              </p>
            </div>
          </div>

          <form
            className="grid gap-4 md:grid-cols-[1fr_auto]"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (!file) {
                setUploadError("Choose a file before upload.");
                return;
              }

              void uploadMutation.mutate({
                file,
                fileName: file.name,
              });
            }}
          >
            <Input
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <Button disabled={!file || uploadMutation.isPending} type="submit">
              {uploadMutation.isPending ? "Uploading..." : "Upload document"}
            </Button>
          </form>
          {uploadError ? (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
              {uploadError}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-outline-variant">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {documentsQuery.data?.items.map((document) => (
                  <tr
                    className={`cursor-pointer border-t border-outline-variant/60 ${
                      selectedDocumentId === document.id ? "bg-primary/10" : "hover:bg-surface-container-low"
                    }`}
                    key={document.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{document.fileName}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{document.fileType}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge tone={toneForStatus(document.status)}>{document.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-on-surface-variant">
                      {formatDateTime(document.createdAt)}
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
                <p className="text-xl font-black text-white">Selected document</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Start the 10-stage scaffold or jump directly into review if artifacts exist.
                </p>
              </div>
              {selectedDocument ? (
                <Button
                  disabled={startPipelineMutation.isPending}
                  onClick={() => void startPipelineMutation.mutate(selectedDocument.id)}
                >
                  {startPipelineMutation.isPending ? "Starting..." : "Start pipeline"}
                </Button>
              ) : null}
            </div>

            {selectedDocument ? (
              <>
                <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-semibold text-white">{selectedDocument.fileName}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <StatusBadge tone={toneForStatus(selectedDocument.status)}>
                      {selectedDocument.status}
                    </StatusBadge>
                    <span className="text-xs text-on-surface-variant">
                      {formatDateTime(selectedDocument.createdAt)}
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
                      <Link
                        className="action-button-secondary"
                        to={`/ai-review/${selectedDocument.id}`}
                      >
                        Open AI review
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    No manifest has been created for this document yet.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Select a document from the intake table to inspect status and actions.
              </p>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="text-xl font-black text-white">Pipeline queue</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manifest-level overview across current documents.
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
