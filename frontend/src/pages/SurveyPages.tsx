import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Input,
  LoaderBlock,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
} from "@/components/ui";
import {
  DynamicFieldInput,
  type DynamicFieldValue,
} from "@/features/forms/DynamicFieldInput";
import { formsApi, surveysApi, documentsApi } from "@/lib/services";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import type { FormField } from "@/types/api";

type SurveyDraftState = Record<string, DynamicFieldValue>;

type ExtractionEntry = {
  label: string;
  rawValue: unknown;
  confidence: number | null;
  sourceLabel: string;
  sourceType: "mapped_field" | "candidate_field" | "key_value";
};

type FieldExtractionMeta = {
  confidence: number | null;
  sourceLabel: string;
  sourceType: ExtractionEntry["sourceType"];
  extractedValue: string;
};

type ExtractionAttentionItem = {
  fieldId: string;
  label: string;
  reason: string;
  confidence: number | null;
  value: string;
  sourceLabel: string | null;
};

const LOW_CONFIDENCE_THRESHOLD = 0.8;

const normalizeFieldToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toConfidenceNumber = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
};

const combineConfidence = (left: number | null, right: number | null) => {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.min(left, right);
};

const describeRawValue = (rawValue: unknown) => {
  if (rawValue === null || rawValue === undefined) {
    return "Not provided";
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value)).join(", ");
  }

  if (typeof rawValue === "object") {
    return JSON.stringify(rawValue);
  }

  return String(rawValue).trim() || "Not provided";
};

const describeDraftValue = (field: FormField, value: DynamicFieldValue | undefined) => {
  if (!hasMeaningfulDraftValue(field.inputType, value)) {
    return "Not provided";
  }

  if (field.inputType === "number") {
    return String(value?.valueNumber ?? "");
  }

  if (field.inputType === "boolean") {
    return value?.valueBool ? "Yes" : "No";
  }

  if (field.inputType === "multiselect") {
    return Array.isArray(value?.valueJson)
      ? (value.valueJson as string[]).join(", ")
      : "Not provided";
  }

  return String(value?.valueText ?? "").trim() || "Not provided";
};

const toneForConfidence = (confidence: number | null) => {
  if (confidence === null) {
    return "warning" as const;
  }

  if (confidence >= LOW_CONFIDENCE_THRESHOLD) {
    return "success" as const;
  }

  if (confidence >= 0.6) {
    return "warning" as const;
  }

  return "danger" as const;
};

const hasMeaningfulDraftValue = (inputType: string, value: DynamicFieldValue | undefined) => {
  if (!value) {
    return false;
  }

  if (inputType === "number") {
    return value.valueNumber !== undefined;
  }

  if (inputType === "boolean") {
    return value.valueBool !== undefined;
  }

  if (inputType === "multiselect") {
    return Array.isArray(value.valueJson) && value.valueJson.length > 0;
  }

  return typeof value.valueText === "string" && value.valueText.trim().length > 0;
};

const buildResponsePayload = (field: FormField, value: DynamicFieldValue | undefined) => {
  if (!hasMeaningfulDraftValue(field.inputType, value)) {
    return null;
  }

  if (field.inputType === "number") {
    return {
      form_field_id: field.id,
      input_type: field.inputType,
      value_number: value?.valueNumber,
    };
  }

  if (field.inputType === "boolean") {
    return {
      form_field_id: field.id,
      input_type: field.inputType,
      value_bool: value?.valueBool,
    };
  }

  if (field.inputType === "multiselect") {
    return {
      form_field_id: field.id,
      input_type: field.inputType,
      value_json: Array.isArray(value?.valueJson) ? value.valueJson : [],
    };
  }

  return {
    form_field_id: field.id,
    input_type: field.inputType,
    value_text: value?.valueText ?? "",
  };
};

const coerceExtractedValue = (field: FormField, rawValue: unknown): DynamicFieldValue | null => {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const textValue = String(rawValue).trim();
  if (textValue.length === 0) {
    return null;
  }

  if (field.inputType === "number") {
    const normalized = textValue.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return {
      inputType: field.inputType,
      valueNumber: parsed,
    };
  }

  if (field.inputType === "boolean") {
    const lowered = textValue.toLowerCase();
    if (["yes", "true", "1", "checked", "y"].includes(lowered)) {
      return { inputType: field.inputType, valueBool: true };
    }

    if (["no", "false", "0", "unchecked", "n"].includes(lowered)) {
      return { inputType: field.inputType, valueBool: false };
    }

    return null;
  }

  if (field.inputType === "multiselect") {
    const parts = textValue
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      inputType: field.inputType,
      valueJson: parts,
    };
  }

  if (field.inputType === "select") {
    return {
      inputType: field.inputType,
      valueText: textValue,
      valueJson: textValue,
    };
  }

  return {
    inputType: field.inputType,
    valueText: textValue,
  };
};

