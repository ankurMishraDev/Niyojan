import { z } from "zod";
import { db } from "../../config/db";
import { env } from "../../config/env";
import {
	ExtractedCandidateField,
	MappedFieldShape,
	mappedFieldSchema,
} from "./ai.schemas";
import { vertexService } from "./vertex.service";

type FieldCatalogRow = {
	id: string;
	key: string;
	name: string;
	category: string;
	input_type: string;
	options_json: unknown;
};

export type MappedField = {
	label: string;
	inputType: string;
	required: boolean;
	options: string[] | null;
	confidence: number;
	fieldCatalogId: string | null;
	matchedCatalogKey: string | null;
	isCustom: boolean;
	category: string;
};

export type FieldMappingResult = {
	providerName: string;
	mode: "live";
	model: string;
	promptVersion: string;
	mappedFields: MappedField[];
	contradictions: string[];
	modelQualityFlags: string[];
	inputTokenCount: number | null;
	outputTokenCount: number | null;
	latencyMs: number;
	validationStatus: "passed" | "fallback" | "requires_human";
	validationErrors: string[];
	fallbackReason: string | null;
	reviewRequired: boolean;
};

const fromJson = (value: unknown) => {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	return value;
};

const normalizeToKey = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

const inferCategory = (label: string) => {
	const lower = label.toLowerCase();

	if (lower.includes("water") || lower.includes("sanitation")) return "water_sanitation";
	if (lower.includes("medical") || lower.includes("health") || lower.includes("illness")) return "health";
	if (lower.includes("school") || lower.includes("education")) return "education";
	if (lower.includes("income") || lower.includes("livelihood") || lower.includes("employment")) return "livelihood";
	if (lower.includes("house") || lower.includes("shelter")) return "shelter";

	return "general";
};

const applyCatalogMatch = (
	candidate: ExtractedCandidateField,
	matched: FieldCatalogRow | null,
): MappedField => {
	const mappedOptions = matched ? (fromJson(matched.options_json) as string[] | null) : null;

	return {
		label: matched ? matched.name : candidate.label,
		inputType: matched ? matched.input_type : candidate.inputType,
		required: candidate.required,
		options: mappedOptions || candidate.options || null,
		confidence: candidate.confidence,
		fieldCatalogId: matched ? matched.id : null,
		matchedCatalogKey: matched ? matched.key : null,
		isCustom: !matched,
		category: matched ? matched.category : inferCategory(candidate.label),
	};
};

const buildDeterministicMapping = (
	candidates: ExtractedCandidateField[],
	catalogRows: FieldCatalogRow[],
) => {
	const byKey = new Map<string, FieldCatalogRow>();
	const byName = new Map<string, FieldCatalogRow>();

	for (const row of catalogRows) {
		byKey.set(row.key.toLowerCase(), row);
		byName.set(row.name.trim().toLowerCase(), row);
	}

	const mappedFields = candidates.map((candidate) => {
		const normalizedKey = normalizeToKey(candidate.label);
		const matched =
			byKey.get(normalizedKey) ||
			byName.get(candidate.label.trim().toLowerCase()) ||
			null;

		return applyCatalogMatch(candidate, matched);
	});

	return mappedFields;
};

const normalizeFieldIdentity = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

const modelOutputSchema = z.array(mappedFieldSchema);

export class GeminiService {
	async normalizeAndMapFields(candidates: ExtractedCandidateField[]): Promise<FieldMappingResult> {
		const catalogRows = (await db("field_catalog")
			.select("id", "key", "name", "category", "input_type", "options_json")) as FieldCatalogRow[];

		const deterministicMapping = buildDeterministicMapping(candidates, catalogRows);

		try {
			const prompt = [
				"You map extracted document fields to a known field catalog.",
				"Return JSON only as an array.",
				"Return exactly one output item for each candidate field.",
				"Preserve the same field order as the candidate input array.",
				"Do not add, drop, merge, or duplicate fields.",
				"Each item must include label, inputType, required, options, confidence, matchedCatalogKey, isCustom, and category.",
				"If there is no confident match, set matchedCatalogKey to null and isCustom to true.",
				"Available field catalog:",
				JSON.stringify(
					catalogRows.map((row) => ({
						key: row.key,
						name: row.name,
						category: row.category,
						inputType: row.input_type,
						options: fromJson(row.options_json),
					})),
				),
				"Candidate fields:",
				JSON.stringify(candidates),
			].join("\n");

			const result = await vertexService.generateStructuredJson({
				model: env.VERTEX_DOCUMENT_MODEL,
				promptVersion: "field_mapping_v1",
				schema: modelOutputSchema,
				prompt,
			});

			if ("validationErrors" in result && result.validationErrors?.length) {
				throw new Error("Vertex mapping failed");
			}

			if (result.output.length !== candidates.length) {
				throw new Error(
					`Vertex mapping returned ${result.output.length} items for ${candidates.length} candidates`,
				);
			}

			const seenModelFields = new Set<string>();
			for (const field of result.output) {
				const identity = field.matchedCatalogKey || normalizeFieldIdentity(field.label);
				if (seenModelFields.has(identity)) {
					throw new Error(`Vertex mapping produced duplicate field identity: ${identity}`);
				}
				seenModelFields.add(identity);
			}

			const catalogByKey = new Map(catalogRows.map((row) => [row.key, row]));
			const mappedFields = result.output.map((field: MappedFieldShape) => {
				const matched = field.matchedCatalogKey
					? catalogByKey.get(field.matchedCatalogKey) || null
					: null;
				const pseudoCandidate: ExtractedCandidateField = {
					label: field.label,
					inputType: field.inputType,
					options: field.options || undefined,
					required: field.required,
					confidence: field.confidence,
				};

				const applied = applyCatalogMatch(pseudoCandidate, matched);
				return {
					...applied,
					isCustom: field.isCustom || !matched,
					category: matched ? matched.category : field.category,
				};
			});

			const customCount = mappedFields.filter((field) => field.isCustom).length;
			return {
				providerName: result.providerName,
				mode: "live",
				model: result.model,
				promptVersion: result.promptVersion,
				mappedFields,
				contradictions: [],
				modelQualityFlags: customCount > 0 ? ["custom_fields_present"] : [],
				inputTokenCount: result.inputTokenCount,
				outputTokenCount: result.outputTokenCount,
				latencyMs: result.latencyMs,
				validationStatus: result.validationStatus,
				validationErrors: result.validationErrors,
				fallbackReason: result.fallbackReason,
				reviewRequired: result.reviewRequired,
			};
		} catch (error) {
			console.error("Gemini mapping failed, falling back to deterministic mapping", error);
			return {
				providerName: "deterministic-fallback",
				mode: "live",
				model: env.VERTEX_DOCUMENT_MODEL,
				promptVersion: "field_mapping_v1",
				mappedFields: deterministicMapping,
				contradictions: [],
				modelQualityFlags: deterministicMapping.some((field) => field.isCustom)
					? ["custom_fields_present"]
					: [],
				inputTokenCount: null,
				outputTokenCount: null,
				latencyMs: 0,
				validationStatus: "fallback",
				validationErrors: [error instanceof Error ? error.message : "field_mapping_failed"],
				fallbackReason: "deterministic_field_mapping_fallback",
				reviewRequired: true,
			};
		}
	}

	getProviderMetadata() {
		return {
			mode: "live" as const,
			model: env.VERTEX_DOCUMENT_MODEL,
		};
	}
}

export const geminiService = new GeminiService();
