/**
 * Offline-first survey fill screen.
 *
 * Architecture:
 *  - Answers are saved to SQLite continuously (auto-save on every field change).
 *  - "Save Draft" saves the current state locally with status='draft'.
 *  - "Upload to Server" is only enabled when online. It enqueues the survey for
 *    background sync via syncService and shows the pending count.
 *  - The app NEVER tries to talk to the server directly from this screen.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/db/schema';
import { useAppStore } from '../../src/store/appStore';
import { enqueueSurvey, flush } from '../../src/lib/syncService';

// ── A lightweight UUID that doesn't need a library ───────────────────────────
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── How many surveys are in the sync queue waiting to upload ─────────────────
function getPendingCount(): number {
  try {
    const rows = db.getAllSync(
      `SELECT COUNT(*) as cnt FROM sync_queue WHERE status IN ('pending','retrying')`,
      []
    ) as { cnt: number }[];
    return rows[0]?.cnt ?? 0;
  } catch {
    return 0;
  }
}

export default function FillForm() {
  const { id, surveyId: existingSurveyId } = useLocalSearchParams<{ id: string; surveyId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useAppStore();

  const [form, setForm] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Local survey row ID — created once when the form first loads
  const localSurveyId = useRef<string>(existingSurveyId ?? uuid());
  const [saveFeedback, setSaveFeedback] = useState('');
  const [pendingCount, setPendingCount] = useState(getPendingCount);
  const [uploading, setUploading] = useState(false);

  // Load the form template from SQLite
  useEffect(() => {
    db.getFirstAsync('SELECT * FROM forms WHERE id = ?', [id]).then((row: any) => {
      if (row) {
        try {
          setForm({ ...row, fields: JSON.parse(row.fields) });
        } catch {
          setForm({ ...row, fields: [] });
        }
      }
    });
  }, [id]);

  // Load any previously auto-saved answers for this survey ID
  useEffect(() => {
    db.getFirstAsync('SELECT data FROM surveys WHERE id = ?', [localSurveyId.current])
      .then((row: any) => {
        if (row?.data && row.data !== '{}' && row.data !== 'null') {
          try { setAnswers(JSON.parse(row.data)); } catch { /* ignore */ }
        }
      });
  }, []);

  // ── Auto-save answers to SQLite whenever they change ─────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistAnswers = useCallback((currentAnswers: Record<string, string>) => {
    const now = new Date().toISOString();
    const sid = localSurveyId.current;
    try {
      // Upsert — create if not exists, update data if exists
      const existing = db.getFirstSync('SELECT id FROM surveys WHERE id = ?', [sid]);
      if (existing) {
        db.runSync(
          'UPDATE surveys SET data=?, updatedAt=? WHERE id=?',
          [JSON.stringify(currentAnswers), now, sid]
        );
      } else {
        // Look up templateVersionId from the cached form so syncService can call
        // surveysApi.create({ template_version_id: ... }) without hitting the network
        const cachedForm = db.getFirstSync(
          'SELECT templateVersionId FROM forms WHERE id = ?',
          [id]
        ) as { templateVersionId: string | null } | null;
        db.runSync(
          `INSERT INTO surveys (id, formId, templateVersionId, data, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
          [sid, id, cachedForm?.templateVersionId ?? null, JSON.stringify(currentAnswers), now, now]
        );
      }
    } catch (err) {
      console.warn('[AUTO-SAVE] failed:', err);
    }
  }, [id]);

  const handleAnswerChange = (fieldId: string, value: string) => {
    const next = { ...answers, [fieldId]: value };
    setAnswers(next);

    // Debounced auto-save (500 ms after last keystroke)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => persistAnswers(next), 500);
  };

  // ── Save Draft (explicit button) ─────────────────────────────────────────
  const saveDraft = () => {
    try {
      persistAnswers(answers);
      setSaveFeedback('Draft saved to device.');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (err) {
      setSaveFeedback('Save failed. Please try again.');
    }
  };

  // ── Upload to Server ──────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (isOffline) {
      setSaveFeedback('You are offline. Connect to the internet to upload.');
      return;
    }

    // Make sure latest answers are persisted first
    persistAnswers(answers);
    const sid = localSurveyId.current;

    try {
      // Check if already queued
      const inQueue = db.getFirstSync(
        `SELECT id FROM sync_queue WHERE localId=? AND status NOT IN ('synced','failed')`,
        [sid]
      );
      if (!inQueue) {
        enqueueSurvey(sid);
      }

      setUploading(true);
      setSaveFeedback('Uploading…');
      await flush();
      setPendingCount(getPendingCount());

      const nowSynced = db.getFirstSync(
        `SELECT status FROM sync_queue WHERE localId=? ORDER BY createdAt DESC LIMIT 1`,
        [sid]
      ) as { status: string } | undefined;

      if (nowSynced?.status === 'synced') {
        setSaveFeedback('Uploaded successfully!');
        setTimeout(() => router.back(), 1200);
      } else {
        setSaveFeedback('Upload queued. It will retry automatically when online.');
      }
    } catch (err) {
      setSaveFeedback('Upload failed. Survey is saved locally and will retry when online.');
    } finally {
      setUploading(false);
      setPendingCount(getPendingCount());
    }
  };

  if (!form) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas-soft-2">
        <ActivityIndicator size="large" color="#171717" />
        <Text className="text-mute mt-3 text-sm">{t('forms.loading', 'Loading form…')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas-soft-2">
      {/* Header */}
      <View className="p-4 bg-primary pt-10 pb-6">
        <Text className="text-2xl font-bold text-on-primary">{form.title}</Text>
        {form.description ? (
          <Text className="text-on-primary/80 mt-1 text-sm">{form.description}</Text>
        ) : null}
        {/* Connectivity indicator */}
        <View className="flex-row items-center mt-2 gap-2">
          <View className={`w-2 h-2 rounded-full ${isOffline ? 'bg-warning' : 'bg-cyan'}`} />
          <Text className="text-on-primary/70 text-xs">
            {isOffline ? 'Offline — answers save to device' : 'Online — upload available'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 p-4"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Feedback banner */}
          {saveFeedback ? (
            <View className="bg-canvas border border-hairline rounded-md px-4 py-3 mb-4">
              <Text className="text-ink text-sm">{saveFeedback}</Text>
            </View>
          ) : null}

          {/* Pending upload count */}
          {pendingCount > 0 && (
            <View className="bg-warning-soft border border-warning/30 rounded-md px-4 py-2 mb-4">
              <Text className="text-warning-deep text-xs">
                {pendingCount} survey{pendingCount !== 1 ? 's' : ''} pending upload on this device
              </Text>
            </View>
          )}

          {/* Form fields */}
          {form.fields.map((field: any) => (
            <View
              key={field.id}
              className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline"
            >
              <Text className="font-medium text-ink mb-2">
                {field.label}{' '}
                {field.required ? <Text className="text-danger">*</Text> : null}
              </Text>
              <TextInput
                className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2"
                placeholder={t('forms.answerPlaceholder', 'Your answer')}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                value={answers[field.id] ?? ''}
                onChangeText={(val) => handleAnswerChange(field.id, val)}
                multiline={field.type === 'textarea'}
                numberOfLines={field.type === 'textarea' ? 4 : 1}
              />
            </View>
          ))}

          {/* Action buttons */}
          <View className="gap-3 mt-2">
            {/* Save Draft — always available */}
            <Pressable
              className="bg-canvas border border-hairline rounded-pill py-3 items-center shadow-card-soft"
              onPress={saveDraft}
            >
              <Text className="text-ink font-medium">
                Save Draft to Device
              </Text>
            </Pressable>

            {/* Upload — only active online */}
            <Pressable
              className={`rounded-pill py-3 items-center shadow-card-soft ${
                isOffline ? 'bg-canvas-soft-2 border border-hairline' : 'bg-primary'
              }`}
              onPress={() => void handleUpload()}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className={`font-medium ${isOffline ? 'text-mute' : 'text-on-primary'}`}>
                  {isOffline ? 'Upload Unavailable (Offline)' : 'Upload to Server'}
                </Text>
              )}
            </Pressable>

            {isOffline && (
              <Text className="text-center text-xs text-mute px-4">
                You are offline. Save the draft and upload when you reconnect.
              </Text>
            )}
          </View>

          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
