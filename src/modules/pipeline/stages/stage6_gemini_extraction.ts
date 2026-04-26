import { DocumentExtractionOrchestrationOutput } from "../../aiPipeline/aiOrchestrator.service";

export const stage6GeminiExtraction = (extraction: DocumentExtractionOrchestrationOutput) => {
	return {
		modelName: extraction.models.fieldMapper,
		modelVersion: extraction.models.vertexProvider,
		promptVersion: "extraction_prompt_v1",
		extractedFields: extraction.mappedFields,
		missingFields: extraction.mappedFields.filter((field) => field.isCustom).map((field) => field.label),
		contradictions: [],
		modelQualityFlags: [],
		inputTokenCount: extraction.extractedFields.length * 20,
		outputTokenCount: extraction.mappedFields.length * 12,
		latencyMs: 0,
		isMock: extraction.providerMode === "mock",
	};
};
