import { gcsBucketName, getStorageClient } from "../../config/gcp";
import { getGoogleAccessToken } from "../../config/googleCredentials";
import { env } from "../../config/env";
import {
	ExtractedCandidateField,
	extractedCandidateFieldSchema,
} from "./ai.schemas";

export type DocumentExtractionInput = {
	documentId: string;
	gcsPath: string;
	fileName: string;
	fileType: string;
};

type TextBlock = {
	page: number;
	block_id: string;
	text: string;
	block_type: string;
	bbox: unknown;
};

type KeyValuePair = {
	label: string;
	value: string;
	confidence: number;
	page: number;
};

type ProcessedDocument = {
	text?: string;
	entities?: Array<Record<string, unknown>>;
	pages?: Array<Record<string, unknown>>;
};

export type DocumentExtractionResult = {
	providerMode: "mock" | "live";
	providerName: string;
	model: string;
	fields: ExtractedCandidateField[];
	documentText: string;
	textBlocks: TextBlock[];
	keyValuePairs: KeyValuePair[];
	tables: unknown[];
	pageCount: number;
	detectedLanguage: string | null;
	rawResponse: unknown;
	latencyMs: number;
	validationStatus: "passed" | "fallback" | "requires_human";
	validationErrors: string[];
	fallbackReason: string | null;
	reviewRequired: boolean;
};

const SUPPORTED_MIME_TYPES = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/tiff",
]);

const mockHouseholdFields: ExtractedCandidateField[] = [
	{ label: "Household Size", inputType: "number", required: true, confidence: 0.97 },
	{ label: "Respondent Age", inputType: "number", required: true, confidence: 0.94 },
	{
		label: "Respondent Gender",
		inputType: "select",
		options: ["male", "female", "other", "prefer_not_to_say"],
		required: true,
		confidence: 0.91,
	},
	{
		label: "Primary Water Access",
		inputType: "select",
		options: ["piped", "well", "tanker", "river", "none"],
		required: true,
		confidence: 0.89,
	},
	{ label: "Immediate Medical Need", inputType: "boolean", required: true, confidence: 0.88 },
	{
		label: "Urgent Assistance Required",
		inputType: "multiselect",
		options: ["food", "medical", "shelter", "water", "counseling"],
		required: true,
		confidence: 0.86,
	},
	{ label: "Case Notes", inputType: "textarea", required: false, confidence: 0.84 },
	{ label: "Consent Given", inputType: "boolean", required: true, confidence: 0.98 },
];

const mockGeneralFields: ExtractedCandidateField[] = [
	{ label: "Respondent Name", inputType: "text", required: true, confidence: 0.87 },
	{ label: "Village Name", inputType: "text", required: true, confidence: 0.83 },
	{
		label: "Urgent Assistance Required",
		inputType: "multiselect",
		options: ["food", "medical", "shelter", "water", "counseling"],
		required: true,
		confidence: 0.82,
	},
	{ label: "Case Notes", inputType: "textarea", required: false, confidence: 0.8 },
];

const chooseMockFields = (fileName: string) => {
	const normalized = fileName.toLowerCase();
	return normalized.includes("household") || normalized.includes("assessment")
		? mockHouseholdFields
		: mockGeneralFields;
};

const toArray = <T>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

const readTextAnchor = (documentText: string, textAnchor: unknown) => {
	const segments = toArray<{ startIndex?: string; endIndex?: string }>(
		(textAnchor as { textSegments?: unknown })?.textSegments,
	);

	if (segments.length === 0) {
		return "";
	}

	return segments
		.map((segment) => {
			const start = Number(segment.startIndex || 0);
			const end = Number(segment.endIndex || documentText.length);
			return documentText.slice(start, end);
		})
		.join("")
		.trim();
};

const inferInputType = (value: string) => {
	const normalized = value.trim().toLowerCase();

	if (normalized === "yes" || normalized === "no" || normalized === "true" || normalized === "false") {
		return "boolean";
	}

	if (/^\d+(\.\d+)?$/.test(normalized)) {
		return "number";
	}

	if (normalized.includes(",") || normalized.includes(";")) {
		return "multiselect";
	}

	if (normalized.length > 80) {
		return "textarea";
	}

	return "text";
};

