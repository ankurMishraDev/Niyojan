import NetInfo from '@react-native-community/netinfo';
import { db } from '../db/schema';
import { formsApi, surveysApi } from './services';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

type SyncRow = {
  id: string;
  entityType: string;
  localId: string;
  remoteId: string | null;
  op: string;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type SurveyRow = {
  id: string;
  remoteId: string | null;
  templateVersionId: string | null;
  formId: string | null;
  volunteerId: string | null;
  respondentName: string | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  data: string | null;
  submittedLanguage: string | null;
  status: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function generateUuid(): string {
  // RFC4122-compliant UUID v4 without external dependencies
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function setStatus(id: string, status: string): void {
  db.runSync('UPDATE sync_queue SET status=?, updatedAt=? WHERE id=?', [status, nowIso(), id]);
}

/**
 * Map local survey data to the responses[] format expected by surveysApi.submit.
 *
 * Handles TWO storage formats:
 *   1. Structured: { inputType: "text", valueText: "..." }  — from the web extraction flow
 *   2. Raw string: "some text answer"  — from the mobile FillForm screen
 *
 * The mobile FillForm saves answers as plain strings keyed by field ID.
 * We treat those as text responses.
 */
function buildResponsesFromLocalData(data: Record<string, unknown>): unknown[] {
  const responses: unknown[] = [];
  for (const [fieldId, val] of Object.entries(data)) {
    if (val === null || val === undefined || val === '') continue;

    // Raw string format (from mobile FillForm)
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        responses.push({ form_field_id: fieldId, input_type: 'text', value_text: trimmed });
      }
      continue;
    }

    // Number stored directly
    if (typeof val === 'number') {
      responses.push({ form_field_id: fieldId, input_type: 'number', value_number: val });
      continue;
    }

    // Structured object format (from extraction / web flow)
    if (typeof val === 'object') {
      const v = val as Record<string, unknown>;
      const inputType = (v.inputType as string) ?? 'text';

      if (inputType === 'number' || inputType === 'decimal') {
        if (v.valueNumber !== undefined && v.valueNumber !== null) {
          responses.push({ form_field_id: fieldId, input_type: inputType, value_number: v.valueNumber });
        }
      } else if (inputType === 'boolean' || inputType === 'checkbox') {
        if (v.valueBool !== undefined && v.valueBool !== null) {
          responses.push({ form_field_id: fieldId, input_type: inputType, value_bool: v.valueBool });
        }
      } else if (inputType === 'multiselect') {
        if (Array.isArray(v.valueJson) && v.valueJson.length > 0) {
          responses.push({ form_field_id: fieldId, input_type: inputType, value_json: v.valueJson });
        }
      } else {
        const text = (v.valueText as string | undefined)?.trim();
        if (text) {
          responses.push({ form_field_id: fieldId, input_type: inputType, value_text: text });
        }
      }
    }
  }
  return responses;
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

/**
 * Add a survey to the sync queue (called after saving offline).
 * Uses parameterized statements — no string interpolation.
 */
export function enqueueSurvey(localId: string): void {
  const now = nowIso();
  db.runSync(
    `INSERT INTO sync_queue (id, entityType, localId, op, status, idempotencyKey, createdAt, updatedAt)
     VALUES (?, 'survey', ?, 'create_and_submit', 'pending', ?, ?, ?)`,
    [generateUuid(), localId, generateUuid(), now, now],
  );
}

// ─── Sync survey (two-step) ───────────────────────────────────────────────────

async function syncSurvey(item: SyncRow): Promise<void> {
  const localRows = db.getAllSync('SELECT * FROM surveys WHERE id = ?', [item.localId]) as SurveyRow[];
  const local = localRows[0];

  if (!local) {
    throw new Error(`Survey ${item.localId} not found in local db`);
  }

  // Check if data is actually empty — handle both {} and {"fieldId": ""} cases
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(local.data);
  } catch {
    throw new Error('Survey data is not valid JSON');
  }

  // A survey is empty if: no keys, OR all string values are blank/empty
  const hasContent = Object.values(parsed).some((v) => {
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number') return true;
    if (typeof v === 'boolean') return true;
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      return (
        (typeof obj.valueText === 'string' && obj.valueText.trim().length > 0) ||
        obj.valueNumber !== undefined ||
        obj.valueBool !== undefined
      );
    }
    return false;
  });

  if (!hasContent) {
    throw new Error('Survey has no captured data — skipping submit');
  }

  console.log(`[SYNC] Survey ${local.id}: hasContent=${hasContent}, keys=${Object.keys(parsed).length}, templateVersionId=${local.templateVersionId ?? 'null'}`);

  // Step 1: create draft (skip if already created)
  let remoteId = item.remoteId ?? local.remoteId;
  if (!remoteId) {
    // If templateVersionId is missing, try to look it up from the cached forms table
    let templateVersionId = local.templateVersionId;
    if (!templateVersionId && local.formId) {
      const cachedForm = db.getFirstSync(
        'SELECT templateVersionId FROM forms WHERE id = ?',
        [local.formId]
      ) as { templateVersionId: string | null } | null;
      templateVersionId = cachedForm?.templateVersionId ?? null;
    }

    if (!templateVersionId) {
      throw new Error(`No templateVersionId for survey ${local.id} — cannot create remote draft`);
    }

    const survey = await surveysApi.create({
      template_version_id: templateVersionId,
      respondent_name: local.respondentName ?? undefined,
      location_text: local.locationText ?? undefined,
      latitude: local.latitude ?? undefined,
      longitude: local.longitude ?? undefined,
      submitted_language: local.submittedLanguage ?? 'en',
    });
    remoteId = survey.id;
    console.log(`[SYNC] Created remote survey ${remoteId} for local ${local.id}`);
    // Store remoteId on both survey row and queue item (parameterized)
    db.runSync('UPDATE surveys SET remoteId=? WHERE id=?', [remoteId, local.id]);
    db.runSync('UPDATE sync_queue SET remoteId=?, updatedAt=? WHERE id=?', [remoteId, nowIso(), item.id]);
  }

  const responses = buildResponsesFromLocalData(parsed);
  if (responses.length === 0) {
    throw new Error('Survey data produced zero responses — skipping submit');
  }

  await surveysApi.submit(remoteId!, { responses });
  console.log(`[SYNC] Successfully submitted survey ${local.id} → remote ${remoteId} with ${responses.length} responses`);
  db.runSync("UPDATE surveys SET status='submitted' WHERE id=?", [local.id]);
}

