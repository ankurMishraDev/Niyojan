import { DocumentExtractionOrchestrationOutput } from "../../aiPipeline/aiOrchestrator.service";

export const stage3Canonicalization = (extraction: DocumentExtractionOrchestrationOutput) => {
	const textBlocks =
		extraction.documentAi.textBlocks.length > 0
			? extraction.documentAi.textBlocks
			: extraction.extractedFields.map((field, index) => ({
					page: 1,
					block_id: `b${index + 1}`,
					text: `${field.label}: ${field.valueHint || field.inputType}`,
					block_type: "field_candidate",
					bbox: null,
			  }));

	const canonicalText =
		extraction.documentAi.documentText.trim() ||
		extraction.extractedFields
			.map((field, index) => `p1:b${index + 1} ${field.label} (${field.inputType})`)
			.join("\n");

	return {
		extractionMethod: extraction.providerMode === "mock" ? "manual" : "document_ai_form_parser",
		detectedLanguage: extraction.documentAi.detectedLanguage || "en",
		pageCount: extraction.documentAi.pageCount || 1,
		canonicalText,
		textBlocks,
		keyValuePairs:
			extraction.documentAi.keyValuePairs.length > 0
				? extraction.documentAi.keyValuePairs
				: extraction.mappedFields.map((field) => ({
						label: field.label,
						value: field.inputType,
						category: field.category,
						fieldCatalogId: field.fieldCatalogId,
				  })),
		tablesJson: extraction.documentAi.tables,
		rawDocAiResponse: extraction.documentAi.rawResponse,
	};
};
