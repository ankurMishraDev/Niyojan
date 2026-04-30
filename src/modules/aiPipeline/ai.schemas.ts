import { z } from "zod";

export const extractedCandidateFieldSchema = z.object({
	label: z.string().min(1),
	inputType: z.string().min(1),
	options: z.array(z.string()).optional(),
	required: z.boolean().default(false),
	confidence: z.number().min(0).max(1),
	provenanceRef: z.string().optional(),
	valueHint: z.string().optional(),
});

export const mappedFieldSchema = z.object({
	label: z.string().min(1),
	inputType: z.string().min(1),
	required: z.boolean(),
	options: z.array(z.string()).nullable(),
	confidence: z.number().min(0).max(1),
	matchedCatalogKey: z.string().nullable(),
	isCustom: z.boolean(),
	category: z.string().min(1),
});

export const documentReasoningSchema = z.object({
	caseSummary: z.string().min(12),
	urgencyScore: z.number().min(0).max(100),
	urgencyLabel: z.enum(["low", "medium", "high", "critical"]),
	urgencyReasons: z.array(z.string().min(1)).min(1),
	urgencyEvidenceRefs: z.array(z.string()).default([]),
	needCategory: z.string().min(1),
	needSubcategory: z.string().nullable().default(null),
	recommendedSkillKeys: z.array(z.string()).default([]),
	recommendedAction: z.string().min(1),
	reasoningConfidence: z.number().min(0).max(1),
	verificationRisk: z.enum(["low", "medium", "high"]),
	verificationRiskReasons: z.array(z.string().min(1)).default([]),
});

export const surveyNeedDraftSchema = z.object({
	category: z.string().min(1),
	summary: z.string().min(8),
	urgencyScore: z.number().min(0).max(1),
	priorityLevel: z.enum(["low", "medium", "high"]),
	skillKeys: z.array(z.string().min(1)).default([]),
});

export const surveyNeedDraftListSchema = z.array(surveyNeedDraftSchema);

export const normalizeJsonPayload = (value: string) => {
	const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
	return (fencedMatch?.[1] || value).trim();
};

export const parseStructuredJson = <T>(raw: string, schema: z.ZodSchema<T>) => {
	return schema.parse(JSON.parse(normalizeJsonPayload(raw)));
};

export type ExtractedCandidateField = z.infer<typeof extractedCandidateFieldSchema>;
export type MappedFieldShape = z.infer<typeof mappedFieldSchema>;
export type DocumentReasoningShape = z.infer<typeof documentReasoningSchema>;
export type SurveyNeedDraftShape = z.infer<typeof surveyNeedDraftSchema>;
