import { db } from "../../config/db";
import { env } from "../../config/env";
import { ExtractedCandidateField } from "./documentAi.service";

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

const normalizeToKey = (value: string) => {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
};

const inferCategory = (label: string) => {
	const lower = label.toLowerCase();

	if (lower.includes("water") || lower.includes("sanitation")) {
		return "water_sanitation";
	}

	if (lower.includes("medical") || lower.includes("health") || lower.includes("illness")) {
		return "health";
	}

	if (lower.includes("school") || lower.includes("education")) {
		return "education";
	}

	if (lower.includes("income") || lower.includes("livelihood") || lower.includes("employment")) {
		return "livelihood";
	}

	if (lower.includes("house") || lower.includes("shelter")) {
		return "shelter";
	}

	return "general";
};

export class GeminiService {
	async normalizeAndMapFields(candidates: ExtractedCandidateField[]): Promise<MappedField[]> {
		const catalogRows = (await db("field_catalog")
			.select("id", "key", "name", "category", "input_type", "options_json")) as FieldCatalogRow[];

		const byKey = new Map<string, FieldCatalogRow>();
		const byName = new Map<string, FieldCatalogRow>();

		for (const row of catalogRows) {
			byKey.set(row.key.toLowerCase(), row);
			byName.set(row.name.trim().toLowerCase(), row);
		}

		return candidates.map((candidate) => {
			const normalizedKey = normalizeToKey(candidate.label);
			const byKeyMatch = byKey.get(normalizedKey);
			const byNameMatch = byName.get(candidate.label.trim().toLowerCase());
			const matched = byKeyMatch || byNameMatch || null;

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
		});
	}

	getProviderMetadata() {
		return {
			mode: env.AI_PROVIDER_MODE,
			model: env.AI_PROVIDER_MODE === "mock" ? "mock-gemini-normalizer-v1" : "live-fallback-mock-v1",
		};
	}
}

export const geminiService = new GeminiService();
