import { generateSignedReadUrl } from "../../config/gcp";
import { db } from "../../config/db";
import { jobService } from "../../jobs/job.service";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import { AuthenticatedUser } from "../../types/auth";
import { formTemplatesService } from "../formBuilder/formTemplates.service";
import { surveysService } from "../surveys/surveys.service";
import { stage10ReviewPrep } from "./stages/stage10_review_prep";
import { stage1Ingestion } from "./stages/stage1_ingestion";
import { stage2Extraction } from "./stages/stage2_extraction";
import { stage3Canonicalization } from "./stages/stage3_canonicalization";
import { stage4PiiMasking } from "./stages/stage4_pii_masking";
import { stage5SemanticCheck } from "./stages/stage5_semantic_check";
import { stage6GeminiExtraction } from "./stages/stage6_gemini_extraction";
import { stage7TrustGate } from "./stages/stage7_trust_gate";
import { stage8Escalation } from "./stages/stage8_escalation";
import { stage9Reasoning } from "./stages/stage9_reasoning";

type DocumentRow = {
  id: string;
  org_id: string;
  source_survey_id: string | null;
  file_name: string;
  gcs_path: string;
  file_type: string;
  status: string;
  extraction_result_json: unknown;
  assessment_overrides_json: unknown;
  created_at: Date;
  updated_at: Date;
};

