export const GEMINI_DOCUMENT_EXTRACTION_PROMPT = [
  "Extract all user-visible form fields from this document in top-to-bottom reading order.",
  "Return JSON only in the required schema.",
  "Include blank fields from empty forms and filled values from completed forms.",
  "Use `valueHint` for any detected filled value, selected option, checkbox state, or handwritten/typed answer.",
  "Infer `inputType` carefully: text, number, boolean, date, select, multiselect, textarea.",
  "Do not skip signature, consent, checkbox, or footer fields if they are actual form inputs.",
  "Do not output duplicate fields.",
  "Keep exactly the same order as the document.",
].join(" ");

export const buildDocumentExtractionPrompt = (targetLanguage?: string, langName?: string) => {
  let finalPrompt = GEMINI_DOCUMENT_EXTRACTION_PROMPT;

  if (targetLanguage && targetLanguage !== "en") {
    finalPrompt += `\n\nCRITICAL TRANSLATION INSTRUCTIONS:
- The source document might be in English or another language, but YOU MUST TRANSLATE EVERYTHING into ${langName}.
- You must translate ALL extracted form field labels, text prompt instructions, choices, and filled values into ${langName}.
- The output MUST be in ${langName}.
- The JSON keys in the output schema must remain strictly in English, but their string values must be translated to ${langName}.`;
  } else if (targetLanguage === "en") {
    finalPrompt += `\n\nCRITICAL TRANSLATION INSTRUCTIONS:
- The source document might be in a regional language (like Hindi, Tamil, etc).
- YOU MUST TRANSLATE ALL extracted form field labels, text prompt instructions, choices, and filled values into English.
- The output MUST be in English.
- The JSON keys in the output schema must remain strictly in English.`;
  }

  return finalPrompt;
};
