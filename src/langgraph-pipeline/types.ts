export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
  evidenceRef: string | null;
  inputType: string;
}

export interface MappedField extends ExtractedField {
  fieldCatalogId: string | null;
  matchedCatalogKey: string | null;
  isCustom: boolean;
  category: string;
  trustLevel: "trusted" | "untrusted";
}

export interface TrustEntry {
  fieldLabel: string;
  trustLevel: "trusted" | "untrusted";
  confidence: number;
  hasCatalogMatch: boolean;
  reason: string;
}
