import { Annotation } from "@langchain/langgraph";
import { ExtractedField, MappedField, TrustEntry } from "./types";

export const PipelineStateAnnotation = Annotation.Root({
  // ── Input ────────────────────────────────────────────────
  documentId:   Annotation<string>(),
  orgId:        Annotation<string>(),
  userId:       Annotation<string>(),
  surveyId:     Annotation<string | null>(),

  // ── PII Masking output ───────────────────────────────────
  rawText:          Annotation<string | null>(),
  maskedText:       Annotation<string | null>(),   // text sent to Gemini
  piiTokenMap:      Annotation<Record<string, string>>(),  // token → original
  piiMaskingMethod: Annotation<"regex" | "dlp" | "skipped">(),

  // ── Ingestion output ─────────────────────────────────────
  fileType:       Annotation<string | null>(),
  ingestionError: Annotation<string | null>(),

  // ── AI Extraction output ─────────────────────────────────
  extractedFields:     Annotation<ExtractedField[]>(),
  extractionMethod:    Annotation<"gemini" | "tesseract" | "failed">(),
  extractionConfidence: Annotation<number>(),      // always set, never undefined
  extractionError:     Annotation<string | null>(),

  // ── Mapping output ───────────────────────────────────────
  mappedFields:      Annotation<MappedField[]>(),
  unmatchedFields:   Annotation<string[]>(),
  mappingConfidence: Annotation<number>(),

  // ── Trust Gate output ────────────────────────────────────
  compositeConfidence: Annotation<number>(),
  trustStatus:         Annotation<"passed" | "requires_human" | "failed">(),
  fieldTrustMap:       Annotation<Record<string, TrustEntry>>(),
  trustedCount:        Annotation<number>(),
  untrustedCount:      Annotation<number>(),

  // ── Reasoning output ─────────────────────────────────────
  caseSummary:           Annotation<string | null>(),
  urgencyScore:          Annotation<number>(),
  urgencyLabel:          Annotation<"low" | "medium" | "high" | "critical">(),
  urgencyReasons:        Annotation<string[]>(),
  needCategory:          Annotation<string>(),
  needSubcategory:       Annotation<string | null>(),
  recommendedSkillKeys:  Annotation<string[]>(),
  recommendedAction:     Annotation<string | null>(),
  reasoningConfidence:   Annotation<number>(),
  verificationRisk:      Annotation<"low" | "medium" | "high">(),
  reasoningMethod:       Annotation<"gemini_pro" | "fallback" | "failed">(),

  // ── Final ────────────────────────────────────────────────
  documentStatus:  Annotation<string>(),
  pipelineStatus:  Annotation<string>(),
  reviewQueue:     Annotation<"human-review" | "standard-review">(),
  errors:          Annotation<string[]>(),
  nodeTimings:     Annotation<Record<string, number>>(),  // ms per node
});

export type PipelineState = typeof PipelineStateAnnotation.State;
