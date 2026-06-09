import { PipelineState } from "../pipelineState";

export async function reasoningFallbackNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  const text = state.maskedText || "";
  const mappedFields = state.mappedFields || [];

  let urgencyScore = 55;
  if (text.toLowerCase().includes("urgent") || text.toLowerCase().includes("critical") || text.toLowerCase().includes("emergency")) {
    urgencyScore = 85;
  } else if (mappedFields.length > 4) {
    urgencyScore = 72;
  }

  let urgencyLabel: "low" | "medium" | "high" | "critical" = "low";
  if (urgencyScore >= 80) urgencyLabel = "high";
  else if (urgencyScore >= 65) urgencyLabel = "medium";

  // Infer category from most common field category
  const categories = mappedFields.map(f => f.category);
  const categoryCounts: Record<string, number> = {};
  let mostCommonCategory = "other";
  let maxCount = 0;
  
  for (const cat of categories) {
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    if (categoryCounts[cat] > maxCount) {
      maxCount = categoryCounts[cat];
      mostCommonCategory = cat;
    }
  }

  const caseSummary = `Case extracted from document. ${mappedFields.length} fields identified. Category: ${mostCommonCategory}. Manual review recommended.`;

  return {
    urgencyScore,
    urgencyLabel,
    needCategory: mostCommonCategory,
    recommendedSkillKeys: [], // Fallback doesn't know skills
    caseSummary,
    reasoningMethod: "fallback",
    nodeTimings: { ...state.nodeTimings, reasoning_fallback: Date.now() - startTime }
  };
}
