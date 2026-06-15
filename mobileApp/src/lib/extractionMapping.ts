/**
 * Shared extraction mapping utility (platform-agnostic — no DOM, no React Native).
 * Ports the web extraction pipeline from frontend/src/pages/SurveyPages.tsx so that
 * web and mobile produce identical outputs for the same inputs.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DynamicFieldValue = {
  inputType: string;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueJson?: unknown;
};

export type FormField = {
  id: string;
  label: string;
  inputType: string;
  isRequired?: boolean;
  options?: unknown;
};

export type ExtractionEntry = {
  label: string;
  rawValue: unknown;
  confidence: number | null;
  sourceLabel: string;
  sourceType: 'mapped_field' | 'candidate_field' | 'key_value';
};

export type FieldExtractionMeta = {
  confidence: number | null;
  sourceLabel: string;
  sourceType: ExtractionEntry['sourceType'];
  extractedValue: string;
};

export type ExtractionAttentionItem = {
  fieldId: string;
  fieldLabel: string;
  reason: string;
  confidence: number | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const LOW_CONFIDENCE_THRESHOLD = 0.8;

// ─── normalizeFieldToken ─────────────────────────────────────────────────────

/**
 * Normalizes a label for fuzzy matching:
 * - Trim whitespace
 * - Lowercase
 * - Replace runs of non-alphanumeric characters with underscores
 * - Strip leading/trailing underscores
 *
 * Returns '' for all-punctuation inputs (treated as no-match by callers).
 * Uses the \p{L}\p{N} Unicode classes; falls back to [a-z0-9] on Hermes if needed.
 */
export function normalizeFieldToken(value: string): string {
  let result: string;
  try {
    // Try Unicode property escapes (supported in V8 and modern Hermes)
    result = value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '');
  } catch {
    // Fallback for environments that don't support Unicode property escapes
    result = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  return result;
}

// ─── describeRawValue ────────────────────────────────────────────────────────

function describeRawValue(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return 'Not provided';
  if (typeof rawValue === 'boolean') return rawValue ? 'Yes' : 'No';
  if (Array.isArray(rawValue)) return rawValue.map((v) => String(v)).join(', ');
  if (typeof rawValue === 'object') return JSON.stringify(rawValue);
  return String(rawValue).trim() || 'Not provided';
}

// ─── toConfidenceNumber ───────────────────────────────────────────────────────

function toConfidenceNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

// ─── combineConfidence ────────────────────────────────────────────────────────