type ManifestRow = {
  id: string;
  document_id: string;
  manifest_version: string;
  current_stage: string;
  pipeline_status: string;
  pii_fields_to_keep: unknown;
  pii_fields_to_tokenize: unknown;
  pii_fields_to_redact: unknown;
  initial_model: string;
  escalation_triggered: boolean;
  escalation_stage: string | null;
  escalation_reasons: unknown;
  triage_flags: unknown;
  extraction_quality_flags: unknown;
  model_review_flags: unknown;
  auto_approve_eligible: boolean;
  auto_approve_blocked_by: unknown;
  auto_approve_policy_version: string | null;
  semantic_loss_detected: boolean;
  semantic_loss_reason: string | null;
  assigned_review_queue: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type HumanReviewRow = {
  id: string;
  review_action: string;
  reviewed_at: Date;
  review_notes?: string | null;
  field_corrections?: unknown;
  approved_fields?: unknown;
};

type SurveyReviewRow = {
  id: string;
  org_id: string;
  respondent_name: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  template_version_id: string;
  status: string;
  assessment_overrides_json: unknown;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type SurveyResponseReviewRow = {
  id: string;
  input_type: string;
  value_text: string | null;
  value_number: string | number | null;
  value_bool: boolean | null;
  value_json: unknown;
  field_label: string;
  field_display_order: number;
};

type SurveyNeedRow = {
  id: string;
  org_id: string;
  survey_id: string;
  category: string;
  summary: string;
  urgency_score: number;
  priority_level: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  respondent_name: string | null;
  template_version_id: string | null;
  skill_id: string | null;
  skill_key: string | null;
  skill_name: string | null;
  skill_category: string | null;
};

type IntakeSurveyRow = {
  id: string;
  org_id: string;
  template_version_id: string;
  respondent_name: string | null;
  location_text: string | null;
  status: string;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  source_document_id: string | null;
  source_document_name: string | null;
  source_document_type: string | null;
  source_document_status: string | null;
  source_document_created_at: Date | null;
};

const fromJson = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const getDocumentById = async (documentId: string) => {
  return (await db("documents").where({ id: documentId }).first()) as
    | DocumentRow
    | undefined;
};

const getManifestByDocumentId = async (documentId: string) => {
  return (await db("pipeline_routing_manifests")
    .where({ document_id: documentId })
    .orderBy("created_at", "desc")
    .first()) as ManifestRow | undefined;
};

const getLatestHumanReview = async (documentId: string) => {
  return (await db("human_reviews")
    .where({ document_id: documentId })
    .orderBy("reviewed_at", "desc")
    .first()) as HumanReviewRow | undefined;
};

const getSurveyStatusById = async (surveyId: string) => {
  return (await db("surveys")
    .where({ id: surveyId })
    .select("id", "status")
    .first()) as { id: string; status: string } | undefined;
};

const getSurveyReviewRowById = async (surveyId: string) => {
  return (await db("surveys")
    .where({ id: surveyId })
    .select(
      "id",
      "org_id",
      "respondent_name",
      "location_text",
      "latitude",
      "longitude",
      "template_version_id",
      "status",
      "assessment_overrides_json",
      "submitted_at",
      "created_at",
      "updated_at",
    )
    .first()) as SurveyReviewRow | undefined;
};

const getSurveyResponsesForReview = async (surveyId: string) => {
  return (await db("survey_responses as sr")
    .join("form_fields as ff", "sr.form_field_id", "ff.id")
    .where("sr.survey_id", surveyId)
    .orderBy("ff.display_order", "asc")
    .select(
      "sr.id",
      "sr.input_type",
      "sr.value_text",
      "sr.value_number",
      "sr.value_bool",
      "sr.value_json",
      "ff.label as field_label",
      "ff.display_order as field_display_order",
    )) as SurveyResponseReviewRow[];
};

const getSurveyNeedsBySurveyId = async (surveyId: string) => {
  const rows = (await db("needs_analysis as n")
    .join("surveys as s", "n.survey_id", "s.id")
    .leftJoin("need_skills as ns", "ns.need_id", "n.id")
    .leftJoin("skills as sk", "sk.id", "ns.skill_id")
    .where("n.survey_id", surveyId)
    .select(
      "n.id",
      "n.org_id",
      "n.survey_id",
      "n.category",
      "n.summary",
      "n.urgency_score",
      "n.priority_level",
      "n.status",
      "n.created_at",
      "n.updated_at",
      "s.location_text",
      "s.latitude",
      "s.longitude",
      "s.respondent_name",
      "s.template_version_id",
      db.raw("sk.id as skill_id"),
      db.raw("sk.key as skill_key"),
      db.raw("sk.name as skill_name"),
      db.raw("sk.category as skill_category"),
    )
    .orderBy("n.created_at", "asc")) as SurveyNeedRow[];

  const grouped = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const existing = grouped.get(row.id);
    const skill = row.skill_id
      ? {
          skillId: row.skill_id,
          key: row.skill_key,
          name: row.skill_name,
          category: row.skill_category,
        }
      : null;

    if (!existing) {
      grouped.set(row.id, {
        id: row.id,
        orgId: row.org_id,
        surveyId: row.survey_id,
        category: row.category,
        summary: row.summary,
        urgencyScore: Number(row.urgency_score),
        priorityLevel: row.priority_level,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        locationText: row.location_text,
        latitude: row.latitude,
        longitude: row.longitude,
        respondentName: row.respondent_name,
        templateVersionId: row.template_version_id,
        skills: skill ? [skill] : [],
      });
      continue;
    }

    if (skill) {
      const skills = existing.skills as Array<{ skillId: string }>;
      if (!skills.some((item) => item.skillId === skill.skillId)) {
        skills.push(skill);
      }
    }
  }

  return Array.from(grouped.values());
};

const formatSurveyResponseValue = (response: SurveyResponseReviewRow) => {
  const parsedJson = fromJson(response.value_json);

  if (response.value_text && response.value_text.trim()) {
    return response.value_text.trim();
  }

  if (response.value_number !== null && response.value_number !== undefined) {
    return String(response.value_number);
  }

  if (response.value_bool !== null && response.value_bool !== undefined) {
    return response.value_bool ? "Yes" : "No";
  }

  if (Array.isArray(parsedJson)) {
    return parsedJson.map((item) => String(item)).join(", ");
  }

  if (parsedJson && typeof parsedJson === "object") {
    return JSON.stringify(parsedJson);
  }

  if (parsedJson !== null && parsedJson !== undefined && String(parsedJson).trim()) {
    return String(parsedJson).trim();
  }

  return "Not provided";
};

const priorityRank = (value: string) => {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
};

const urgencyLabelFromScore = (score: number) => {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
};

const applyFieldOverrides = (
  trustedFields: Record<string, unknown>,
  latestReview?: { approved_fields?: unknown; field_corrections?: unknown } | null,
) => {
  const approvedFields = fromJson(latestReview?.approved_fields);
  const fieldCorrections = fromJson(latestReview?.field_corrections);

  return {
    ...trustedFields,
    ...(approvedFields && typeof approvedFields === "object" ? approvedFields : {}),
    ...(fieldCorrections && typeof fieldCorrections === "object" ? fieldCorrections : {}),
  };
};

const applyAssessmentOverrides = (
  reasoningOutput: Record<string, unknown> | null,
  overrides: unknown,
) => {
  const parsedOverrides = fromJson(overrides);
  if (!parsedOverrides || typeof parsedOverrides !== "object") {
    return reasoningOutput;
  }

  return {
    ...(reasoningOutput || {}),
    ...parsedOverrides,
  };
};

const createPipelineLogger = (documentId: string) => {
  const pipelineStartedAt = Date.now();
  console.info(`\n============== PIPELINE PROCESSING STARTED ==============`);
  console.info(
    `[Pipeline] Initializing next stages for Document ID: ${documentId}\n`,
  );

  return (stage: string, details?: Record<string, unknown>) => {
    console.info(`\n[Pipeline] -> STAGE: ${stage.toUpperCase()}`);
    console.info(
      `[Pipeline] Document ID: ${documentId} | Elapsed: ${Date.now() - pipelineStartedAt}ms`,
    );
    if (details) {
      console.info(`[Pipeline] Details: ${JSON.stringify(details, null, 2)}`);
    }
  };
};

const clearPipelineArtifacts = async (
  documentId: string,
  trx: Parameters<typeof db.transaction>[0] extends (arg: infer T) => any
    ? T
    : never,
) => {
  await trx("human_reviews").where({ document_id: documentId }).del();
  await trx("ai_reasoning_outputs").where({ document_id: documentId }).del();
  await trx("validated_candidates").where({ document_id: documentId }).del();
  await trx("ai_extractions").where({ document_id: documentId }).del();
  await trx("pii_token_maps").where({ document_id: documentId }).del();
  await trx("canonical_projections").where({ document_id: documentId }).del();
};

const mapManifest = (manifest: ManifestRow) => ({
  id: manifest.id,
  documentId: manifest.document_id,
  manifestVersion: manifest.manifest_version,
  currentStage: manifest.current_stage,
  pipelineStatus: manifest.pipeline_status,
  piiFieldsToKeep: fromJson(manifest.pii_fields_to_keep) || [],
  piiFieldsToTokenize: fromJson(manifest.pii_fields_to_tokenize) || [],
  piiFieldsToRedact: fromJson(manifest.pii_fields_to_redact) || [],
  initialModel: manifest.initial_model,
  escalationTriggered: manifest.escalation_triggered,
  escalationStage: manifest.escalation_stage,
  escalationReasons: fromJson(manifest.escalation_reasons) || [],
  triageFlags: fromJson(manifest.triage_flags) || [],
  extractionQualityFlags: fromJson(manifest.extraction_quality_flags) || [],
  modelReviewFlags: fromJson(manifest.model_review_flags) || [],
  autoApproveEligible: manifest.auto_approve_eligible,
  autoApproveBlockedBy: fromJson(manifest.auto_approve_blocked_by) || [],
  autoApprovePolicyVersion: manifest.auto_approve_policy_version,
  semanticLossDetected: manifest.semantic_loss_detected,
  semanticLossReason: manifest.semantic_loss_reason,
  assignedReviewQueue: manifest.assigned_review_queue,
  startedAt: manifest.started_at,
  completedAt: manifest.completed_at,
  createdAt: manifest.created_at,
  updatedAt: manifest.updated_at,
});

export class PipelineOrchestrator {
  async startDocumentPipeline(documentId: string, user: AuthenticatedUser) {
    const logStage = createPipelineLogger(documentId);
    let currentStage = "loading_document";
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (document.status === "processing")
      throw new AppError(409, "Document pipeline is already in progress");
    if (!document.source_survey_id) {
      throw new AppError(
        409,
        "Pipeline can only start for documents attached to submitted surveys",
      );
    }

    const sourceSurvey = await getSurveyStatusById(document.source_survey_id);
    if (
      !sourceSurvey ||
      !["submitted", "analyzed"].includes(sourceSurvey.status)
    ) {
      throw new AppError(
        409,
        "Pipeline can only start after the linked survey has been submitted",
      );
    }

    logStage("document_loaded", {
      documentStatus: document.status,
      sourceSurveyId: document.source_survey_id,
      sourceSurveyStatus: sourceSurvey.status,
      fileName: document.file_name,
      fileType: document.file_type,
    });

    currentStage = "survey_need_analysis";
    logStage(currentStage, { action: "start", surveyId: document.source_survey_id });
    const analyzedSurvey = await surveysService.analyzeNeeds(
      document.source_survey_id,
      user,
    );
    logStage(currentStage, {
      action: "completed",
      surveyId: document.source_survey_id,
      createdNeedCount: analyzedSurvey.createdCount,
      surveyStatus: analyzedSurvey.survey.status,
    });

    const job = await jobService.createJob({
      orgId: document.org_id,
      type: "document_pipeline",
      entityType: "document",
      entityId: document.id,
      payload: {
        documentId: document.id,
        fileName: document.file_name,
      },
    });

    try {
      await jobService.markRunning(job.id as string);
      const existingManifest = await getManifestByDocumentId(documentId);

      currentStage = "stage2_extraction";
      logStage(currentStage, { action: "start" });
      const extraction = await stage2Extraction({
        documentId: document.id,
        gcsPath: document.gcs_path,
        fileName: document.file_name,
        fileType: document.file_type,
      });
      logStage(currentStage, {
        action: "completed",
        candidateCount: extraction.summary.candidateCount,
        mappedCount: extraction.summary.mappedCount,
        documentValidationStatus: extraction.documentAi.validationStatus,
        mappingValidationStatus: extraction.fieldMapping.validationStatus,
      });

      currentStage = "stage3_canonicalization";
      const canonical = stage3Canonicalization(extraction);
      logStage(currentStage, {
        pageCount: canonical.pageCount,
        keyValuePairCount: canonical.keyValuePairs.length,
        textBlockCount: canonical.textBlocks.length,
      });

      currentStage = "stage4_pii_masking";
      const pii = stage4PiiMasking(canonical.canonicalText);
      logStage(currentStage, {
        dlpFindingsCount: pii.dlpFindingsCount,
        softPiiFindingsCount: pii.softPiiFindingsCount,
        semanticLossRatio: pii.semanticLossRatio,
      });

      currentStage = "stage5_semantic_check";
      const semantic = stage5SemanticCheck(pii.semanticLossRatio);
      logStage(currentStage, {
        semanticLossDetected: semantic.semanticLossDetected,
        semanticLossReason: semantic.semanticLossReason,
      });

      currentStage = "stage6_gemini_extraction";
      const extractionRecord = stage6GeminiExtraction(extraction);
      logStage(currentStage, {
        extractedFieldCount: extractionRecord.extractedFields.length,
        validationStatus: extractionRecord.validationStatus,
        reviewRequired: extractionRecord.reviewRequired,
      });

      currentStage = "stage7_trust_gate";
      const baseTrust = stage7TrustGate(extraction.mappedFields);
      const combinedValidationFlags = Array.from(
        new Set([
          ...baseTrust.validationFlags,
          ...extraction.documentAi.validationErrors,
          ...extraction.fieldMapping.validationErrors,
        ]),
      );
      const effectiveValidationStatus =
        baseTrust.validationStatus === "requires_human" ||
        extraction.documentAi.reviewRequired ||
        extraction.fieldMapping.reviewRequired
          ? "requires_human"
          : extraction.documentAi.validationStatus === "fallback" ||
              extraction.fieldMapping.validationStatus === "fallback"
            ? "fallback"
            : baseTrust.validationStatus;
      const trust = {
        ...baseTrust,
        validationStatus: effectiveValidationStatus,
        validationFlags: combinedValidationFlags,
      };
      logStage(currentStage, {
        validationStatus: trust.validationStatus,
        validationFlags: trust.validationFlags,
        compositeConfidence: trust.compositeConfidence,
      });

      currentStage = "stage8_escalation";
      const escalation = stage8Escalation({
        candidateCount: extraction.summary.candidateCount,
        mappedCount: extraction.summary.mappedCount,
        validationStatus: trust.validationStatus,
      });
      logStage(currentStage, {
        escalationTriggered: escalation.escalationTriggered,
        escalationStage: escalation.escalationStage,
        reasons: escalation.escalationReasons,
      });

      currentStage = "stage9_reasoning";
      const reasoning = escalation.escalationTriggered
        ? await stage9Reasoning(
            extraction.mappedFields,
            canonical.canonicalText,
          )
        : null;
      logStage(
        currentStage,
        reasoning
          ? {
              status: "completed",
              urgencyLabel: reasoning.urgencyLabel,
              needCategory: reasoning.needCategory,
              validationStatus: reasoning.validationStatus,
            }
          : { status: "skipped" },
      );

      currentStage = "stage10_review_prep";
      const reviewPrep = stage10ReviewPrep({
        escalationTriggered: escalation.escalationTriggered,
        validationStatus: trust.validationStatus,
      });
      logStage(currentStage, {
        pipelineStatus: reviewPrep.pipelineStatus,
        documentStatus: reviewPrep.documentStatus,
        assignedReviewQueue: reviewPrep.assignedReviewQueue,
      });

      currentStage = "persist_pipeline_artifacts";
      logStage(currentStage, { action: "start" });
      const result = await db.transaction(async (trx) => {
        if (existingManifest) {
          await clearPipelineArtifacts(document.id, trx);
        }

        const manifestPayload = {
          ...stage1Ingestion(document.id),
          current_stage: "review_prep",
          pipeline_status: reviewPrep.pipelineStatus,
          semantic_loss_detected: semantic.semanticLossDetected,
          semantic_loss_reason: semantic.semanticLossReason,
          escalation_triggered: escalation.escalationTriggered,
          escalation_stage: escalation.escalationStage,
          escalation_reasons: JSON.stringify(escalation.escalationReasons),
          triage_flags: JSON.stringify(escalation.triageFlags),
          extraction_quality_flags: JSON.stringify(
            escalation.extractionQualityFlags,
          ),
          model_review_flags: JSON.stringify(escalation.modelReviewFlags),
          assigned_review_queue: reviewPrep.assignedReviewQueue,
          completed_at: new Date(),
          updated_at: new Date(),
        };

        let manifest: ManifestRow;
        if (existingManifest) {
          const [updated] = (await trx("pipeline_routing_manifests")
            .where({ id: existingManifest.id })
            .update(manifestPayload)
            .returning("*")) as ManifestRow[];
          manifest = updated;
        } else {
          const [created] = (await trx("pipeline_routing_manifests")
            .insert(manifestPayload)
            .returning("*")) as ManifestRow[];
          manifest = created;
        }

        await trx("documents")
          .where({ id: document.id })
          .update({
            status: reviewPrep.documentStatus,
            extraction_result_json: JSON.stringify(extraction),
            updated_at: new Date(),
          });

        await trx("canonical_projections")
          .insert({
            document_id: document.id,
            manifest_id: manifest.id,
            extraction_method: canonical.extractionMethod,
            detected_language: canonical.detectedLanguage,
            page_count: canonical.pageCount,
            canonical_text: canonical.canonicalText,
            text_blocks: JSON.stringify(canonical.textBlocks),
            key_value_pairs: JSON.stringify(canonical.keyValuePairs),
            tables_json: JSON.stringify(canonical.tablesJson),
            raw_docai_response: JSON.stringify(canonical.rawDocAiResponse),
          })
          .onConflict(["document_id"])
          .merge({
            manifest_id: manifest.id,
            extraction_method: canonical.extractionMethod,
            detected_language: canonical.detectedLanguage,
            page_count: canonical.pageCount,
            canonical_text: canonical.canonicalText,
            text_blocks: JSON.stringify(canonical.textBlocks),
            key_value_pairs: JSON.stringify(canonical.keyValuePairs),
            tables_json: JSON.stringify(canonical.tablesJson),
            raw_docai_response: JSON.stringify(canonical.rawDocAiResponse),
            updated_at: new Date(),
          });

        await trx("pii_token_maps")
          .insert({
            document_id: document.id,
            manifest_id: manifest.id,
            dlp_findings_count: pii.dlpFindingsCount,
            dlp_info_types_found: JSON.stringify(pii.dlpInfoTypesFound),
            soft_pii_findings_count: pii.softPiiFindingsCount,
            gcs_token_map_path: pii.gcsTokenMapPath,
            inline_token_map: JSON.stringify(pii.inlineTokenMap),
            tokenized_text: pii.tokenizedText,
            original_token_count: pii.originalTokenCount,
            remaining_token_count: pii.remainingTokenCount,
            semantic_loss_ratio: pii.semanticLossRatio,
          })
          .onConflict(["document_id"])
          .merge({
            manifest_id: manifest.id,
            dlp_findings_count: pii.dlpFindingsCount,
            dlp_info_types_found: JSON.stringify(pii.dlpInfoTypesFound),
            soft_pii_findings_count: pii.softPiiFindingsCount,
            gcs_token_map_path: pii.gcsTokenMapPath,
            inline_token_map: JSON.stringify(pii.inlineTokenMap),
            tokenized_text: pii.tokenizedText,
            original_token_count: pii.originalTokenCount,
            remaining_token_count: pii.remainingTokenCount,
            semantic_loss_ratio: pii.semanticLossRatio,
            updated_at: new Date(),
          });

        const [aiExtraction] = (await trx("ai_extractions")
          .insert({
            document_id: document.id,
            manifest_id: manifest.id,
            provider_name: extractionRecord.providerName,
            model_name: extractionRecord.modelName,
            model_version: extractionRecord.modelVersion,
            prompt_version: extractionRecord.promptVersion,
            extracted_fields: JSON.stringify(extractionRecord.extractedFields),
            missing_fields: JSON.stringify(extractionRecord.missingFields),
            contradictions: JSON.stringify(extractionRecord.contradictions),
            model_quality_flags: JSON.stringify(
              extractionRecord.modelQualityFlags,
            ),
            input_token_count: extractionRecord.inputTokenCount,
            output_token_count: extractionRecord.outputTokenCount,
            latency_ms: extractionRecord.latencyMs,
            validation_status: extractionRecord.validationStatus,
            validation_errors: JSON.stringify(
              extractionRecord.validationErrors,
            ),
            fallback_reason: extractionRecord.fallbackReason,
            review_required: extractionRecord.reviewRequired,
            average_confidence:
              extractionRecord.extractedFields.length === 0
                ? 0
                : Number(
                    (
                      extractionRecord.extractedFields.reduce(
                        (sum, field) => sum + field.confidence,
                        0,
                      ) / extractionRecord.extractedFields.length
                    ).toFixed(4),
                  ),
            is_mock: extractionRecord.isMock,
          })
          .returning("*")) as Array<{ id: string }>;

        const [validatedCandidate] = (await trx("validated_candidates")
          .insert({
            document_id: document.id,
            extraction_id: aiExtraction.id,
            manifest_id: manifest.id,
            field_trust_map: JSON.stringify(trust.fieldTrustMap),
            composite_confidence: trust.compositeConfidence,
            field_completeness_score: trust.fieldCompletenessScore,
            evidence_strength_score: trust.evidenceStrengthScore,
            rule_consistency_score: trust.ruleConsistencyScore,
            model_signal_score: trust.modelSignalScore,
            validation_status: trust.validationStatus,
            validation_flags: JSON.stringify(trust.validationFlags),
            trusted_fields: JSON.stringify(trust.trustedFields),
            untrusted_fields: JSON.stringify(trust.untrustedFields),
            reasoning_invoked: Boolean(reasoning),
          })
          .onConflict(["document_id"])
          .merge({
            extraction_id: aiExtraction.id,
            manifest_id: manifest.id,
            field_trust_map: JSON.stringify(trust.fieldTrustMap),
            composite_confidence: trust.compositeConfidence,
            field_completeness_score: trust.fieldCompletenessScore,
            evidence_strength_score: trust.evidenceStrengthScore,
            rule_consistency_score: trust.ruleConsistencyScore,
            model_signal_score: trust.modelSignalScore,
            validation_status: trust.validationStatus,
            validation_flags: JSON.stringify(trust.validationFlags),
            trusted_fields: JSON.stringify(trust.trustedFields),
            untrusted_fields: JSON.stringify(trust.untrustedFields),
            reasoning_invoked: Boolean(reasoning),
            reasoning_extraction_id: null,
            updated_at: new Date(),
          })
          .returning("*")) as Array<{ id: string }>;

        let reasoningRow = null;
        if (reasoning) {
			const [createdReasoning] = (await trx("ai_reasoning_outputs")
				.insert({
					document_id: document.id,
					validated_candidate_id: validatedCandidate.id,
					manifest_id: manifest.id,
					provider_name: reasoning.providerName,
					model_name: reasoning.modelName,
					prompt_version: reasoning.promptVersion,
					case_summary: reasoning.caseSummary,
					urgency_score: reasoning.urgencyScore,
					urgency_label: reasoning.urgencyLabel,
              urgency_reasons: JSON.stringify(reasoning.urgencyReasons),
              urgency_evidence_refs: JSON.stringify(
                reasoning.urgencyEvidenceRefs,
              ),
              need_category: reasoning.needCategory,
              need_subcategory: reasoning.needSubcategory,
              recommended_skill_keys: JSON.stringify(
                reasoning.recommendedSkillKeys,
              ),
              recommended_action: reasoning.recommendedAction,
              reasoning_confidence: reasoning.reasoningConfidence,
              verification_risk: reasoning.verificationRisk,
              verification_risk_reasons: JSON.stringify(
                reasoning.verificationRiskReasons,
              ),
              input_token_count: reasoning.inputTokenCount,
              output_token_count: reasoning.outputTokenCount,
              latency_ms: reasoning.latencyMs,
              validation_status: reasoning.validationStatus,
              validation_errors: JSON.stringify(reasoning.validationErrors),
              fallback_reason: reasoning.fallbackReason,
              review_required: reasoning.reviewRequired,
              is_mock: reasoning.isMock,
            })
            .returning("*")) as Array<{ id: string }>;
          reasoningRow = createdReasoning;
        }

        await auditService.writeEvent(trx, {
          orgId: document.org_id,
          eventType: "pipeline_started",
          entityType: "document",
          entityId: document.id,
          actorId: user.id,
          oldValue: { status: document.status },
          newValue: {
            status: reviewPrep.documentStatus,
            manifestId: manifest.id,
          },
          expectedNextState: reviewPrep.documentStatus,
        });

        await auditService.writeEvent(trx, {
          orgId: document.org_id,
          eventType: "pipeline_completed",
          entityType: "pipeline_manifest",
          entityId: manifest.id,
          actorId: user.id,
          newValue: {
            pipelineStatus: reviewPrep.pipelineStatus,
            currentStage: manifest.current_stage,
            reasoningId: reasoningRow?.id || null,
          },
          expectedNextState: reviewPrep.pipelineStatus,
        });

        return manifest;
      });

      logStage(currentStage, { action: "completed", manifestId: result.id });
      await jobService.markCompleted(job.id as string, {
        documentId: document.id,
        manifestId: result.id,
        pipelineStatus: result.pipeline_status,
        currentStage: result.current_stage,
      });

      logStage("pipeline_completed", {
        manifestId: result.id,
        pipelineStatus: result.pipeline_status,
      });

      return this.getDocumentPipelineStatus(documentId, user, result.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown pipeline error";
      logStage("pipeline_failed", {
        failedStage: currentStage,
        errorMessage,
      });
      await jobService.markFailed(
        job.id as string,
        `${currentStage}: ${errorMessage}`,
      );
      throw error;
    }
  }

  async getDocumentPipelineStatus(
    documentId: string,
    user: AuthenticatedUser,
    manifestIdOverride?: string,
  ) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (user.role !== "superadmin" && user.orgId !== document.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const manifest = manifestIdOverride
      ? ((await db("pipeline_routing_manifests")
          .where({ id: manifestIdOverride })
          .first()) as ManifestRow | undefined)
      : await getManifestByDocumentId(documentId);
    if (!manifest)
      throw new AppError(404, "Pipeline manifest not found for document");

    const latestJob = await db("jobs")
      .where({ entity_type: "document", entity_id: documentId })
      .orderBy("created_at", "desc")
      .first();

    return {
      document: {
        id: document.id,
        orgId: document.org_id,
        fileName: document.file_name,
        gcsPath: document.gcs_path,
        fileType: document.file_type,
        status: document.status,
      },
      manifest: mapManifest(manifest),
      job: latestJob
        ? {
            id: latestJob.id,
            type: latestJob.type,
            status: latestJob.status,
            errorMessage: latestJob.error_message,
            runAt: latestJob.run_at,
          }
        : null,
    };
  }

  async getReviewPackage(documentId: string, user: AuthenticatedUser) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (user.role !== "superadmin" && user.orgId !== document.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const manifest = await getManifestByDocumentId(documentId);
    if (!manifest)
      throw new AppError(404, "Pipeline manifest not found for document");

    const [projection, piiMap, extraction, validated, reasoning, reviews, surveyNeeds] =
      await Promise.all([
        db("canonical_projections").where({ document_id: documentId }).first(),
        db("pii_token_maps").where({ document_id: documentId }).first(),
        db("ai_extractions")
          .where({ document_id: documentId })
          .orderBy("created_at", "desc")
          .first(),
        db("validated_candidates").where({ document_id: documentId }).first(),
        db("ai_reasoning_outputs")
          .where({ document_id: documentId })
          .orderBy("created_at", "desc")
          .first(),
        db("human_reviews")
          .where({ document_id: documentId })
          .orderBy("reviewed_at", "desc"),
        document.source_survey_id
          ? getSurveyNeedsBySurveyId(document.source_survey_id)
          : Promise.resolve([]),
      ]);

    const latestReview = reviews[0] as
      | {
          approved_fields?: unknown;
          field_corrections?: unknown;
        }
      | undefined;
    const trustedFieldsWithOverrides = validated
      ? applyFieldOverrides(
          (fromJson(validated.trusted_fields) as Record<string, unknown>) || {},
          latestReview,
        )
      : {};

    const signed = await generateSignedReadUrl(document.gcs_path);

    return {
      document: {
        id: document.id,
        fileName: document.file_name,
        fileType: document.file_type,
        status: document.status,
        readUrl: signed.url,
        readUrlExpiresAt: signed.expiresAt,
      },
      sourceDocumentId: document.id,
      sourceSurveyId: document.source_survey_id,
      manifest: mapManifest(manifest),
      canonicalProjection: projection
        ? {
            ...projection,
            text_blocks: fromJson(projection.text_blocks),
            key_value_pairs: fromJson(projection.key_value_pairs),
            tables_json: fromJson(projection.tables_json),
            raw_docai_response: fromJson(projection.raw_docai_response),
          }
        : null,
      piiTokenMap: piiMap
        ? {
            ...piiMap,
            dlp_info_types_found: fromJson(piiMap.dlp_info_types_found),
            inline_token_map: fromJson(piiMap.inline_token_map),
          }
        : null,
      aiExtraction: extraction
        ? {
            ...extraction,
            extracted_fields: fromJson(extraction.extracted_fields),
            missing_fields: fromJson(extraction.missing_fields),
            contradictions: fromJson(extraction.contradictions),
            model_quality_flags: fromJson(extraction.model_quality_flags),
            validation_errors: fromJson(extraction.validation_errors),
          }
        : null,
      validatedCandidate: validated
        ? {
            ...validated,
            field_trust_map: fromJson(validated.field_trust_map),
            validation_flags: fromJson(validated.validation_flags),
            trusted_fields: trustedFieldsWithOverrides,
            untrusted_fields: fromJson(validated.untrusted_fields),
          }
        : null,
      reasoningOutput: applyAssessmentOverrides(
        reasoning
          ? {
					...reasoning,
					case_summary: reasoning.case_summary,
                    urgency_reasons: fromJson(reasoning.urgency_reasons),
            urgency_evidence_refs: fromJson(reasoning.urgency_evidence_refs),
            recommended_skill_keys: fromJson(reasoning.recommended_skill_keys),
            verification_risk_reasons: fromJson(
              reasoning.verification_risk_reasons,
            ),
            validation_errors: fromJson(reasoning.validation_errors),
          }
        : null,
        document.assessment_overrides_json,
      ),
      humanReviews: reviews.map((review) => ({
        ...review,
        field_corrections: fromJson(review.field_corrections),
        approved_fields: fromJson(review.approved_fields),
      })),
      surveyNeeds: surveyNeeds,
    };
  }

  async getSurveyReviewPackage(surveyId: string, user: AuthenticatedUser) {
    const survey = await getSurveyReviewRowById(surveyId);
    if (!survey) throw new AppError(404, "Survey not found");
    if (user.role !== "superadmin" && user.orgId !== survey.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const [responses, surveyNeeds, reviews] = await Promise.all([
      getSurveyResponsesForReview(surveyId),
      getSurveyNeedsBySurveyId(surveyId),
      db("survey_human_reviews")
        .where({ survey_id: surveyId })
        .orderBy("reviewed_at", "desc"),
    ]);

    const rawTrustedFields = Object.fromEntries(
      responses.map((response) => [
        response.field_label,
        formatSurveyResponseValue(response),
      ]),
    );
    const latestReview = reviews[0] as
      | {
          approved_fields?: unknown;
          field_corrections?: unknown;
        }
      | undefined;
    const trustedFields = applyFieldOverrides(rawTrustedFields, latestReview);
    const topUrgencyScore = surveyNeeds.reduce(
      (highest, need) => Math.max(highest, Number(need.urgencyScore || 0)),
      0,
    );
    const topPriority = surveyNeeds.reduce(
      (selected, need) =>
        priorityRank(String(need.priorityLevel)) > priorityRank(selected)
          ? String(need.priorityLevel)
          : selected,
      "low",
    );
    const uniqueSkillKeys = Array.from(
      new Set(
        surveyNeeds.flatMap((need) =>
          (need.skills as Array<{ key: string }>).map((skill) => skill.key),
        ),
      ),
    );
    const evidenceRefs = responses
      .map((response) => `${response.field_label}: ${formatSurveyResponseValue(response)}`)
      .filter((value) => !value.endsWith(": Not provided"))
      .slice(0, 4);
    const caseSummary = surveyNeeds.length > 0
      ? `This manually submitted survey appears to request ${surveyNeeds.length} area(s) of support. The strongest needs are ${surveyNeeds
          .slice(0, 2)
          .map((need) => String(need.summary))
          .join(" and ")}.`
      : "This manually submitted survey has been reviewed, but no needs were detected automatically. The admin should still review the responses and consider volunteer support.";

    return {
      document: {
        id: survey.id,
        fileName: survey.respondent_name
          ? `Manual survey: ${survey.respondent_name}`
          : "Manual survey submission",
        fileType: "survey/manual",
        status: survey.status,
        readUrl: "",
        readUrlExpiresAt: "",
      },
      sourceDocumentId: null,
      sourceSurveyId: survey.id,
      manifest: null,
      canonicalProjection: null,
      piiTokenMap: null,
      aiExtraction: null,
      validatedCandidate: {
        trusted_fields: trustedFields,
        untrusted_fields: {},
      },
      reasoningOutput: applyAssessmentOverrides({
        case_summary: caseSummary,
        urgency_score: topUrgencyScore,
        urgency_label: urgencyLabelFromScore(topUrgencyScore),
        urgency_reasons:
          surveyNeeds.length > 0
            ? [
                `The survey responses produced ${surveyNeeds.length} identified support need(s).`,
                `The highest detected priority is ${topPriority}.`,
              ]
            : [
                "No needs were detected automatically from the survey responses.",
                "Manual review is still required to understand whether volunteer support should be offered.",
              ],
        urgency_evidence_refs:
          evidenceRefs.length > 0
            ? evidenceRefs
            : ["The review is based on the manually filled survey responses."],
        need_category:
          surveyNeeds.length > 0 ? String(surveyNeeds[0].category) : "general",
        need_subcategory: null,
        recommended_skill_keys: uniqueSkillKeys,
        recommended_action:
          surveyNeeds.length > 0
            ? "Review the generated needs and continue to volunteer matching for this survey."
            : "Review the survey manually and continue to volunteer matching if support is still required.",
        reasoning_confidence: surveyNeeds.length > 0 ? 0.72 : 0.45,
        verification_risk: surveyNeeds.length > 0 ? "medium" : "high",
        verification_risk_reasons:
          surveyNeeds.length > 0
            ? [
                "This is a manually filled survey, so an admin should confirm the detected needs before assignment.",
              ]
            : [
                "No needs were detected automatically, so an admin should review the responses carefully.",
              ],
      }, survey.assessment_overrides_json),
      humanReviews: reviews.map((review) => ({
        ...review,
        field_corrections: fromJson(review.field_corrections),
        approved_fields: fromJson(review.approved_fields),
      })),
      surveyNeeds,
    };
  }

  async submitHumanReview(
    documentId: string,
    input: {
      review_action:
        | "approved"
        | "rejected"
        | "edited"
        | "requested_reextraction";
      field_corrections?: Record<string, unknown>;
      review_notes?: string;
      approved_fields?: Record<string, unknown>;
    },
    user: AuthenticatedUser,
  ) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (user.role !== "superadmin" && user.orgId !== document.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const validated = await db("validated_candidates")
      .where({ document_id: documentId })
      .first();
    const manifest = await getManifestByDocumentId(documentId);
    const [review] = await db.transaction(async (trx) => {
      const [createdReview] = (await trx("human_reviews")
        .insert({
          document_id: documentId,
          validated_candidate_id: validated?.id || null,
          reviewed_by: user.id,
          review_action: input.review_action,
          field_corrections: JSON.stringify(input.field_corrections || {}),
          review_notes: input.review_notes?.trim() || null,
          approved_fields: JSON.stringify(input.approved_fields || {}),
          reviewed_at: new Date(),
        })
        .returning("*")) as any[];

      const nextStatus =
        input.review_action === "approved" || input.review_action === "edited"
          ? "approved"
          : input.review_action === "requested_reextraction"
            ? "uploaded"
            : "failed";
      const nextPipelineStatus =
        input.review_action === "requested_reextraction"
          ? "failed"
          : input.review_action === "rejected"
            ? "failed"
            : "completed";
      const nextPipelineStage =
        input.review_action === "requested_reextraction"
          ? "ingestion"
          : "review_prep";

      await trx("documents")
        .where({ id: documentId })
        .update({
          status: nextStatus,
          extraction_result_json:
            input.review_action === "requested_reextraction"
              ? null
              : document.extraction_result_json,
          updated_at: new Date(),
        });

      if (input.review_action === "requested_reextraction") {
        await clearPipelineArtifacts(documentId, trx);
      }

      if (manifest) {
        await trx("pipeline_routing_manifests")
          .where({ id: manifest.id })
          .update({
            current_stage: nextPipelineStage,
            pipeline_status: nextPipelineStatus,
            completed_at:
              input.review_action === "requested_reextraction"
                ? null
                : new Date(),
            updated_at: new Date(),
          });
      }

      await auditService.writeEvent(trx, {
        orgId: document.org_id,
        eventType: "human_review_submitted",
        entityType: "document",
        entityId: document.id,
        actorId: user.id,
        oldValue: { status: document.status },
        newValue: {
          status: nextStatus,
          reviewAction: input.review_action,
          pipelineStatus: nextPipelineStatus,
          pipelineStage: nextPipelineStage,
        },
        expectedNextState: nextStatus,
      });

      return [createdReview];
    });

    return {
      ...review,
      field_corrections: fromJson(review.field_corrections),
      approved_fields: fromJson(review.approved_fields),
    };
  }

  async submitSurveyHumanReview(
    surveyId: string,
    input: {
      review_action:
        | "approved"
        | "rejected"
        | "edited"
        | "requested_reextraction";
      field_corrections?: Record<string, unknown>;
      review_notes?: string;
      approved_fields?: Record<string, unknown>;
    },
    user: AuthenticatedUser,
  ) {
    const survey = await getSurveyReviewRowById(surveyId);
    if (!survey) throw new AppError(404, "Survey not found");
    if (user.role !== "superadmin" && user.orgId !== survey.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const [review] = (await db("survey_human_reviews")
      .insert({
        survey_id: surveyId,
        reviewed_by: user.id,
        review_action: input.review_action,
        field_corrections: JSON.stringify(input.field_corrections || {}),
        review_notes: input.review_notes?.trim() || null,
        approved_fields: JSON.stringify(input.approved_fields || {}),
        reviewed_at: new Date(),
      })
      .returning("*")) as HumanReviewRow[];

    await auditService.logEvent({
      orgId: survey.org_id,
      eventType: "survey_human_review_submitted",
      entityType: "survey",
      entityId: surveyId,
      actorId: user.id,
      newValue: {
        reviewAction: input.review_action,
        reviewNotes: input.review_notes?.trim() || null,
      },
    });

    return {
      ...review,
      field_corrections: fromJson(review.field_corrections),
      approved_fields: fromJson(review.approved_fields),
    };
  }

  async updateDocumentAssessmentField(
    documentId: string,
    input: { field: string; value: unknown },
    user: AuthenticatedUser,
  ) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (user.role !== "superadmin" && user.orgId !== document.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const currentOverrides = (fromJson(document.assessment_overrides_json) as Record<string, unknown>) || {};
    const nextOverrides = {
      ...currentOverrides,
      [input.field]: input.value,
    };

    await db("documents").where({ id: documentId }).update({
      assessment_overrides_json: JSON.stringify(nextOverrides),
      updated_at: new Date(),
    });

    return nextOverrides;
  }

  async updateSurveyAssessmentField(
    surveyId: string,
    input: { field: string; value: unknown },
    user: AuthenticatedUser,
  ) {
    const survey = await getSurveyReviewRowById(surveyId);
    if (!survey) throw new AppError(404, "Survey not found");
    if (user.role !== "superadmin" && user.orgId !== survey.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");

    const currentOverrides = (fromJson(survey.assessment_overrides_json) as Record<string, unknown>) || {};
    const nextOverrides = {
      ...currentOverrides,
      [input.field]: input.value,
    };

    await db("surveys").where({ id: surveyId }).update({
      assessment_overrides_json: JSON.stringify(nextOverrides),
      updated_at: new Date(),
    });

    return nextOverrides;
  }

  async createDraftFormFromPipeline(
    documentId: string,
    input: { name?: string },
    user: AuthenticatedUser,
  ) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "Document not found");
    if (user.role !== "superadmin" && user.orgId !== document.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");
    const latestReview = await getLatestHumanReview(documentId);
    const isReviewApproved =
      latestReview?.review_action === "approved" ||
      latestReview?.review_action === "edited";

    if (document.status !== "approved" && !isReviewApproved) {
      throw new AppError(
        409,
        "Draft form creation requires an approved pipeline review",
      );
    }

    const result = await formTemplatesService.createTemplateFromDocument(
      documentId,
      { name: input.name },
      user,
    );
    await auditService.logEvent({
      orgId: document.org_id,
      eventType: "draft_form_created_from_pipeline",
      entityType: "document",
      entityId: document.id,
      actorId: user.id,
      newValue: {
        templateId: result.template.id,
        versionId: result.version.id,
        totalFieldsCreated: result.summary.totalFieldsCreated,
      },
    });
    return result;
  }

  async listSurveyIntake(user: AuthenticatedUser) {
    const latestDocumentsQuery = db("documents as d1")
      .select(
        "d1.id",
        "d1.source_survey_id",
        "d1.file_name",
        "d1.file_type",
        "d1.status",
        "d1.created_at",
      )
      .whereNotNull("d1.source_survey_id")
      .andWhereRaw(
        `d1.id = (select d2.id from documents as d2 where d2.source_survey_id = d1.source_survey_id order by d2.created_at desc, d2.id desc limit 1)`,
      );

    const query = db("surveys as s")
      .leftJoin(latestDocumentsQuery.as("ld"), "ld.source_survey_id", "s.id")
      .whereIn("s.status", ["submitted", "analyzed"])
      .select(
        "s.id",
        "s.org_id",
        "s.template_version_id",
        "s.respondent_name",
        "s.location_text",
        "s.status",
        "s.submitted_at",
        "s.created_at",
        "s.updated_at",
        db.raw("ld.id as source_document_id"),
        db.raw("ld.file_name as source_document_name"),
        db.raw("ld.file_type as source_document_type"),
        db.raw("ld.status as source_document_status"),
        db.raw("ld.created_at as source_document_created_at"),
      )
      .orderBy("s.submitted_at", "desc")
      .orderBy("s.created_at", "desc");

    if (user.role !== "superadmin") {
      if (!user.orgId)
        throw new AppError(
          400,
          "Authenticated user organization context is missing",
        );
      query.andWhere("s.org_id", user.orgId);
    }

    const rows = (await query) as IntakeSurveyRow[];
    return rows.map((row) => ({
      surveyId: row.id,
      orgId: row.org_id,
      templateVersionId: row.template_version_id,
      respondentName: row.respondent_name,
      locationText: row.location_text,
      surveyStatus: row.status,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceDocumentId: row.source_document_id,
      sourceDocumentName: row.source_document_name,
      sourceDocumentType: row.source_document_type,
      sourceDocumentStatus: row.source_document_status,
      sourceDocumentCreatedAt: row.source_document_created_at,
    }));
  }

  async listPipelineQueue(user: AuthenticatedUser, query: { status?: string }) {
    const baseQuery = db("pipeline_routing_manifests as m")
      .join("documents as d", "m.document_id", "d.id")
      .select(
        "m.id",
        "m.document_id",
        "m.current_stage",
        "m.pipeline_status",
        "m.started_at",
        "m.completed_at",
        "d.org_id",
        "d.file_name",
        "d.status as document_status",
      )
      .orderBy("m.started_at", "desc");

    if (user.role !== "superadmin") {
      if (!user.orgId)
        throw new AppError(
          400,
          "Authenticated user organization context is missing",
        );
      baseQuery.andWhere("d.org_id", user.orgId);
    }

    if (query.status) baseQuery.andWhere("m.pipeline_status", query.status);

    const rows = await baseQuery;
    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      orgId: row.org_id,
      fileName: row.file_name,
      documentStatus: row.document_status,
      currentStage: row.current_stage,
      pipelineStatus: row.pipeline_status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  async getManifestById(manifestId: string, user: AuthenticatedUser) {
    const manifest = (await db("pipeline_routing_manifests as m")
      .join("documents as d", "m.document_id", "d.id")
      .where("m.id", manifestId)
      .select("m.*", "d.org_id")
      .first()) as (ManifestRow & { org_id: string }) | undefined;
    if (!manifest) throw new AppError(404, "Pipeline manifest not found");
    if (user.role !== "superadmin" && user.orgId !== manifest.org_id)
      throw new AppError(403, "Cross-organization access is not allowed");
    return mapManifest(manifest);
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