const collectExtractionEntries = (extractionResult: any): ExtractionEntry[] => {
  const entries: ExtractionEntry[] = [];
  const seenEntries = new Set<string>();

  const pushIfPresent = (entry: ExtractionEntry) => {
    const renderedValue = describeRawValue(entry.rawValue);
    if (typeof entry.label !== "string" || entry.label.trim().length === 0) {
      return;
    }

    if (renderedValue === "Not provided") {
      return;
    }

    const entryKey = `${normalizeFieldToken(entry.label)}::${renderedValue.toLowerCase()}`;
    if (seenEntries.has(entryKey)) {
      return;
    }

    seenEntries.add(entryKey);

    entries.push({
      ...entry,
      label: entry.label.trim(),
      sourceLabel: entry.sourceLabel.trim() || entry.label.trim(),
    });
  };

  const candidateFields = Array.isArray(extractionResult?.documentAi?.fields)
    ? extractionResult.documentAi.fields
    : Array.isArray(extractionResult?.extractedFields)
      ? extractionResult.extractedFields
      : [];
  const mappedFields = Array.isArray(extractionResult?.fieldMapping?.mappedFields)
    ? extractionResult.fieldMapping.mappedFields
    : Array.isArray(extractionResult?.mappedFields)
      ? extractionResult.mappedFields
      : [];

  candidateFields.forEach((candidate: any, index: number) => {
    const mappedField = mappedFields[index];
    const resolvedLabel =
      typeof mappedField?.label === "string" && mappedField.label.trim().length > 0
        ? mappedField.label
        : typeof candidate?.label === "string"
          ? candidate.label
          : "";

    pushIfPresent({
      label: resolvedLabel,
      rawValue: candidate?.valueHint,
      confidence: combineConfidence(
        toConfidenceNumber(candidate?.confidence),
        toConfidenceNumber(mappedField?.confidence),
      ),
      sourceLabel:
        typeof candidate?.label === "string" && candidate.label.trim().length > 0
          ? candidate.label
          : resolvedLabel,
      sourceType:
        typeof mappedField?.label === "string" && mappedField.label.trim().length > 0
          ? "mapped_field"
          : "candidate_field",
    });
  });

  const keyValueCollections = [
    extractionResult?.documentAi?.keyValuePairs,
    extractionResult?.keyValuePairs,
  ];
  for (const collection of keyValueCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    collection.forEach((item: any) =>
      pushIfPresent({
        label: item.label,
        rawValue: item.value,
        confidence: null,
        sourceLabel: item.label,
        sourceType: "key_value",
      }),
    );
  }

  return entries;
};

const applyExtractionToDraft = (
  currentDraft: SurveyDraftState,
  fields: FormField[],
  extractionResult: any,
) => {
  const nextDraft = { ...currentDraft };
  const fieldExtractionMeta: Record<string, FieldExtractionMeta> = {};
  const entries = collectExtractionEntries(extractionResult);
  const usedFieldIds = new Set<string>();

  for (const entry of entries) {
    const normalizedEntryLabel = normalizeFieldToken(entry.label);
    const field = fields.find((candidateField) => {
      if (usedFieldIds.has(candidateField.id)) {
        return false;
      }

      const normalizedFieldLabel = normalizeFieldToken(candidateField.label);
      return (
        normalizedFieldLabel === normalizedEntryLabel ||
        normalizedFieldLabel.includes(normalizedEntryLabel) ||
        normalizedEntryLabel.includes(normalizedFieldLabel)
      );
    });

    if (!field) {
      continue;
    }

    const coerced = coerceExtractedValue(field, entry.rawValue);
    if (!coerced) {
      continue;
    }

    usedFieldIds.add(field.id);
    nextDraft[field.id] = {
      ...(nextDraft[field.id] ?? { inputType: field.inputType }),
      ...coerced,
    };
    fieldExtractionMeta[field.id] = {
      confidence: entry.confidence,
      sourceLabel: entry.sourceLabel,
      sourceType: entry.sourceType,
      extractedValue: describeRawValue(entry.rawValue),
    };
  }

  return {
    draft: nextDraft,
    fieldExtractionMeta,
  };
};

