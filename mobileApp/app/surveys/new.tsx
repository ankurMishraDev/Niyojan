/**
 * New Survey screen — UNIFIED offline-first flow.
 *
 * Whether online or offline, the survey is ALWAYS saved to SQLite first.
 * The user then fills out the form in /forms/[templateId], and uploads
 * from there (or from the Saved Surveys tab) when they have internet.
 *
 * The AI document scan (online-only) still creates a remote survey first
 * and navigates to the survey detail screen for prefill.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsApi, documentsApi, pipelineApi } from '../../src/lib/services';
import { useAppStore } from '../../src/store/appStore';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../src/lib/api';
import { surveysApi } from '../../src/lib/services';
import CustomDropdown from '../../src/components/CustomDropdown';
import { DynamicLoader } from '../../src/components/DynamicLoader';
import { db } from '../../src/db/schema';

// ── UUID without external deps ────────────────────────────────────────────────
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'ur', label: 'اُردُو (Urdu)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'ml', label: 'മലയാളം (Malayalam)' },
  { value: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { value: 'as', label: 'অসমীয়া (Assamese)' },
  { value: 'mai', label: 'मैथिली (Maithili)' },
  { value: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)' },
  { value: 'ks', label: 'कॉशुर (Kashmiri)' },
];

export default function SurveyNew() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useAppStore();

  const [templateId, setTemplateId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [respondentName, setRespondentName] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [extractionStage, setExtractionStage] = useState('');
  const [creationFeedback, setCreationFeedback] = useState('');

  // Load cached templates regardless of online/offline state
  const [cachedTemplates, setCachedTemplates] = useState<any[]>([]);
  useEffect(() => {
    const rows = db.getAllSync('SELECT id, title, templateVersionId FROM forms WHERE status = ? OR status = ?', ['active', 'Active']) as any[];
    setCachedTemplates(rows);
    if (rows.length > 0 && !templateId) {
      setTemplateId(rows[0].id);
      if (rows[0].templateVersionId) setVersionId(rows[0].templateVersionId);
    }
  }, []);

  const templatesQuery = useQuery({
    queryKey: ['survey-templates'],
    queryFn: () => formsApi.listTemplates({ page: 1, pageSize: 25, status: 'active' }),
    enabled: !isOffline,
  });

  useEffect(() => {
    if (!templateId && templatesQuery.data?.items?.[0]) {
      setTemplateId(templatesQuery.data.items[0].id);
    }
  }, [templateId, templatesQuery.data]);

  const versionsQuery = useQuery({
    enabled: Boolean(templateId) && !isOffline,
    queryKey: ['survey-template-versions', templateId],
    queryFn: () => formsApi.listVersions(templateId),
  });

  useEffect(() => {
    const published = versionsQuery.data?.find((v: any) => v.isPublished);
    if (!versionId && published) {
      setVersionId(published.id);
    } else if (!versionId && versionsQuery.data?.[0]) {
      setVersionId(versionsQuery.data[0].id);
    }
  }, [versionId, versionsQuery.data]);

  // ── Unified: always create a local draft first, then navigate to form fill ──
  const handleCreateDraft = () => {
    if (!templateId) {
      setCreationFeedback('Select a template first.');
      return;
    }
    const surveyId = uuid();
    const now = new Date().toISOString();
    try {
      // Resolve version ID — prefer loaded version, fall back to cached
      const resolvedVersionId =
        versionId ||
        cachedTemplates.find((t: any) => t.id === templateId)?.templateVersionId ||
        null;

      db.runSync(
        `INSERT OR REPLACE INTO surveys
           (id, formId, templateVersionId, volunteerId, respondentName, locationText,
            latitude, longitude, data, submittedLanguage, status, createdAt, updatedAt)
         VALUES (?, ?, ?, '', ?, ?, ?, ?, '{}', ?, 'draft', ?, ?)`,
        [
          surveyId,
          templateId,
          resolvedVersionId,
          respondentName || null,
          locationText || null,
          latitude ? Number(latitude) : null,
          longitude ? Number(longitude) : null,
          targetLanguage || 'en',
          now,
          now,
        ]
      );
      // Navigate to form fill screen, passing the pre-created local survey ID
      router.push({ pathname: `/forms/${templateId}`, params: { surveyId } } as any);
    } catch (err) {
      console.error('[CREATE DRAFT] Insert failed:', err);
      setCreationFeedback('Failed to create draft. Please try again.');
    }
  };

  // ── AI document scan (online-only) ──────────────────────────────────────────
  const createFromFilledFormMutation = useMutation({
    mutationFn: async (result: DocumentPicker.DocumentPickerResult) => {
      if (result.canceled || !result.assets.length) return;
      const fileAsset = result.assets[0];

      setExtractionStage('Processing');
      setCreationFeedback('Creating survey draft on server…');
      const survey = await surveysApi.create({
        template_version_id: versionId,
        submitted_language: targetLanguage || 'en',
      });

      setCreationFeedback('Requesting upload URL…');
      const signed = await documentsApi.uploadUrl({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || 'application/pdf',
      });

      setCreationFeedback('Uploading document…');
      const fileResponse = await fetch(fileAsset.uri);
      const blob = await fileResponse.blob();
      await api.uploadToSignedUrl(signed.uploadUrl, blob, signed.requiredHeaders);

      setCreationFeedback('Creating document record…');
      const doc = await documentsApi.create({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || 'application/pdf',
        gcs_path: signed.gcsPath,
        source_survey_id: survey.id,
      });

      setExtractionStage('Extracting');
      setCreationFeedback('Triggering AI extraction…');
      await documentsApi.extract(doc.id, targetLanguage);

      setCreationFeedback('Waiting for extraction (this may take a minute)…');
      let currentDoc = doc;
      while (currentDoc.status === 'processing' || currentDoc.status === 'uploaded') {
        await new Promise((res) => setTimeout(res, 3000));
        currentDoc = await documentsApi.get(doc.id);
        try {
          const pipeStatus = await pipelineApi.status(doc.id);
          if (pipeStatus?.manifest?.currentStage) setExtractionStage(pipeStatus.manifest.currentStage);
        } catch { /* ignore */ }
      }

      if (currentDoc.status === 'failed') throw new Error('Document extraction failed');
      setExtractionStage('Finalizing');
      return {
        survey,
        extractionResult: currentDoc.extractionResult || currentDoc.extraction_result_json,
        fileName: fileAsset.name,
      };
    },
    onSuccess: (data) => {
      if (!data) return;
      setExtractionStage('');
      router.push({
        pathname: `/surveys/${data.survey.id}`,
        params: {
          prefillExtraction: JSON.stringify(data.extractionResult),
          prefillDocumentName: data.fileName,
        },
      } as any);
    },
    onError: (error: any) => {
      setCreationFeedback(error.message || 'Failed to create from document');
    },
  });

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (!result.canceled) createFromFilledFormMutation.mutate(result);
    } catch (e) {
      console.log('Document picker err', e);
    }
  };

  // Templates to show in dropdown — prefer live API, fall back to cache
  const templateOptions = !isOffline && templatesQuery.data?.items?.length
    ? templatesQuery.data.items.map((t: any) => ({ label: t.name, value: t.id }))
    : cachedTemplates.map((t: any) => ({ label: t.title, value: t.id }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {createFromFilledFormMutation.isPending && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <DynamicLoader
            currentStage={extractionStage}
            stages={['Processing', 'Extracting', 'Finalizing']}
            label="Creating Survey from Document..."
          />
        </View>
      )}

      <ScrollView
        className="flex-1 bg-canvas-soft-2 p-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Header */}
        <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
          <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">
            {isOffline ? 'Offline Mode' : t('NGO_SurveyPages_Header_CreateSurvey')}
          </Text>
          <Text className="text-2xl font-bold text-ink">{t('NGO_SurveyPages_Header')}</Text>
          <Text className="text-mute mt-2 text-sm">
            {isOffline
              ? 'You are offline. The draft will be saved to your device and uploaded when you reconnect.'
              : t('NGO_SurveyPages_Header_Description')}
          </Text>
        </View>

        {creationFeedback ? (
          <View className="bg-canvas-soft border border-hairline p-3 rounded-md mb-4">
            <Text className="text-ink text-sm font-medium">{creationFeedback}</Text>
            {createFromFilledFormMutation.isPending && (
              <Text className="text-ink text-xs mt-1">Stage: {extractionStage}</Text>
            )}
          </View>
        ) : null}

        {/* ── AI Document Scan (online only) ── */}
        {!isOffline && (
          <View className="bg-canvas rounded-lg p-5 shadow-card-soft border border-hairline mb-6">
            <Text className="text-lg font-bold text-ink mb-3">{t('NGO_Mobile_Forms_FormExtraction')}</Text>
            <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Language')}</Text>
            <View className="mb-3">
              <CustomDropdown
                items={LANGUAGES}
                selectedValue={targetLanguage}
                onValueChange={(v) => setTargetLanguage(v)}
              />
            </View>
            <Pressable
              className={`bg-ink border border-hairline rounded-pill py-3 items-center shadow-card-soft mt-2 mb-2 ${createFromFilledFormMutation.isPending ? 'opacity-70' : ''}`}
              onPress={handleDocumentPick}
              disabled={createFromFilledFormMutation.isPending || !versionId}
            >
              {createFromFilledFormMutation.isPending ? (
                <ActivityIndicator size="small" color="#171717" />
              ) : (
                <Text className="text-white font-medium">{t('NGO_SurveyPages_Button_ScanDocument')}</Text>
              )}
            </Pressable>
            <Text className="text-xs text-mute text-center">
              Requires an active internet connection
            </Text>
          </View>
        )}

        {/* ── Manual Draft (works online AND offline) ── */}
        <View className="bg-canvas rounded-lg p-5 shadow-card-soft border border-hairline mb-6">
          <Text className="text-lg font-bold text-ink mb-3">{t('NGO_SurveyPages_Header_BlankDraft')}</Text>

          <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Template')}</Text>
          <View className="mb-3">
            <CustomDropdown
              items={templateOptions}
              selectedValue={templateId}
              onValueChange={(v) => {
                setTemplateId(v);
                setVersionId('');
                // auto-pick version from cache
                const cached = cachedTemplates.find((t: any) => t.id === v);
                if (cached?.templateVersionId) setVersionId(cached.templateVersionId);
              }}
              placeholder="Select Template"
            />
          </View>

          {!isOffline && versionsQuery.data && versionsQuery.data.length > 0 && (
            <>
              <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Version')}</Text>
              <View className="mb-3">
                <CustomDropdown
                  items={versionsQuery.data.map((v: any) => ({ label: `Version ${v.versionNo}${v.isPublished ? ' (published)' : ''}`, value: v.id }))}
                  selectedValue={versionId}
                  onValueChange={(v) => setVersionId(v)}
                  placeholder="Select Version"
                />
              </View>
            </>
          )}

          <View className="border-t border-hairline my-4" />

          <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Form_Respondent')}</Text>
          <TextInput
            className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
            placeholder="John Doe / Camp A"
            value={respondentName}
            onChangeText={setRespondentName}
          />

          <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Form_Location')}</Text>
          <TextInput
            className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
            placeholder="Village, District"
            value={locationText}
            onChangeText={setLocationText}
          />

          <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Form_Latitude')}</Text>
          <TextInput
            className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
            placeholder="e.g. 12.3456"
            keyboardType="numeric"
            value={latitude}
            onChangeText={setLatitude}
          />

          <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Form_Longitude')}</Text>
          <TextInput
            className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
            placeholder="e.g. 78.9101"
            keyboardType="numeric"
            value={longitude}
            onChangeText={setLongitude}
          />

          <Pressable
            className={`bg-primary rounded-pill py-3 items-center shadow-card-soft mt-2 ${templateOptions.length === 0 ? 'opacity-50' : ''}`}
            onPress={handleCreateDraft}
            disabled={templateOptions.length === 0}
          >
            <Text className="text-on-primary font-medium">
              {isOffline ? 'Create Draft (Offline)' : t('NGO_Mobile_Forms_CreateDraft')}
            </Text>
          </Pressable>

          {isOffline && (
            <Text className="text-xs text-mute text-center mt-2">
              Draft saves to device · Upload from Saved Surveys when online
            </Text>
          )}
        </View>

        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
