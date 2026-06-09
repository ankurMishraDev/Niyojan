import { PipelineState } from "../pipelineState";

export async function inputNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  // Here we would typically fetch the document from the DB and verify it exists
  // For now, simulating the validation check
  // The plan mentioned setting pipelineStatus: 'failed' if not found
  
  if (!state.documentId) {
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), "Document ID missing"],
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime }
    };
  }

  // Simulating Survey check (crucial for fixing the undefined survey crash)
  if (state.surveyId === undefined) { // explicitly undefined, null is okay
    return {
      pipelineStatus: "failed",
      errors: [...(state.errors || []), "Survey ID cannot be undefined (must be string or null)"],
      nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime }
    };
  }

  return {
    nodeTimings: { ...state.nodeTimings, input: Date.now() - startTime }
  };
}
