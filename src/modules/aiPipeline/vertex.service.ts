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

const normalizeModelId = (model: string) =>
	model
		.replace(/^publishers\/google\/models\//, "")
		.replace(/^models\//, "")
		.trim();

const uniqueStrings = (values: Array<string | undefined>) =>
	Array.from(
		new Set(
			values
				.map((value) => value?.trim())
				.filter((value): value is string => Boolean(value)),
		),
	);

const getModelCandidates = (requestedModel: string) =>
	uniqueStrings([
		normalizeModelId(requestedModel),
		env.VERTEX_GEMINI_FAST_MODEL ? normalizeModelId(env.VERTEX_GEMINI_FAST_MODEL) : undefined,
		env.VERTEX_GEMINI_MODEL ? normalizeModelId(env.VERTEX_GEMINI_MODEL) : undefined,
		"gemini-2.0-flash-001",
	]);

const getLocationCandidates = () =>
	uniqueStrings([
		env.VERTEX_LOCATION,
		env.VERTEX_LOCATION === "global" ? "us-central1" : undefined,
		env.VERTEX_LOCATION !== "global" ? "global" : undefined,
	]);

const getVertexHost = (location: string) =>
	location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;

const buildVertexEndpoint = (model: string, location: string) => {
	const modelId = normalizeModelId(model);
	return `https://${getVertexHost(location)}/v1/projects/${env.GCP_PROJECT_ID}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
};

const normalizeSkillKeys = (keys: string[]) =>
	Array.from(
		new Set(
			keys
				.map((key) => key.trim())
				.filter(Boolean),
		),
	);

const extractMeaningfulSnippets = (text: string, limit = 3) =>
	text
		.split(/\r?\n|(?<=[.!?])\s+/)
		.map((line) => line.trim().replace(/\s+/g, " "))
		.filter((line) => line.length >= 12)
		.slice(0, limit);

const buildFallbackSummary = (input: {
	canonicalText: string;
	fields: Array<{
		label: string;
	}>;
}) => {
	const snippets = extractMeaningfulSnippets(input.canonicalText, 2);
	if (snippets.length > 0) {
		return snippets.join(" ");
	}

	const fieldLabels = input.fields
		.map((field) => field.label.trim())
		.filter(Boolean)
		.slice(0, 4);

	if (fieldLabels.length > 0) {
		return `This intake appears to describe a case involving ${fieldLabels.join(", ")}. Human review is needed to confirm the details.`;
	}

	return "This intake contains limited readable detail. Human review is needed to understand the case clearly.";
};

const buildFallbackUrgencyReasons = (input: {
	canonicalText: string;
	fields: Array<{
		label: string;
	}>;
}) => {
	const lower = input.canonicalText.toLowerCase();
	const reasons: string[] = [];

	if (
		lower.includes("urgent") ||
		lower.includes("critical") ||
		lower.includes("emergency") ||
		lower.includes("medical")
	) {
		reasons.push("The intake mentions urgent, emergency, or medical concerns.");
	}

	if (input.fields.length >= 5) {
		reasons.push("The intake captures multiple case details, which suggests the request may need timely review.");
	}

	if (reasons.length === 0) {
		reasons.push("The system found enough case information to keep this intake under active review.");
	}

	return reasons;
};

const buildFallbackEvidenceRefs = (input: {
	canonicalText: string;
	fields: Array<{
		label: string;
	}>;
}) => {
	const snippets = extractMeaningfulSnippets(input.canonicalText, 3);
	if (snippets.length > 0) {
		return snippets;
	}

	return input.fields
		.slice(0, 3)
		.map((field) => `Field captured in intake: ${field.label}`);
};

const buildFallbackVerificationRiskReasons = (input: {
	canonicalText: string;
	fields: Array<{
		confidence: number;
	}>;
}) => {
	const reasons = [
		"This case still needs manual confirmation because the AI could not return a complete reasoning response.",
	];

	if (input.fields.some((field) => field.confidence < 0.75)) {
		reasons.push("Some extracted fields were captured with lower confidence and should be checked by an admin.");
	}

	if (input.canonicalText.trim().length < 80) {
		reasons.push("The readable case text is limited, so the system may be missing context.");
	}

	return reasons;
};

export class VertexService {
	getProviderMetadata() {
		return {
			mode: "live" as const,
			location: env.VERTEX_LOCATION,
			provider: "vertex-ai-live",
		};
	}

	private async requestStructuredContent(options: {
		model: string;
		prompt: string;
		accessToken: string;
		fileData?: {
			mimeType: string;
			data: string;
		};
	}) {
		const parts: Array<Record<string, unknown>> = [];
		if (options.fileData) {
			parts.push({
				inlineData: {
					mimeType: options.fileData.mimeType,
					data: options.fileData.data,
				},
			});
		}
		parts.push({ text: options.prompt });

		const attempts: string[] = [];
		const errors: string[] = [];
		for (const location of getLocationCandidates()) {
			for (const model of getModelCandidates(options.model)) {
				const endpoint = buildVertexEndpoint(model, location);
				attempts.push(`${location}:${model}`);

				try {
					const response = await fetch(endpoint, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${options.accessToken}`,
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
						errors.push(`${location}:${model} -> ${response.status} ${errorBody}`);
						continue;
					}

					const payload = (await response.json()) as Record<string, unknown>;
					return {
						payload,
						resolvedModel: model,
						resolvedLocation: location,
					};
				} catch (error) {
					errors.push(
						`${location}:${model} -> ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}

		throw new Error(
			`Vertex AI request failed after trying ${attempts.join(", ")}: ${errors.join(" | ")}`,
		);
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
		const { payload, resolvedModel } = await this.requestStructuredContent({
			model: options.model,
			prompt: options.prompt,
			accessToken,
			fileData: options.fileData,
		});
		const rawText = getFirstCandidateText(payload);
		const output = parseStructuredJson(rawText, options.schema);
		const usage = getUsage(payload);

		return {
			providerName: "vertex-ai",
			model: resolvedModel,
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
			const caseSummary = buildFallbackSummary(input);
			const urgencyReasons = buildFallbackUrgencyReasons(input);
			const urgencyEvidenceRefs = buildFallbackEvidenceRefs(input);
			const verificationRiskReasons = buildFallbackVerificationRiskReasons(input);

			return {
				providerName: "vertex-ai",
				model: env.VERTEX_REASONING_MODEL,
				promptVersion: "document_reasoning_v2",
				output: {
					caseSummary,
					urgencyScore: input.fields.length > 4 ? 78 : 62,
					urgencyLabel: input.fields.length > 4 ? "high" : "medium",
					urgencyReasons,
					urgencyEvidenceRefs,
					needCategory: categories[0] || "general",
					needSubcategory: null,
					recommendedSkillKeys,
					recommendedAction: "Review this case, confirm the important details, and then continue it for form or case processing.",
					reasoningConfidence: 0.58,
					verificationRisk: "high" as const,
					verificationRiskReasons,
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
				"Write for a non-technical NGO admin in simple language.",
				"caseSummary must be a short 2-4 sentence explanation of what the survey or intake is basically about.",
				"urgencyReasons and verificationRiskReasons must be plain-language explanations, not system messages.",
				"urgencyEvidenceRefs must contain short human-readable text snippets or field references from the intake, not codes like p1:b1.",
				"Urgency score must be 0-100.",
				"Verification risk must be low, medium, or high.",
				"Extracted fields JSON:",
				JSON.stringify(input.fields),
				"Canonical text:",
				input.canonicalText.slice(0, 12000),
			].join("\n");

			return await this.generateStructuredJson({
				model: env.VERTEX_REASONING_MODEL,
				promptVersion: "document_reasoning_v2",
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
