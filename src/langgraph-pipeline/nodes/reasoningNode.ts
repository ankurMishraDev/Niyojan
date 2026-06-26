import { PipelineState } from "../pipelineState";
import { vertexService } from "../../modules/aiPipeline/vertex.service";

/**
 * reasoningNode — uses the same vertexService.reasonAboutDocument() call
 * that the legacy pipeline uses, so we get consistent AI reasoning output
 * regardless of which pipeline path ran.
 */
export async function reasoningNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();

  const canonicalText = state.maskedText || state.rawText || "";
  if (!canonicalText.trim()) {
    console.warn("[reasoningNode] No text available for reasoning, using fallback");
    return {
      reasoningMethod: "fallback",
      nodeTimings: { ...state.nodeTimings, reasoning: Date.now() - startTime },
    };
  }

  const fields = (state.mappedFields || []).map((f) => ({
    label: f.label,
    category: (f as any).category || "general",
    matchedCatalogKey: f.matchedCatalogKey || null,
    inputType: (f as any).inputType || "text",
    confidence: (f as any).confidence ?? 0.95,
  }));

  try {
    const result = await vertexService.reasonAboutDocument({
      canonicalText: canonicalText.slice(0, 12000),
      fields,
    });

    console.log(`[reasoningNode] Reasoning complete. urgencyLabel=${result.output.urgencyLabel}, category=${result.output.needCategory}`);

    return {
      caseSummary: result.output.caseSummary,
      urgencyScore: result.output.urgencyScore / 100,  // normalize 0-100 → 0-1
      urgencyLabel: result.output.urgencyLabel,
      urgencyReasons: result.output.urgencyReasons,
      needCategory: result.output.needCategory,
      needSubcategory: result.output.needSubcategory || null,
      recommendedSkillKeys: result.output.recommendedSkillKeys,
      recommendedAction: result.output.recommendedAction || null,
      reasoningConfidence: result.output.reasoningConfidence,
      verificationRisk: result.output.verificationRisk,
      reasoningMethod: result.validationStatus === "fallback" ? "fallback" : "gemini_pro",
      nodeTimings: { ...state.nodeTimings, reasoning: Date.now() - startTime },
    };
  } catch (error) {
    console.error("[reasoningNode] Reasoning failed:", error instanceof Error ? error.message : error);
    return {
      reasoningMethod: "failed",
      nodeTimings: { ...state.nodeTimings, reasoning: Date.now() - startTime },
    };
  }
}
