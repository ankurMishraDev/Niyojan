import { gcsBucketName, getStorageClient } from "../../config/gcp";
import { getGoogleAccessToken } from "../../config/googleCredentials";
import { env } from "../../config/env";
import { PDFParse } from "pdf-parse";
import { recognize } from "tesseract.js";
import { vertexService } from "./vertex.service";
import { z } from "zod";
import {
	ExtractedCandidateField,
	extractedCandidateFieldSchema,
} from "./ai.schemas";

const geminiFallbackSchema = z.any();

const GEMINI_DOCUMENT_EXTRACTION_PROMPT = [
	"Extract all user-visible form fields from this document in top-to-bottom reading order.",
	"Return JSON only in the required schema.",
	"Include blank fields from empty forms and filled values from completed forms.",
	"Use `valueHint` for any detected filled value, selected option, checkbox state, or handwritten/typed answer.",
	"Infer `inputType` carefully: text, number, boolean, date, select, multiselect, textarea.",
	"Do not skip signature, consent, checkbox, or footer fields if they are actual form inputs.",
	"Do not output duplicate fields.",
	"Keep exactly the same order as the document.",
].join(" ");

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

type ProcessorAttempt = {
	id: string;
	kind: "form" | "ocr";
};

export type DocumentExtractionResult = {
	providerMode: "live";
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
		const match = line.match(/^([^:]{2,80}):\s*(.*)$/);
		if (match) {
			const [, rawLabel, rawValue] = match;
			const parsed = extractedCandidateFieldSchema.safeParse({
				label: rawLabel.trim(),
				inputType: inferInputType(rawValue),
				required: false,
				confidence: 0.62,
				valueHint: rawValue.trim() || undefined,
			});
			if (parsed.success) {
				candidates.push(parsed.data);
			}
			continue;
		}

		const blankFieldMatch = line.match(/^([A-Za-z][A-Za-z0-9 /()_-]{1,80}?)(?:\.{3,}|_{3,}|\s{4,})$/);
		if (!blankFieldMatch) {
			continue;
		}

		const parsed = extractedCandidateFieldSchema.safeParse({
			label: blankFieldMatch[1]?.trim(),
			inputType: "text",
			required: false,
			confidence: 0.5,
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

const normalizeChoiceOption = (value: string) => value.trim().toLowerCase();

const splitChoiceSuffix = (label: string) => {
	const match = label.match(/^(.*?)(?::|\-|\u2022)\s*(yes|no|male|female|other|true|false)$/i);
	if (!match) {
		return null;
	}

	return {
		baseLabel: match[1].trim(),
		option: match[2].trim(),
	};
};

const mergeChoiceCandidates = (fields: ExtractedCandidateField[]) => {
	const merged: ExtractedCandidateField[] = [];
	for (const field of fields) {
		const choiceParts = splitChoiceSuffix(field.label);
		if (!choiceParts) {
			merged.push(field);
			continue;
		}

		const existing = merged.find((candidate) => candidate.label === choiceParts.baseLabel);
		if (!existing) {
			merged.push({
				...field,
				label: choiceParts.baseLabel,
				inputType:
					normalizeChoiceOption(choiceParts.option) === "yes" || normalizeChoiceOption(choiceParts.option) === "no"
						? "boolean"
						: "select",
				options: [choiceParts.option],
				valueHint: undefined,
			});
			continue;
		}

		const nextOptions = new Set([...(existing.options || []), choiceParts.option]);
		existing.options = Array.from(nextOptions);
		existing.inputType =
			nextOptions.size === 2 && Array.from(nextOptions).every((option) => ["yes", "no"].includes(normalizeChoiceOption(option)))
				? "boolean"
				: "select";
		if (!existing.valueHint && field.valueHint) {
			existing.valueHint = field.valueHint;
		}
	}

	return merged;
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
			if (!label) {
				return;
			}

			if (value) {
				keyValuePairs.push({
					label,
					value,
					confidence: Number(formField.confidence || 0.7),
					page: pageNumber,
				});
			}

			const parsed = extractedCandidateFieldSchema.safeParse({
				label,
				inputType: inferInputType(value || ""),
				required: false,
				confidence: Number(formField.confidence || 0.7),
				valueHint: value || undefined,
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

const buildManualReviewResult = (
	input: DocumentExtractionInput,
	reason: string,
	startedAt = Date.now(),
): DocumentExtractionResult => {
	return {
		providerMode: "live",
		providerName: "document-ai",
		model: `document-ai:${env.DOCUMENT_AI_PROCESSOR_ID}`,
		fields: [],
		documentText: "",
		textBlocks: [],
		keyValuePairs: [],
		tables: [],
		pageCount: 1,
		detectedLanguage: null,
		rawResponse: {
			reason,
			fileName: input.fileName,
		},
		latencyMs: Date.now() - startedAt,
		validationStatus: "requires_human",
		validationErrors: [reason],
		fallbackReason: reason,
		reviewRequired: true,
	};
};

const buildLocalTextFallbackResult = (
	input: DocumentExtractionInput,
	documentText: string,
	reason: string,
	providerName: string,
	model: string,
	startedAt = Date.now(),
): DocumentExtractionResult | null => {
	const fields = dedupeCandidates(collectCandidateFromLines(documentText));
	if (fields.length === 0) {
		return null;
	}

	return {
		providerMode: "live",
		providerName,
		model,
		fields,
		documentText,
		textBlocks: buildTextBlocks(documentText),
		keyValuePairs: [],
		tables: [],
		pageCount: 1,
		detectedLanguage: null,
		rawResponse: {
			reason,
			fileName: input.fileName,
		},
		latencyMs: Date.now() - startedAt,
		validationStatus: "fallback",
		validationErrors: [reason],
		fallbackReason: reason,
		reviewRequired: true,
	};
};

const extractPdfText = async (fileBytes: Buffer) => {
	const parser = new PDFParse({ data: new Uint8Array(fileBytes) });
	try {
		const result = await parser.getText();
		return result.text || "";
	} finally {
		await parser.destroy();
	}
};

const extractImageText = async (fileBytes: Buffer) => {
	const result = await recognize(fileBytes, "eng");
	return result.data.text || "";
};

const downloadDocumentBytes = async (gcsPath: string) => {
	const storage = getStorageClient();
	const [bytes] = await storage.bucket(gcsBucketName).file(gcsPath).download();
	return bytes;
};

const resolveProcessorAttempts = () => {
	const attempts: ProcessorAttempt[] = [];
	const seen = new Set<string>();

	const add = (id: string | undefined, kind: ProcessorAttempt["kind"]) => {
		if (!id || seen.has(id)) {
			return;
		}
		seen.add(id);
		attempts.push({ id, kind });
	};

	add(env.DOCUMENT_AI_PROCESSOR_ID_FORM, "form");
	add(env.DOCUMENT_AI_PROCESSOR_ID_OCR, "ocr");

	return attempts;
};

const toOptionalStringArray = (value: unknown) =>
	Array.isArray(value)
		? value.map((item) => String(item).trim()).filter(Boolean)
		: undefined;

const normalizeGeminiField = (field: Record<string, unknown>) => {
	const label = [field.label, field.fieldLabel, field.name, field.fieldName, field.question, field.title]
		.find((value) => typeof value === "string" && value.trim().length > 0);
	const inputType = [field.inputType, field.fieldType, field.type]
		.find((value) => typeof value === "string" && value.trim().length > 0);
	const rawValueHint = [field.valueHint, field.value, field.answer, field.selectedValue, field.selectedOption]
		.find((value) => value !== undefined);

	const parsed = extractedCandidateFieldSchema.safeParse({
		label,
		inputType: typeof inputType === "string" ? inputType : "text",
		options: toOptionalStringArray(field.options),
		required: typeof field.required === "boolean" ? field.required : false,
		confidence: typeof field.confidence === "number" ? field.confidence : 0.7,
		provenanceRef: typeof field.provenanceRef === "string" ? field.provenanceRef : undefined,
		valueHint:
			rawValueHint === null || rawValueHint === undefined
				? undefined
				: typeof rawValueHint === "string"
					? rawValueHint
					: String(rawValueHint),
	});

	return parsed.success ? parsed.data : null;
};

const normalizeGeminiOutputFields = (rawOutput: unknown) => {
	const candidateArray = Array.isArray(rawOutput)
		? rawOutput
		: Array.isArray((rawOutput as { fields?: unknown[] } | null | undefined)?.fields)
			? ((rawOutput as { fields?: unknown[] }).fields as unknown[])
			: [];

	return candidateArray
		.map((field) => (field && typeof field === "object" ? normalizeGeminiField(field as Record<string, unknown>) : null))
		.filter((field): field is ExtractedCandidateField => Boolean(field));
};

const extractWithGemini = async (input: DocumentExtractionInput, fileBytes: Buffer, startedAt: number) => {
	const geminiExtract = await vertexService.generateStructuredJson({
		model: env.VERTEX_DOCUMENT_MODEL,
		promptVersion: "doc_extract_v2",
		schema: geminiFallbackSchema,
		prompt: GEMINI_DOCUMENT_EXTRACTION_PROMPT,
		fileData: {
			mimeType: input.fileType,
			data: fileBytes.toString("base64"),
		},
	});

	if ("validationErrors" in geminiExtract && geminiExtract.validationErrors?.length) {
		throw new Error(geminiExtract.validationErrors.join(", "));
	}

	const rawOutput = (geminiExtract as { output?: unknown }).output;
	const normalizedFields = normalizeGeminiOutputFields(rawOutput);
	const fields = dedupeCandidates(mergeChoiceCandidates(normalizedFields));
	return {
		providerMode: "live" as const,
		providerName: "gemini-document-extractor",
		model: geminiExtract.model,
		fields,
		documentText: "",
		textBlocks: [],
		keyValuePairs: fields
			.filter((field) => field.valueHint)
			.map((field) => ({
				label: field.label,
				value: field.valueHint as string,
				confidence: field.confidence,
				page: 1,
			})),
		tables: [],
		pageCount: 1,
		detectedLanguage: null,
		rawResponse: geminiExtract,
		latencyMs: Date.now() - startedAt,
		validationStatus: fields.length > 0 ? "passed" as const : "requires_human" as const,
		validationErrors: fields.length > 0 ? [] : ["gemini_returned_no_fields"],
		fallbackReason: fields.length > 0 ? null : "gemini_returned_no_fields",
		reviewRequired: fields.length === 0,
	};
};

const callDocumentAiProcessor = async (
	processorId: string,
	fileBytes: Buffer,
	fileType: string,
	accessToken: string,
) => {
	const endpoint = `https://${env.DOCUMENT_AI_LOCATION}-documentai.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/locations/${env.DOCUMENT_AI_LOCATION}/processors/${processorId}:process`;
	return fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			skipHumanReview: true,
			rawDocument: {
				content: fileBytes.toString("base64"),
				mimeType: fileType,
			},
		}),
	});
};

export class DocumentAiService {
	async extractCandidateFields(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
		const startedAt = Date.now();
		if (!SUPPORTED_MIME_TYPES.has(input.fileType)) {
			return buildManualReviewResult(
				input,
				"unsupported_file_type_requires_manual_review",
				startedAt,
			);
		}

		try {
			const fileBytes = await downloadDocumentBytes(input.gcsPath);
			console.info("Document extraction started", {
				documentId: input.documentId,
				fileName: input.fileName,
				fileType: input.fileType,
				vertexModel: env.VERTEX_DOCUMENT_MODEL,
			});

			try {
				const geminiResult = await extractWithGemini(input, fileBytes, startedAt);
				console.info("Gemini extraction result", {
					documentId: input.documentId,
					candidateCount: geminiResult.fields.length,
					validationStatus: geminiResult.validationStatus,
				});
				if (geminiResult.fields.length > 0) {
					return geminiResult;
				}
			} catch (geminiError) {
				console.error("Gemini extraction failed", {
					documentId: input.documentId,
					error: geminiError instanceof Error ? geminiError.message : geminiError,
				});
			}

			if (input.fileType === "application/pdf") {
				try {
					const parsedPdfText = await extractPdfText(fileBytes);
					const localPdfFallback = buildLocalTextFallbackResult(
						input,
						parsedPdfText,
						"document_ai_failed_used_local_pdf_text",
						"local-pdf-text-fallback",
						"pdf-parse",
						startedAt,
					);
					if (localPdfFallback) {
						return localPdfFallback;
					}
				} catch (pdfError) {
					console.error("Local PDF text fallback failed", pdfError);
				}
			}

			if (input.fileType.startsWith("image/")) {
				try {
					const imageText = await extractImageText(fileBytes);
					const localImageFallback = buildLocalTextFallbackResult(
						input,
						imageText,
						"document_ai_failed_used_local_image_ocr",
						"local-image-ocr-fallback",
						"tesseract.js",
						startedAt,
					);
					if (localImageFallback) {
						return localImageFallback;
					}
				} catch (imageError) {
					console.error("Local image OCR fallback failed", imageError);
				}
			}

			return buildManualReviewResult(
				input,
				"no_fields_detected_after_gemini_and_local_fallbacks",
				startedAt,
			);

		} catch (error) {
			return buildManualReviewResult(
				input,
				error instanceof Error ? error.message : "document_ai_live_call_failed",
				startedAt,
			);
		}
	}
}

export const documentAiService = new DocumentAiService();
