import { PipelineState } from "../pipelineState";

export async function fallbackNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  // Here we would run Tesseract.js
  
  // Simulated fallback response
  return {
    extractionMethod: "tesseract",
    extractedFields: [], // Could be empty or partial depending on OCR
    extractionConfidence: 0.1, // Low confidence
    nodeTimings: { ...state.nodeTimings, fallback: Date.now() - startTime }
  };
}
