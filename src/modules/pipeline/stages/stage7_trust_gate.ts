type ExtractionField = {
	label: string;
	inputType: string;
	fieldCatalogId: string | null;
	confidence: number;
	category: string;
	isCustom: boolean;
};

export const stage7TrustGate = (fields: ExtractionField[]) => {
	const trusted = fields.filter((field) => field.confidence >= 0.8 || field.fieldCatalogId !== null);
	const untrusted = fields.filter((field) => !trusted.includes(field));
	const fieldCompleteness = fields.length === 0 ? 0 : trusted.length / fields.length;
	const evidenceStrength = fields.length === 0 ? 0 : trusted.length / fields.length;
	const ruleConsistency = 1;
	const modelSignal = fields.length === 0
		? 0
		: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;
	const composite = Number(((fieldCompleteness + evidenceStrength + ruleConsistency + modelSignal) / 4).toFixed(4));

	return {
		fieldTrustMap: Object.fromEntries(
			fields.map((field) => [field.label, {
				value: field.label,
				confidence: field.confidence,
				trustLevel: trusted.includes(field) ? "trusted" : "needs_review",
				blockedReason: trusted.includes(field) ? null : "Low confidence or custom field",
			}]),
		),
		compositeConfidence: composite,
		fieldCompletenessScore: fieldCompleteness,
		evidenceStrengthScore: evidenceStrength,
		ruleConsistencyScore: ruleConsistency,
		modelSignalScore: modelSignal,
		validationStatus: untrusted.length > 0 ? "requires_human" : "passed",
		validationFlags: untrusted.length > 0 ? ["untrusted_fields_present"] : [],
		trustedFields: trusted,
		untrustedFields: untrusted,
	};
};
