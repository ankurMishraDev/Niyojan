import { DocumentExtractionOrchestrationOutput } from "../../aiPipeline/aiOrchestrator.service";

export const stage3Canonicalization = (extraction: DocumentExtractionOrchestrationOutput) => {
	const textBlocks = extraction.extractedFields.map((field, index) => ({
		page: 1,
		block_id: `b${index + 1}`,
		text: `${field.label}: ${Array.isArray(field.options) ? field.options.join(", ") : field.inputType}`,
		block_type: "field_candidate",
		bbox: null,
	}));

	const canonicalText = extraction.extractedFields
		.map((field, index) => `p1:b${index + 1} ${field.label} (${field.inputType})`)
		.join("\n");

	return {
		extractionMethod: extraction.providerMode === "mock" ? "manual" : "document_ai_form_parser",
		detectedLanguage: "en",
		pageCount: 1,
		canonicalText,
		textBlocks,
		keyValuePairs: extraction.mappedFields.map((field) => ({
			label: field.label,
			inputType: field.inputType,
			category: field.category,
			fieldCatalogId: field.fieldCatalogId,
		})),
		tablesJson: [],
		rawDocAiResponse: extraction,
	};
};
