import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Input, LoaderBlock, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { fieldCatalogApi, formsApi } from "@/lib/services";
import { toneForStatus } from "@/lib/format";

export function FormBuilderPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const deferredSearch = useDeferredValue(catalogSearch);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [feedback, setFeedback] = useState("");

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
    await Promise.all([templatesQuery.refetch(), versionsQuery.refetch(), versionQuery.refetch()]);
  };

  const createVersionMutation = useMutation({
    mutationFn: () => formsApi.createVersion(selectedTemplateId, {}),
    onSuccess: async (version) => {
      setSelectedVersionId(version.id);
      setFeedback("New template version created.");
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

  if (templatesQuery.isLoading) {
    return <LoaderBlock label="Loading form builder..." />;
  }

  const selectedVersion = versionQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Form Builder"
        title="Template and field orchestration"
        description="Manage field catalog references, versioned templates, and publishable survey structures using the existing backend form endpoints."
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
            <Button
              disabled={!selectedTemplateId || createVersionMutation.isPending}
              onClick={() => void createVersionMutation.mutate()}
              variant="secondary"
            >
              New version
            </Button>
          </div>

          <div className="space-y-3">
            {templatesQuery.data?.items.map((template) => (
              <button
                className={`w-full rounded-md border px-4 py-3 text-left ${
                  selectedTemplateId === template.id
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant bg-surface-container-low hover:border-primary/50"
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
                <p className="font-semibold text-white">{template.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge tone={toneForStatus(template.status)}>{template.status}</StatusBadge>
                  <span className="text-xs text-on-surface-variant">{template.id.slice(0, 8)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 border-t border-outline-variant pt-4">
            <p className="label-caps">Versions</p>
            {versionsQuery.data?.map((version) => (
              <button
                className={`w-full rounded-md border px-4 py-3 text-left ${
                  selectedVersionId === version.id
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant bg-surface-container-low hover:border-primary/50"
                }`}
                key={version.id}
                onClick={() => setSelectedVersionId(version.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">Version {version.versionNo}</p>
                  {version.isPublished ? <StatusBadge tone="success">published</StatusBadge> : null}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">{version.status}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">
                {selectedVersion?.templateName ?? "Template version"}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Edit labels, required flags, and display ordering against the live backend version.
              </p>
            </div>
            <Button
              disabled={!selectedVersionId || publishMutation.isPending}
              onClick={() => void publishMutation.mutate()}
            >
              {publishMutation.isPending ? "Publishing..." : "Publish version"}
            </Button>
          </div>

          {!selectedVersion ? (
            <p className="text-sm text-on-surface-variant">Select a template version to begin editing.</p>
          ) : (
            <div className="space-y-4">
              {selectedVersion.fields?.map((field) => (
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
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <p className="text-xl font-black text-white">Field catalog</p>
          <Input
            onChange={(event) => setCatalogSearch(event.target.value)}
            placeholder="Search fields by name, key, or category"
            value={catalogSearch}
          />

          <Select value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.target.value)}>
            <option value="">Custom field</option>
            {catalogQuery.data?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.inputType})
              </option>
            ))}
          </Select>
          {!selectedCatalogId ? (
            <>
              <Input
                placeholder="Custom field label"
                value={newFieldLabel}
                onChange={(event) => setNewFieldLabel(event.target.value)}
              />
              <Select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value)}>
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="textarea">textarea</option>
                <option value="select">select</option>
                <option value="multiselect">multiselect</option>
                <option value="date">date</option>
              </Select>
            </>
          ) : null}
          <Button
            disabled={!selectedVersionId || addFieldMutation.isPending || (!selectedCatalogId && !newFieldLabel)}
            onClick={() => void addFieldMutation.mutate()}
            variant="secondary"
          >
            {addFieldMutation.isPending ? "Adding..." : "Add to version"}
          </Button>

          <div className="space-y-3 border-t border-outline-variant pt-4">
            {catalogQuery.data?.items.map((item) => (
              <div
                className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3"
                key={item.id}
              >
                <p className="font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {item.key} · {item.category} · {item.inputType}
                </p>
              </div>
            ))}
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

  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_auto]">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        <Select value={inputType} onChange={(event) => setInputType(event.target.value)}>
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="textarea">textarea</option>
          <option value="select">select</option>
          <option value="multiselect">multiselect</option>
          <option value="date">date</option>
        </Select>
        <Input
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(Number(event.target.value))}
        />
        <Select
          value={String(isRequired)}
          onChange={(event) => setIsRequired(event.target.value === "true")}
        >
          <option value="true">required</option>
          <option value="false">optional</option>
        </Select>
        <div className="flex gap-2">
          <Button
            disabled={working}
            onClick={async () => {
              setWorking(true);
              await onSave({
                label,
                input_type: inputType,
                display_order: displayOrder,
                is_required: isRequired,
              });
              setWorking(false);
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
              await onDelete();
              setWorking(false);
            }}
            type="button"
            variant="danger"
          >
            Delete
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        {field.isCustom ? "Custom field" : "Catalog field"} · id {field.id}
      </p>
    </div>
  );
}
