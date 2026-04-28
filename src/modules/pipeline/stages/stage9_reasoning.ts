import { vertexService } from "../../aiPipeline/vertex.service";

type ReasoningField = {
	label: string;
	category: string;
	fieldCatalogId: string | null;
	confidence: number;
	matchedCatalogKey?: string | null;
	inputType: string;
};

export const stage9Reasoning = async (fields: ReasoningField[], canonicalText: string) => {
	const result = await vertexService.reasonAboutDocument({
		canonicalText,
		fields,
	});

	return {
		providerName: result.providerName,
		modelName: result.model,
		promptVersion: result.promptVersion,
		urgencyScore: result.output.urgencyScore,
		urgencyLabel: result.output.urgencyLabel,
		urgencyReasons: result.output.urgencyReasons,
		urgencyEvidenceRefs: result.output.urgencyEvidenceRefs,
		needCategory: result.output.needCategory,
		needSubcategory: result.output.needSubcategory,
		recommendedSkillKeys: result.output.recommendedSkillKeys,
		recommendedAction: result.output.recommendedAction,
		reasoningConfidence: result.output.reasoningConfidence,
		verificationRisk: result.output.verificationRisk,
		verificationRiskReasons: result.output.verificationRiskReasons,
		inputTokenCount: result.inputTokenCount,
		outputTokenCount: result.outputTokenCount,
		latencyMs: result.latencyMs,
		validationStatus: result.validationStatus,
		validationErrors: result.validationErrors,
		fallbackReason: result.fallbackReason,
		reviewRequired: result.reviewRequired,
		isMock: result.providerName.startsWith("mock"),
	};
};
