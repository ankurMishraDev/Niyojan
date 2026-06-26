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
  import { LANGUAGES } from "@/components/LanguageSelector";
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
    .replace(/[^\p{L}\p{N}]+/gu, "_")
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
      typeof candidate?.label === "string" && candidate.label.trim().length > 0
        ? candidate.label
        : typeof mappedField?.label === "string"
          ? mappedField.label
          : "";

    // evidenceRef from Gemini extraction contains the ORIGINAL English text,
    // which is the reliable key for matching against English form field labels.
    const evidenceRef =
      typeof candidate?.evidenceRef === "string" && candidate.evidenceRef.trim().length > 0
        ? candidate.evidenceRef.trim()
        : typeof candidate?.provenanceRef === "string" && candidate.provenanceRef.trim().length > 0
          ? candidate.provenanceRef.trim()
          : null;

    // Only push if there's an actual value
    pushIfPresent({
      label: resolvedLabel,
      rawValue: candidate?.valueHint ?? candidate?.value,
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

    // Also push using evidenceRef label to match English form fields when extraction was translated
    if (evidenceRef && evidenceRef !== resolvedLabel) {
      const evidenceLabel = evidenceRef.includes(":")
        ? evidenceRef.split(":")[0].trim()
        : evidenceRef;
      if (evidenceLabel.length >= 2) {
        pushIfPresent({
          label: evidenceLabel,
          rawValue: candidate?.valueHint ?? candidate?.value,
          confidence: combineConfidence(
            toConfidenceNumber(candidate?.confidence),
            toConfidenceNumber(mappedField?.confidence),
          ),
          sourceLabel: evidenceLabel,
          sourceType: "key_value",
        });
      }
    }
  });

  // Also process mappedFields directly (they carry the matched English label + value hint)
  // This is the primary path when extraction fields have values
  mappedFields.forEach((mapped: any, index: number) => {
    const candidate = candidateFields[index];
    const label = typeof mapped?.label === "string" && mapped.label.trim().length > 0
      ? mapped.label : "";
    const rawValue = candidate?.valueHint ?? candidate?.value ?? mapped?.valueHint;
    if (label && rawValue !== undefined && rawValue !== null && rawValue !== "") {
      pushIfPresent({
        label,
        rawValue,
        confidence: toConfidenceNumber(mapped?.confidence),
        sourceLabel: label,
        sourceType: "mapped_field",
      });
    }
  });

  // keyValuePairs always have English labels from the document
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
        confidence: typeof item.confidence === "number" ? item.confidence : null,
        sourceLabel: item.label,
        sourceType: "key_value",
      }),
    );
  }

  return entries;
};

import { pipelineApi } from "@/lib/services";
import { DynamicLoader } from "@/components/DynamicLoader";
import { useTranslation } from "react-i18next";

