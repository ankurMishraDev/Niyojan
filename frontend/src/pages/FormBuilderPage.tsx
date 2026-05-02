import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Input, LoaderBlock, Panel, Select, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, toneForStatus } from "@/lib/format";
import { documentsApi, fieldCatalogApi, formsApi } from "@/lib/services";

type Mode = "gallery" | "editor";
type ScanStage = "idle" | "requesting_upload" | "uploading" | "extracting" | "generating" | "completed" | "failed";
type FieldLayout = { section: string; group: string; subgroup: string };
type FieldItem = {
  id: string;
  label: string;
  inputType: string;
  isRequired: boolean;
  displayOrder: number;
  isCustom: boolean;
};
type Checkpoint = {
  id: string;
  section: string;
  group: string;
  subgroup: string;
  start: number;
  end: number;
  fields: FieldItem[];
};

const DEFAULT_SECTION = "General";
const DEFAULT_GROUP = "Main Group";
const DEFAULT_SUBGROUP = "Main Fields";
const CHECKPOINT_SIZE = 6;
const FIELD_TYPES = ["text", "number", "boolean", "textarea", "select", "multiselect", "date"] as const;

export function FormBuilderPage() {
  const [mode, setMode] = useState<Mode>("gallery");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [scanStage, setScanStage] = useState<ScanStage>("idle");
  const [layoutMap, setLayoutMap] = useState<Record<string, FieldLayout>>({});
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [modalSection, setModalSection] = useState(DEFAULT_SECTION);
  const [modalGroup, setModalGroup] = useState(DEFAULT_GROUP);
  const [modalSubgroup, setModalSubgroup] = useState(DEFAULT_SUBGROUP);
  const [modalRequired, setModalRequired] = useState(false);
  const [modalDisplayOrder, setModalDisplayOrder] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(catalogSearch);

  const templatesQuery = useQuery({
    queryKey: ["form-templates"],
    queryFn: () => formsApi.listTemplates({ page: 1, pageSize: 25 }),
  });

  const versionsQuery = useQuery({
    enabled: Boolean(selectedTemplateId),
    queryKey: ["form-template-versions", selectedTemplateId],
    queryFn: () => formsApi.listVersions(selectedTemplateId),
  });

  useEffect(() => {
    if (!selectedVersionId && versionsQuery.data?.[0] && mode === "editor") {
      setSelectedVersionId(versionsQuery.data[0].id);
    }
  }, [mode, selectedVersionId, versionsQuery.data]);

  const versionQuery = useQuery({
    enabled: Boolean(selectedVersionId),
    queryKey: ["form-template-version", selectedVersionId],
    queryFn: () => formsApi.getVersion(selectedVersionId),
  });

  const catalogQuery = useQuery({
    queryKey: ["field-catalog", deferredSearch],
    queryFn: () =>
      fieldCatalogApi.list({
        page: 1,
        pageSize: 50,
        search: deferredSearch || undefined,
      }),
  });

  useEffect(() => {
    if (!selectedVersionId) {
      setLayoutMap({});
      return;
    }
    const stored = window.localStorage.getItem(`niyojan.form-layout.${selectedVersionId}`);
    setLayoutMap(stored ? (JSON.parse(stored) as Record<string, FieldLayout>) : {});
  }, [selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId) {
      window.localStorage.setItem(`niyojan.form-layout.${selectedVersionId}`, JSON.stringify(layoutMap));
    }
  }, [layoutMap, selectedVersionId]);

  const refreshAll = async () => {
    await Promise.all([templatesQuery.refetch(), versionsQuery.refetch(), versionQuery.refetch()]);
  };

  const openTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedVersionId("");
    setCheckpointIndex(0);
    setMode("editor");
  };

  const createTemplateMutation = useMutation({
    mutationFn: (name: string) => formsApi.createTemplate({ name }),
    onSuccess: async (template) => {
      setSelectedTemplateId(template.id);
      setSelectedVersionId("");
      setCheckpointIndex(0);
      setNewTemplateName("");
      setFeedback("New draft created.");
      setMode("editor");
      await refreshAll();
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: () => formsApi.createVersion(selectedTemplateId, {}),
    onSuccess: async (version) => {
      setSelectedVersionId(version.id);
      setCheckpointIndex(0);
      setFeedback("New draft version created.");
      await refreshAll();
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: () =>
      formsApi.addField(selectedVersionId, {
        field_catalog_id: selectedCatalogId || undefined,
        label: selectedCatalogId ? undefined : newFieldLabel,
        input_type: selectedCatalogId ? undefined : newFieldType,
        is_required: modalRequired,
        display_order: modalDisplayOrder,
      }),
    onSuccess: async (field) => {
      setFeedback("Field added to the draft.");
      setNewFieldLabel("");
      setSelectedCatalogId("");
      setIsAddFieldModalOpen(false);
      await versionQuery.refetch();
      setLayoutMap((current) => ({
        ...current,
        [field.id]: current[field.id] ?? {
          section: modalSection || DEFAULT_SECTION,
          group: modalGroup || DEFAULT_GROUP,
          subgroup: modalSubgroup || DEFAULT_SUBGROUP,
        },
      }));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => formsApi.publishVersion(selectedVersionId),
    onSuccess: async () => {
      setFeedback("Version published.");
      await refreshAll();
    },
  });

  const scanDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      setScanStage("requesting_upload");
      setFeedback("Uploading document...");
      const signed = await documentsApi.uploadUrl({ file_name: file.name, file_type: file.type });
      setScanStage("uploading");
      await api.uploadToSignedUrl(signed.uploadUrl, file, signed.requiredHeaders);
      const doc = await documentsApi.create({
        file_name: file.name,
        file_type: file.type,
        gcs_path: signed.gcsPath,
      });
      setScanStage("extracting");
      setFeedback("Scanning and extracting structure...");
      await documentsApi.extract(doc.id);
      let currentDoc = doc;
      while (currentDoc.status === "processing" || currentDoc.status === "uploaded") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        currentDoc = await documentsApi.get(doc.id);
      }
      if (currentDoc.status === "failed") throw new Error("Document extraction failed");
      setScanStage("generating");
      setFeedback("Creating draft...");
      return formsApi.createFromDocument(doc.id, {
        name: `${file.name.replace(/\.[^/.]+$/, "")} Template`,
      });
    },
    onSuccess: async (result) => {
      setScanStage("completed");
      setFeedback("Draft created from the scanned document.");
      setSelectedTemplateId(result.template.id);
      setSelectedVersionId(result.version.id);
      setCheckpointIndex(0);
      setMode("editor");
      await refreshAll();
      window.setTimeout(() => setScanStage("idle"), 1800);
    },
    onError: (error: Error) => {
      setScanStage("failed");
      setFeedback(`Could not create a draft from the document: ${error.message}`);
    },
  });

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void scanDocumentMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (templatesQuery.isLoading) {
    return <LoaderBlock label="Loading form builder..." />;
  }

  const renameTemplate = async () => {
    if (!selectedTemplateId) {
      return;
    }

    const currentName =
      templatesQuery.data?.items.find((template) => template.id === selectedTemplateId)?.name ?? "";
    const nextName = prompt("Enter template name:", currentName);
    if (!nextName?.trim()) {
      return;
    }

    await formsApi.updateTemplate(selectedTemplateId, { name: nextName.trim() });
    setFeedback("Template name updated.");
    await refreshAll();
  };

  const deleteSelectedTemplate = async () => {
    if (!selectedTemplateId) {
      return;
    }

    if (!window.confirm("Delete this template and all its versions?")) {
      return;
    }

    await formsApi.deleteTemplate(selectedTemplateId);
    setFeedback("Template deleted.");
    setSelectedTemplateId("");
    setSelectedVersionId("");
    await refreshAll();
  };

  const deleteSelectedVersion = async () => {
    if (!selectedVersionId) {
      return;
    }

    if (!window.confirm("Delete this version?")) {
      return;
    }

    await formsApi.deleteVersion(selectedVersionId);
    setFeedback("Version deleted.");
    setSelectedVersionId("");
    await refreshAll();
  };

  const selectedVersion = versionQuery.data;
  const catalogItems = catalogQuery.data?.items ?? [];
  const orderedFields = [...(selectedVersion?.fields ?? [])].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  ) as FieldItem[];

  const sections = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, FieldItem[]>>>();
    for (const field of orderedFields) {
      const layout = layoutMap[field.id] ?? {
        section: DEFAULT_SECTION,
        group: DEFAULT_GROUP,
        subgroup: DEFAULT_SUBGROUP,
      };
      if (!map.has(layout.section)) map.set(layout.section, new Map());
      const groups = map.get(layout.section) as Map<string, Map<string, FieldItem[]>>;
      if (!groups.has(layout.group)) groups.set(layout.group, new Map());
      const subgroups = groups.get(layout.group) as Map<string, FieldItem[]>;
      if (!subgroups.has(layout.subgroup)) subgroups.set(layout.subgroup, []);
      (subgroups.get(layout.subgroup) as FieldItem[]).push(field);
    }
    return [...map.entries()].map(([section, groups]) => ({
      section,
      groups: [...groups.entries()].map(([group, subgroups]) => ({
        group,
        subgroups: [...subgroups.entries()].map(([subgroup, fields]) => ({ subgroup, fields })),
      })),
    }));
  }, [layoutMap, orderedFields]);

  const checkpoints = useMemo(() => {
    const items: Checkpoint[] = [];
    for (const section of sections) {
      for (const group of section.groups) {
        for (const subgroup of group.subgroups) {
          for (let index = 0; index < subgroup.fields.length; index += CHECKPOINT_SIZE) {
            const batch = subgroup.fields.slice(index, index + CHECKPOINT_SIZE);
            items.push({
              id: `${section.section}-${group.group}-${subgroup.subgroup}-${index}`,
              section: section.section,
              group: group.group,
              subgroup: subgroup.subgroup,
              start: index + 1,
              end: index + batch.length,
              fields: batch,
            });
          }
        }
      }
    }
    return items;
  }, [sections]);

  useEffect(() => {
    if (checkpointIndex > checkpoints.length - 1) setCheckpointIndex(0);
  }, [checkpointIndex, checkpoints.length]);

  const currentCheckpoint = checkpoints[checkpointIndex] ?? null;
  const versionReady = orderedFields.length > 0 && orderedFields.every((field) => field.label.trim());

  const openAddFieldModal = () => {
    setCatalogSearch("");
    setSelectedCatalogId("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setModalSection(currentCheckpoint?.section || sections[0]?.section || DEFAULT_SECTION);
    setModalGroup(currentCheckpoint?.group || sections[0]?.groups[0]?.group || DEFAULT_GROUP);
    setModalSubgroup(currentCheckpoint?.subgroup || sections[0]?.groups[0]?.subgroups[0]?.subgroup || DEFAULT_SUBGROUP);
    setModalRequired(false);
    setModalDisplayOrder(orderedFields.length + 1);
    setIsAddFieldModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <input
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFileChange}
        ref={fileInputRef}
        title="scan document"
        type="file"
      />

      {feedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[0.7fr_1.4fr_0.9fr]">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-black text-white">Templates</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                disabled={scanDocumentMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                variant="primary"
              >
                Scan AI Document
              </Button>
              <input
                title="image"
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={onFileChange}
              />
              <Button
                onClick={() => {
                  const name = prompt("Enter new template name:");
                  if (name) {
                    void createTemplateMutation.mutate(name);
                  }
                }}
                variant="secondary"
                disabled={createTemplateMutation.isPending}
              >
                New Template
              </Button>
              <Button
                disabled={
                  !selectedTemplateId || createVersionMutation.isPending
                }
                onClick={() => void createVersionMutation.mutate()}
                variant="secondary"
              >
                New version
              </Button>
              <Button
                disabled={!selectedTemplateId}
                onClick={() => void renameTemplate()}
                variant="secondary"
              >
                Rename template
              </Button>
              <Button
                disabled={!selectedTemplateId}
                onClick={() => void deleteSelectedTemplate()}
                variant="danger"
              >
                Delete template
              </Button>
            </div>
          </div>

          <Panel className="space-y-6">
            <div>
              <p className="text-xl font-semibold text-on-surface">Template gallery</p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Start from a blank draft, scan a document, or continue an existing template.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <button
                className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-left transition hover:border-primary/40 hover:bg-surface"
                onClick={() => void createTemplateMutation.mutate(newTemplateName.trim() || "Untitled Draft")}
                type="button"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-semibold text-primary">+</div>
                <div>
                  <p className="text-lg font-semibold text-on-surface">New draft</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">Create a blank form and open the editor immediately.</p>
                </div>
              </button>

          <div className="space-y-3 border-t border-outline-variant pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps">Versions</p>
              <Button
                disabled={!selectedVersionId}
                onClick={() => void deleteSelectedVersion()}
                variant="danger"
              >
                Delete version
              </Button>
            </div>
            {versionsQuery.data?.map((version) => (
              <button
                className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-left transition hover:border-primary/40 hover:bg-surface"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">O</div>
                <div>
                  <p className="text-lg font-semibold text-on-surface">Scan document</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">Upload a file and generate a draft structure to review.</p>
                </div>
              </button>

              {templates.slice(0, 2).map((template) => (
                <button
                  className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-outline-variant bg-surface p-6 text-left transition hover:border-outline hover:shadow-panel"
                  key={template.id}
                  onClick={() => openTemplate(template.id)}
                  type="button"
                >
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-surface-container-high" />
                      <div className="h-2 w-4/5 rounded-full bg-surface-container-high" />
                      <div className="h-2 w-3/5 rounded-full bg-surface-container-high" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{template.name}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <StatusBadge tone={toneForStatus(template.status)}>{template.status}</StatusBadge>
                      <span className="text-[11px] text-on-surface-variant">{formatDateTime(template.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-on-surface">Recent drafts and templates</p>
                <span className="text-xs text-on-surface-variant">{recentTemplates.length} items</span>
              </div>

              {recentTemplates.length === 0 ? (
                <EmptyState
                  action={null}
                  description="Create a draft or scan a document to start building forms."
                  title="Nothing to continue yet"
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_120px_150px_110px] gap-3 border-b border-outline-variant px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    <span>Name</span>
                    <span>Scope</span>
                    <span>Updated</span>
                    <span>Status</span>
                  </div>
                  {recentTemplates.map((template) => (
                    <button
                      className="grid w-full grid-cols-[minmax(0,1.4fr)_120px_150px_110px] gap-3 border-b border-outline-variant px-4 py-4 text-left transition last:border-b-0 hover:bg-surface-container-low"
                      key={template.id}
                      onClick={() => openTemplate(template.id)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">{template.name}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">Open editor</p>
                      </div>
                      <span className="text-sm text-on-surface-variant">Workspace</span>
                      <span className="text-sm text-on-surface-variant">{formatDateTime(template.updatedAt)}</span>
                      <span><StatusBadge tone={toneForStatus(template.status)}>{template.status}</StatusBadge></span>
                    </button>
                  ))}
                </div>
              )}

            </div>
          </Panel>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-panel border border-outline-variant bg-surface px-6 py-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button onClick={() => setMode("gallery")} variant="secondary">
                  Back to gallery
                </Button>
                <div>
                  <p className="text-lg font-semibold text-on-surface">{selectedVersion?.templateName ?? "Untitled draft"}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Draft {selectedVersion?.versionNo ? `v${selectedVersion.versionNo}` : ""} - {orderedFields.length} fields - {sections.length} sections
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {versions.map((version) => (
                  <button
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selectedVersionId === version.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant bg-surface text-on-surface-variant hover:border-outline hover:text-on-surface"
                    }`}
                    key={version.id}
                    onClick={() => setSelectedVersionId(version.id)}
                    type="button"
                  >
                    v{version.versionNo}
                    {version.isPublished ? " live" : ""}
                  </button>
                ))}
                <Button disabled={!selectedTemplateId || createVersionMutation.isPending} onClick={() => void createVersionMutation.mutate()} variant="secondary">
                  {createVersionMutation.isPending ? "Creating..." : "New draft"}
                </Button>
                <Button disabled={!selectedVersionId || publishMutation.isPending || !versionReady} onClick={() => void publishMutation.mutate()}>
                  {publishMutation.isPending ? "Publishing..." : "Publish"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-panel border border-outline-variant bg-surface px-5 py-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="label-caps">Checkpoint</span>
                <Select
                  className="min-w-[280px]"
                  disabled={checkpoints.length === 0}
                  onChange={(event) => setCheckpointIndex(Number(event.target.value))}
                  value={String(checkpointIndex)}
                >
                  {checkpoints.length === 0 ? (
                    <option value="0">No checkpoints yet</option>
                  ) : (
                    checkpoints.map((checkpoint, index) => (
                      <option key={checkpoint.id} value={String(index)}>
                        {checkpoint.section} / {checkpoint.group} / {checkpoint.subgroup} ({checkpoint.start}-{checkpoint.end})
                      </option>
                    ))
                  )}
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={openAddFieldModal} variant="secondary">
                  Add field
                </Button>
                <Button
                  disabled={orderedFields.length === 0}
                  onClick={() => setIsPreviewOpen(true)}
                  variant="secondary"
                >
                  Preview form
                </Button>
                <Button disabled={scanDocumentMutation.isPending} onClick={() => fileInputRef.current?.click()} variant="secondary">
                  {scanDocumentMutation.isPending ? "Scanning..." : "Scan document"}
                </Button>
              </div>
            </div>
          </div>

          <Panel className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-caps text-primary">Editor checkpoint</p>
                  <p className="mt-1 text-xl font-semibold text-on-surface">{currentCheckpoint ? currentCheckpoint.section : "Draft editor"}</p>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                    {currentCheckpoint
                      ? `${currentCheckpoint.group} / ${currentCheckpoint.subgroup} - Fields ${currentCheckpoint.start}-${currentCheckpoint.end}`
                      : "Select a checkpoint or add fields to begin editing."}
                  </p>
                </div>
                {feedback ? <p className="max-w-[260px] text-xs leading-5 text-on-surface-variant">{feedback}</p> : null}
              </div>

              {!currentCheckpoint ? (
                <EmptyState
                  action={null}
                  description="This draft needs fields before the guided editor can open."
                  title="Nothing to edit yet"
                />
              ) : (
                <div className="space-y-5">
                  {currentCheckpoint.fields.map((field) => (
                    <FieldEditorCard
                      field={field}
                      key={field.id}
                      layout={
                        layoutMap[field.id] ?? {
                          section: DEFAULT_SECTION,
                          group: DEFAULT_GROUP,
                          subgroup: DEFAULT_SUBGROUP,
                        }
                      }
                      onDelete={async (fieldId, label) => {
                        await formsApi.deleteField(fieldId);
                        setFeedback(`Deleted field "${label}".`);
                        await versionQuery.refetch();
                      }}
                      onLayoutChange={(fieldId, nextLayout) =>
                        setLayoutMap((current) => ({
                          ...current,
                          [fieldId]: nextLayout,
                        }))
                      }
                      onSave={async (fieldId, payload, label) => {
                        await formsApi.updateField(fieldId, payload);
                        setFeedback(`Updated field "${label}".`);
                        await versionQuery.refetch();
                      }}
                    />
                  ))}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Checkpoint progress</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{checkpointIndex + 1} of {checkpoints.length}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={checkpointIndex === 0} onClick={() => setCheckpointIndex((current) => Math.max(current - 1, 0))} variant="secondary">
                        Previous
                      </Button>
                      <Button disabled={checkpointIndex >= checkpoints.length - 1} onClick={() => setCheckpointIndex((current) => Math.min(current + 1, checkpoints.length - 1))}>
                        Confirm and continue
                      </Button>
                    </div>
                  </div>
                </div>
              )}
          </Panel>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="label-caps">Status</p>
                <div className="mt-2">
                  <StatusBadge tone={selectedVersion?.isPublished ? "success" : "warning"}>
                    {selectedVersion?.isPublished ? "live" : "draft"}
                  </StatusBadge>
                </div>
              </div>
              <div>
                <p className="label-caps">Structure</p>
                <p className="mt-2 text-sm text-on-surface-variant">{sections.length} sections - {orderedFields.length} fields</p>
              </div>
              <div>
                <p className="label-caps">Current checkpoint</p>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {currentCheckpoint
                    ? `${currentCheckpoint.group} / ${currentCheckpoint.subgroup} - Fields ${currentCheckpoint.start}-${currentCheckpoint.end}`
                    : "No checkpoint selected"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddFieldModalOpen ? (
        <AddFieldModal
          adding={addFieldMutation.isPending}
          canSubmit={Boolean(selectedVersionId && (selectedCatalogId || newFieldLabel.trim()))}
          catalogSearch={catalogSearch}
          catalogItems={catalogItems}
          modalDisplayOrder={modalDisplayOrder}
          modalGroup={modalGroup}
          modalRequired={modalRequired}
          modalSection={modalSection}
          modalSubgroup={modalSubgroup}
          newFieldLabel={newFieldLabel}
          newFieldType={newFieldType}
          onClose={() => setIsAddFieldModalOpen(false)}
          onSubmit={() => void addFieldMutation.mutate()}
          selectedCatalogId={selectedCatalogId}
          setCatalogSearch={setCatalogSearch}
          setModalDisplayOrder={setModalDisplayOrder}
          setModalGroup={setModalGroup}
          setModalRequired={setModalRequired}
          setModalSection={setModalSection}
          setModalSubgroup={setModalSubgroup}
          setNewFieldLabel={setNewFieldLabel}
          setNewFieldType={setNewFieldType}
          setSelectedCatalogId={setSelectedCatalogId}
        />
      ) : null}

      {isPreviewOpen ? (
        <PreviewModal
          onClose={() => setIsPreviewOpen(false)}
          sections={sections}
          templateName={selectedVersion?.templateName ?? "Untitled draft"}
        />
      ) : null}
    </div>
  );
}

function FieldEditorCard({
  field,
  layout,
  onDelete,
  onLayoutChange,
  onSave,
}: {
  field: FieldItem;
  layout: FieldLayout;
  onDelete: (fieldId: string, label: string) => Promise<void>;
  onLayoutChange: (fieldId: string, nextLayout: FieldLayout) => void;
  onSave: (fieldId: string, payload: Record<string, unknown>, label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(field.label);
  const [inputType, setInputType] = useState(field.inputType);
  const [displayOrder, setDisplayOrder] = useState(field.displayOrder);
  const [isRequired, setIsRequired] = useState(field.isRequired);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLabel(field.label);
    setInputType(field.inputType);
    setDisplayOrder(field.displayOrder);
    setIsRequired(field.isRequired);
  }, [field.displayOrder, field.id, field.inputType, field.isRequired, field.label]);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-5 py-5">
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_130px_110px]">
          <div>
            <p className="label-caps">Field label</p>
            <Input className="mt-2" onChange={(event) => setLabel(event.target.value)} value={label} />
          </div>
          <div>
            <p className="label-caps">Type</p>
            <Select className="mt-2" onChange={(event) => setInputType(event.target.value)} value={inputType}>
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="label-caps">Order</p>
            <Input
              className="mt-2"
              onChange={(event) => setDisplayOrder(Number(event.target.value))}
              type="number"
              value={displayOrder}
            />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div>
            <p className="label-caps">Section</p>
            <Input
              className="mt-2"
              onChange={(event) =>
                onLayoutChange(field.id, {
                  ...layout,
                  section: event.target.value || DEFAULT_SECTION,
                })
              }
              value={layout.section}
            />
          </div>
          <div>
            <p className="label-caps">Group</p>
            <Input
              className="mt-2"
              onChange={(event) =>
                onLayoutChange(field.id, {
                  ...layout,
                  group: event.target.value || DEFAULT_GROUP,
                })
              }
              value={layout.group}
            />
          </div>
          <div>
            <p className="label-caps">Subgroup</p>
            <Input
              className="mt-2"
              onChange={(event) =>
                onLayoutChange(field.id, {
                  ...layout,
                  subgroup: event.target.value || DEFAULT_SUBGROUP,
                })
              }
              value={layout.subgroup}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              aria-checked={isRequired}
              className={`relative h-6 w-11 rounded-full transition ${isRequired ? "bg-primary" : "bg-outline"}`}
              onClick={() => setIsRequired((current) => !current)}
              role="switch"
              type="button"
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  isRequired ? "left-6" : "left-1"
                }`}
              />
            </button>
            <span className="text-sm text-on-surface-variant">{isRequired ? "Required" : "Optional"}</span>
            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
              {field.isCustom ? "Custom field" : "Catalog field"}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  await onSave(
                    field.id,
                    {
                      label,
                      input_type: inputType,
                      display_order: displayOrder,
                      is_required: isRequired,
                    },
                    label,
                  );
                } finally {
                  setWorking(false);
                }
              }}
              type="button"
              variant="secondary"
            >
              Save
            </Button>
            <Button
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  await onDelete(field.id, field.label);
                } finally {
                  setWorking(false);
                }
              }}
              type="button"
              variant="danger"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddFieldModal({
  adding,
  canSubmit,
  catalogSearch,
  catalogItems,
  modalDisplayOrder,
  modalGroup,
  modalRequired,
  modalSection,
  modalSubgroup,
  newFieldLabel,
  newFieldType,
  onClose,
  onSubmit,
  selectedCatalogId,
  setCatalogSearch,
  setModalDisplayOrder,
  setModalGroup,
  setModalRequired,
  setModalSection,
  setModalSubgroup,
  setNewFieldLabel,
  setNewFieldType,
  setSelectedCatalogId,
}: {
  adding: boolean;
  canSubmit: boolean;
  catalogSearch: string;
  catalogItems: Array<{ id: string; name: string; inputType: string }>;
  modalDisplayOrder: number;
  modalGroup: string;
  modalRequired: boolean;
  modalSection: string;
  modalSubgroup: string;
  newFieldLabel: string;
  newFieldType: string;
  onClose: () => void;
  onSubmit: () => void;
  selectedCatalogId: string;
  setCatalogSearch: (value: string) => void;
  setModalDisplayOrder: (value: number) => void;
  setModalGroup: (value: string) => void;
  setModalRequired: (value: boolean) => void;
  setModalSection: (value: string) => void;
  setModalSubgroup: (value: string) => void;
  setNewFieldLabel: (value: string) => void;
  setNewFieldType: (value: string) => void;
  setSelectedCatalogId: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-outline-variant bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-on-surface">Add field</p>
            <p className="mt-1 text-sm text-on-surface-variant">Create a new field and place it directly into the form structure.</p>
          </div>
          <Button onClick={onClose} variant="secondary">Close</Button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="label-caps">Find catalog field</p>
            <Input
              className="mt-2"
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Search by name or type"
              value={catalogSearch}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="label-caps">Field source</p>
              <Select className="mt-2" onChange={(event) => setSelectedCatalogId(event.target.value)} value={selectedCatalogId}>
                <option value="">Create custom field</option>
                {catalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.inputType})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="label-caps">Display order</p>
              <Input
                className="mt-2"
                onChange={(event) => setModalDisplayOrder(Number(event.target.value))}
                type="number"
                value={modalDisplayOrder}
              />
            </div>
          </div>

          {!selectedCatalogId ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="label-caps">Field label</p>
                <Input className="mt-2" onChange={(event) => setNewFieldLabel(event.target.value)} value={newFieldLabel} />
              </div>
              <div>
                <p className="label-caps">Type</p>
                <Select className="mt-2" onChange={(event) => setNewFieldType(event.target.value)} value={newFieldType}>
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="label-caps">Section</p>
              <Input className="mt-2" onChange={(event) => setModalSection(event.target.value)} value={modalSection} />
            </div>
            <div>
              <p className="label-caps">Group</p>
              <Input className="mt-2" onChange={(event) => setModalGroup(event.target.value)} value={modalGroup} />
            </div>
            <div>
              <p className="label-caps">Subgroup</p>
              <Input className="mt-2" onChange={(event) => setModalSubgroup(event.target.value)} value={modalSubgroup} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-checked={modalRequired}
              className={`relative h-6 w-11 rounded-full transition ${modalRequired ? "bg-primary" : "bg-outline"}`}
              onClick={() => setModalRequired(!modalRequired)}
              role="switch"
              type="button"
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${modalRequired ? "left-6" : "left-1"}`} />
            </button>
            <span className="text-sm text-on-surface-variant">{modalRequired ? "Required field" : "Optional field"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button disabled={!canSubmit || adding} onClick={onSubmit}>
            {adding ? "Adding..." : "Create field"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  onClose,
  sections,
  templateName,
}: {
  onClose: () => void;
  sections: Array<{
    section: string;
    groups: Array<{
      group: string;
      subgroups: Array<{ subgroup: string; fields: FieldItem[] }>;
    }>;
  }>;
  templateName: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-on-surface">Form preview</p>
            <p className="mt-1 text-sm text-on-surface-variant">{templateName}</p>
          </div>
          <Button onClick={onClose} variant="secondary">Close</Button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-outline-variant bg-surface-container-low p-6">
            {sections.length === 0 ? (
              <EmptyState
                action={null}
                description="Add sections and fields to preview the form layout."
                title="Nothing to preview yet"
              />
            ) : (
              sections.map((section) => (
                <div className="space-y-5 rounded-xl border border-outline-variant bg-surface p-5" key={section.section}>
                  <div>
                    <p className="text-lg font-semibold text-on-surface">{section.section}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">Preview of grouped form fields for this section.</p>
                  </div>

                  {section.groups.map((group) => (
                    <div className="space-y-4" key={`${section.section}-${group.group}`}>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{group.group}</p>
                      </div>
                      {group.subgroups.map((subgroup) => (
                        <div className="space-y-3" key={`${group.group}-${subgroup.subgroup}`}>
                          <p className="label-caps">{subgroup.subgroup}</p>
                          <div className="grid gap-4 md:grid-cols-2">
                            {subgroup.fields.map((field) => (
                              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4" key={field.id}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-on-surface">{field.label}</p>
                                  {field.isRequired ? <StatusBadge tone="warning">required</StatusBadge> : null}
                                </div>
                                <div className="mt-3 rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface-variant">
                                  {field.inputType} field
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
