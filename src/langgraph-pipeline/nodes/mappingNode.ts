import { PipelineState } from "../pipelineState";
import { MappedField } from "../types";
import { levenshteinDistance, normalizeString } from "../utils/catalog";

// Mock catalog for deterministic matching. In a real scenario, this would be fetched from the DB
// in the Input node or here if async DB access is needed.
const MOCK_CATALOG = [
  { id: "cat_1", key: "first_name", label: "First Name", category: "demographics" },
  { id: "cat_2", key: "last_name", label: "Last Name", category: "demographics" },
  { id: "cat_3", key: "age", label: "Age", category: "demographics" },
  { id: "cat_4", key: "phone_number", label: "Phone Number", category: "contact" },
  { id: "cat_5", key: "address", label: "Address", category: "contact" },
  { id: "cat_6", key: "income", label: "Income", category: "financial" },
  { id: "cat_7", key: "education_level", label: "Education Level", category: "education" },
  { id: "cat_8", key: "health_status", label: "Health Status", category: "health" }
];

export async function mappingNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const startTime = Date.now();
  const extractedFields = state.extractedFields || [];
  
  const mappedFields: MappedField[] = [];
  const unmatchedFields: string[] = [];
  let matchedCount = 0;

  for (const field of extractedFields) {
    const normalizedLabel = normalizeString(field.label);
    
    // 1. Exact Match
    let match = MOCK_CATALOG.find(c => normalizeString(c.label) === normalizedLabel || normalizeString(c.key) === normalizedLabel);
    
    // 2. Fuzzy Match (Levenshtein Distance <= 2)
    if (!match) {
      let bestDist = Infinity;
      let bestMatch = null;
      
      for (const cat of MOCK_CATALOG) {
        const distLabel = levenshteinDistance(normalizedLabel, normalizeString(cat.label));
        const distKey = levenshteinDistance(normalizedLabel, normalizeString(cat.key));
        
        const minDist = Math.min(distLabel, distKey);
        if (minDist <= 2 && minDist < bestDist) {
          bestDist = minDist;
          bestMatch = cat;
        }
      }
      match = bestMatch || undefined;
    }

    // 3. Populate MappedField
    if (match) {
      matchedCount++;
      mappedFields.push({
        ...field,
        fieldCatalogId: match.id,
        matchedCatalogKey: match.key,
        isCustom: false,
        category: match.category,
        trustLevel: "untrusted" // Will be evaluated in trustGateNode
      });
    } else {
      unmatchedFields.push(field.label);
      
      // Infer category from keywords
      let inferredCategory = "other";
      if (normalizedLabel.includes("health") || normalizedLabel.includes("medical") || normalizedLabel.includes("disease")) {
        inferredCategory = "health";
      } else if (normalizedLabel.includes("school") || normalizedLabel.includes("education") || normalizedLabel.includes("degree")) {
        inferredCategory = "education";
      } else if (normalizedLabel.includes("money") || normalizedLabel.includes("salary") || normalizedLabel.includes("wage")) {
        inferredCategory = "financial";
      }

      mappedFields.push({
        ...field,
        fieldCatalogId: null,
        matchedCatalogKey: null,
        isCustom: true,
        category: inferredCategory,
        trustLevel: "untrusted"
      });
    }
  }

  const mappingConfidence = extractedFields.length > 0 ? matchedCount / extractedFields.length : 0;
  const duration = Date.now() - startTime;

  return {
    mappedFields,
    unmatchedFields,
    mappingConfidence,
    nodeTimings: { ...state.nodeTimings, mapping: duration }
  };
}
