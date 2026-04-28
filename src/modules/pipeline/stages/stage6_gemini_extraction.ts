import { DocumentExtractionOrchestrationOutput } from "../../aiPipeline/aiOrchestrator.service";

export const stage6GeminiExtraction = (extraction: DocumentExtractionOrchestrationOutput) => {
	return {
		providerName: extraction.fieldMapping.providerName,
		modelName: extraction.fieldMapping.model,
		modelVersion: extraction.models.vertexProvider,
		promptVersion: extraction.fieldMapping.promptVersion,
		extractedFields: extraction.mappedFields,
		missingFields: extraction.mappedFields
			.filter((field) => field.isCustom)
			.map((field) => field.label),
		contradictions: extraction.fieldMapping.contradictions,
		modelQualityFlags: extraction.fieldMapping.modelQualityFlags,
		inputTokenCount: extraction.fieldMapping.inputTokenCount,
		outputTokenCount: extraction.fieldMapping.outputTokenCount,
		latencyMs: extraction.fieldMapping.latencyMs,
		validationStatus: extraction.fieldMapping.validationStatus,
		validationErrors: extraction.fieldMapping.validationErrors,
		fallbackReason: extraction.fieldMapping.fallbackReason,
		reviewRequired: extraction.fieldMapping.reviewRequired,
		isMock: extraction.providerMode === "mock",
	};
};
