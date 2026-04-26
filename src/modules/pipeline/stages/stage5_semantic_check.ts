export const stage5SemanticCheck = (semanticLossRatio: number) => {
	if (semanticLossRatio > 0.4) {
		return {
			semanticLossDetected: true,
			semanticLossReason: "Semantic loss ratio exceeded the scaffold threshold",
			pipelineStatus: "requires_human" as const,
		};
	}

	return {
		semanticLossDetected: false,
		semanticLossReason: null,
		pipelineStatus: "running" as const,
	};
};
