import { PipelineState } from "../pipelineState";

export async function reviewPrepNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  
  const requiresHuman = 
    state.trustStatus === "requires_human" || 
    state.reasoningMethod === "fallback" || 
    (state.compositeConfidence !== undefined && state.compositeConfidence < 0.6);

  const reviewQueue = requiresHuman ? "human-review" : "standard-review";
  const pipelineStatus = requiresHuman ? "requires_human" : "completed";

  return {
    reviewQueue,
    pipelineStatus,
    documentStatus: "review_pending", // Always review_pending as human must confirm
    nodeTimings: { ...state.nodeTimings, review_prep: Date.now() - startTime }
  };
}
