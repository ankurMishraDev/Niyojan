import { PipelineState } from "../pipelineState";
import { db } from "../../config/db";

/**
 * persistNode — writes all pipeline artifacts to the database in a single
 * transaction. This is the node that was previously a stub ("simulating the
 * persistence operation"), which caused surveys to appear as if the pipeline
 * completed but produce no visible AI review data.
 *
 * We write the same tables as the legacy startDocumentPipeline path:
 *   - pipeline_routing_manifests
 *   - canonical_projections
 *   - ai_extractions
 *   - validated_candidates
 *   - ai_reasoning_outputs
 *   - documents (status update)
 */
export async function persistNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();

  try {
    await db.transaction(async (trx) => {
      // ── 1. Upsert pipeline manifest ──────────────────────────────────────
      const manifestPayload = {
        document_id: state.documentId,
        manifest_version: "1.0",
        current_stage: "review_prep",
        pipeline_status: state.pipelineStatus || "completed",
        pii_fields_to_keep: JSON.stringify([]),
        pii_fields_to_tokenize: JSON.stringify([]),
        pii_fields_to_redact: JSON.stringify([]),
        initial_model: "survey_responses",
        escalation_triggered: false,
        escalation_stage: null,
        escalation_reasons: JSON.stringify([]),
        triage_flags: JSON.stringify([]),
        extraction_quality_flags: JSON.stringify([]),
        model_review_flags: JSON.stringify([]),
        auto_approve_eligible: false,
        auto_approve_blocked_by: JSON.stringify([]),
        auto_approve_policy_version: null,
        semantic_loss_detected: false,
        semantic_loss_reason: null,
        assigned_review_queue: state.reviewQueue || "standard-review",
        completed_at: new Date(),
        updated_at: new Date(),
        started_at: new Date(),
      };

      const existing = await trx("pipeline_routing_manifests")
        .where({ document_id: state.documentId })
        .orderBy("created_at", "desc")
        .first() as { id: string } | undefined;

      let manifestId: string;

      if (existing) {
        await trx("pipeline_routing_manifests")
          .where({ id: existing.id })
          .update({ ...manifestPayload });
        manifestId = existing.id;
      } else {
        const [created] = await trx("pipeline_routing_manifests")
          .insert(manifestPayload)
          .returning("id") as [{ id: string }];
        manifestId = created.id;
      }

      // ── 2. Upsert canonical projection ───────────────────────────────────
      const canonicalText = state.maskedText || state.rawText || "";
      const textBlocks = (state.mappedFields || []).map((f, i) => ({
        page: 1,
        block_id: `b${i + 1}`,
        text: `${f.label}: ${(f as any).valueHint || f.label}`,
        block_type: "survey_response",
        bbox: null,
      }));

      await trx("canonical_projections")
        .insert({
          document_id: state.documentId,
          manifest_id: manifestId,
          extraction_method: "survey_responses",
          detected_language: "en",
          page_count: 1,
          canonical_text: canonicalText,
          text_blocks: JSON.stringify(textBlocks),
          key_value_pairs: JSON.stringify([]),
          tables_json: JSON.stringify([]),
          raw_docai_response: JSON.stringify({ source: "survey_responses", surveyId: state.surveyId }),
        })
        .onConflict(["document_id"])
        .merge({
          manifest_id: manifestId,
          canonical_text: canonicalText,
          text_blocks: JSON.stringify(textBlocks),
          updated_at: new Date(),
        });

      // ── 3. Insert ai_extractions ─────────────────────────────────────────
      const extractedFields = state.mappedFields || [];
      const avgConf = extractedFields.length > 0
        ? extractedFields.reduce((s, f) => s + ((f as any).confidence ?? 0.95), 0) / extractedFields.length
        : 0;

      const [aiExtraction] = await trx("ai_extractions")
        .insert({
          document_id: state.documentId,
          manifest_id: manifestId,
          provider_name: "survey_responses",
          model_name: "survey_responses",
          model_version: "v1",
          prompt_version: "survey_v1",           // ≤20 chars
          extracted_fields: JSON.stringify(extractedFields),
          missing_fields: JSON.stringify(state.unmatchedFields || []),
          contradictions: JSON.stringify([]),
          model_quality_flags: JSON.stringify([]),
          input_token_count: null,
          output_token_count: null,
          latency_ms: state.nodeTimings?.mapping ?? 0,
          validation_status: "passed",
          validation_errors: JSON.stringify([]),
          fallback_reason: null,
          review_required: false,
          average_confidence: Number(avgConf.toFixed(4)),
          is_mock: false,
        })
        .returning("id") as [{ id: string }];

      // ── 4. Upsert validated_candidates ───────────────────────────────────
      const trustedFields: Record<string, unknown> = {};
      const untrustedFields: Record<string, unknown> = {};
      for (const f of extractedFields) {
        const key = f.label;
        const conf = (f as any).confidence ?? 0.95;
        if (conf >= 0.8) {
          trustedFields[key] = (f as any).valueHint ?? f.label;
        } else {
          untrustedFields[key] = (f as any).valueHint ?? f.label;
        }
      }

      const [validatedCandidate] = await trx("validated_candidates")
        .insert({
          document_id: state.documentId,
          extraction_id: aiExtraction.id,
          manifest_id: manifestId,
          field_trust_map: JSON.stringify(state.fieldTrustMap || {}),
          composite_confidence: state.compositeConfidence ?? 0.95,
          field_completeness_score: 1.0,
          evidence_strength_score: 0.95,
          rule_consistency_score: 1.0,
          model_signal_score: 0.95,
          validation_status: state.trustStatus || "passed",
          validation_flags: JSON.stringify([]),
          trusted_fields: JSON.stringify(trustedFields),
          untrusted_fields: JSON.stringify(untrustedFields),
          reasoning_invoked: Boolean(state.caseSummary),
        })
        .onConflict(["document_id"])
        .merge({
          extraction_id: aiExtraction.id,
          manifest_id: manifestId,
          composite_confidence: state.compositeConfidence ?? 0.95,
          trusted_fields: JSON.stringify(trustedFields),
          untrusted_fields: JSON.stringify(untrustedFields),
          reasoning_invoked: Boolean(state.caseSummary),
          updated_at: new Date(),
        })
        .returning("id") as [{ id: string }];

      // ── 5. Insert ai_reasoning_outputs (if reasoning ran) ────────────────
      if (state.caseSummary || state.urgencyLabel) {
        const urgencyScore = Math.round((state.urgencyScore || 0.65) * 100);
        await trx("ai_reasoning_outputs")
          .insert({
            document_id: state.documentId,
            validated_candidate_id: validatedCandidate.id,
            manifest_id: manifestId,
            provider_name: "survey_responses",
            model_name: "survey_responses",
            prompt_version: "reasoning_v1",     // ≤20 chars
            case_summary: state.caseSummary,
            urgency_score: urgencyScore,
            urgency_label: state.urgencyLabel || "medium",
            urgency_reasons: JSON.stringify(state.urgencyReasons || []),
            urgency_evidence_refs: JSON.stringify([]),
            need_category: state.needCategory || "general",
            need_subcategory: state.needSubcategory || null,
            recommended_skill_keys: JSON.stringify(state.recommendedSkillKeys || []),
            recommended_action: state.recommendedAction || null,
            verification_risk: state.verificationRisk || "medium",
            verification_risk_reasons: JSON.stringify([]),
            reasoning_confidence: state.reasoningConfidence ?? 0.65,
            validation_status: "passed",
            validation_errors: JSON.stringify([]),
            fallback_reason: null,
            review_required: false,
            latency_ms: state.nodeTimings?.reasoning ?? 0,
            input_token_count: null,
            output_token_count: null,
          })
          .onConflict(["document_id"])
          .merge({
            manifest_id: manifestId,
            case_summary: state.caseSummary,
            urgency_score: urgencyScore,
            urgency_label: state.urgencyLabel || "medium",
            urgency_reasons: JSON.stringify(state.urgencyReasons || []),
            need_category: state.needCategory || "general",
            recommended_skill_keys: JSON.stringify(state.recommendedSkillKeys || []),
            updated_at: new Date(),
          });
      }

      // ── 6. Update document status ─────────────────────────────────────────
      await trx("documents")
        .where({ id: state.documentId })
        .update({
          status: state.documentStatus || "review_pending",
          updated_at: new Date(),
        });
    });

    console.log(`[persistNode] Successfully persisted all pipeline artifacts for document ${state.documentId}`);
    return {
      nodeTimings: { ...state.nodeTimings, persist: Date.now() - startTime },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[persistNode] DB persist failed:`, err);
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), `persistNode error: ${msg}`],
      nodeTimings: { ...state.nodeTimings, persist: Date.now() - startTime },
    };
  }
}
