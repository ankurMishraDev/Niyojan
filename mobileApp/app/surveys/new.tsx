import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsApi, surveysApi, documentsApi, pipelineApi } from '../../src/lib/services';
import { useAppStore } from '../../src/store/appStore';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../src/lib/api';
import CustomDropdown from '../../src/components/CustomDropdown';
import { DynamicLoader } from '../../src/components/DynamicLoader';
import { db } from '../../src/db/schema';

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

  const [templateId, setTemplateId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [respondentName, setRespondentName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [extractionStage, setExtractionStage] = useState("");
  const [creationFeedback, setCreationFeedback] = useState("");

  // ── Offline: load cached templates from SQLite ──────────────────────────────
  const [cachedTemplates, setCachedTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (isOffline) {
      const rows = db.getAllSync('SELECT id, title FROM forms WHERE status = ?', ['active']) as any[];
      setCachedTemplates(rows);
      if (rows.length > 0 && !templateId) {
        setTemplateId(rows[0].id);
      }
    }
  }, [isOffline]);

  const templatesQuery = useQuery({
    queryKey: ["survey-templates"],
    queryFn: () => formsApi.listTemplates({ page: 1, pageSize: 25, status: "active" }),
    enabled: !isOffline,
  });

  useEffect(() => {
    if (!templateId && templatesQuery.data?.items?.[0]) {
      setTemplateId(templatesQuery.data.items[0].id);
    }
  }, [templateId, templatesQuery.data]);

  const versionsQuery = useQuery({
    enabled: Boolean(templateId) && !isOffline,
    queryKey: ["survey-template-versions", templateId],
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

  const createSurveyMutation = useMutation({
    mutationFn: (payload: any) => surveysApi.create(payload),
    onSuccess: (survey) => {
      router.push(`/surveys/${survey.id}`);
    },
  });

  const handleSubmit = () => {
    createSurveyMutation.mutate({
      template_version_id: versionId,
      respondent_name: respondentName,
      location_text: locationText,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      submitted_language: targetLanguage || "en",
    });
  };

  const createFromFilledFormMutation = useMutation({
    mutationFn: async (result: DocumentPicker.DocumentPickerResult) => {
      if (result.canceled || !result.assets.length) return;
      const fileAsset = result.assets[0];

      setExtractionStage("Processing");
      setCreationFeedback("Creating survey draft...");
      const survey = await surveysApi.create({
        template_version_id: versionId,
        submitted_language: targetLanguage || 'en',
      });

      setCreationFeedback("Requesting upload URL...");
      const signed = await documentsApi.uploadUrl({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || "application/pdf",
      });

      setCreationFeedback("Uploading document...");
      const fileResponse = await fetch(fileAsset.uri);
      const blob = await fileResponse.blob();
      await api.uploadToSignedUrl(signed.uploadUrl, blob, signed.requiredHeaders);

      setCreationFeedback("Creating document record...");
      const doc = await documentsApi.create({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || "application/pdf",
        gcs_path: signed.gcsPath,
        source_survey_id: survey.id,
      });

      setExtractionStage("Extracting");
      setCreationFeedback("Triggering AI extraction...");
      await documentsApi.extract(doc.id, targetLanguage);

      setCreationFeedback("Waiting for extraction (this may take a minute)...");
      let currentDoc = doc;
      while (currentDoc.status === "processing" || currentDoc.status === "uploaded") {
        await new Promise((res) => setTimeout(res, 3000));
        currentDoc = await documentsApi.get(doc.id);
        try {
          const pipeStatus = await pipelineApi.status(doc.id);
          if (pipeStatus && pipeStatus.manifest && pipeStatus.manifest.currentStage) {
            setExtractionStage(pipeStatus.manifest.currentStage);
          }
        } catch (e) {
          // ignore
        }
      }

      if (currentDoc.status === "failed") {
        throw new Error("Document extraction failed");
      }

      setExtractionStage("Finalizing");
      return {
        survey,
        extractionResult: currentDoc.extractionResult || currentDoc.extraction_result_json,
        fileName: fileAsset.name,
      };
    },
    onSuccess: (data) => {
      if (!data) return;
      setExtractionStage("");
      router.push({
        pathname: `/surveys/${data.survey.id}`,
        params: {
          prefillExtraction: JSON.stringify(data.extractionResult),
          prefillDocumentName: data.fileName,
        }
      } as any);
    },
    onError: (error: any) => {
      setCreationFeedback(error.message || "Failed to create from document");
    },
  });

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (!result.canceled) {
        createFromFilledFormMutation.mutate(result);
      }
    } catch (e) {
      console.log('Document picker err', e);
    }
  };

  if (isOffline) {
    const handleOfflineDraft = () => {
      if (!templateId) {
        setCreationFeedback("Select a cached template first.");
        return;
      }
      const surveyId = Date.now().toString();
      const now = new Date().toISOString();
      try {
        db.runSync(
          `INSERT OR REPLACE INTO surveys
             (id, formId, volunteerId, respondentName, locationText,
              latitude, longitude, data, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 'draft', ?, ?)`,
          [
            surveyId,
            templateId,
            '',
            respondentName || null,
            locationText || null,
            latitude ? Number(latitude) : null,
            longitude ? Number(longitude) : null,
            now,
            now,
          ]
        );
        // Navigate to the form fill screen, passing the pre-created local survey ID
        router.push({ pathname: `/forms/${templateId}`, params: { surveyId } } as any);
      } catch (err) {
        console.error('[OFFLINE DRAFT] Insert failed:', err);
        setCreationFeedback('Failed to create draft. Please try again.');
      }
    };

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 bg-canvas-soft-2 p-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
            <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">Offline Mode</Text>
            <Text className="text-2xl font-bold text-ink">{t('NGO_SurveyPages_Header')}</Text>
            <Text className="text-warning-deep mt-2 text-sm">
              You are offline. AI scan is unavailable. Select a cached template and create a draft — it will sync automatically when you reconnect.
            </Text>
          </View>

          {creationFeedback ? (
            <View className="bg-canvas-soft border border-hairline p-3 rounded-md mb-4">
              <Text className="text-ink text-sm font-medium">{creationFeedback}</Text>
            </View>
          ) : null}

          <View className="bg-canvas rounded-lg p-5 shadow-card-soft border border-hairline mb-6">
            <Text className="text-lg font-bold text-ink mb-3">Cached Templates</Text>
            {cachedTemplates.length === 0 ? (
              <Text className="text-mute text-sm">No cached templates available. Connect to the internet and open this screen once to cache templates.</Text>
            ) : (
              <View className="mb-3">
                <CustomDropdown
                  items={cachedTemplates.map((t: any) => ({ label: t.title, value: t.id }))}
                  selectedValue={templateId}
                  onValueChange={(v) => setTemplateId(v)}
                  placeholder="Select Cached Template"
                />
              </View>
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
              className={`bg-primary rounded-pill py-3 items-center shadow-card-soft mt-2 ${cachedTemplates.length === 0 ? 'opacity-50' : ''}`}
              onPress={handleOfflineDraft}
              disabled={cachedTemplates.length === 0}
            >
              <Text className="text-on-primary font-medium">Create Draft (Offline)</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* DynamicLoader overlay — rendered on top while AI extraction runs.
          Kept here (not as a screen replacement) so expo-router context stays
          mounted and router.push() in onSuccess works correctly. */}
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
        <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">{t('NGO_SurveyPages_Header_CreateSurvey')}</Text>
        <Text className="text-2xl font-bold text-ink">{t('NGO_SurveyPages_Header')}</Text>
        <Text className="text-mute mt-2">{t('NGO_SurveyPages_Header_Description')}</Text>
      </View>

      {creationFeedback ? (
        <View className="bg-canvas-soft border border-hairline p-3 rounded-md mb-4">
          <Text className="text-ink text-sm font-medium">{creationFeedback}</Text>
          {createFromFilledFormMutation.isPending && (
             <Text className="text-ink text-xs mt-1">Stage: {extractionStage}</Text>
          )}
        </View>
      ) : null}

      <View className="bg-canvas rounded-lg p-5 shadow-card-soft border border-hairline mb-6">
        <Text className="text-lg font-bold text-ink mb-3">{t('NGO_Mobile_Forms_FormExtraction')}</Text>
        <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Language')}</Text>
        <View className="mb-3">
           <CustomDropdown
             items={LANGUAGES}
             selectedValue={targetLanguage}
             onValueChange={(itemValue) => setTargetLanguage(itemValue)}
           />
        </View>
        
        <Pressable 
          className={`bg-ink border border-hairline rounded-pill py-3 items-center shadow-card-soft mt-2 mb-4 ${createFromFilledFormMutation.isPending ? 'opacity-70' : ''}`}
          onPress={handleDocumentPick}
          disabled={createFromFilledFormMutation.isPending}
        >
          {createFromFilledFormMutation.isPending ? (
             <ActivityIndicator size="small" color="#171717" />
          ) : (
            <Text className=" text-white  font-medium">{t('NGO_SurveyPages_Button_ScanDocument')}</Text>
          )}
        </Pressable>

        <View className="border-t border-hairline my-4" />

        <Text className="text-lg font-bold text-ink mb-3">{t('NGO_SurveyPages_Header_BlankDraft')}</Text>
        <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Template')}</Text>
        <View className="mb-3">
           <CustomDropdown
             items={(templatesQuery.data?.items || []).map((t:any) => ({ label: t.name, value: t.id }))}
             selectedValue={templateId}
             onValueChange={(itemValue) => setTemplateId(itemValue)}
             placeholder="Select Template"
           />
        </View>

        <Text className="text-sm font-medium text-ink mb-1">{t('NGO_SurveyPages_Header_Version')}</Text>
        <View className="mb-3">
           <CustomDropdown
             items={(versionsQuery.data || []).map((v:any) => ({ label: `Version ${v.versionNo}`, value: v.id }))}
             selectedValue={versionId}
             onValueChange={(itemValue) => setVersionId(itemValue)}
             placeholder="Select Version"
           />
        </View>

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
          className="bg-primary rounded-pill py-3 items-center shadow-card-soft mt-2"
          onPress={handleSubmit}
          disabled={createSurveyMutation.isPending}
        >
          {createSurveyMutation.isPending ? (
             <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-on-primary font-medium">{t('NGO_Mobile_Forms_CreateDraft')}</Text>
          )}
        </Pressable>
      </View>
      <View className="h-10" />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
