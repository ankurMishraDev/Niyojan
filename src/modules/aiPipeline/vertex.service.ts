import { z } from "zod";
import { env } from "../../config/env";
import { getGoogleAccessToken } from "../../config/googleCredentials";
import {
	documentReasoningSchema,
	parseStructuredJson,
	surveyNeedDraftListSchema,
} from "./ai.schemas";

type UsageMetadata = {
	promptTokenCount?: number;
	candidatesTokenCount?: number;
	totalTokenCount?: number;
};

export type StructuredGenerationResult<T> = {
	providerName: string;
	model: string;
	promptVersion: string;
	output: T;
	latencyMs: number;
	inputTokenCount: number | null;
	outputTokenCount: number | null;
	validationStatus: "passed" | "fallback" | "requires_human";
	validationErrors: string[];
	fallbackReason: string | null;
	reviewRequired: boolean;
	rawText: string | null;
};

const getFirstCandidateText = (payload: Record<string, unknown>) => {
	const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null;
	const content = (candidate as { content?: { parts?: Array<{ text?: string }> } } | null)?.content;
	return content?.parts?.map((part) => part.text || "").join("").trim() || "";
};

const getUsage = (payload: Record<string, unknown>) =>
	((payload.usageMetadata as UsageMetadata | undefined) || {}) as UsageMetadata;

const buildVertexEndpoint = (model: string) => {
	const modelId = model.replace('publishers/google/models/', '');
	// Note: We need to use projects/.../locations/.../publishers/google/models/... for older models,
	// but Vertex AI handles standard models using just the endpoint.
	// Actually, the standard Vertex URL is projects/.../locations/.../publishers/google/models/...
	return `https://${env.VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/locations/${env.VERTEX_LOCATION}/publishers/google/models/${modelId}:generateContent`;
};

const normalizeSkillKeys = (keys: string[]) =>
	Array.from(
		new Set(
			keys
				.map((key) => key.trim())
				.filter(Boolean),
		),
	);

export class VertexService {
	getProviderMetadata() {
		return {
			mode: "live" as const,
			location: env.VERTEX_LOCATION,
			provider: "vertex-ai-live",
		};
	}

