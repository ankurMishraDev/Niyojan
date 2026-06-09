import { PipelineState } from "../pipelineState";
import { EXTRACTION_PROMPT, extractedFieldSchema } from "../prompts/extractionPrompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pRetry from "p-retry";

export async function aiExtractionNode(state: PipelineState): Promise<Partial<PipelineState>> {
  if (!state.maskedText || state.maskedText.trim() === "") {
    return {
      extractionMethod: "failed",
      extractionError: "No text provided for extraction",
      extractedFields: [],
      extractionConfidence: 0,
      nodeTimings: { ...state.nodeTimings, ai_extraction: 0 }
    };
  }

  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      extractionMethod: "failed",
      extractionError: "GEMINI_API_KEY not configured",
      extractedFields: [],
      extractionConfidence: 0,
      nodeTimings: { ...state.nodeTimings, ai_extraction: Date.now() - startTime }
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Keep using the existing model configured or default to gemini-1.5-flash as it's common
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash"; 
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.0, // Force determinism
      responseMimeType: "application/json",
    }
  });

  const prompt = EXTRACTION_PROMPT(state.maskedText);

  try {
    const result = await pRetry(
      async () => {
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        
        try {
          const parsed = JSON.parse(text);
          // Zod validation enforces confidence is present and valid
          const validated = extractedFieldSchema.parse(parsed);
          return validated;
        } catch (parseError: any) {
          throw new Error(`JSON/Zod parsing failed: ${parseError.message}`);
        }
      },
      {
        retries: 3,
        minTimeout: 500,
        factor: 2,
        onFailedAttempt: (error: any) => {
          console.warn(`[aiExtractionNode] Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left. Error: ${error.message}`);
        },
      }
    );

    const mappedExtractedFields = result.fields.map(f => ({
      label: f.label,
      value: f.value,
      confidence: f.confidence,
      evidenceRef: f.evidenceRef || null,
      inputType: f.inputType || "text"
    }));
    
    // Average confidence across all extracted fields
    const avgConfidence = mappedExtractedFields.length > 0 
      ? mappedExtractedFields.reduce((sum, f) => sum + f.confidence, 0) / mappedExtractedFields.length 
      : 0;

    const duration = Date.now() - startTime;

    return {
      extractedFields: mappedExtractedFields,
      extractionMethod: "gemini",
      extractionConfidence: avgConfidence,
      extractionError: null,
      nodeTimings: { ...state.nodeTimings, ai_extraction: duration }
    };

  } catch (error: any) {
    console.error("[aiExtractionNode] All retries exhausted or fatal error:", error);
    const duration = Date.now() - startTime;
    return {
      extractionMethod: "failed",
      extractionError: error.message || "Unknown extraction error",
      extractedFields: [],
      extractionConfidence: 0,
      nodeTimings: { ...state.nodeTimings, ai_extraction: duration }
    };
  }
}
