import { z } from "zod";
import { MappedField } from "../types";

export const documentReasoningSchema = z.object({
  caseSummary:          z.string().min(12),
  urgencyScore:         z.number().min(0).max(100),
  urgencyLabel:         z.enum(["low", "medium", "high", "critical"]),
  urgencyReasons:       z.array(z.string()).min(1),
  urgencyEvidenceRefs:  z.array(z.string()).optional().default([]),
  needCategory:         z.string().min(1),
  needSubcategory:      z.string().nullable().optional(),
  recommendedSkillKeys: z.array(z.string()).default([]),
  recommendedAction:    z.string().nullable().optional(),
  reasoningConfidence:  z.number().min(0).max(1),
  verificationRisk:     z.enum(["low", "medium", "high"]),
});

export const REASONING_PROMPT = (fields: MappedField[], text: string, skillKeys: string[], caseSummaryHint?: string | null) => `
You are an NGO case analyst reviewing an intake document.

Your job is to analyze the extracted case information and produce a clean human-readable case assessment.

Return JSON only.
No markdown.
No explanation.
No extra fields.
Do not invent facts.

IMPORTANT:
The extracted fields may include internal field IDs, page/block IDs, placeholder values, or schema labels such as:
- p1:b1
- p1:b2
- (text)
- field_001
- unknown
- not provided

Do NOT include these internal IDs or placeholder values in the caseSummary unless they are meaningful real case data.

When writing the caseSummary:
- Summarize the actual case information, not the field IDs.
- Prefer real extracted values from fields and document text.
- Ignore fields whose value is empty, "(text)", "unknown", "not provided", null, or looks like a placeholder.
- Mention the main location, household/community, and primary needs if clearly available.
- Use 2-4 plain-language sentences.
- Do not include unmasked PII.
${caseSummaryHint ? `- Use this hint only if it is supported by the evidence: ${caseSummaryHint}` : ""}

URGENCY SCORING:
Base urgencyScore on explicit urgency evidence.

Urgency keywords:
- "urgent"
- "critical"
- "emergency"
- "immediate"

Scoring:
- 80-100: explicit urgent/critical/emergency/immediate language is present.
- 60-79: serious need or significant risk is described, but exact urgency keywords are absent.
- 25-59: clear need exists, but no immediate danger is described.
- 0-24: routine, unclear, informational, or low-risk case.

Urgency label must match urgencyScore:
- 0-24: "low"
- 25-59: "medium"
- 60-84: "high"
- 85-100: "critical"

urgencyReasons:
- Provide 1-4 short reasons.
- Each reason must be based on extracted fields or document text.
- Do not exaggerate urgency.

urgencyEvidenceRefs:
- Include short supporting field labels or text snippets.
- Use [] if there is no clear urgency evidence.

NEED CATEGORY:
needCategory must be exactly one of:
- health
- education
- shelter
- water_sanitation
- livelihood
- child_protection
- other

Category guidance:
- health: illness, injury, disability, medication, mental health, nutrition, pregnancy
- education: school access, fees, attendance, learning support, school supplies
- shelter: housing, displacement, unsafe home, homelessness, rent support
- water_sanitation: drinking water, sanitation, toilets, drainage, hygiene, sewage
- livelihood: income, employment, agriculture, food insecurity, financial stability
- child_protection: abuse, neglect, exploitation, child safety, orphaned or unaccompanied child
- other: only if none clearly fit

needSubcategory:
- Use a short specific phrase if supported.
- Use null if unclear.

SKILL RECOMMENDATION:
recommendedSkillKeys must only contain keys from this allowed list:
${skillKeys.length > 0 ? skillKeys.join(", ") : "none_provided"}

Rules:
- Do not invent skill keys.
- Do not return descriptions instead of keys.
- If no skill clearly applies, return [].

CONFIDENCE:
reasoningConfidence should measure how confident the AI is in the final assessment, not how many fields were flagged.

Use:
- 0.85-1.0 if the document text and important extracted values are readable and the summary/category are clearly supported.
- 0.65-0.84 if the main case is understandable but some secondary details are missing.
- 0.40-0.64 if the main need is partially unclear or many important values are missing.
- 0.0-0.39 if the case cannot be reliably understood.

Do NOT reduce reasoningConfidence only because many fields were flagged.
Reduce it only when the missing or flagged fields affect the case summary, urgency, category, or recommended action.

VERIFICATION RISK:
verificationRisk should describe how much human review is still needed.

Use:
- "low" if the main facts are clear and consistent.
- "medium" if some important details need confirmation.
- "high" if key facts are missing, contradictory, unreadable, or the recommendation could be wrong without review.

recommendedAction:
- Give one short practical next step.
- Do not promise services or outcomes.
- Use null only if no meaningful next step can be inferred.

Extracted structured fields:
${fields.length > 0
  ? fields
      .map(f => `- ${f.label}: ${String(f.value ?? "").trim()} (confidence: ${f.confidence})`)
      .join("\n")
  : "- No structured fields were extracted."}

Document text, with PII masked:
---
${text.slice(0, 3000)}
---

Return exactly this JSON structure:
{
  "caseSummary": "string",
  "urgencyScore": 0,
  "urgencyLabel": "low",
  "urgencyReasons": ["string"],
  "urgencyEvidenceRefs": [],
  "needCategory": "other",
  "needSubcategory": null,
  "recommendedSkillKeys": [],
  "recommendedAction": null,
  "reasoningConfidence": 0,
  "verificationRisk": "medium"
}
`;
