import { z } from "zod";

export const extractedFieldSchema = z.object({
  fields: z.array(z.object({
    label:       z.string().min(1),
    value:       z.string(),
    confidence:  z.number().min(0).max(1),
    evidenceRef: z.string().nullable().optional(),
    inputType:   z.enum(["text", "number", "date", "boolean", "select"]).optional().default("text"),
  })).min(1),
});

export const EXTRACTION_PROMPT = (text: string) => `
You are a document field extractor for an NGO case management system.
Extract all form fields from the following document text.

RULES:
- Return JSON only. No explanation. No markdown.
- For each field, assign a confidence score between 0.0 and 1.0
  based on how clearly the field and value are present in the text.
- confidence = 1.0  → field label and value are explicitly present
- confidence = 0.5  → field is implied or partially present
- confidence = 0.2  → field is guessed from context
- evidenceRef = exact text snippet from the document that supports this field (optional)
- inputType must be one of: text, number, date, boolean, select

Document text:
---
${text}
---

Respond with this exact JSON structure:
{
  "fields": [
    { "label": "...", "value": "...", "confidence": 0.95, "evidenceRef": "...", "inputType": "text" }
  ]
}
`;