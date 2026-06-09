import { PipelineState } from "../pipelineState";
import { TrustEntry } from "../types";

export async function trustGateNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  const mappedFields = state.mappedFields || [];
  
  if (mappedFields.length === 0) {
    return {
      compositeConfidence: 0,
      trustStatus: "failed",
      fieldTrustMap: {},
      trustedCount: 0,
      untrustedCount: 0,
      nodeTimings: { ...state.nodeTimings, trust_gate: Date.now() - startTime }
    };
  }

  const fieldTrustMap: Record<string, TrustEntry> = {};
  let trustedCount = 0;
  let totalConfidence = 0;
  let fieldsWithEvidence = 0;

  for (const field of mappedFields) {
    // Determine trust for individual field
    const isTrusted = field.confidence >= 0.8 || field.fieldCatalogId !== null;
    const trustLevel = isTrusted ? "trusted" : "untrusted";
    
    if (isTrusted) trustedCount++;
    totalConfidence += field.confidence;
    if (field.evidenceRef) fieldsWithEvidence++;

    // Update field object itself
    field.trustLevel = trustLevel;

    // Add to map
    fieldTrustMap[field.label] = {
      fieldLabel: field.label,
      trustLevel: trustLevel,
      confidence: field.confidence,
      hasCatalogMatch: field.fieldCatalogId !== null,
      reason: isTrusted ? "High confidence or catalog match" : "Low confidence and no catalog match"
    };
  }

  const totalCount = mappedFields.length;
  const untrustedCount = totalCount - trustedCount;

  // Composite Score Math
  const fieldCompleteness = trustedCount / totalCount;
  const evidenceStrength = fieldsWithEvidence / totalCount;
  const ruleConsistency = 1.0; // Simplification unless PII masked a lot
  const modelSignal = totalConfidence / totalCount;

  const compositeConfidence = (fieldCompleteness + evidenceStrength + ruleConsistency + modelSignal) / 4;

  const trustStatus = untrustedCount > 0 ? "requires_human" : "passed";
  const duration = Date.now() - startTime;

  return {
    compositeConfidence,
    trustStatus,
    fieldTrustMap,
    trustedCount,
    untrustedCount,
    mappedFields, // Return updated fields with trustLevel set
    nodeTimings: { ...state.nodeTimings, trust_gate: duration }
  };
}
