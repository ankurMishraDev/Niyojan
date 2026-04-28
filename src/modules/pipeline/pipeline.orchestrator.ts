import { generateSignedReadUrl } from "../../config/gcp";
import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import { AuthenticatedUser } from "../../types/auth";
import { formTemplatesService } from "../formBuilder/formTemplates.service";
import { buildInitialRoutingManifest } from "./routingManifest";
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
	file_name: string;
	gcs_path: string;
	file_type: string;
	status: string;
	extraction_result_json: unknown;
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
	return (await db("documents").where({ id: documentId }).first()) as DocumentRow | undefined;
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

const clearPipelineArtifacts = async (documentId: string, trx: Parameters<typeof db.transaction>[0] extends (arg: infer T) => any ? T : never) => {
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
		const document = await getDocumentById(documentId);
		if (!document) throw new AppError(404, "Document not found");
		if (document.status === "processing") throw new AppError(409, "Document pipeline is already in progress");

		const existingManifest = await getManifestByDocumentId(documentId);
		const extraction = await stage2Extraction({
			documentId: document.id,
			gcsPath: document.gcs_path,
			fileName: document.file_name,
			fileType: document.file_type,
		});
		const canonical = stage3Canonicalization(extraction);
		const pii = stage4PiiMasking(canonical.canonicalText);
		const semantic = stage5SemanticCheck(pii.semanticLossRatio);
		const extractionRecord = stage6GeminiExtraction(extraction);
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
		const escalation = stage8Escalation({
			candidateCount: extraction.summary.candidateCount,
			mappedCount: extraction.summary.mappedCount,
			validationStatus: trust.validationStatus,
		});
		const reasoning = escalation.escalationTriggered
			? await stage9Reasoning(extraction.mappedFields, canonical.canonicalText)
			: null;
		const reviewPrep = stage10ReviewPrep({
			escalationTriggered: escalation.escalationTriggered,
			validationStatus: trust.validationStatus,
		});

		const result = await db.transaction(async (trx) => {
			if (existingManifest) {
				await clearPipelineArtifacts(document.id, trx);
			}

			const manifestPayload = {
				...stage1Ingestion(document.id),
				current_stage: reviewPrep.pipelineStatus === "requires_human" ? "review_prep" : "review_prep",
				pipeline_status: reviewPrep.pipelineStatus,
				semantic_loss_detected: semantic.semanticLossDetected,
				semantic_loss_reason: semantic.semanticLossReason,
				escalation_triggered: escalation.escalationTriggered,
				escalation_stage: escalation.escalationStage,
				escalation_reasons: JSON.stringify(escalation.escalationReasons),
				triage_flags: JSON.stringify(escalation.triageFlags),
				extraction_quality_flags: JSON.stringify(escalation.extractionQualityFlags),
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

			await trx("documents").where({ id: document.id }).update({
				status: reviewPrep.documentStatus,
				extraction_result_json: JSON.stringify(extraction),
				updated_at: new Date(),
			});

			await trx("canonical_projections").insert({
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

			await trx("pii_token_maps").insert({
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
					model_quality_flags: JSON.stringify(extractionRecord.modelQualityFlags),
					input_token_count: extractionRecord.inputTokenCount,
					output_token_count: extractionRecord.outputTokenCount,
					latency_ms: extractionRecord.latencyMs,
					validation_status: extractionRecord.validationStatus,
					validation_errors: JSON.stringify(extractionRecord.validationErrors),
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
						urgency_score: reasoning.urgencyScore,
						urgency_label: reasoning.urgencyLabel,
						urgency_reasons: JSON.stringify(reasoning.urgencyReasons),
						urgency_evidence_refs: JSON.stringify(reasoning.urgencyEvidenceRefs),
						need_category: reasoning.needCategory,
						need_subcategory: reasoning.needSubcategory,
						recommended_skill_keys: JSON.stringify(reasoning.recommendedSkillKeys),
						recommended_action: reasoning.recommendedAction,
						reasoning_confidence: reasoning.reasoningConfidence,
						verification_risk: reasoning.verificationRisk,
						verification_risk_reasons: JSON.stringify(reasoning.verificationRiskReasons),
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
				newValue: { status: reviewPrep.documentStatus, manifestId: manifest.id },
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

		return this.getDocumentPipelineStatus(documentId, user, result.id);
	}

	async getDocumentPipelineStatus(documentId: string, user: AuthenticatedUser, manifestIdOverride?: string) {
		const document = await getDocumentById(documentId);
		if (!document) throw new AppError(404, "Document not found");
		if (user.role !== "superadmin" && user.orgId !== document.org_id) throw new AppError(403, "Cross-organization access is not allowed");

		const manifest = manifestIdOverride
			? ((await db("pipeline_routing_manifests").where({ id: manifestIdOverride }).first()) as ManifestRow | undefined)
			: await getManifestByDocumentId(documentId);
		if (!manifest) throw new AppError(404, "Pipeline manifest not found for document");

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
		if (user.role !== "superadmin" && user.orgId !== document.org_id) throw new AppError(403, "Cross-organization access is not allowed");

		const manifest = await getManifestByDocumentId(documentId);
		if (!manifest) throw new AppError(404, "Pipeline manifest not found for document");

		const [projection, piiMap, extraction, validated, reasoning, reviews] = await Promise.all([
			db("canonical_projections").where({ document_id: documentId }).first(),
			db("pii_token_maps").where({ document_id: documentId }).first(),
			db("ai_extractions").where({ document_id: documentId }).orderBy("created_at", "desc").first(),
			db("validated_candidates").where({ document_id: documentId }).first(),
			db("ai_reasoning_outputs").where({ document_id: documentId }).orderBy("created_at", "desc").first(),
			db("human_reviews").where({ document_id: documentId }).orderBy("reviewed_at", "desc"),
		]);

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
			manifest: mapManifest(manifest),
			canonicalProjection: projection ? { ...projection, text_blocks: fromJson(projection.text_blocks), key_value_pairs: fromJson(projection.key_value_pairs), tables_json: fromJson(projection.tables_json), raw_docai_response: fromJson(projection.raw_docai_response) } : null,
			piiTokenMap: piiMap ? { ...piiMap, dlp_info_types_found: fromJson(piiMap.dlp_info_types_found), inline_token_map: fromJson(piiMap.inline_token_map) } : null,
			aiExtraction: extraction ? { ...extraction, extracted_fields: fromJson(extraction.extracted_fields), missing_fields: fromJson(extraction.missing_fields), contradictions: fromJson(extraction.contradictions), model_quality_flags: fromJson(extraction.model_quality_flags), validation_errors: fromJson(extraction.validation_errors) } : null,
			validatedCandidate: validated ? { ...validated, field_trust_map: fromJson(validated.field_trust_map), validation_flags: fromJson(validated.validation_flags), trusted_fields: fromJson(validated.trusted_fields), untrusted_fields: fromJson(validated.untrusted_fields) } : null,
			reasoningOutput: reasoning ? { ...reasoning, urgency_reasons: fromJson(reasoning.urgency_reasons), urgency_evidence_refs: fromJson(reasoning.urgency_evidence_refs), recommended_skill_keys: fromJson(reasoning.recommended_skill_keys), verification_risk_reasons: fromJson(reasoning.verification_risk_reasons), validation_errors: fromJson(reasoning.validation_errors) } : null,
			humanReviews: reviews.map((review) => ({ ...review, field_corrections: fromJson(review.field_corrections), approved_fields: fromJson(review.approved_fields) })),
		};
	}

	async submitHumanReview(documentId: string, input: { review_action: "approved" | "rejected" | "edited" | "requested_reextraction"; field_corrections?: Record<string, unknown>; review_notes?: string; approved_fields?: Record<string, unknown>; }, user: AuthenticatedUser) {
		const document = await getDocumentById(documentId);
		if (!document) throw new AppError(404, "Document not found");
		if (user.role !== "superadmin" && user.orgId !== document.org_id) throw new AppError(403, "Cross-organization access is not allowed");

		const validated = await db("validated_candidates").where({ document_id: documentId }).first();
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

			const nextStatus = input.review_action === "approved" || input.review_action === "edited"
				? "approved"
				: input.review_action === "requested_reextraction"
					? "uploaded"
					: "failed";
			const nextPipelineStatus = input.review_action === "requested_reextraction"
				? "failed"
				: input.review_action === "rejected"
					? "failed"
					: "completed";
			const nextPipelineStage = input.review_action === "requested_reextraction" ? "ingestion" : "review_prep";

			await trx("documents").where({ id: documentId }).update({
				status: nextStatus,
				extraction_result_json: input.review_action === "requested_reextraction" ? null : document.extraction_result_json,
				updated_at: new Date(),
			});

			if (input.review_action === "requested_reextraction") {
				await clearPipelineArtifacts(documentId, trx);
			}

			if (manifest) {
				await trx("pipeline_routing_manifests").where({ id: manifest.id }).update({
					current_stage: nextPipelineStage,
					pipeline_status: nextPipelineStatus,
					completed_at: input.review_action === "requested_reextraction" ? null : new Date(),
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

		return { ...review, field_corrections: fromJson(review.field_corrections), approved_fields: fromJson(review.approved_fields) };
	}

	async createDraftFormFromPipeline(documentId: string, input: { name?: string }, user: AuthenticatedUser) {
		const document = await getDocumentById(documentId);
		if (!document) throw new AppError(404, "Document not found");
		if (user.role !== "superadmin" && user.orgId !== document.org_id) throw new AppError(403, "Cross-organization access is not allowed");
		const latestReview = await getLatestHumanReview(documentId);
		const isReviewApproved = latestReview?.review_action === "approved" || latestReview?.review_action === "edited";

		if (document.status !== "approved" && !isReviewApproved) {
			throw new AppError(409, "Draft form creation requires an approved pipeline review");
		}

		const result = await formTemplatesService.createTemplateFromDocument(documentId, { name: input.name }, user);
		await auditService.logEvent({
			orgId: document.org_id,
			eventType: "draft_form_created_from_pipeline",
			entityType: "document",
			entityId: document.id,
			actorId: user.id,
			newValue: { templateId: result.template.id, versionId: result.version.id, totalFieldsCreated: result.summary.totalFieldsCreated },
		});
		return result;
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
			if (!user.orgId) throw new AppError(400, "Authenticated user organization context is missing");
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
		if (user.role !== "superadmin" && user.orgId !== manifest.org_id) throw new AppError(403, "Cross-organization access is not allowed");
		return mapManifest(manifest);
	}
}

export const pipelineOrchestrator = new PipelineOrchestrator();
