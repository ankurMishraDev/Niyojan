import { PipelineState } from "../pipelineState";

export async function ingestionNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  // Here we would download from GCS and run pdf-parse
  // Currently we rely on rawText potentially passed in from earlier logic, or assume we fetch it
  
  if (!state.maskedText && !state.rawText) {
      // Simulate reading raw text if it wasn't provided directly
      // In a real scenario, this gets from GCS using state.documentId
      // For testing, if we fail to get text, we set an error
      return {
          ingestionError: "Failed to load document text from storage",
          nodeTimings: { ...state.nodeTimings, ingestion: Date.now() - startTime }
      };
  }

  return {
    fileType: state.fileType || "text/plain", // Default to text for now
    nodeTimings: { ...state.nodeTimings, ingestion: Date.now() - startTime }
  };
}
