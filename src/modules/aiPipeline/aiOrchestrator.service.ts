import { DocumentExtractionInput, documentAiService } from "./documentAi.service";
import { geminiService } from "./gemini.service";
import { vertexService } from "./vertex.service";

export type DocumentExtractionOrchestrationOutput = {
	providerMode: "live";
	document: {
		id: string;
		gcsPath: string;
		fileName: string;
		fileType: string;
	};
	extractedFields: {
		label: string;
		inputType: string;
		options?: string[];
		required: boolean;
		confidence: number;
		provenanceRef?: string;
		valueHint?: string;
	}[];
	mappedFields: {
		label: string;
		inputType: string;
		required: boolean;
		options: string[] | null;
		confidence: number;
		fieldCatalogId: string | null;
		matchedCatalogKey: string | null;
		isCustom: boolean;
		category: string;
	}[];
	summary: {
		candidateCount: number;
		mappedCount: number;
		customCount: number;
	};
	models: {
		documentExtractor: string;
		fieldMapper: string;
		vertexProvider: string;
	};
	documentAi: Awaited<ReturnType<typeof documentAiService.extractCandidateFields>>;
	fieldMapping: Awaited<ReturnType<typeof geminiService.normalizeAndMapFields>>;
	generatedAt: string;
};

export class AiOrchestratorService {
	async extractAndMapDocumentFields(
		input: DocumentExtractionInput,
	): Promise<DocumentExtractionOrchestrationOutput> {
		const extraction = await documentAiService.extractCandidateFields(input);
		const fieldMapping = await geminiService.normalizeAndMapFields(extraction.fields);

		const mappedCount = fieldMapping.mappedFields.filter((field) => !field.isCustom).length;
		const customCount = fieldMapping.mappedFields.filter((field) => field.isCustom).length;
		const vertexMetadata = vertexService.getProviderMetadata();

		return {
			providerMode: extraction.providerMode,
			document: {
				id: input.documentId,
				gcsPath: input.gcsPath,
				fileName: input.fileName,
				fileType: input.fileType,
			},
			extractedFields: extraction.fields,
			mappedFields: fieldMapping.mappedFields,
			summary: {
				candidateCount: extraction.fields.length,
				mappedCount,
				customCount,
			},
			models: {
				documentExtractor: extraction.model,
				fieldMapper: fieldMapping.model,
				vertexProvider: vertexMetadata.provider,
			},
			documentAi: extraction,
			fieldMapping,
			generatedAt: new Date().toISOString(),
		};
	}
}

export const aiOrchestratorService = new AiOrchestratorService();
