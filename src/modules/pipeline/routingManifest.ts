export type PipelineStageName =
	| "ingestion"
	| "extraction"
	| "canonicalization"
	| "pii_masking"
	| "semantic_check"
	| "gemini_extraction"
	| "trust_gate"
	| "escalation"
	| "reasoning"
	| "review_prep";

export type PipelineStatus = "running" | "completed" | "failed" | "requires_human";

export type RoutingManifestSeed = {
	documentId: string;
	manifestVersion?: string;
	initialModel?: string;
};

export const buildInitialRoutingManifest = (input: RoutingManifestSeed) => {
	return {
		document_id: input.documentId,
		manifest_version: input.manifestVersion || "v1",
		current_stage: "ingestion",
		pipeline_status: "running",
		pii_fields_to_keep: JSON.stringify([]),
		pii_fields_to_tokenize: JSON.stringify([]),
		pii_fields_to_redact: JSON.stringify([]),
		initial_model: input.initialModel || "gemini-flash",
		escalation_triggered: false,
		escalation_reasons: JSON.stringify([]),
		triage_flags: JSON.stringify([]),
		extraction_quality_flags: JSON.stringify([]),
		model_review_flags: JSON.stringify([]),
		auto_approve_eligible: false,
		auto_approve_blocked_by: JSON.stringify([]),
		semantic_loss_detected: false,
		started_at: new Date(),
	};
};
