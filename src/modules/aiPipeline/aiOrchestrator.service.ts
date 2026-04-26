import { documentAiService, DocumentExtractionInput } from "./documentAi.service";
import { geminiService } from "./gemini.service";
import { vertexService } from "./vertex.service";

export type DocumentExtractionOrchestrationOutput = {
	providerMode: "mock" | "live";
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
	generatedAt: string;
};

export class AiOrchestratorService {
	async extractAndMapDocumentFields(
		input: DocumentExtractionInput,
	): Promise<DocumentExtractionOrchestrationOutput> {
		const extraction = await documentAiService.extractCandidateFields(input);
		const mappedFields = await geminiService.normalizeAndMapFields(extraction.fields);

		const mappedCount = mappedFields.filter((field) => !field.isCustom).length;
		const customCount = mappedFields.filter((field) => field.isCustom).length;

		const geminiMetadata = geminiService.getProviderMetadata();
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
			mappedFields,
			summary: {
				candidateCount: extraction.fields.length,
				mappedCount,
				customCount,
			},
			models: {
				documentExtractor: extraction.model,
				fieldMapper: geminiMetadata.model,
				vertexProvider: vertexMetadata.provider,
			},
			generatedAt: new Date().toISOString(),
		};
	}
}

export const aiOrchestratorService = new AiOrchestratorService();
