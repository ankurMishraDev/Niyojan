import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, FileText, RefreshCw } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../src/db/schema';
import { useAppStore } from '../../src/store/appStore';
import { enqueueSurvey, flush } from '../../src/lib/syncService';

type FormTemplate = {
  id: string;
  title: string;
  description: string;
  status: string;
  synced: number;
};

type SavedSurvey = {
  id: string;
  formId: string | null;
  respondentName: string | null;
  locationText: string | null;
  data: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  remoteId: string | null;
  synced: number;
  // join fields
  formTitle: string | null;
  syncStatus: string | null; // from sync_queue
};

type SyncQueueRow = {
  localId: string;
  status: string;
  attempts: number;
  lastError: string | null;
};

/** Merge surveys with their sync_queue status */
function loadSavedSurveys(): SavedSurvey[] {
  try {
    const rows = db.getAllSync(
      `SELECT
         s.*,
         f.title as formTitle,
         sq.status as syncStatus,
         sq.attempts as syncAttempts,
         sq.lastError as syncLastError
       FROM surveys s
       LEFT JOIN forms f ON s.formId = f.id
       LEFT JOIN (
         SELECT localId, status, attempts, lastError
         FROM sync_queue
         WHERE id IN (
           SELECT id FROM sync_queue sq2
           WHERE sq2.localId = sync_queue.localId
           ORDER BY createdAt DESC LIMIT 1
         )
       ) sq ON sq.localId = s.id
       ORDER BY s.createdAt DESC`,
      []
    ) as SavedSurvey[];
    return rows;
  } catch {
    // Simpler fallback if the JOIN fails
    try {
      const rows = db.getAllSync('SELECT s.*, f.title as formTitle FROM surveys s LEFT JOIN forms f ON s.formId = f.id ORDER BY s.createdAt DESC', []) as SavedSurvey[];
      return rows;
    } catch {
      return [];
    }
  }
}