const buildExtractionAttentionItems = (
  fields: FormField[],
  draft: SurveyDraftState,
  fieldExtractionMeta: Record<string, FieldExtractionMeta>,
) => {
  const attentionByFieldId = new Map<string, ExtractionAttentionItem>();

  const upsertItem = (field: FormField, reason: string, confidence: number | null) => {
    const existingItem = attentionByFieldId.get(field.id);
    if (existingItem) {
      existingItem.reason = `${existingItem.reason} ${reason}`;
      if (existingItem.confidence === null && confidence !== null) {
        existingItem.confidence = confidence;
      }
      return;
    }

    const extractionMeta = fieldExtractionMeta[field.id];
    attentionByFieldId.set(field.id, {
      fieldId: field.id,
      label: field.label,
      reason,
      confidence,
      value: describeDraftValue(field, draft[field.id]),
      sourceLabel: extractionMeta?.sourceLabel ?? null,
    });
  };

  for (const field of fields) {
    const extractionMeta = fieldExtractionMeta[field.id];

    if (extractionMeta && (extractionMeta.confidence === null || extractionMeta.confidence < LOW_CONFIDENCE_THRESHOLD)) {
      upsertItem(
        field,
        extractionMeta.confidence === null
          ? "Confidence is unavailable for this extracted value."
          : `Low AI confidence (${formatPercent(extractionMeta.confidence)}).`,
        extractionMeta.confidence,
      );
    }

    if (field.isRequired && !hasMeaningfulDraftValue(field.inputType, draft[field.id])) {
      upsertItem(field, "Required field is still empty after auto-fill.", extractionMeta?.confidence ?? null);
    }
  }

  return Array.from(attentionByFieldId.values()).sort((left, right) => left.label.localeCompare(right.label));
};

const uploadAndExtractDocument = async (
  file: File,
  onProgress: (message: string) => void,
  sourceSurveyId?: string,
) => {
  onProgress("Requesting upload URL...");
  const signed = await documentsApi.uploadUrl({
    file_name: file.name,
    file_type: file.type,
  });

  onProgress("Uploading document...");
  await api.uploadToSignedUrl(signed.uploadUrl, file, signed.requiredHeaders);

  onProgress("Creating document record...");
  const document = await documentsApi.create({
    file_name: file.name,
    file_type: file.type,
    gcs_path: signed.gcsPath,
    source_survey_id: sourceSurveyId,
  });

  onProgress("Triggering AI extraction...");
  await documentsApi.extract(document.id);

  onProgress("Waiting for extraction (this may take a minute)...");
  let currentDocument = document;
  while (
    currentDocument.status === "processing" ||
    currentDocument.status === "uploaded"
  ) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    currentDocument = await documentsApi.get(document.id);
  }

  if (currentDocument.status === "failed") {
    throw new Error("Document extraction failed");
  }

  return currentDocument;
};