const applyExtractionToDraft = (
  currentDraft: SurveyDraftState,
  fields: FormField[],
  extractionResult: any,
) => {
  console.log(`[HYDRATION] Starting. Fields in form: ${fields.length}`);
  console.log(`[HYDRATION] extractionResult keys:`, Object.keys(extractionResult ?? {}));
  console.log(`[HYDRATION] documentAi.fields count:`, extractionResult?.documentAi?.fields?.length ?? 'N/A');
  console.log(`[HYDRATION] fieldMapping.mappedFields count:`, extractionResult?.fieldMapping?.mappedFields?.length ?? 'N/A');
  console.log(`[HYDRATION] documentAi.keyValuePairs count:`, extractionResult?.documentAi?.keyValuePairs?.length ?? 'N/A');

  const nextDraft = { ...currentDraft };
  const fieldExtractionMeta: Record<string, FieldExtractionMeta> = {};
  const entries = collectExtractionEntries(extractionResult);
  
  console.log(`[HYDRATION] Collected ${entries.length} extraction entries`);
  if (entries.length > 0) {
    console.log(`[HYDRATION] First 5 entries:`, entries.slice(0, 5).map(e => ({ label: e.label, value: e.rawValue })));
  } else {
    console.warn(`[HYDRATION] ZERO entries collected — check candidateFields and keyValuePairs`);
  }
  
  const usedFieldIds = new Set<string>();
  let matchCount = 0;

  for (const entry of entries) {
    const normalizedEntryLabel = normalizeFieldToken(entry.label);
    const field = fields.find((candidateField) => {
      if (usedFieldIds.has(candidateField.id)) return false;
      const normalizedFieldLabel = normalizeFieldToken(candidateField.label);
      return (
        normalizedFieldLabel === normalizedEntryLabel ||
        normalizedFieldLabel.includes(normalizedEntryLabel) ||
        normalizedEntryLabel.includes(normalizedFieldLabel)
      );
    });

    if (!field) continue;

    const coerced = coerceExtractedValue(field, entry.rawValue);
    if (!coerced) {
      console.log(`[HYDRATION] Field "${field.label}" matched but coercion failed for value:`, entry.rawValue);
      continue;
    }

    usedFieldIds.add(field.id);
    matchCount++;
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

  console.log(`[HYDRATION] Matched and populated ${matchCount} form fields`);
  return { draft: nextDraft, fieldExtractionMeta };
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
  onStage?: (stage: string) => void,
  targetLanguage?: string,
) => {
  if (onStage) onStage("Processing");
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

  if (onStage) onStage("Extracting");
  onProgress(`Triggering AI extraction... (Lang: ${targetLanguage || "en"})`);
  console.log(`[DEBUG-EXTRACTION] Frontend triggering extraction with targetLanguage: ${targetLanguage || "en"}`);
  await documentsApi.extract(document.id, targetLanguage || "en");
  
    onProgress("Waiting for extraction (this may take a minute)...");
  let currentDocument = document;
  while (
    currentDocument.status === "processing" ||
    currentDocument.status === "uploaded"
  ) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    currentDocument = await documentsApi.get(document.id);
    if (onStage) {
      try {
        const pipeStatus = await pipelineApi.status(document.id);
        if (pipeStatus && pipeStatus.manifest && pipeStatus.manifest.currentStage) {
          onStage(pipeStatus.manifest.currentStage);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (currentDocument.status === "failed") {
    throw new Error("Document extraction failed");
  }

  if (onStage) onStage("Finalizing");
  return currentDocument;
};

export function SurveyNewPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [creationFeedback, setCreationFeedback] = useState("");
  const [extractionStage, setExtractionStage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  const { t } = useTranslation();
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
      setExtractionStage("Processing");
      setCreationFeedback("Creating survey draft...");
      const survey = await surveysApi.create({
        template_version_id: versionId,
        submitted_language: targetLanguage || 'en',
      });

      const document = await uploadAndExtractDocument(
        file, 
        setCreationFeedback, 
        survey.id,
        setExtractionStage,
        targetLanguage || undefined
      );

      return {
        survey,
        extractionResult: (document as any).extractionResult,
        fileName: file.name,
      };
    },
    onSuccess: ({ survey, extractionResult, fileName }) => {
      setExtractionStage("");
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
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading survey templates…" />
      </div>
    );
  }

  if (createFromFilledFormMutation.isPending) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <DynamicLoader
          currentStage={extractionStage}
          stages={["Processing", "Extracting", "Finalizing"]}
          label="Creating Survey Draft..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <PageHeader
        eyebrow={t("NGO_SurveyPages_Header_CreateSurvey")}
        title={t("NGO_SurveyPages_Header")}
        description={t("NGO_SurveyPages_Header_Description")}
      />

      {creationFeedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm shadow-sm text-ink">
          {creationFeedback}
        </div>
      ) : null}

      <Panel className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-hairline">
          <div>
            <p className="text-xl font-semibold tracking-tight text-ink">{t("NGO_SurveyPages_Header_BlankDraft")}</p>
            <p className="mt-1 text-sm text-body">
              {t("NGO_SurveyPages_Header_BlankDraft_Description")}
            </p>
          </div>
          {/* <Button
            className="w-full sm:w-auto shrink-0"
            disabled={!versionId || createFromFilledFormMutation.isPending}
            onClick={() => filledFormInputRef.current?.click()}
            type="button"
            variant="secondary"
          >
            {createFromFilledFormMutation.isPending
              ? "Extracting…"
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
          /> */}
        </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Header_Template")}</label>
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
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Header_Version")}</label>
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
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Header_Language")}:</label>
              <Select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
              >
                <option value="">English (Default)</option>
                {LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-mute px-1 mt-1">{t("NGO_SurveyPages_Text_LanguageDescription")}</p>
            </div>
          </div>

          <form
            className="grid gap-4 sm:grid-cols-2 pt-2"
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
                submitted_language: targetLanguage || "en",
              });
            }}
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Form_Respondent")}</label>
            <Input name="respondent_name" placeholder="John Doe / Camp A" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Form_Location")}</label>
            <Input name="location_text" placeholder="Village, District" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Form_Latitude")}</label>
            <Input name="latitude" placeholder="e.g. 12.3456" type="number" step="any" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-body px-1">{t("NGO_SurveyPages_Form_Longitude")}</label>
            <Input name="longitude" placeholder="e.g. 78.9101" type="number" step="any" />
          </div>
          <div className="sm:col-span-2 pt-4 border-t border-hairline mt-2">
            <Button
              className="w-full sm:w-auto"
              disabled={!versionId || createSurveyMutation.isPending}
              type="submit"
            >
              {createSurveyMutation.isPending
                ? "Creating…"
                : "Create Survey Draft"}
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
  const [extractionStage, setExtractionStage] = useState("");
  const [fieldExtractionMeta, setFieldExtractionMeta] = useState<Record<string, FieldExtractionMeta>>({});
  const [extractionAttentionItems, setExtractionAttentionItems] = useState<ExtractionAttentionItem[]>([]);
  const [hasExtractionInsights, setHasExtractionInsights] = useState(false);
  const [showExtractionAttentionCard, setShowExtractionAttentionCard] = useState(false);
  const appliedPrefillRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

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
    mutationFn: async (file: File) => {
      setExtractionStage("Processing");
      return uploadAndExtractDocument(
        file, 
        setAnalysisFeedback, 
        surveyId,
        setExtractionStage,
        surveyQuery.data?.submittedLanguage || undefined
      );
    },
    onSuccess: (documentItem) => {
      setExtractionStage("");
      setAnalysisFeedback(
        "Data extracted successfully! Mapping to survey fields…",
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
      setAnalysisFeedback("Survey submitted successfully.");
      await surveyQuery.refetch();
    },
    onError: (error) => {
      setAnalysisFeedback(`Survey submit failed: ${getApiErrorMessage(error)}`);
    },
  });

  if (surveyQuery.isLoading || versionQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Loading survey payload…" />
      </div>
    );
  }

  if (scanDocumentMutation.isPending) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <DynamicLoader
          currentStage={extractionStage}
          stages={["Processing", "Extracting", "Finalizing"]}
          label="Analyzing Survey Document..."
        />
      </div>
    );
  }

  const survey = surveyQuery.data;
  const version = versionQuery.data;

  if (!survey || !version) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4">
        <LoaderBlock label="Survey detail could not be loaded." />
      </div>
    );
  }

  const attentionByFieldId = new Map(
    extractionAttentionItems.map((item) => [item.fieldId, item]),
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4 sm:px-6 relative">
      {showExtractionAttentionCard && extractionAttentionItems.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
          <Panel className="w-full max-w-2xl space-y-4 border border-warning/30 bg-canvas shadow-modal animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-hairline">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">{t("NGO_SurveyPages_Warning_FieldAttention")}</p>
                <p className="mt-1 text-sm text-body">
                  {t("NGO_SurveyPages_Warning_FieldAttention_Description")}
                </p>
              </div>
              <StatusBadge tone="warning">{extractionAttentionItems.length} field(s)</StatusBadge>
            </div>

            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
              {extractionAttentionItems.map((item) => (
                <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3" key={item.fieldId}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="font-semibold text-ink text-sm">{item.label}</p>
                    <StatusBadge tone={toneForConfidence(item.confidence)}>
                      {item.confidence === null ? t("NGO_SurveyPages_Warning_ConfidenceUnavailable") : `AI confidence ${formatPercent(item.confidence)}`}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-warning-deep">{item.reason}</p>
                  <p className="mt-2 text-xs font-mono text-mute">{t("NGO_SurveyPages_Warning_CurrentValue")}: {item.value}</p>
                  {item.sourceLabel ? (
                    <p className="mt-1 text-xs font-mono text-mute">{t("NGO_SurveyPages_Warning_MatchValue")}: {item.sourceLabel}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-hairline">
              <Button onClick={() => setShowExtractionAttentionCard(false)} type="button" variant="secondary">
                {t("NGO_SurveyPages_Warning_ReviewFields_Button")}
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}

      <PageHeader
        eyebrow={t("NGO_Survey_Header_FieldSurvey")}
        title={version.templateName ?? "Survey Detail"}
        description={t("NGO_SurveyPages_Header_SurveyDescription")}
        actions={
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Button
              className="flex-1 sm:flex-none"
              disabled={scanDocumentMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
            >
              {t("NGO_SurveyPages_Button_ScanDocument")}
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
              className="flex-1 sm:flex-none"
              disabled={submitMutation.isPending || survey.status !== "draft"}
              onClick={() => void submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Submitting…" : survey.status === "draft" ? t("NGO_Survey_Button_Submit") : t("NGO_Survey_Text_AlreadySubmitted")}
            </Button>
          </div>
        }
      />

      {analysisFeedback ? (
        <div className="rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-sm text-ink shadow-sm">
          {analysisFeedback}
        </div>
      ) : null}

      <Panel className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <InfoCard
            label={t("NGO_SurveyPages_Info_Respondent")}
            value={survey.respondentName ?? "Not set"}
          />
          <InfoCard
            label={t("NGO_SurveyPages_Info_Location")}
            value={survey.locationText ?? "Not set"}
          />
          <InfoCard
            label={t("NGO_SurveyPages_Info_Status")}
            value={survey.status}
          />
          <InfoCard
            label={t("NGO_SurveyPages_Info_Coordinates")}
            value={`${survey.latitude ?? "—"}, ${survey.longitude ?? "—"}`}
          />
        </div>

        <div className="space-y-5 pt-4 border-t border-hairline">
          {version.fields?.map((field) => {
            const extractionMeta = fieldExtractionMeta[field.id];
            const attentionItem = attentionByFieldId.get(field.id);

            return (
              <div
                className={`rounded-md border px-5 py-4 transition-colors ${
                  attentionItem
                    ? "border-warning/40 bg-warning/5 shadow-sm"
                    : "border-hairline bg-canvas hover:border-hairline-strong"
                }`}
                key={field.id}
              >
                <div className="mb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <label className="text-sm font-semibold text-ink">
                    {field.label} {field.isRequired ? <span className="text-danger">*</span> : ""}
                  </label>
                  {extractionMeta ? (
                    <StatusBadge tone={toneForConfidence(extractionMeta.confidence)}>
                      {extractionMeta.confidence === null
                        ? "Confidence unavailable"
                        : `AI confidence ${formatPercent(extractionMeta.confidence)}`}
                    </StatusBadge>
                  ) : null}
                </div>

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

                {extractionMeta ? (
                  <p className="mt-3 text-[11px] font-mono text-mute">
                    Extracted: {extractionMeta.extractedValue}
                    {extractionMeta.sourceLabel ? ` • Source: ${extractionMeta.sourceLabel}` : ""}
                  </p>
                ) : null}
                
                {attentionItem ? (
                  <p className="mt-2 text-xs font-medium text-warning-deep">{attentionItem.reason}</p>
                ) : null}
              </div>
            );
          })}
          {version.fields?.length === 0 && (
             <div className="py-12 text-center text-sm text-body border-2 border-dashed border-hairline rounded-md">
             No fields defined for this template version.
           </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-canvas-soft p-4">
      <p className="label-caps mb-1">{label}</p>
      <p className="text-sm font-medium text-ink truncate" title={value}>{value}</p>
    </div>
  );
}
