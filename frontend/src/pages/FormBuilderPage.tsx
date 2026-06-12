import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  useRef,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  LoaderBlock,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  } from "@/components/ui";
  import { fieldCatalogApi, formsApi, documentsApi, pipelineApi } from "@/lib/services";
  import { api } from "@/lib/api";
import { toneForStatus } from "@/lib/format";
import { LANGUAGES } from "@/components/LanguageSelector";

import { DynamicLoader } from "@/components/DynamicLoader";

import { useTranslation } from "react-i18next";

export function FormBuilderPage() {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const deferredSearch = useDeferredValue(catalogSearch);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [extractionStage, setExtractionStage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const templatesQuery = useQuery({
    queryKey: ["form-templates"],
    queryFn: () => formsApi.listTemplates({ page: 1, pageSize: 25 }),
  });

  useEffect(() => {
    if (!selectedTemplateId && templatesQuery.data?.items[0]) {
      setSelectedTemplateId(templatesQuery.data.items[0].id);
    }
  }, [selectedTemplateId, templatesQuery.data]);

  const versionsQuery = useQuery({
    enabled: Boolean(selectedTemplateId),
    queryKey: ["form-template-versions", selectedTemplateId],
    queryFn: () => formsApi.listVersions(selectedTemplateId),
  });

  useEffect(() => {
    if (!selectedVersionId && versionsQuery.data?.[0]) {
      setSelectedVersionId(versionsQuery.data[0].id);
    }
  }, [selectedVersionId, versionsQuery.data]);

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

  const refreshAll = async () => {
    await Promise.all([
      templatesQuery.refetch(),
      versionsQuery.refetch(),
      versionQuery.refetch(),
    ]);
  };

  const createVersionMutation = useMutation({
    mutationFn: () => formsApi.createVersion(selectedTemplateId, {}),
    onSuccess: async (version) => {
      setSelectedVersionId(version.id);
      setFeedback("New template version created.");
      await refreshAll();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (name: string) => formsApi.createTemplate({ name }),
    onSuccess: async (template) => {
      setSelectedTemplateId(template.id);
      setSelectedVersionId("");
      setFeedback("New custom template created.");
      await refreshAll();
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: () =>
      formsApi.addField(selectedVersionId, {
        field_catalog_id: selectedCatalogId || undefined,
        label: selectedCatalogId ? undefined : newFieldLabel,
        input_type: selectedCatalogId ? undefined : newFieldType,
      }),
    onSuccess: async () => {
      setFeedback("Field added to version.");
      setNewFieldLabel("");
      await versionQuery.refetch();
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
        setExtractionStage("Processing");
        setFeedback("Requesting upload URL...");
        const signed = await documentsApi.uploadUrl({
          file_name: file.name,
          file_type: file.type,
        });
  
        setFeedback("Uploading document...");
        await api.uploadToSignedUrl(
          signed.uploadUrl,
          file,
          signed.requiredHeaders,
        );
  
        setFeedback("Creating document record...");
        const doc = await documentsApi.create({
          file_name: file.name,
          file_type: file.type,
          gcs_path: signed.gcsPath,
        });
  
      setExtractionStage("Extracting");
      setFeedback("Triggering AI extraction...");
      await documentsApi.extract(doc.id, targetLanguage || "en");

      setFeedback(
          "Waiting for extraction to complete (this may take a minute)...",
        );
        let currentDoc = doc;
        while (
          currentDoc.status === "processing" ||
          currentDoc.status === "uploaded"
        ) {
          await new Promise((res) => setTimeout(res, 3000));
          currentDoc = await documentsApi.get(doc.id);
          
          // Optionally get pipeline status here for more detailed stage info
          try {
            const pipeStatus = await pipelineApi.status(doc.id);
            if (pipeStatus && pipeStatus.manifest && pipeStatus.manifest.currentStage) {
               setExtractionStage(pipeStatus.manifest.currentStage);
            }
          } catch (e) {
            // ignore
          }
        }
  
          if (currentDoc.status === "failed") {
          throw new Error("Document extraction failed");
        }
  
        setExtractionStage("Finalizing");
        setFeedback("Generating form template...");
        console.log(`[DEBUG-EXTRACTION] Frontend creating template with doc.id: ${doc.id}`);
        const newTemplate = await formsApi.createFromDocument(doc.id, {
          name: file.name.replace(/\.[^/.]+$/, "") + " Template",
        });
        console.log(`[DEBUG-EXTRACTION] Template created successfully:`, newTemplate);
        return newTemplate;
      },
      onSuccess: async (result) => {
        setExtractionStage("");
        setFeedback("Form template successfully created from AI extraction!");
      setSelectedTemplateId(result.template.id);
      setSelectedVersionId(result.version.id);
      await refreshAll();
    },
    onError: (err: Error) => {
      setFeedback(
        `Error mapping AI template: ${err?.message || "Unknown error"}`,
      );
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void scanDocumentMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (templatesQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading form builder…" />
      </div>
    );
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
  const orderedFields = [...(selectedVersion?.fields ?? [])].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );

  if (scanDocumentMutation.isPending) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <DynamicLoader
          currentStage={extractionStage}
          stages={["Processing", "Extracting", "Finalizing"]}
          label="Creating Form Template"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow={t("Common_Navigation_Link_FormBuilder")}
        title={t("NGO_FormBuilder_Header_CreateForm")}
        description={t("NGO_FormBuilder_Header_Description")}
      />

      {feedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr] xl:grid-cols-[300px_1fr_300px]">
          <Panel className="space-y-5 flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-3">
              <p className="text-xl font-semibold tracking-tight text-ink">{t("NGO_FormBuilder_Label_TemplateName")}</p>
              
              <div className="flex flex-col gap-2 p-3 bg-canvas-soft-2 rounded-md border border-hairline">
                <p className="text-xs font-medium text-body mb-1">{t("NGO_FormBuilder_Label_TargetLanguage")}</p>
                <select
                title="Select target language for AI extraction and template generation"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer mb-2"
                >
                  <option value="">English (Default)</option>
                  {LANGUAGES.filter(l => l.code !== 'en').map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
                <Button
                  className="w-full text-xs py-1.5"
                  disabled={scanDocumentMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  variant="primary"
                >
                  {t("NGO_FormBuilder_Button_ScanDocument")}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  title="image"
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={onFileChange}
                />
                <Button
                className="flex-1 text-xs py-1.5"
                onClick={() => {
                  const name = prompt("Enter new template name:");
                  if (name) {
                    void createTemplateMutation.mutate(name);
                  }
                }}
                variant="secondary"
                disabled={createTemplateMutation.isPending}
              >
                {t("NGO_FormBuilder_Button_NewTemplate")}
              </Button>
              <Button
                className="flex-1 text-xs py-1.5"
                disabled={
                  !selectedTemplateId || createVersionMutation.isPending
                }
                onClick={() => void createVersionMutation.mutate()}
                variant="secondary"
              >
                {t("NGO_FormBuilder_Button_NewVersion")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button
                className="flex-1 text-xs py-1.5"
                disabled={!selectedTemplateId}
                onClick={() => void renameTemplate()}
                variant="secondary"
              >
                {t("NGO_FormBuilder_Button_RenameTemplate")}
              </Button>
              <Button
                className="flex-1 text-xs py-1.5"
                disabled={!selectedTemplateId}
                onClick={() => void deleteSelectedTemplate()}
                variant="danger"
              >
                {t("NGO_FormBuilder_Button_DeleteTemplate")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {templatesQuery.data?.items.map((template) => (
              <button
                className={`w-full rounded-md border px-4 py-3 text-left transition-all ${
                  selectedTemplateId === template.id
                    ? "border-ink bg-canvas-soft shadow-sm"
                    : "border-hairline bg-canvas hover:bg-canvas-soft-2 hover:border-hairline-strong"
                }`}
                key={template.id}
                onClick={() => {
                  startTransition(() => {
                    setSelectedTemplateId(template.id);
                    setSelectedVersionId("");
                  });
                }}
                type="button"
              >
                <p className="font-semibold text-ink">{template.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge tone={toneForStatus(template.status)}>
                    {template.status}
                  </StatusBadge>
                  <span className="font-mono text-[10px] text-mute">
                    {template.id.slice(0, 8)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 border-t border-hairline pt-5 mt-auto">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps">{t("NGO_FormBuilder_Text_Versions")}</p>
              <Button
                className="text-[10px] py-1 px-2"
                disabled={!selectedVersionId}
                onClick={() => void deleteSelectedVersion()}
                variant="danger"
              >
                {t("NGO_FormBuilder_Button_DeleteVersion")}
              </Button>
            </div>
            {versionsQuery.data?.map((version) => (
              <button
                className={`w-full rounded-md border px-4 py-3 text-left transition-all ${
                  selectedVersionId === version.id
                    ? "border-ink bg-canvas-soft shadow-sm"
                    : "border-hairline bg-canvas hover:bg-canvas-soft-2 hover:border-hairline-strong"
                }`}
                key={version.id}
                onClick={() => setSelectedVersionId(version.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">
                    Version {version.versionNo}
                  </p>
                  {version.isPublished ? (
                    <StatusBadge tone="success">published</StatusBadge>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] font-mono text-mute">
                  {version.status}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-6 flex flex-col lg:order-last xl:order-none max-h-[85vh] overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-ink">
                {selectedVersion?.templateName ?? "Template version"}
              </p>
              <p className="mt-1.5 text-sm text-body leading-relaxed max-w-lg">
                Edit labels, required flags, and display ordering against the
                live backend version.
              </p>
            </div>
            <Button
              className="w-full sm:w-auto shrink-0"
              disabled={!selectedVersionId || publishMutation.isPending}
              onClick={() => void publishMutation.mutate()}
            >
              {publishMutation.isPending ? "Publishing…" : "Publish version"}
            </Button>
          </div>

          {!selectedVersion ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-hairline rounded-lg p-10 text-center text-sm text-mute">
              Select a template version to begin editing.
            </div>
          ) : (
            <div className="space-y-4">
              {orderedFields.map((field) => (
                <FieldEditorCard
                  field={field}
                  key={field.id}
                  onDelete={async () => {
                    await formsApi.deleteField(field.id);
                    setFeedback(`Deleted field "${field.label}".`);
                    await versionQuery.refetch();
                  }}
                  onSave={async (payload) => {
                    await formsApi.updateField(field.id, payload);
                    setFeedback(`Updated field "${field.label}".`);
                    await versionQuery.refetch();
                  }}
                />
              ))}
              {orderedFields.length === 0 && (
                <div className="py-8 text-center text-body text-sm border-2 border-dashed border-hairline rounded-lg">
                  No fields in this version yet. Add some from the catalog.
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel className="space-y-5 max-h-[85vh] overflow-y-auto">
          <p className="text-xl font-semibold tracking-tight text-ink">Field catalog</p>
          <div className="space-y-3">
            <Input
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Search fields by name, key, or category"
              value={catalogSearch}
            />

            <Select
              value={selectedCatalogId}
              onChange={(event) => setSelectedCatalogId(event.target.value)}
            >
              <option value="">Custom field (New)</option>
              {catalogQuery.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.inputType})
                </option>
              ))}
            </Select>
            {!selectedCatalogId ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="col-span-2"
                  placeholder="Custom field label"
                  value={newFieldLabel}
                  onChange={(event) => setNewFieldLabel(event.target.value)}
                />
                <Select
                  className="col-span-2"
                  value={newFieldType}
                  onChange={(event) => setNewFieldType(event.target.value)}
                >
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="textarea">textarea</option>
                  <option value="select">select</option>
                  <option value="multiselect">multiselect</option>
                  <option value="date">date</option>
                </Select>
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={
                !selectedVersionId ||
                addFieldMutation.isPending ||
                (!selectedCatalogId && !newFieldLabel)
              }
              onClick={() => void addFieldMutation.mutate()}
              variant="secondary"
            >
              {addFieldMutation.isPending ? "Adding…" : "Add to version"}
            </Button>
          </div>

          <div className="space-y-3 border-t border-hairline pt-5">
            <p className="label-caps mb-2">Available Catalog Fields</p>
            {catalogQuery.data?.items.map((item) => (
              <div
                className="rounded-md border border-hairline bg-canvas-soft-2 px-4 py-3 hover:border-hairline-strong transition-colors cursor-pointer"
                key={item.id}
                onClick={() => setSelectedCatalogId(item.id)}
              >
                <p className="font-medium text-ink text-sm">{item.name}</p>
                <p className="mt-1 font-mono text-[10px] text-mute break-words">
                  {item.key} • {item.category} • {item.inputType}
                </p>
              </div>
            ))}
            {catalogQuery.data?.items.length === 0 && (
              <p className="text-xs text-mute text-center">No fields matched the search.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FieldEditorCard({
  field,
  onSave,
  onDelete,
}: {
  field: {
    id: string;
    label: string;
    inputType: string;
    isRequired: boolean;
    displayOrder: number;
    isCustom: boolean;
  };
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
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
    <div className="rounded-md border border-hairline bg-canvas-soft px-4 py-5 shadow-sm group hover:border-hairline-strong transition-colors">
      <div className="hidden sm:grid mb-2 gap-3 grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <span className="label-caps">Label</span>
        <span className="label-caps">Type</span>
        <span className="label-caps">Order</span>
        <span className="label-caps">Required</span>
        <span className="label-caps text-right">Actions</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <Input
          className="text-sm py-2"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Field Label"
        />
        <Select
          className="text-sm py-2"
          value={inputType}
          onChange={(event) => setInputType(event.target.value)}
        >
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="textarea">textarea</option>
          <option value="select">select</option>
          <option value="multiselect">multiselect</option>
          <option value="date">date</option>
        </Select>
        <Input
          className="text-sm py-2"
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(Number(event.target.value))}
          placeholder="Order"
        />
        <Select
          className="text-sm py-2"
          value={String(isRequired)}
          onChange={(event) => setIsRequired(event.target.value === "true")}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
        <div className="flex gap-2 sm:justify-end">
          <Button
            className="px-3 py-1.5 text-xs"
            disabled={working}
            onClick={async () => {
              setWorking(true);
              try {
                await onSave({
                  label,
                  input_type: inputType,
                  display_order: displayOrder,
                  is_required: isRequired,
                });
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
            className="px-3 py-1.5 text-xs"
            disabled={working}
            onClick={async () => {
              setWorking(true);
              try {
                await onDelete();
              } finally {
                setWorking(false);
              }
            }}
            type="button"
            variant="danger"
          >
            Remove
          </Button>
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-mute flex items-center justify-between">
        <span>{field.isCustom ? "Custom field" : "Catalog field"}</span>
        <span>id: {field.id.slice(0,8)}…</span>
      </p>
    </div>
  );
}