function pendingUploadCount(): number {
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

function surveyStatusLabel(survey: SavedSurvey): { label: string; color: string; bg: string } {
  if (survey.remoteId || survey.syncStatus === 'synced') {
    return { label: 'Uploaded', color: 'text-success', bg: 'bg-success/10' };
  }
  if (survey.syncStatus === 'in_flight') {
    return { label: 'Uploading…', color: 'text-link', bg: 'bg-link-bg-soft' };
  }
  if (survey.syncStatus === 'failed') {
    return { label: 'Upload Failed', color: 'text-danger', bg: 'bg-error-soft' };
  }
  if (survey.syncStatus === 'retrying') {
    return { label: 'Retrying…', color: 'text-warning-deep', bg: 'bg-warning-soft' };
  }
  if (survey.status === 'draft') {
    return { label: 'Draft', color: 'text-mute', bg: 'bg-canvas-soft-2' };
  }
  return { label: 'Saved', color: 'text-body', bg: 'bg-canvas-soft' };
}

// ── SurveyDetailModal ─────────────────────────────────────────────────────────
function SurveyDetailModal({ survey, onClose }: { survey: SavedSurvey | null; onClose: () => void }) {
  if (!survey) return null;

  // Load form fields from cached template
  const [fields, setFields] = useState<Array<{ id: string; label: string; type?: string }>>([]);

  useEffect(() => {
    if (survey.formId) {
      try {
        const form = db.getFirstSync('SELECT fields FROM forms WHERE id = ?', [survey.formId]) as { fields: string } | null;
        if (form?.fields) {
          setFields(JSON.parse(form.fields));
        }
      } catch { /* ignore */ }
    }
  }, [survey.formId]);

  const data = (() => {
    try { return JSON.parse(survey.data ?? '{}') as Record<string, string>; }
    catch { return {}; }
  })();

  // Map field ID → label
  const fieldMap = new Map(fields.map(f => [f.id, f.label]));
  const entries = Object.entries(data);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-canvas-soft-2">
        {/* Header */}
        <View className="bg-primary pt-12 pb-4 px-4 flex-row items-center gap-3">
          <Pressable onPress={onClose} className="p-2 rounded-full bg-on-primary/10">
            <Text className="text-on-primary font-bold text-base">←</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-on-primary font-bold text-lg" numberOfLines={1}>
              {survey.respondentName || survey.formTitle || 'Survey Record'}
            </Text>
            {survey.locationText ? (
              <Text className="text-on-primary/70 text-xs">{survey.locationText}</Text>
            ) : null}
          </View>
        </View>

        <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Meta */}
          <View className="bg-canvas rounded-lg p-4 mb-4 border border-hairline shadow-card-soft">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs uppercase tracking-wider font-mono text-mute">Survey Info</Text>
            </View>
            <View className="gap-y-2">
              {survey.createdAt && (
                <View className="flex-row gap-2">
                  <Text className="text-xs text-mute w-24">Recorded</Text>
                  <Text className="text-xs text-ink flex-1">
                    {new Date(survey.createdAt).toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              {survey.formTitle && (
                <View className="flex-row gap-2">
                  <Text className="text-xs text-mute w-24">Template</Text>
                  <Text className="text-xs text-ink flex-1">{survey.formTitle}</Text>
                </View>
              )}
              <View className="flex-row gap-2">
                <Text className="text-xs text-mute w-24">Status</Text>
                <Text className="text-xs text-ink flex-1">{survey.syncStatus === 'synced' || survey.remoteId ? 'Uploaded' : survey.status ?? 'Draft'}</Text>
              </View>
              {survey.syncStatus === 'failed' && (
                <View className="flex-row gap-2">
                  <Text className="text-xs text-danger w-24">Error</Text>
                  <Text className="text-xs text-danger flex-1">{(survey as any).syncLastError ?? 'Upload failed'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Fields */}
          <View className="bg-canvas rounded-lg p-4 border border-hairline shadow-card-soft">
            <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-3">
              Recorded Answers ({entries.length} fields)
            </Text>
            {entries.length === 0 ? (
              <Text className="text-mute text-sm italic">No answers recorded yet.</Text>
            ) : (
              entries.map(([fieldId, value]) => {
                const label = fieldMap.get(fieldId) ?? fieldId;
                return (
                  <View key={fieldId} className="border-b border-hairline py-3 last:border-0">
                    <Text className="text-xs text-mute mb-1 font-medium">{label}</Text>
                    <Text className="text-sm text-ink">{value || '—'}</Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Forms() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useAppStore();
  const [activeTab, setActiveTab] = useState<'templates' | 'surveys'>('surveys');
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [surveys, setSurveys] = useState<SavedSurvey[]>([]);
  const [pending, setPending] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState('');
  const [viewingSurvey, setViewingSurvey] = useState<SavedSurvey | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = () => {
    try {
      const rows = db.getAllSync('SELECT * FROM forms ORDER BY updatedAt DESC') as FormTemplate[];
      setForms(rows);
    } catch { /* ignore */ }

    setSurveys(loadSavedSurveys());
    setPending(pendingUploadCount());
  };

  const handleUploadAll = async () => {
    if (isOffline) {
      setUploadFeedback('You are offline. Connect to upload surveys.');
      return;
    }
    setUploading(true);
    setUploadFeedback('Uploading pending surveys…');
    try {
      // Enqueue any saved surveys that haven't been queued yet
      for (const survey of surveys) {
        if (!survey.remoteId && survey.syncStatus !== 'synced') {
          const inQueue = db.getFirstSync(
            `SELECT id FROM sync_queue WHERE localId=? AND status NOT IN ('synced','failed')`,
            [survey.id]
          );
          if (!inQueue) {
            enqueueSurvey(survey.id);
          }
        }
      }
      await flush();
      loadData();
      const newPending = pendingUploadCount();
      if (newPending === 0) {
        setUploadFeedback('All surveys uploaded successfully!');
      } else {
        setUploadFeedback(`${newPending} survey(s) still pending — will retry automatically.`);
      }
    } catch (err) {
      setUploadFeedback('Upload failed. Will retry when connected.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadFeedback(''), 3500);
    }
  };

  const handleUploadSingle = async (survey: SavedSurvey) => {
    if (isOffline) {
      Alert.alert('Offline', 'Connect to the internet to upload this survey.');
      return;
    }
    setUploadFeedback('Uploading survey…');
    try {
      const inQueue = db.getFirstSync(
        `SELECT id FROM sync_queue WHERE localId=? AND status NOT IN ('synced','failed')`,
        [survey.id]
      );
      if (!inQueue) {
        enqueueSurvey(survey.id);
      }
      await flush();
      loadData();

      // Check actual result
      const result = db.getFirstSync(
        `SELECT status, lastError FROM sync_queue WHERE localId=? ORDER BY createdAt DESC LIMIT 1`,
        [survey.id]
      ) as { status: string; lastError: string | null } | null;

      if (result?.status === 'synced') {
        setUploadFeedback('Survey uploaded successfully!');
      } else if (result?.status === 'failed' || result?.status === 'retrying') {
        setUploadFeedback(`Upload failed: ${result.lastError ?? 'Unknown error'}. Check your connection.`);
      } else {
        setUploadFeedback('Upload queued. Check back shortly.');
      }
      setTimeout(() => setUploadFeedback(''), 5000);
    } catch (err: any) {
      setUploadFeedback(`Error: ${err?.message ?? 'Upload failed'}`);
      setTimeout(() => setUploadFeedback(''), 5000);
    }
  };

  return (
    <View className="flex-1 bg-canvas-soft-2">
      <SurveyDetailModal survey={viewingSurvey} onClose={() => setViewingSurvey(null)} />
      {/* Header */}
      <View className="px-4 pt-12 pb-3 bg-canvas border-b border-hairline">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-bold text-ink">Field Data</Text>
          <Pressable
            className="bg-primary rounded-pill flex-row items-center px-3 py-2 shadow-card-soft"
            onPress={() => router.push('/surveys/new' as any)}
          >
            <Plus size={15} color="white" />
            <Text className="text-on-primary ml-1 font-medium text-sm">New Survey</Text>
          </Pressable>
        </View>

        {/* Tab row */}
        <View className="flex-row gap-2">
          {(['surveys', 'templates'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-pill border ${activeTab === tab ? 'bg-primary border-primary' : 'bg-canvas border-hairline'}`}
            >
              <Text className={`text-sm font-medium ${activeTab === tab ? 'text-on-primary' : 'text-body'}`}>
                {tab === 'surveys' ? `Saved Surveys${surveys.length > 0 ? ` (${surveys.length})` : ''}` : 'Form Templates'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Upload feedback banner */}
      {uploadFeedback ? (
        <View className="bg-canvas border-b border-hairline px-4 py-2">
          <Text className="text-ink text-xs">{uploadFeedback}</Text>
        </View>
      ) : null}

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 80 }}>
        {activeTab === 'surveys' ? (
          <>
            {/* Upload all button */}
            {surveys.length > 0 && (
              <View className="mb-4 flex-row items-center justify-between bg-canvas rounded-lg px-4 py-3 border border-hairline shadow-card-soft">
                <View>
                  <Text className="text-sm font-medium text-ink">
                    {pending > 0 ? `${pending} pending upload` : 'All surveys saved locally'}
                  </Text>
                  <Text className="text-xs text-mute mt-0.5">
                    {isOffline ? 'Offline — connect to upload' : 'Connected — ready to upload'}
                  </Text>
                </View>
                <Pressable
                  className={`flex-row items-center gap-1.5 rounded-pill px-3 py-2 ${isOffline ? 'bg-canvas-soft-2 border border-hairline' : 'bg-primary'}`}
                  onPress={() => void handleUploadAll()}
                  disabled={uploading || isOffline}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Upload size={14} color={isOffline ? '#888888' : 'white'} />
                      <Text className={`text-xs font-medium ${isOffline ? 'text-mute' : 'text-on-primary'}`}>
                        Upload All
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {surveys.length === 0 ? (
              <View className="items-center justify-center p-10 border-2 border-dashed border-hairline rounded-lg mt-4">
                <FileText size={32} color="#888888" />
                <Text className="text-mute text-center mt-3 mb-1 font-medium">No saved surveys yet</Text>
                <Text className="text-xs text-body text-center">Tap "New Survey" to collect field data.</Text>
              </View>
            ) : (
              surveys.map((survey) => {
                const statusInfo = surveyStatusLabel(survey);
                const isUploaded = survey.remoteId != null || survey.syncStatus === 'synced';
                const fieldCount = (() => {
                  try { return Object.keys(JSON.parse(survey.data ?? '{}')).length; }
                  catch { return 0; }
                })();
                return (
                  <View key={survey.id} className="bg-canvas rounded-lg p-4 mb-3 border border-hairline shadow-card-soft">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="font-semibold text-ink" numberOfLines={1}>
                          {survey.respondentName || survey.formTitle || 'Unnamed Survey'}
                        </Text>
                        {survey.locationText ? (
                          <Text className="text-xs text-mute mt-0.5" numberOfLines={1}>{survey.locationText}</Text>
                        ) : null}
                      </View>
                      <View className={`px-2 py-0.5 rounded-md ${statusInfo.bg}`}>
                        <Text className={`text-[10px] font-medium ${statusInfo.color}`}>{statusInfo.label}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-3 mb-3">
                      <Text className="text-xs text-mute">
                        {fieldCount} field{fieldCount !== 1 ? 's' : ''} captured
                      </Text>
                      {survey.formTitle ? (
                        <Text className="text-xs text-mute">· {survey.formTitle}</Text>
                      ) : null}
                      {survey.createdAt ? (
                        <Text className="text-xs text-mute">
                          · {new Date(survey.createdAt).toLocaleDateString('en-IN')}
                        </Text>
                      ) : null}
                    </View>

                    <View className="flex-row gap-2 pt-3 border-t border-hairline flex-wrap">
                      {/* View recorded data with field labels */}
                      <Pressable
                        className="flex-row items-center justify-center gap-1 bg-canvas-soft border border-hairline rounded-pill py-2 px-3"
                        onPress={() => setViewingSurvey(survey)}
                      >
                        <FileText size={13} color="#171717" />
                        <Text className="text-xs font-medium text-ink">View</Text>
                      </Pressable>

                      {/* Continue filling — only for drafts */}
                      {!isUploaded && (
                        <Pressable
                          className="flex-1 flex-row items-center justify-center gap-1 bg-canvas-soft border border-hairline rounded-pill py-2"
                          onPress={() => router.push({ pathname: `/forms/${survey.formId}`, params: { surveyId: survey.id } } as any)}
                        >
                          <FileText size={13} color="#171717" />
                          <Text className="text-xs font-medium text-ink">Continue</Text>
                        </Pressable>
                      )}

                      {/* Upload button — disabled offline or if already uploaded */}
                      {!isUploaded && (
                        <Pressable
                          className={`flex-1 flex-row items-center justify-center gap-1 rounded-pill py-2 ${isOffline ? 'bg-canvas-soft-2 border border-hairline' : 'bg-primary'}`}
                          onPress={() => void handleUploadSingle(survey)}
                          disabled={isOffline}
                        >
                          <Upload size={13} color={isOffline ? '#888888' : 'white'} />
                          <Text className={`text-xs font-medium ${isOffline ? 'text-mute' : 'text-on-primary'}`}>
                            {isOffline ? 'Offline' : 'Upload'}
                          </Text>
                        </Pressable>
                      )}

                      {/* Delete button — only before upload */}
                      {!isUploaded && (
                        <Pressable
                          className="flex-row items-center justify-center gap-1 bg-error-soft border border-danger/20 rounded-pill py-2 px-3"
                          onPress={() => {
                            Alert.alert(
                              'Delete Survey',
                              'This will permanently delete this survey from your device. This cannot be undone.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => {
                                    try {
                                      db.runSync('DELETE FROM surveys WHERE id=?', [survey.id]);
                                      db.runSync('DELETE FROM sync_queue WHERE localId=?', [survey.id]);
                                      loadData();
                                    } catch (e) {
                                      Alert.alert('Error', 'Could not delete survey.');
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Text className="text-xs font-medium text-danger">Delete</Text>
                        </Pressable>
                      )}

                      {isUploaded && (
                        <View className="flex-1 flex-row items-center justify-center gap-1 bg-success/10 rounded-pill py-2">
                          <Text className="text-xs font-medium text-success">✓ Uploaded to Server</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* Templates tab */
          <>
            <View className="flex-row justify-end mb-3">
              <Pressable
                className="bg-canvas border border-hairline rounded-pill flex-row items-center px-3 py-2 shadow-card-soft"
                onPress={() => router.push('/forms/builder' as any)}
              >
                <Plus size={15} color="#171717" />
                <Text className="text-ink ml-1 font-medium text-sm">Form Builder</Text>
              </Pressable>
            </View>

            {forms.length === 0 ? (
              <View className="items-center justify-center p-10 border-2 border-dashed border-hairline rounded-lg mt-4">
                <Text className="text-mute text-center mb-2">No templates cached yet.</Text>
                <Text className="text-xs text-body text-center">
                  Connect to the internet and open the New Survey screen to cache templates for offline use.
                </Text>
              </View>
            ) : (
              forms.map((item) => (
                <Pressable
                  key={item.id}
                  className="bg-canvas rounded-lg p-4 shadow-card-soft mb-3 border border-hairline"
                  onPress={() => router.push(`/forms/${item.id}` as any)}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-2">
                      <Text className="font-bold text-ink text-base">{item.title}</Text>
                      {item.description ? (
                        <Text className="text-body text-sm mt-1" numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View className={`px-2 py-0.5 rounded-md ${item.status === 'active' || item.status === 'Active' ? 'bg-success/10' : 'bg-warning/10'}`}>
                      <Text className={`text-[10px] font-medium ${item.status === 'active' || item.status === 'Active' ? 'text-success' : 'text-warning-deep'}`}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-hairline">
                    <Text className="text-mute text-xs">ID: {item.id.slice(0, 8)}…</Text>
                    <Text className="text-mute text-xs">
                      {item.synced ? '✓ Cached' : '⚠ Not synced'}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        {/* Refresh button */}
        <Pressable
          className="flex-row items-center justify-center gap-2 mt-2 py-3"
          onPress={loadData}
        >
          <RefreshCw size={14} color="#888888" />
          <Text className="text-mute text-xs">Refresh</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
