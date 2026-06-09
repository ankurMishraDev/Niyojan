import { StateGraph, END } from "@langchain/langgraph";
import { PipelineStateAnnotation, PipelineState } from "./pipelineState";
import { inputNode }              from "./nodes/inputNode";
import { piiMaskNode }            from "./nodes/piiMaskNode";
import { ingestionNode }          from "./nodes/ingestionNode";
import { aiExtractionNode }       from "./nodes/aiExtractionNode";
import { fallbackNode }           from "./nodes/fallbackNode";
import { mappingNode }            from "./nodes/mappingNode";
import { trustGateNode }          from "./nodes/trustGateNode";
import { reasoningNode }          from "./nodes/reasoningNode";
import { reasoningFallbackNode }  from "./nodes/reasoningFallbackNode";
import { reviewPrepNode }         from "./nodes/reviewPrepNode";
import { persistNode }            from "./nodes/persistNode";

const graph = new StateGraph(PipelineStateAnnotation)
  .addNode("input",              inputNode)
  .addNode("pii_mask",           piiMaskNode)
  .addNode("ingestion",          ingestionNode)
  .addNode("ai_extraction",      aiExtractionNode)
  .addNode("fallback",           fallbackNode)
  .addNode("mapping",            mappingNode)
  .addNode("trust_gate",         trustGateNode)
  .addNode("reasoning",          reasoningNode)
  .addNode("reasoning_fallback", reasoningFallbackNode)
  .addNode("review_prep",        reviewPrepNode)
  .addNode("persist",            persistNode)

  // Edges
  .addEdge("__start__",      "input")
  .addConditionalEdges("input", (s: PipelineState) =>
    s.pipelineStatus === "failed" ? END : "pii_mask"
  )
  .addEdge("pii_mask",       "ingestion")
  .addConditionalEdges("ingestion", (s: PipelineState) =>
    s.ingestionError ? "fallback" : "ai_extraction"
  )
  .addConditionalEdges("ai_extraction", (s: PipelineState) =>
    s.extractionMethod === "failed" ? "fallback" : "mapping"
  )
  .addEdge("fallback",       "mapping")
  .addEdge("mapping",        "trust_gate")
  .addEdge("trust_gate",     "reasoning")          // always — no escalation gate
  .addConditionalEdges("reasoning", (s: PipelineState) =>
    s.reasoningMethod === "failed" ? "reasoning_fallback" : "review_prep"
  )
  .addEdge("reasoning_fallback", "review_prep")
  .addEdge("review_prep",    "persist")
  .addEdge("persist",        END);

export const compiledPipeline = graph.compile();

// Adapter called by existing pipeline module
export async function runDocumentPipeline(
  documentId: string,
  orgId: string,
  userId: string,
  surveyId: string | null = null,
  rawTextOverride?: string
) {
  const initialState = {
    documentId,
    orgId,
    userId,
    surveyId, // crucial for input node validation
    rawText: rawTextOverride || null,
    errors: [],
    nodeTimings: {},
    extractedFields: [],
    mappedFields: [],
    unmatchedFields: [],
    piiTokenMap: {},
    urgencyReasons: [],
    recommendedSkillKeys: [],
  };

  // Using invoke, passing full initial state object matching the Annotation
  const result = await compiledPipeline.invoke(initialState);
  return result;
}
