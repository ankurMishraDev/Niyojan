import { z } from "zod";

export const extractedFieldSchema = z.object({
  language: z.string().optional().default("unknown"),
  fields: z.array(z.object({
    label:       z.string().min(1),
    value:       z.string(),
    confidence:  z.number().min(0).max(1),
    evidenceRef: z.string().nullable().optional(),
    inputType:   z.enum(["text", "number", "date", "boolean", "select"]).optional().default("text"),
  })).optional().default([]),
  formQuestions: z.array(z.object({
    label:       z.string().min(1),
    confidence:  z.number().min(0).max(1),
    evidenceRef: z.string().nullable().optional(),
    inputType:   z.enum(["text", "number", "date", "boolean", "select"]).optional().default("text"),
  })).optional().default([]),
});

export const EXTRACTION_PROMPT = (text: string, targetLanguage?: string) => `
You are a highly accurate document field extractor for an NGO case management system.

You will receive a raw document image, PDF, or text.

Your task has THREE parts:

1. Detect the main language of the document.
2. Extract filled form fields where both the question/label and answer/value are present.
3. Extract blank form questions separately when the form question is present but no answer/value is filled.

Return JSON only.
No markdown.
No explanation.
No comments.
Do not include extra keys.

${targetLanguage && targetLanguage !== "en" ? `CRITICAL TRANSLATION INSTRUCTIONS:
- You must translate ALL extracted form field labels, blank form questions, and filled values into ${targetLanguage}.
- Even if the source document is in Hindi, English, or another language, the output strings MUST be translated into ${targetLanguage}.
- The JSON keys MUST remain exactly as specified in the schema.` : targetLanguage === "en" ? `CRITICAL TRANSLATION INSTRUCTIONS:
- You must translate ALL extracted form field labels, blank form questions, and filled values into English.
- The JSON keys MUST remain exactly as specified in the schema.` : ""}

LANGUAGE RULES:
- Detect the main language of the document text.
- Return the language as a lowercase English name.
- Examples: "english", "hindi", "spanish", "french", "arabic", "mixed"
- If multiple languages are meaningfully present, use "mixed".
- If the language is unclear, use "unknown".

FILLED FIELD EXTRACTION RULES:
Use "fields" only for form fields that have a real filled value.

A filled field must have:
- a meaningful label/question, and
- a meaningful answer/value.

Examples:
- "Village ID: RJ-08-3319" -> fields
- "Name of the Village: Devpura" -> fields
- "Number of Wards: 9" -> fields
- "District: Tonk" -> fields

Do NOT put blank questions in "fields".

FORM QUESTION EXTRACTION RULES:
Use "formQuestions" for form labels/questions that are present but do not have a filled value.

Examples:
- "Name of Applicant: __" -> formQuestions
- "Date of Birth:" with no value -> formQuestions
- "Household income: (blank)" -> formQuestions

The purpose of formQuestions is to capture the structure of the form even when values are missing.

DO NOT TREAT THESE AS REAL VALUES:
Ignore these values when deciding whether a field is filled:
- empty string
- "(text)"
- "text"
- "(number)"
- "number"
- "(date)"
- "date"
- "unknown"
- "not provided"
- "n/a"
- "na"
- "null"
- "undefined"
- "-"
- "—"
- "__"
- "___"
- field IDs such as "p1:b1", "p2:b3", "field_001", "block_002", or similar internal identifiers

If a label has only one of these placeholder values, put it in "formQuestions", not "fields".

TABLE AND FORM RULES:
- Many documents are tables where the label is in the left column and the value is in the right column.
- For rows like "Village ID: RJ-08-3319", extract:
  label = "Village ID"
  value = "RJ-08-3319"
- For rows like "Name of the Village    Devpura", extract:
  label = "Name of the Village"
  value = "Devpura"
- For rows where the value is blank or only a placeholder, put the label in formQuestions.
- Do not extract section headings as fields unless they have a real value.
- Do not extract page numbers, headers, footers, watermarks, or document titles as fields unless they clearly have a value.
- If the same field appears more than once with the same value, return it only once.
- If the same field appears more than once with different values, return the clearest value and use evidenceRef to support it.

CONFIDENCE RULES FOR FILLED FIELDS:
Assign confidence based on how clearly the label-value pair appears.

Use:
- 0.95 to 1.0:
  The label and value are explicitly present together and clearly readable.
  Example: "Village ID: RJ-08-3319"

- 0.85 to 0.94:
  The label and value are clearly present, but spacing or OCR formatting is slightly messy.
  Example: "Village ID    RJ-08-3319"

- 0.65 to 0.84:
  The field is likely correct, but the value has minor OCR uncertainty, broken lines, or table alignment ambiguity.

- 0.40 to 0.64:
  The label or value is partially unclear, but there is still enough evidence to extract it.

- 0.0 to 0.39:
  Use only when the value is highly uncertain.
  Avoid extracting such fields unless there is some useful evidence.

CONFIDENCE RULES FOR FORM QUESTIONS:
Assign confidence based on how clearly the blank question/label appears.

Use:
- 0.95 to 1.0 if the form question is clearly visible.
- 0.75 to 0.94 if the question is visible but formatting/OCR is slightly unclear.
- 0.40 to 0.74 if the question is partially readable.
- Below 0.40 only if highly uncertain.

IMPORTANT:
Do NOT reduce confidence just because:
- the document is long
- the document contains many fields
- the field was extracted from a table
- other fields in the document are unclear
- the document is a scanned PDF, as long as the label and value are readable in the text

EVIDENCE RULES:
- evidenceRef should be the shortest exact text snippet from the document that supports the field or question.
- Prefer snippets that contain both label and value for filled fields.
- For blank form questions, evidenceRef may contain just the question label.
- Use null only if no useful snippet is available.

INPUT TYPE RULES:
Set inputType based on the field/question:

- "number": numeric values or numeric measurements, such as "9", "38 km", "1,845 Acres", "260 feet"
- "date": dates
- "boolean": yes/no, true/false, present/absent
- "select": value chosen from visible options
- "text": names, locations, descriptions, IDs, mixed alphanumeric values, and general text

${text ? `Document text:
---
${text}
---` : ""}

Respond with exactly this JSON structure:

{
  "language": "english",
  "fields": [
    {
      "label": "Village ID",
      "value": "RJ-08-3319",
      "confidence": 0.98,
      "evidenceRef": "Village ID: RJ-08-3319",
      "inputType": "text"
    }
  ],
  "formQuestions": [
    {
      "label": "Name of Applicant",
      "confidence": 0.96,
      "evidenceRef": "Name of Applicant:",
      "inputType": "text"
    }
  ]
}
`;