function combineConfidence(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

// ─── coerceExtractedValue ────────────────────────────────────────────────────

export function coerceExtractedValue(
  field: FormField,
  rawValue: unknown,
): DynamicFieldValue | null {
  if (rawValue === null || rawValue === undefined) return null;
  const textValue = String(rawValue).trim();
  if (textValue.length === 0) return null;

  const type = field.inputType;

  if (type === 'number' || type === 'decimal') {
    const normalized = textValue.replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);
    if (normalized.length === 0 || Number.isNaN(parsed)) return null;
    return { inputType: type, valueNumber: parsed };
  }

  if (type === 'boolean' || type === 'checkbox') {
    const lower = textValue.toLowerCase();
    if (['yes', 'true', '1', 'checked', 'y'].includes(lower)) {
      return { inputType: type, valueBool: true };
    }
    if (['no', 'false', '0', 'unchecked', 'n'].includes(lower)) {
      return { inputType: type, valueBool: false };
    }
    return null;
  }

  if (type === 'multiselect') {
    const parts = textValue
      .split(/[,;|]/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { inputType: type, valueJson: parts };
  }

  if (type === 'select') {
    return { inputType: type, valueText: textValue, valueJson: textValue };
  }

  return { inputType: type, valueText: textValue };
}

// ─── collectExtractionEntries ────────────────────────────────────────────────

export function collectExtractionEntries(extractionResult: unknown): ExtractionEntry[] {
  const entries: ExtractionEntry[] = [];
  const seenEntries = new Set<string>();

  function pushIfPresent(entry: ExtractionEntry): void {
    const rendered = describeRawValue(entry.rawValue);
    if (typeof entry.label !== 'string' || entry.label.trim().length === 0) return;
    if (rendered === 'Not provided') return;

    const key = `${normalizeFieldToken(entry.label)}::${rendered.toLowerCase()}`;
    if (seenEntries.has(key)) return;
    seenEntries.add(key);

    entries.push({
      ...entry,
      label: entry.label.trim(),
      sourceLabel: (entry.sourceLabel ?? entry.label).trim(),
    });
  }

  if (!extractionResult || typeof extractionResult !== 'object') return entries;
  const result = extractionResult as Record<string, unknown>;

  // Source 1 & 2: documentAi.fields and extractedFields
  const candidateFields = Array.isArray((result.documentAi as Record<string, unknown>)?.fields)
    ? ((result.documentAi as Record<string, unknown>).fields as unknown[])
    : Array.isArray(result.extractedFields)
    ? (result.extractedFields as unknown[])
    : [];

  // Source 3 & 4: fieldMapping.mappedFields and top-level mappedFields
  const mappedFields = Array.isArray(
    ((result.fieldMapping as Record<string, unknown>)?.mappedFields),
  )
    ? ((result.fieldMapping as Record<string, unknown>).mappedFields as unknown[])
    : Array.isArray(result.mappedFields)
    ? (result.mappedFields as unknown[])
    : [];

  (candidateFields as Record<string, unknown>[]).forEach((candidate, index) => {
    const mapped = (mappedFields as Record<string, unknown>[])[index];
    const resolvedLabel =
      typeof candidate?.label === 'string' && candidate.label.trim().length > 0
        ? candidate.label
        : typeof mapped?.label === 'string'
        ? mapped.label
        : '';

    pushIfPresent({
      label: resolvedLabel,
      rawValue: candidate?.valueHint,
      confidence: combineConfidence(
        toConfidenceNumber(candidate?.confidence),
        toConfidenceNumber(mapped?.confidence),
      ),
      sourceLabel:
        typeof candidate?.label === 'string' && candidate.label.trim().length > 0
          ? candidate.label
          : resolvedLabel,
      sourceType:
        typeof mapped?.label === 'string' && mapped.label.trim().length > 0
          ? 'mapped_field'
          : 'candidate_field',
    });
  });

  // Source 5: keyValuePairs (documentAi.keyValuePairs and top-level)
  const kvCollections = [
    Array.isArray((result.documentAi as Record<string, unknown>)?.keyValuePairs)
      ? ((result.documentAi as Record<string, unknown>).keyValuePairs as unknown[])
      : null,
    Array.isArray(result.keyValuePairs) ? (result.keyValuePairs as unknown[]) : null,
  ];

  for (const collection of kvCollections) {
    if (!collection) continue;
    (collection as Record<string, unknown>[]).forEach((item) => {
      pushIfPresent({
        label: item.label as string,
        rawValue: item.value,
        confidence: null,
        sourceLabel: item.label as string,
        sourceType: 'key_value',
      });
    });
  }

  return entries;
}

// ─── applyExtractionToDraft ───────────────────────────────────────────────────

export function applyExtractionToDraft(
  currentDraft: Record<string, DynamicFieldValue>,
  fields: FormField[],
  extractionResult: unknown,
): {
  draft: Record<string, DynamicFieldValue>;
  fieldExtractionMeta: Record<string, FieldExtractionMeta>;
} {
  const nextDraft = { ...currentDraft };
  const fieldExtractionMeta: Record<string, FieldExtractionMeta> = {};
  const usedFieldIds = new Set<string>();

  if (!extractionResult || !fields || fields.length === 0) {
    return { draft: nextDraft, fieldExtractionMeta };
  }

  const entries = collectExtractionEntries(extractionResult);

  for (const entry of entries) {
    const normalizedEntry = normalizeFieldToken(entry.label);
    if (normalizedEntry === '') continue;

    const field = fields.find((f) => {
      if (usedFieldIds.has(f.id)) return false;
      const normalizedField = normalizeFieldToken(f.label);
      return (
        normalizedField === normalizedEntry ||
        normalizedField.includes(normalizedEntry) ||
        normalizedEntry.includes(normalizedField)
      );
    });

    if (!field) continue;

    const coerced = coerceExtractedValue(field, entry.rawValue);
    if (!coerced) continue;

    usedFieldIds.add(field.id);
    nextDraft[field.id] = {
      ...(nextDraft[field.id] ?? { inputType: field.inputType }),
      ...coerced,
    };
    fieldExtractionMeta[field.id] = {
      confidence: entry.confidence,
      sourceLabel: entry.sourceLabel,
      sourceType: entry.sourceType,
      extractedValue: describeRawValue(entry.rawValue),
    };
  }

  return { draft: nextDraft, fieldExtractionMeta };
}

// ─── buildExtractionAttentionItems ───────────────────────────────────────────

export function buildExtractionAttentionItems(
  fields: FormField[],
  draft: Record<string, DynamicFieldValue>,
  fieldExtractionMeta: Record<string, FieldExtractionMeta>,
): ExtractionAttentionItem[] {
  const attentionMap = new Map<string, ExtractionAttentionItem>();

  function upsert(field: FormField, reason: string, confidence: number | null): void {
    const existing = attentionMap.get(field.id);
    if (existing) {
      existing.reason = `${existing.reason} ${reason}`;
      if (existing.confidence === null && confidence !== null) {
        existing.confidence = confidence;
      }
      return;
    }
    attentionMap.set(field.id, {
      fieldId: field.id,
      fieldLabel: field.label,
      reason,
      confidence,
    });
  }

  for (const field of fields) {
    const meta = fieldExtractionMeta[field.id];

    if (meta && (meta.confidence === null || meta.confidence < LOW_CONFIDENCE_THRESHOLD)) {
      const reason =
        meta.confidence === null
          ? 'Confidence is unavailable for this extracted value.'
          : `Low AI confidence (${Math.round(meta.confidence * 100)}%).`;
      upsert(field, reason, meta.confidence);
    }

    if (field.isRequired) {
      const val = draft[field.id];
      const isEmpty =
        !val ||
        ((val.valueText === undefined || val.valueText === '') &&
          val.valueNumber === undefined &&
          val.valueBool === undefined &&
          (!Array.isArray(val.valueJson) || (val.valueJson as unknown[]).length === 0));

      if (isEmpty) {
        upsert(field, 'Required field is still empty after auto-fill.', meta?.confidence ?? null);
      }
    }
  }

  return Array.from(attentionMap.values()).sort((a, b) =>
    a.fieldLabel.localeCompare(b.fieldLabel),
  );
}

// ─── buildResponsePayload ─────────────────────────────────────────────────────

export function buildResponsePayload(
  field: FormField,
  value?: DynamicFieldValue,
): {
  form_field_id: string;
  input_type: string;
  value_text?: string;
  value_number?: number;
  value_bool?: boolean;
  value_json?: unknown;
} | null {
  if (!value) return null;

  const type = field.inputType;

  if (type === 'number' || type === 'decimal') {
    if (value.valueNumber === undefined) return null;
    return { form_field_id: field.id, input_type: type, value_number: value.valueNumber };
  }

  if (type === 'boolean' || type === 'checkbox') {
    if (value.valueBool === undefined) return null;
    return { form_field_id: field.id, input_type: type, value_bool: value.valueBool };
  }

  if (type === 'multiselect') {
    if (!Array.isArray(value.valueJson) || (value.valueJson as unknown[]).length === 0) return null;
    return { form_field_id: field.id, input_type: type, value_json: value.valueJson };
  }

  const text = value.valueText?.trim();
  if (!text) return null;
  return { form_field_id: field.id, input_type: type, value_text: text };
}
