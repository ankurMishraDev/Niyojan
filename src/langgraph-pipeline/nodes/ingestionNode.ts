import { PipelineState } from "../pipelineState";

/**
 * ingestionNode — since rawText is already populated by inputNode from the
 * survey's digitized responses, this node is now a simple pass-through that
 * confirms the text is available and sets the fileType.
 *
 * We no longer fetch from GCS here because we don't want to process the raw
 * uploaded PDF — we want the structured survey responses, which inputNode
 * already loaded.
 */
export async function ingestionNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();

  // rawText is populated by inputNode from survey responses.
  // maskedText may be set if piiMaskNode has run.
  const textAvailable = Boolean(state.maskedText?.trim() || state.rawText?.trim());

  if (!textAvailable) {
    return {
      ingestionError: "No survey text available — survey has no responses or inputNode did not populate rawText",
      nodeTimings: { ...state.nodeTimings, ingestion: Date.now() - startTime },
    };
  }

  return {
    fileType: "text/plain", // survey responses are always treated as plain text
    ingestionError: null,
    nodeTimings: { ...state.nodeTimings, ingestion: Date.now() - startTime },
  };
}
