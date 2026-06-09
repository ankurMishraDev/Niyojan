import { PipelineState } from "../pipelineState";
import { REASONING_PROMPT, documentReasoningSchema } from "../prompts/reasoningPrompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pRetry from "p-retry";

export async function reasoningNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      reasoningMethod: "failed",
      nodeTimings: { ...state.nodeTimings, reasoning: Date.now() - startTime }
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Keep using existing model or gemini-1.5-pro for reasoning
  const modelName = process.env.GEMINI_REASONING_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-pro"; 
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.0, // Force determinism
      responseMimeType: "application/json",
    }
  });

  // We should fetch available skills from DB in a real scenario, but we can pass an empty array or defaults for now
  // or retrieve from state if we added it to Input node
  const availableSkillKeys = ["medical", "teaching", "logistics", "counseling", "legal"]; 

  const prompt = REASONING_PROMPT(state.mappedFields || [], state.maskedText || "", availableSkillKeys, state.caseSummary);

  try {
    const result = await pRetry(
      async () => {
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        
        try {
          const parsed = JSON.parse(text);
          const validated = documentReasoningSchema.parse(parsed);
          return validated;
        } catch (parseError: any) {
          throw new Error(`JSON/Zod parsing failed: ${parseError.message}`);
        }
      },
      {
        retries: 2, // Less retries for reasoning
        minTimeout: 500,
        factor: 2,
        onFailedAttempt: (error: any) => {
          console.warn(`[reasoningNode] Attempt ${error.attemptNumber} failed. Retries left: ${error.retriesLeft}. Error: ${error.message}`);
        },
      }
    );

    const duration = Date.now() - startTime;

    return {
      caseSummary: result.caseSummary,
      urgencyScore: result.urgencyScore,
      urgencyLabel: result.urgencyLabel,
      urgencyReasons: result.urgencyReasons,
      needCategory: result.needCategory,
      needSubcategory: result.needSubcategory || null,
      recommendedSkillKeys: result.recommendedSkillKeys,
      recommendedAction: result.recommendedAction || null,
      reasoningConfidence: result.reasoningConfidence,
      verificationRisk: result.verificationRisk,
      reasoningMethod: "gemini_pro",
      nodeTimings: { ...state.nodeTimings, reasoning: duration }
    };

  } catch (error: any) {
    console.error("[reasoningNode] All retries exhausted or fatal error:", error);
    const duration = Date.now() - startTime;
    return {
      reasoningMethod: "failed", // This triggers the reasoning_fallback node
      nodeTimings: { ...state.nodeTimings, reasoning: duration }
    };
  }
}
