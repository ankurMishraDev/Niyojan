import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Input,
  LoaderBlock,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";
import {
  DynamicFieldInput,
  type DynamicFieldValue,
} from "@/features/forms/DynamicFieldInput";
import { formsApi, surveysApi, documentsApi } from "@/lib/services";
import { api } from "@/lib/api";

export function SurveyNewPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState("");
  const [versionId, setVersionId] = useState("");

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

  if (templatesQuery.isLoading) {
    return <LoaderBlock label="Loading survey templates..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field Workflow"
        title="Create survey draft"
        description="Start a dynamic survey from a published form template version. The detail page renders the live form structure from backend-managed fields."
      />

      <Panel className="max-w-3xl space-y-4">
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

type SurveyDraftState = Record<string, DynamicFieldValue>;

export function SurveyDetailPage() {
  const { surveyId = "" } = useParams();
  const [draft, setDraft] = useState<SurveyDraftState>({});
  const [analysisFeedback, setAnalysisFeedback] = useState("");

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

  const scanDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      setAnalysisFeedback("Requesting upload URL...");
      const signed = await documentsApi.uploadUrl({
        file_name: file.name,
        file_type: file.type,
      });

      setAnalysisFeedback("Uploading filled document...");
      await api.uploadToSignedUrl(
        signed.uploadUrl,
        file,
        signed.requiredHeaders,
      );

      setAnalysisFeedback("Creating document record...");
      const doc = await documentsApi.create({
        file_name: file.name,
        file_type: file.type,
        gcs_path: signed.gcsPath,
      });

      setAnalysisFeedback("Triggering AI extraction on filled form...");
      await documentsApi.extract(doc.id);

      setAnalysisFeedback("Waiting for extraction (this may take a minute)...");
      let currentDoc = doc;
      while (
        currentDoc.status === "processing" ||
        currentDoc.status === "uploaded"
      ) {
        await new Promise((res) => setTimeout(res, 3000));
        currentDoc = await documentsApi.get(doc.id);
      }

      if (currentDoc.status === "failed") {
        throw new Error("Document extraction failed");
      }

      return currentDoc;
    },
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

      const newDraft = { ...draft };

      // Fallback check against known schema patterns
      const fields = versionQuery.data?.fields ?? [];

      // Check extractedFields array from documentAi
      if (Array.isArray(extractionResult.extractedFields)) {
        extractionResult.extractedFields.forEach((extracted: any) => {
          if (extracted.value === undefined || extracted.value === null) return;
          const normalizedExtractedLabel = (extracted.label || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
          
          const field = fields.find((f) => {
            const normalizedFieldLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
            return normalizedFieldLabel.includes(normalizedExtractedLabel) || normalizedExtractedLabel.includes(normalizedFieldLabel) || f.label.toLowerCase() === (extracted.label || "").toLowerCase();
          });
          
          if (field) {
            newDraft[field.id] = {
              ...newDraft[field.id],
              valueText: String(extracted.value),
            };
          }
        });
      }

      // Iteration over mapped fields if mapped format
      if (Array.isArray(extractionResult.mappedFields)) {
        extractionResult.mappedFields.forEach((extracted: any) => {
          const field = fields.find(
            (f) =>
              f.label.toLowerCase() === extracted.label?.toLowerCase() ||
              (f.fieldCatalogId &&
                f.fieldCatalogId === extracted.fieldCatalogId),
          );
          if (
            field &&
            extracted.value !== undefined &&
            extracted.value !== null
          ) {
            newDraft[field.id] = {
              ...newDraft[field.id],
              valueText: String(extracted.value),
            };
          }
        });
      }

      setDraft(newDraft);
      setAnalysisFeedback("Data populated in draft. Please verify.");
    },
    onError: (err: Error) => {
      setAnalysisFeedback(
        `Error extracting from document: ${err?.message || "Unknown error"}`,
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

  const submitMutation = useMutation({
    mutationFn: () =>
      surveysApi.submit(surveyId, {
        responses: Object.entries(draft).map(([formFieldId, value]) => ({
          form_field_id: formFieldId,
          input_type: value.inputType,
          ...(value.inputType === "number"
            ? { value_number: value.valueNumber ?? 0 }
            : {}),
          ...(value.inputType === "boolean"
            ? { value_bool: Boolean(value.valueBool) }
            : {}),
          ...(value.inputType === "select" || value.inputType === "multiselect"
            ? { value_json: value.valueJson ?? value.valueText ?? [] }
            : {}),
          ...(value.inputType === "text" ||
          value.inputType === "textarea" ||
          value.inputType === "date"
            ? { value_text: value.valueText ?? "" }
            : {}),
        })),
      }),
    onSuccess: async () => {
      setAnalysisFeedback("Survey submitted.");
      await surveyQuery.refetch();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => surveysApi.analyzeNeeds(surveyId),
    onSuccess: (result) => {
      setAnalysisFeedback(
        `Needs analysis complete. ${result.needs.length} needs available.`,
      );
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

  return (
    <div className="space-y-6">
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
            <Button
              disabled={survey.status === "draft" || analyzeMutation.isPending}
              onClick={() => void analyzeMutation.mutate()}
              variant="secondary"
            >
              {analyzeMutation.isPending ? "Analyzing..." : "Analyze needs"}
            </Button>
          </div>
        }
      />

      {analysisFeedback ? (
        <div className="rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
          {analysisFeedback}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
            {version.fields?.map((field) => (
              <div key={field.id}>
                <p className="mb-2 text-sm font-semibold text-white">
                  {field.label} {field.isRequired ? "*" : ""}
                </p>
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
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <p className="text-xl font-black text-white">
            Response payload preview
          </p>
          <pre className="max-h-[780px] overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-xs leading-6 text-on-surface-variant">
            {JSON.stringify(draft, null, 2)}
          </pre>
        </Panel>
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
