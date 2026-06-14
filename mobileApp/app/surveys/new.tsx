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

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'mr', label: 'Marathi' },
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
    return (
      <View className="flex-1 items-center justify-center p-4 bg-canvas-soft-2">
        <Text className="text-warning-deep text-center">Data collection initialization requires internet to fetch templates.</Text>
        <Pressable className="mt-4 bg-primary px-4 py-2 rounded" onPress={() => router.back()}>
          <Text className="text-on-primary">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView className="flex-1 bg-canvas-soft-2 p-4">
        <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">Create Survey</Text>
        <Text className="text-2xl font-bold text-ink">New Draft</Text>
        <Text className="text-mute mt-2">Create a blank draft to manually enter survey responses or scan a filled form using AI.</Text>
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
        <Text className="text-lg font-bold text-ink mb-3">AI Form Extraction</Text>
        <Text className="text-sm font-medium text-ink mb-1">Target Language</Text>
        <View className="mb-3">
           <CustomDropdown
             items={LANGUAGES}
             selectedValue={targetLanguage}
             onValueChange={(itemValue) => setTargetLanguage(itemValue)}
           />
        </View>
        
        <Pressable 
          className={`bg-canvas-soft-2 border border-hairline rounded-pill py-3 items-center shadow-card-soft mt-2 mb-4 ${createFromFilledFormMutation.isPending ? 'opacity-70' : ''}`}
          onPress={handleDocumentPick}
          disabled={createFromFilledFormMutation.isPending}
        >
          {createFromFilledFormMutation.isPending ? (
             <ActivityIndicator size="small" color="#171717" />
          ) : (
            <Text className="text-ink font-medium">Create From Filled Form (Scan)</Text>
          )}
        </Pressable>

        <View className="border-t border-hairline my-4" />

        <Text className="text-lg font-bold text-ink mb-3">Blank Draft</Text>
        <Text className="text-sm font-medium text-ink mb-1">Template</Text>
        <View className="mb-3">
           <CustomDropdown
             items={(templatesQuery.data?.items || []).map((t:any) => ({ label: t.name, value: t.id }))}
             selectedValue={templateId}
             onValueChange={(itemValue) => setTemplateId(itemValue)}
             placeholder="Select Template"
           />
        </View>

        <Text className="text-sm font-medium text-ink mb-1">Version</Text>
        <View className="mb-3">
           <CustomDropdown
             items={(versionsQuery.data || []).map((v:any) => ({ label: `Version ${v.versionNo}`, value: v.id }))}
             selectedValue={versionId}
             onValueChange={(itemValue) => setVersionId(itemValue)}
             placeholder="Select Version"
           />
        </View>

        <View className="border-t border-hairline my-4" />

        <Text className="text-sm font-medium text-ink mb-1">Respondent Name</Text>
        <TextInput 
          className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
          placeholder="John Doe / Camp A"
          value={respondentName}
          onChangeText={setRespondentName}
        />

        <Text className="text-sm font-medium text-ink mb-1">Location</Text>
        <TextInput 
          className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
          placeholder="Village, District"
          value={locationText}
          onChangeText={setLocationText}
        />

        <Text className="text-sm font-medium text-ink mb-1">Latitude</Text>
        <TextInput 
          className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 mb-4"
          placeholder="e.g. 12.3456"
          keyboardType="numeric"
          value={latitude}
          onChangeText={setLatitude}
        />

        <Text className="text-sm font-medium text-ink mb-1">Longitude</Text>
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
            <Text className="text-on-primary font-medium">Create Blank Draft</Text>
          )}
        </Pressable>
      </View>
      <View className="h-10" />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
