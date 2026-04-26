type EscalationInput = {
	candidateCount: number;
	mappedCount: number;
	validationStatus: string;
};

export const stage8Escalation = (input: EscalationInput) => {
	const reasons: string[] = [];
	let escalationStage: string | null = null;

	if (input.candidateCount < 3) {
		reasons.push("structured_field_count_below_threshold");
		escalationStage = escalationStage || "post_extraction";
	}

	if (input.mappedCount === 0) {
		reasons.push("no_mapped_fields_detected");
		escalationStage = escalationStage || "post_extraction";
	}

	if (input.validationStatus === "requires_human") {
		reasons.push("trust_gate_requires_human_review");
		escalationStage = escalationStage || "post_model";
	}

	return {
		escalationTriggered: reasons.length > 0,
		escalationStage,
		escalationReasons: reasons,
		triageFlags: [],
		extractionQualityFlags: reasons.filter((reason) => reason.includes("field") || reason.includes("mapped")),
		modelReviewFlags: reasons.filter((reason) => reason.includes("trust_gate")),
	};
};