const humanizeType = (value: string) =>
	value
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\b\w/g, (match) => match.toUpperCase());

const splitTextLines = (value: string) =>
	value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

const collectCandidateFromLines = (documentText: string) => {
	const candidates: ExtractedCandidateField[] = [];
	for (const line of splitTextLines(documentText)) {
		const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
		if (!match) {
			continue;
		}

		const [, rawLabel, rawValue] = match;
		const parsed = extractedCandidateFieldSchema.safeParse({
			label: rawLabel.trim(),
			inputType: inferInputType(rawValue),
			required: false,
			confidence: 0.62,
			valueHint: rawValue.trim(),
		});
		if (parsed.success) {
			candidates.push(parsed.data);
		}
	}

	return candidates;
};

const dedupeCandidates = (fields: ExtractedCandidateField[]) => {
	const seen = new Set<string>();
	return fields.filter((field) => {
		const key = `${field.label.toLowerCase()}::${field.inputType}`;
		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
};

const buildTextBlocks = (documentText: string) => {
	return splitTextLines(documentText).map((line, index) => ({
		page: 1,
		block_id: `b${index + 1}`,
		text: line,
		block_type: "ocr_line",
		bbox: null,
	}));
};

const parseDocumentAiPayload = (payload: unknown) => {
	const document = ((payload as { document?: ProcessedDocument })?.document || {}) as ProcessedDocument;
	const documentText = document.text || "";
	const pages = toArray<Record<string, unknown>>(document.pages);
	const entities = toArray<Record<string, unknown>>(document.entities);
	const validationErrors: string[] = [];

	const formFieldCandidates: ExtractedCandidateField[] = [];
	const keyValuePairs: KeyValuePair[] = [];
	const tables: unknown[] = [];

	pages.forEach((page, pageIndex) => {
		const pageNumber = Number(page.pageNumber || pageIndex + 1);
		const formFields = toArray<Record<string, unknown>>(page.formFields);
		formFields.forEach((formField) => {
			const label = readTextAnchor(documentText, (formField.fieldName as { textAnchor?: unknown })?.textAnchor);
			const value = readTextAnchor(documentText, (formField.fieldValue as { textAnchor?: unknown })?.textAnchor);
			if (!label || !value) {
				return;
			}

			keyValuePairs.push({
				label,
				value,
				confidence: Number(formField.confidence || 0.7),
				page: pageNumber,
			});

			const parsed = extractedCandidateFieldSchema.safeParse({
				label,
				inputType: inferInputType(value),
				required: false,
				confidence: Number(formField.confidence || 0.7),
				valueHint: value,
				provenanceRef: `p${pageNumber}:form_field`,
			});
			if (parsed.success) {
				formFieldCandidates.push(parsed.data);
			}
		});

		const pageTables = toArray<Record<string, unknown>>(page.tables);
		pageTables.forEach((table) => {
			tables.push({
				page: pageNumber,
				headerRows: toArray<Record<string, unknown>>(table.headerRows).length,
				bodyRows: toArray<Record<string, unknown>>(table.bodyRows).length,
			});
		});
	});

	const entityCandidates = entities
		.map((entity) => {
			const mentionText = String(entity.mentionText || "").trim();
			const label = humanizeType(String(entity.type || entity.type_ || "Extracted Field"));
			const parsed = extractedCandidateFieldSchema.safeParse({
				label,
				inputType: inferInputType(mentionText),
				required: false,
				confidence: Number(entity.confidence || 0.65),
				valueHint: mentionText || undefined,
				provenanceRef: entity.pageAnchor ? "entity" : undefined,
			});

			return parsed.success ? parsed.data : null;
		})
		.filter((candidate): candidate is ExtractedCandidateField => Boolean(candidate));

	const lineCandidates = collectCandidateFromLines(documentText);
	const fields = dedupeCandidates([...formFieldCandidates, ...entityCandidates, ...lineCandidates]);

	if (!documentText.trim()) {
		validationErrors.push("document_text_empty");
	}

	if (fields.length === 0) {
		validationErrors.push("no_candidate_fields_extracted");
	}

	const detectedLanguage =
		String(
			(
				(
					toArray<Record<string, unknown>>(
						(pages[0] as { detectedLanguages?: unknown })?.detectedLanguages,
					)[0] as { languageCode?: string } | undefined
				)?.languageCode || ""
			),
		) || null;

	return {
		fields,
		documentText,
		textBlocks: buildTextBlocks(documentText),
		keyValuePairs,
		tables,
		pageCount: pages.length || 1,
		detectedLanguage,
		validationErrors,
	};
};

const buildMockResult = (input: DocumentExtractionInput, reason?: string): DocumentExtractionResult => {
	const fields = chooseMockFields(input.fileName);
	const documentText = fields
		.map((field) => `${field.label}: ${field.inputType}`)
		.join("\n");

	return {
		providerMode: "mock",
		providerName: "mock-document-ai",
		model: "mock-document-extractor-v1",
		fields,
		documentText,
		textBlocks: buildTextBlocks(documentText),
		keyValuePairs: fields.map((field, index) => ({
			label: field.label,
			value: field.inputType,
			confidence: field.confidence,
			page: 1,
		})),
		tables: [],
		pageCount: 1,
		detectedLanguage: "en",
		rawResponse: {
			reason: reason || "mock_mode",
			fileName: input.fileName,
		},
		latencyMs: 0,
		validationStatus: reason ? "fallback" : "passed",
		validationErrors: reason ? [reason] : [],
		fallbackReason: reason || null,
		reviewRequired: Boolean(reason),
	};
};

const downloadDocumentBytes = async (gcsPath: string) => {
	const storage = getStorageClient();
	if (!storage) {
		throw new Error("Storage client is unavailable in GCP mock mode");
	}

	const [bytes] = await storage.bucket(gcsBucketName).file(gcsPath).download();
	return bytes;
};

export class DocumentAiService {
	async extractCandidateFields(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
		if (env.AI_PROVIDER_MODE === "mock") {
			return buildMockResult(input);
		}

		if (!SUPPORTED_MIME_TYPES.has(input.fileType)) {
			return buildMockResult(input, "unsupported_file_type_requires_manual_review");
		}

		const startedAt = Date.now();

		try {
			const fileBytes = await downloadDocumentBytes(input.gcsPath);
			const accessToken = await getGoogleAccessToken();
			const endpoint = `https://${env.DOCUMENT_AI_LOCATION}-documentai.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/locations/${env.DOCUMENT_AI_LOCATION}/processors/${env.DOCUMENT_AI_PROCESSOR_ID}:process`;
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					skipHumanReview: true,
					rawDocument: {
						content: fileBytes.toString("base64"),
						mimeType: input.fileType,
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`Document AI request failed with status ${response.status}`);
			}

			const payload = (await response.json()) as unknown;
			const parsed = parseDocumentAiPayload(payload);
			const validationStatus =
				parsed.validationErrors.length > 0
					? parsed.fields.length > 0
						? "fallback"
						: "requires_human"
					: "passed";

			return {
				providerMode: "live",
				providerName: "document-ai",
				model: `document-ai:${env.DOCUMENT_AI_PROCESSOR_ID}`,
				fields: parsed.fields,
				documentText: parsed.documentText,
				textBlocks: parsed.textBlocks,
				keyValuePairs: parsed.keyValuePairs,
				tables: parsed.tables,
				pageCount: parsed.pageCount,
				detectedLanguage: parsed.detectedLanguage,
				rawResponse: payload,
				latencyMs: Date.now() - startedAt,
				validationStatus,
				validationErrors: parsed.validationErrors,
				fallbackReason:
					parsed.validationErrors.length > 0 ? parsed.validationErrors.join(",") : null,
				reviewRequired: validationStatus !== "passed",
			};
		} catch (error) {
			return buildMockResult(
				input,
				error instanceof Error ? error.message : "document_ai_live_call_failed",
			);
		}
	}
}

export const documentAiService = new DocumentAiService();
