import { z } from "zod";
import { MappedField } from "../types";

export const documentReasoningSchema = z.object({
  caseSummary:          z.string().min(20).max(500),
  urgencyScore:         z.number().min(0).max(100),
  urgencyLabel:         z.enum(["low", "medium", "high", "critical"]),
  urgencyReasons:       z.array(z.string()).min(1),
  urgencyEvidenceRefs:  z.array(z.string()).optional().default([]),
  needCategory:         z.string().min(1),
  needSubcategory:      z.string().nullable().optional(),
  recommendedSkillKeys: z.array(z.string()),
  recommendedAction:    z.string().nullable().optional(),
  reasoningConfidence:  z.number().min(0).max(1),
  verificationRisk:     z.enum(["low", "medium", "high"]),
});

export const REASONING_PROMPT = (fields: MappedField[], text: string, skillKeys: string[], caseSummaryHint?: string | null) => `
You are an NGO case analyst. Analyze the following structured case fields and document text.

RULES:
- Return JSON only. No explanation. No markdown.
- Base urgencyScore ONLY on explicit keywords: "urgent", "critical", "emergency", "immediate" → 80–100
- needCategory must be one of: health, education, shelter, water_sanitation, livelihood, child_protection, other
- recommendedSkillKeys must only contain keys from this list: ${skillKeys.join(", ") || "none_provided"}
- caseSummary: 2–4 sentences. Plain language. No jargon. ${caseSummaryHint ? `Hint: ${caseSummaryHint}` : ''}

Extracted fields:
${fields.map(f => `- ${f.label}: ${f.value} (confidence: ${f.confidence})`).join("\n")}

Document text (PII masked):
---
${text.slice(0, 2000)}
---

Respond with exactly this JSON structure matching the schema.
`;
