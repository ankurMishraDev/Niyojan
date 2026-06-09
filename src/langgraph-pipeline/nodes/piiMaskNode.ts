import { PipelineState } from "../pipelineState";

export async function piiMaskNode(state: PipelineState): Promise<Partial<PipelineState>> {
  if (!state.rawText) {
    return {
      maskedText: null,
      piiTokenMap: {},
      piiMaskingMethod: "skipped",
      nodeTimings: { ...state.nodeTimings, pii_mask: 0 }
    };
  }

  const startTime = Date.now();
  let masked = state.rawText;
  const tokenMap: Record<string, string> = {};
  let tokenCounter = 1;

  // Indian Phone Numbers (10 digits starting with 6-9)
  const phoneRegex = /[6-9]\d{9}/g;
  masked = masked.replace(phoneRegex, (match) => {
    const token = `[PII_PHONE_${String(tokenCounter).padStart(3, '0')}]`;
    tokenMap[token] = match;
    tokenCounter++;
    return token;
  });

  // Aadhaar Numbers (12 digits, optional spaces)
  const aadhaarRegex = /\d{4}\s?\d{4}\s?\d{4}/g;
  masked = masked.replace(aadhaarRegex, (match) => {
    // Only mask if it's likely an Aadhaar (not just any 12 digit number, though context helps)
    const token = `[PII_AADHAAR_${String(tokenCounter).padStart(3, '0')}]`;
    tokenMap[token] = match;
    tokenCounter++;
    return token;
  });

  // Email Addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  masked = masked.replace(emailRegex, (match) => {
    const token = `[PII_EMAIL_${String(tokenCounter).padStart(3, '0')}]`;
    tokenMap[token] = match;
    tokenCounter++;
    return token;
  });

  // Name Heuristic (very basic: Name: First Last)
  const nameRegex = /Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g;
  masked = masked.replace(nameRegex, (match, p1) => {
    const token = `[PII_NAME_${String(tokenCounter).padStart(3, '0')}]`;
    tokenMap[token] = p1;
    tokenCounter++;
    return `Name: ${token}`;
  });

  const duration = Date.now() - startTime;

  return {
    maskedText: masked,
    piiTokenMap: tokenMap,
    piiMaskingMethod: "regex",
    nodeTimings: { ...state.nodeTimings, pii_mask: duration }
  };
}