export function SurveyNewPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [creationFeedback, setCreationFeedback] = useState("");
  const filledFormInputRef = useRef<HTMLInputElement>(null);

  const templatesQuery = useQuery({
    queryKey: ["survey-templates"],
    queryFn: () =>
      formsApi.listTemplates({ page: 1, pageSize: 25, status: "active" }),
  });

  useEffect(() => {
    if (!templateId && templatesQuery.data?.items[0]) {
      setTemplateId(templatesQuery.data.items[0].id);
    }
  }, [templateId, templatesQuery.data]);

  useEffect(() => {
    setVersionId("");
  }, [templateId]);

  const versionsQuery = useQuery({
    enabled: Boolean(templateId),
    queryKey: ["survey-template-versions", templateId],
    queryFn: () => formsApi.listVersions(templateId),
  });

  useEffect(() => {
    const published = versionsQuery.data?.find(
      (version) => version.isPublished,
    );
    if (!versionId && published) {
      setVersionId(published.id);
    }
  }, [versionId, versionsQuery.data]);

  const createSurveyMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      surveysApi.create(payload),
    onSuccess: (survey) => {
      navigate(`/surveys/${survey.id}`);
    },
  });

  const createFromFilledFormMutation = useMutation({
    mutationFn: async (file: File) => {
      setCreationFeedback("Creating survey draft...");
      const survey = await surveysApi.create({
        template_version_id: versionId,
      });

      const document = await uploadAndExtractDocument(file, setCreationFeedback, survey.id);

      return {
        survey,
        extractionResult: (document as any).extractionResult,
        fileName: file.name,
      };
    },
    onSuccess: ({ survey, extractionResult, fileName }) => {
      navigate(`/surveys/${survey.id}`, {
        state: {
          prefillExtraction: extractionResult,
          prefillDocumentName: fileName,
        },
      });
    },
    onError: (error) => {
      setCreationFeedback(getApiErrorMessage(error));
    },
  });

  if (templatesQuery.isLoading) {
    return <LoaderBlock label="Loading survey templates..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field Workflow"
        title="Create survey draft"
        description="Create a draft from a published template or upload a filled survey form and prefill the draft from extracted data."
      />

      {creationFeedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {creationFeedback}
        </div>
      ) : null}

      <Panel className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-black text-white">Blank draft</p>
            <p className="text-sm text-on-surface-variant">
              Start with an empty survey draft and fill it manually.
            </p>
          </div>
          <Button
            disabled={!versionId || createFromFilledFormMutation.isPending}
            onClick={() => filledFormInputRef.current?.click()}
            type="button"
            variant="secondary"
          >
            {createFromFilledFormMutation.isPending
              ? "Extracting..."
              : "Create From Filled Form"}
          </Button>
          <input
            title="image"
            ref={filledFormInputRef}
            className="hidden"
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void createFromFilledFormMutation.mutate(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </div>

        <Select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
        >
          {templatesQuery.data?.items.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
        <Select
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
        >
          {versionsQuery.data?.map((version) => (
            <option key={version.id} value={version.id}>
              Version {version.versionNo}{" "}
              {version.isPublished ? "(published)" : ""}
            </option>
          ))}
        </Select>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            createSurveyMutation.mutate({
              template_version_id: versionId,
              respondent_name: formData.get("respondent_name"),
              location_text: formData.get("location_text"),
              latitude: formData.get("latitude")
                ? Number(formData.get("latitude"))
                : null,
              longitude: formData.get("longitude")
                ? Number(formData.get("longitude"))
                : null,
            });
          }}
        >
          <Input name="respondent_name" placeholder="Respondent / site name" />
          <Input name="location_text" placeholder="Location text" />
          <Input name="latitude" placeholder="Latitude" type="number" />
          <Input name="longitude" placeholder="Longitude" type="number" />
          <div className="md:col-span-2">
            <Button
              disabled={!versionId || createSurveyMutation.isPending}
              type="submit"
            >
              {createSurveyMutation.isPending
                ? "Creating..."
                : "Create survey draft"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export function SurveyDetailPage() {
  const { surveyId = "" } = useParams();
  const location = useLocation();
  const [draft, setDraft] = useState<SurveyDraftState>({});
  const [analysisFeedback, setAnalysisFeedback] = useState("");
  const [fieldExtractionMeta, setFieldExtractionMeta] = useState<Record<string, FieldExtractionMeta>>({});
  const [extractionAttentionItems, setExtractionAttentionItems] = useState<ExtractionAttentionItem[]>([]);
  const [hasExtractionInsights, setHasExtractionInsights] = useState(false);
  const [showExtractionAttentionCard, setShowExtractionAttentionCard] = useState(false);
  const appliedPrefillRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const surveyQuery = useQuery({
    queryKey: ["survey-detail", surveyId],
    queryFn: () => surveysApi.get(surveyId),
  });

  const versionQuery = useQuery({
    enabled: Boolean(surveyQuery.data?.templateVersionId),
    queryKey: ["survey-template-version", surveyQuery.data?.templateVersionId],
    queryFn: () =>
      formsApi.getVersion(surveyQuery.data?.templateVersionId ?? ""),
  });

  useEffect(() => {
    appliedPrefillRef.current = false;
    setFieldExtractionMeta({});
    setExtractionAttentionItems([]);
    setHasExtractionInsights(false);
    setShowExtractionAttentionCard(false);
  }, [surveyId]);

  useEffect(() => {
    if (!surveyQuery.data || !versionQuery.data) {
      return;
    }

    const nextDraft: SurveyDraftState = {};
    for (const field of versionQuery.data.fields ?? []) {
      const existing = surveyQuery.data.responses?.find(
        (response) => response.formFieldId === field.id,
      );
      nextDraft[field.id] = {
        inputType: field.inputType,
        valueText: existing?.valueText ?? "",
        valueNumber: existing?.valueNumber ?? undefined,
        valueBool: existing?.valueBool ?? undefined,
        valueJson: existing?.valueJson ?? undefined,
      };
    }
    setDraft(nextDraft);
  }, [surveyQuery.data, versionQuery.data]);

  useEffect(() => {
    if (!hasExtractionInsights || !versionQuery.data?.fields) {
      return;
    }

    const nextItems = buildExtractionAttentionItems(
      versionQuery.data.fields,
      draft,
      fieldExtractionMeta,
    );
    setExtractionAttentionItems(nextItems);

    if (nextItems.length === 0) {
      setShowExtractionAttentionCard(false);
    }
  }, [draft, fieldExtractionMeta, hasExtractionInsights, versionQuery.data?.fields]);

  const scanDocumentMutation = useMutation({
    mutationFn: async (file: File) => uploadAndExtractDocument(file, setAnalysisFeedback, surveyId),
    onSuccess: (documentItem) => {
      setAnalysisFeedback(
        "Data extracted successfully! Mapping to survey fields...",
      );
      const extractionResult =
        (documentItem as any).extractionResult ||
        (documentItem as any).extraction_result_json;
      if (!extractionResult) {
        setAnalysisFeedback("No extraction result found.");
        return;
      }

      const fields = versionQuery.data?.fields ?? [];
      const nextDraft = applyExtractionToDraft(draft, fields, extractionResult);
      const attentionItems = buildExtractionAttentionItems(
        fields,
        nextDraft.draft,
        nextDraft.fieldExtractionMeta,
      );
      setDraft(nextDraft.draft);
      setFieldExtractionMeta(nextDraft.fieldExtractionMeta);
      setHasExtractionInsights(true);
      setExtractionAttentionItems(attentionItems);
      setShowExtractionAttentionCard(attentionItems.length > 0);
      setAnalysisFeedback(
        attentionItems.length > 0
          ? "Data populated in draft. Review the flagged fields before submission."
          : "Data populated in draft. The extracted values look ready for a quick final check.",
      );
    },
    onError: (error) => {
      setAnalysisFeedback(`Error extracting from document: ${getApiErrorMessage(error)}`);
    },
  });

  useEffect(() => {
    const prefillExtraction = (location.state as { prefillExtraction?: unknown } | null)?.prefillExtraction;
    if (!prefillExtraction || !versionQuery.data?.fields || appliedPrefillRef.current) {
      return;
    }

    appliedPrefillRef.current = true;
    const nextDraft = applyExtractionToDraft(draft, versionQuery.data.fields ?? [], prefillExtraction);
    const attentionItems = buildExtractionAttentionItems(
      versionQuery.data.fields ?? [],
      nextDraft.draft,
      nextDraft.fieldExtractionMeta,
    );
    setDraft(nextDraft.draft);
    setFieldExtractionMeta(nextDraft.fieldExtractionMeta);
    setHasExtractionInsights(true);
    setExtractionAttentionItems(attentionItems);
    setShowExtractionAttentionCard(attentionItems.length > 0);
    const prefillDocumentName =
      (location.state as { prefillDocumentName?: string } | null)?.prefillDocumentName;
    setAnalysisFeedback(
      attentionItems.length > 0
        ? prefillDocumentName
          ? `Draft prefilled from ${prefillDocumentName}. Review the flagged fields before submission.`
          : "Draft prefilled from uploaded document. Review the flagged fields before submission."
        : prefillDocumentName
          ? `Draft prefilled from ${prefillDocumentName}. Please verify and submit.`
          : "Draft prefilled from uploaded document. Please verify and submit.",
    );
  }, [draft, location.state, versionQuery.data?.fields]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void scanDocumentMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      surveysApi.submit(surveyId, {
        responses: (versionQuery.data?.fields ?? [])
          .map((field) => buildResponsePayload(field, draft[field.id]))
          .filter((response): response is NonNullable<typeof response> => Boolean(response)),
      }),
    onSuccess: async () => {
      setAnalysisFeedback("Survey submitted.");
      await surveyQuery.refetch();
    },
    onError: (error) => {
      setAnalysisFeedback(`Survey submit failed: ${getApiErrorMessage(error)}`);
    },
  });

  if (surveyQuery.isLoading || versionQuery.isLoading) {
    return <LoaderBlock label="Loading survey payload..." />;
  }

  const survey = surveyQuery.data;
  const version = versionQuery.data;

  if (!survey || !version) {
    return <LoaderBlock label="Survey detail could not be loaded." />;
  }

  const attentionByFieldId = new Map(
    extractionAttentionItems.map((item) => [item.fieldId, item]),
  );

  return (
    <div className="space-y-6">
      {showExtractionAttentionCard && extractionAttentionItems.length > 0 ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center">
          <Panel className="w-full max-w-2xl space-y-4 border border-warning/30 bg-surface-container">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black text-white">Fields to verify before submission</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  These fields were either extracted with lower confidence or still need a manual value.
                </p>
              </div>
              <StatusBadge tone="warning">{extractionAttentionItems.length} field(s) need attention</StatusBadge>
            </div>

            <div className="max-h-[50vh] space-y-3 overflow-auto pr-1">
              {extractionAttentionItems.map((item) => (
                <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3" key={item.fieldId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.label}</p>
                    <StatusBadge tone={toneForConfidence(item.confidence)}>
                      {item.confidence === null ? "Confidence unavailable" : `AI confidence ${formatPercent(item.confidence)}`}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-warning">{item.reason}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">Current value: {item.value}</p>
                  {item.sourceLabel ? (
                    <p className="mt-1 text-xs text-on-surface-variant">Matched from: {item.sourceLabel}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setShowExtractionAttentionCard(false)} type="button" variant="secondary">
                Review fields
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Field Survey"
        title={version.templateName ?? "Survey Detail"}
        description="Dynamic survey rendering powered by the current form template version."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={scanDocumentMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
            >
              Scan Data from Image
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
              disabled={submitMutation.isPending}
              onClick={() => void submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit survey"}
            </Button>
            {/* <Button
              disabled={survey.status === "draft" || analyzeMutation.isPending}
              onClick={() => void analyzeMutation.mutate()}
              variant="secondary"
            >
              {analyzeMutation.isPending ? "Analyzing..." : "Analyze needs"}
            </Button> */}
          </div>
        }
      />

      {analysisFeedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {analysisFeedback}
        </div>
      ) : null}

      <div className="grid gap-6 ">
        <Panel className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard
              label="Respondent"
              value={survey.respondentName ?? "Not set"}
            />
            <InfoCard
              label="Location"
              value={survey.locationText ?? "Not set"}
            />
            <InfoCard label="Status" value={survey.status} />
            <InfoCard
              label="Coordinates"
              value={`${survey.latitude ?? "-"}, ${survey.longitude ?? "-"}`}
            />
          </div>

          <div className="space-y-4">
            {version.fields?.map((field) => {
              const extractionMeta = fieldExtractionMeta[field.id];
              const attentionItem = attentionByFieldId.get(field.id);

              return (
                <div
                  className={`rounded-md border px-4 py-4 ${
                    attentionItem
                      ? "border-warning/40 bg-warning/5"
                      : "border-outline-variant/60 bg-surface-container-low/30"
                  }`}
                  key={field.id}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {field.label} {field.isRequired ? "*" : ""}
                    </p>
                    {extractionMeta ? (
                      <StatusBadge tone={toneForConfidence(extractionMeta.confidence)}>
                        {extractionMeta.confidence === null
                          ? "Confidence unavailable"
                          : `AI confidence ${formatPercent(extractionMeta.confidence)}`}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {extractionMeta ? (
                    <p className="mb-3 text-xs text-on-surface-variant">
                      Extracted value: {extractionMeta.extractedValue}
                      {extractionMeta.sourceLabel ? ` | Source label: ${extractionMeta.sourceLabel}` : ""}
                    </p>
                  ) : null}
                  {attentionItem ? (
                    <p className="mb-3 text-xs font-medium text-warning">{attentionItem.reason}</p>
                  ) : null}
                <DynamicFieldInput
                  field={field}
                  value={draft[field.id]}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      [field.id]: {
                        ...(current[field.id] ?? {
                          inputType: field.inputType,
                        }),
                        ...value,
                      },
                    }))
                  }
                />
                </div>
              );
            })}
          </div>
        </Panel>

        {/* <Panel className="space-y-4">
          <p className="text-xl font-black text-white">
            Response payload preview
          </p>
          <pre className="max-h-[780px] overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-xs leading-6 text-on-surface-variant">
            {JSON.stringify(draft, null, 2)}
          </pre>
        </Panel> */}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