	async generateStructuredJson<T>(options: {
		model: string;
		promptVersion: string;
		schema: z.ZodSchema<T>;
		prompt: string;
		fileData?: {
			mimeType: string;
			data: string; // base64
		};
	}) {
		const startedAt = Date.now();
		const accessToken = await getGoogleAccessToken();

		const parts: any[] = [];
		if (options.fileData) {
			parts.push({
				inlineData: {
					mimeType: options.fileData.mimeType,
					data: options.fileData.data,
				},
			});
		}
		parts.push({ text: options.prompt });

		const response = await fetch(buildVertexEndpoint(options.model), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				contents: [{ role: "user", parts }],
				generationConfig: {
					temperature: 0.1,
					responseMimeType: "application/json",
				},
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Vertex AI request failed with status ${response.status}: ${errorBody}`);
		}

		const payload = (await response.json()) as Record<string, unknown>;
		const rawText = getFirstCandidateText(payload);
		const output = parseStructuredJson(rawText, options.schema);
		const usage = getUsage(payload);

		return {
			providerName: "vertex-ai",
			model: options.model,
			promptVersion: options.promptVersion,
			output,
			latencyMs: Date.now() - startedAt,
			inputTokenCount: usage.promptTokenCount ?? null,
			outputTokenCount: usage.candidatesTokenCount ?? null,
			validationStatus: "passed",
			validationErrors: [],
			fallbackReason: null,
			reviewRequired: false,
			rawText,
		} satisfies StructuredGenerationResult<T>;
	}

	computeUrgencyHint(text: string) {
		const lower = text.toLowerCase();

		if (
			lower.includes("urgent") ||
			lower.includes("critical") ||
			lower.includes("immediate") ||
			lower.includes("medical")
		) {
			return { urgencyScore: 0.9, priorityLevel: "high" as const };
		}

		if (lower.includes("soon") || lower.includes("limited") || lower.includes("damaged")) {
			return { urgencyScore: 0.7, priorityLevel: "medium" as const };
		}

		return { urgencyScore: 0.45, priorityLevel: "low" as const };
	}

	async reasonAboutDocument(input: {
		canonicalText: string;
		fields: Array<{
			label: string;
			category: string;
			matchedCatalogKey?: string | null;
			inputType: string;
			confidence: number;
		}>;
	}) {
		const fallback = (() => {
			const categories = Array.from(
				new Set(input.fields.map((field) => field.category).filter(Boolean)),
			);
			const recommendedSkillKeys = normalizeSkillKeys(
				input.fields
					.map((field) => field.matchedCatalogKey || "")
					.filter(Boolean)
					.slice(0, 3),
			);

			return {
				providerName: "vertex-ai",
				model: env.VERTEX_REASONING_MODEL,
				promptVersion: "document_reasoning_v1",
				output: {
					urgencyScore: input.fields.length > 4 ? 78 : 62,
					urgencyLabel: input.fields.length > 4 ? "high" : "medium",
					urgencyReasons: ["Fallback reasoning generated from extracted field density"],
					urgencyEvidenceRefs: input.fields
						.slice(0, 3)
						.map((_field, index) => `p1:b${index + 1}`),
					needCategory: categories[0] || "general",
					needSubcategory: null,
					recommendedSkillKeys,
					recommendedAction: "Route to human review and form refinement",
					reasoningConfidence: 0.58,
					verificationRisk: "high" as const,
					verificationRiskReasons: [
						"Fallback reasoning used due to unavailable or invalid model output",
					],
				},
				latencyMs: 0,
				inputTokenCount: null,
				outputTokenCount: null,
				validationStatus: "fallback" as const,
				validationErrors: [],
				fallbackReason: "deterministic_reasoning_fallback",
				reviewRequired: true,
				rawText: null,
			} satisfies StructuredGenerationResult<z.infer<typeof documentReasoningSchema>>;
		})();

		try {
			const prompt = [
				"You are classifying a humanitarian intake document.",
				"Return JSON only.",
				"Use the extracted fields and canonical text to estimate urgency, category, recommended skills, and verification risk.",
				"Urgency score must be 0-100.",
				"Verification risk must be low, medium, or high.",
				"Extracted fields JSON:",
				JSON.stringify(input.fields),
				"Canonical text:",
				input.canonicalText.slice(0, 12000),
			].join("\n");

			return await this.generateStructuredJson({
				model: env.VERTEX_REASONING_MODEL,
				promptVersion: "document_reasoning_v1",
				schema: documentReasoningSchema,
				prompt,
			});
		} catch (error) {
			return {
				...fallback,
				validationErrors: [
					error instanceof Error ? error.message : "document_reasoning_generation_failed",
				],
			};
		}
	}

	async analyzeSurveyNeeds(input: {
		surveyId: string;
		locationText: string | null;
		respondentName: string | null;
		responses: Array<{
			fieldLabel: string;
			fieldCatalogKey: string | null;
			inputType: string;
			valueText: string | null;
			valueNumber: number | null;
			valueBool: boolean | null;
			valueJson: unknown;
		}>;
		availableSkillKeys: string[];
		fallbackNeeds: Array<{
			category: string;
			summary: string;
			urgencyScore: number;
			priorityLevel: "low" | "medium" | "high";
			skillKeys: string[];
		}>;
	}) {
		try {
			const prompt = [
				"You analyze structured NGO household survey responses and return detected needs.",
				"Return JSON only as an array.",
				"Each need must include category, summary, urgencyScore between 0 and 1, priorityLevel, and skillKeys.",
				"Only choose skillKeys from this list:",
				JSON.stringify(input.availableSkillKeys),
				"Survey metadata:",
				JSON.stringify({
					surveyId: input.surveyId,
					locationText: input.locationText,
					respondentName: input.respondentName,
				}),
				"Responses:",
				JSON.stringify(input.responses),
			].join("\n");

			const result = await this.generateStructuredJson({
				model: env.VERTEX_SURVEY_MODEL,
				promptVersion: "survey_need_analysis_v1",
				schema: surveyNeedDraftListSchema,
				prompt,
			});

			return {
				...result,
				output: result.output.map((need) => ({
					...need,
					skillKeys: normalizeSkillKeys(
						need.skillKeys.filter((key) => input.availableSkillKeys.includes(key)),
					),
				})),
			};
		} catch (error) {
			return {
				providerName: "vertex-ai",
				model: env.VERTEX_SURVEY_MODEL,
				promptVersion: "survey_need_analysis_v1",
				output: input.fallbackNeeds,
				latencyMs: 0,
				inputTokenCount: null,
				outputTokenCount: null,
				validationStatus: "fallback",
				validationErrors: [
					error instanceof Error ? error.message : "survey_need_analysis_generation_failed",
				],
				fallbackReason: "deterministic_survey_need_fallback",
				reviewRequired: false,
				rawText: null,
			};
		}
	}
}

export const vertexService = new VertexService();