// ─── Flush queue ─────────────────────────────────────────────────────────────

let _flushInProgress = false;

/**
 * Flush all pending/retrying sync queue items.
 * Guards against concurrent flushes with an in-memory flag.
 */
export async function flush(): Promise<void> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;
  if (_flushInProgress) return;

  _flushInProgress = true;
  try {
    const items = db.getAllSync(
      `SELECT * FROM sync_queue
       WHERE status IN ('pending', 'retrying', 'failed')
         AND (nextAttemptAt IS NULL OR nextAttemptAt <= ?)
       ORDER BY createdAt ASC`,
      [nowIso()],
    ) as SyncRow[];

    for (const item of items) {
      // Skip permanently failed items
      if (item.status === 'failed' && item.attempts >= MAX_ATTEMPTS) continue;

      try {
        setStatus(item.id, 'in_flight');
        console.log(`[SYNC] Processing item ${item.id}: op=${item.op}, localId=${item.localId}`);
        if (item.op === 'create_and_submit') {
          await syncSurvey(item);
        }
        setStatus(item.id, 'synced');
      } catch (err: unknown) {
        const attempts = item.attempts + 1;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const jitter = Math.random() * 1000;
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts) + jitter, 300_000);
        const nextAttempt =
          attempts >= MAX_ATTEMPTS
            ? null // don't retry permanently-failed items
            : new Date(Date.now() + delay).toISOString();
        const newStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'retrying';

        db.runSync(
          `UPDATE sync_queue SET status=?, attempts=?, lastError=?, nextAttemptAt=?, updatedAt=? WHERE id=?`,
          [newStatus, attempts, errorMsg, nextAttempt, nowIso(), item.id],
        );

        console.warn(`[SYNC] Item ${item.id} failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${errorMsg}`);
      }
    }
  } finally {
    _flushInProgress = false;
  }
}

// ─── Template caching ─────────────────────────────────────────────────────────

/**
 * Download all published templates with their published versions and cache them
 * in the local `forms` table for offline use.
 * Per-template errors are caught and logged; remaining templates continue.
 */
export async function cacheTemplatesForOffline(): Promise<void> {
  try {
    const result = await formsApi.listTemplates({ page: 1, pageSize: 100, status: 'active' });
    const templates = result.items ?? [];

    for (const template of templates) {
      try {
        const versions: any[] = await formsApi.listVersions(template.id);
        const published = versions.find((v: any) => v.isPublished) ?? versions[0];
        if (!published) continue;

        const version = await formsApi.getVersion(published.id);
        const now = nowIso();

        db.runSync(
          `INSERT OR REPLACE INTO forms (id, templateVersionId, title, description, fields, status, updatedAt, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            template.id,
            published.id,
            template.name,
            template.description ?? '',
            JSON.stringify(version.fields ?? []),
            'active',
            now,
          ],
        );
      } catch (templateErr) {
        console.warn(`[CACHE] Failed to cache template ${template.id}:`, templateErr);
      }
    }
    console.log(`[CACHE] Cached ${templates.length} templates for offline use.`);
  } catch (err) {
    console.warn('[CACHE] Failed to load templates for caching:', err);
  }
}
