type ReasoningField = {
	label: string;
	category: string;
	fieldCatalogId: string | null;
	confidence: number;
	matchedCatalogKey?: string | null;
	inputType: string;
};

export const stage9Reasoning = (fields: ReasoningField[]) => {
	const categories = Array.from(new Set(fields.map((field) => field.category).filter(Boolean)));
	const recommendedSkillKeys = Array.from(
		new Set(
			fields
				.map((field) => field.matchedCatalogKey)
				.filter((value): value is string => Boolean(value))
				.slice(0, 3),
		),
	);

	return {
		modelName: "gemini-1.5-pro",
		promptVersion: "reasoning_prompt_v1",
		urgencyScore: fields.length > 4 ? 78 : 62,
		urgencyLabel: fields.length > 4 ? "high" : "medium",
		urgencyReasons: ["Scaffold reasoning generated from extracted field density"],
		urgencyEvidenceRefs: fields.slice(0, 3).map((field, index) => `p1:b${index + 1}`),
		needCategory: categories[0] || "general",
		needSubcategory: null,
		recommendedSkillKeys,
		recommendedAction: "Route to human review and form refinement",
		reasoningConfidence: 0.72,
		verificationRisk: "medium",
		verificationRiskReasons: ["Mock pipeline scaffold requires reviewer confirmation"],
		inputTokenCount: fields.length * 18,
		outputTokenCount: 60,
		latencyMs: 0,
		isMock: true,
	};
};
