import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsApi, fieldCatalogApi, documentsApi, pipelineApi } from '../../src/lib/services';
import { useAppStore } from '../../src/store/appStore';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../src/lib/api';
import CustomDropdown from '../../src/components/CustomDropdown';
import { Trash2, Edit2 } from 'lucide-react-native';
import { DynamicLoader } from '../../src/components/DynamicLoader';

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

export default function FormBuilder() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useAppStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [extractionStage, setExtractionStage] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");

  const [showNewTemplateInput, setShowNewTemplateInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["form-templates"],
    queryFn: () => formsApi.listTemplates({ page: 1, pageSize: 25 }),
    enabled: !isOffline,
  });

  useEffect(() => {
    if (!selectedTemplateId && templatesQuery.data?.items?.[0]) {
      setSelectedTemplateId(templatesQuery.data.items[0].id);
    }
  }, [selectedTemplateId, templatesQuery.data]);

  const versionsQuery = useQuery({
    enabled: Boolean(selectedTemplateId) && !isOffline,
    queryKey: ["form-template-versions", selectedTemplateId],
    queryFn: () => formsApi.listVersions(selectedTemplateId),
  });

  useEffect(() => {
    if (!selectedVersionId && versionsQuery.data?.[0]) {
      setSelectedVersionId(versionsQuery.data[0].id);
    }
  }, [selectedVersionId, versionsQuery.data]);

  const versionQuery = useQuery({
    enabled: Boolean(selectedVersionId) && !isOffline,
    queryKey: ["form-template-version", selectedVersionId],
    queryFn: () => formsApi.getVersion(selectedVersionId),
  });

  const catalogQuery = useQuery({
    queryKey: ["field-catalog", catalogSearch],
    queryFn: () => fieldCatalogApi.list({ page: 1, pageSize: 50, search: catalogSearch || undefined }),
    enabled: !isOffline,
  });

  const refreshAll = async () => {
    await Promise.all([
      templatesQuery.refetch(),
      versionsQuery.refetch(),
      versionQuery.refetch(),
    ]);
  };

  const createVersionMutation = useMutation({
    mutationFn: () => formsApi.createVersion(selectedTemplateId, {}),
    onSuccess: async (version) => {
      setSelectedVersionId(version.id);
      setFeedback("New template version created.");
      await refreshAll();
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => formsApi.deleteTemplate(id),
    onSuccess: async () => {
      setFeedback("Template deleted.");
      if (selectedTemplateId === deleteTemplateMutation.variables) {
        setSelectedTemplateId("");
        setSelectedVersionId("");
      }
      await refreshAll();
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => formsApi.updateTemplate(id, { name }),
    onSuccess: async () => {
      setFeedback("Template renamed.");
      setEditingTemplateId(null);
      await refreshAll();
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (id: string) => formsApi.deleteVersion(id),
    onSuccess: async () => {
      setFeedback("Version deleted.");
      if (selectedVersionId === deleteVersionMutation.variables) {
        setSelectedVersionId("");
      }
      await refreshAll();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (name: string) => formsApi.createTemplate({ name }),
    onSuccess: async (template) => {
      setSelectedTemplateId(template.id);
      setSelectedVersionId("");
      setFeedback("New custom template created.");
      await refreshAll();
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: () =>
      formsApi.addField(selectedVersionId, {
        field_catalog_id: selectedCatalogId || undefined,
        label: selectedCatalogId ? undefined : newFieldLabel,
        input_type: selectedCatalogId ? undefined : newFieldType,
      }),
    onSuccess: async () => {
      setFeedback("Field added to version.");
      setNewFieldLabel("");
      await versionQuery.refetch();
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => formsApi.publishVersion(selectedVersionId),
    onSuccess: async () => {
      setFeedback("Version published.");
      await refreshAll();
    },
  });

  const scanDocumentMutation = useMutation({
    mutationFn: async (result: DocumentPicker.DocumentPickerResult) => {
      if (result.canceled || !result.assets.length) return;
      const fileAsset = result.assets[0];
      setExtractionStage("Processing");
      setFeedback("Requesting upload URL...");
      
      const signed = await documentsApi.uploadUrl({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || "application/pdf",
      });

      setFeedback("Uploading document...");
      // For mobile upload, we fetch the blob first
      const fileResponse = await fetch(fileAsset.uri);
      const blob = await fileResponse.blob();
      await api.uploadToSignedUrl(signed.uploadUrl, blob, signed.requiredHeaders);

      setFeedback("Creating document record...");
      const doc = await documentsApi.create({
        file_name: fileAsset.name,
        file_type: fileAsset.mimeType || "application/pdf",
        gcs_path: signed.gcsPath,
      });

      setExtractionStage("Extracting");
      setFeedback("Triggering AI extraction...");
      await documentsApi.extract(doc.id, targetLanguage);

      setFeedback("Waiting for extraction to complete (this may take a minute)...");
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
      setFeedback("Generating form template...");
      const newTemplate = await formsApi.createFromDocument(doc.id, {
        name: fileAsset.name.replace(/\.[^/.]+$/, "") + " Template",
      });
      return newTemplate;
    },
    onSuccess: async (result) => {
      if (!result) return;
      setExtractionStage("");
      setFeedback("Form template successfully created from AI extraction!");
      setSelectedTemplateId(result.template.id);
      setSelectedVersionId(result.version.id);
      await refreshAll();
    },
    onError: (err: Error) => {
      setFeedback(`Error mapping AI template: ${err?.message || "Unknown error"}`);
    },
  });

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (!result.canceled) {
        scanDocumentMutation.mutate(result);
      }
    } catch (e) {
      console.log('Document picker err', e);
    }
  };

  if (isOffline) {
    return (
      <View className="flex-1 items-center justify-center p-4 bg-canvas-soft-2">
        <Text className="text-warning-deep text-center">Form Builder is unavailable offline.</Text>
        <Pressable className="mt-4 bg-primary px-4 py-2 rounded" onPress={() => router.back()}>
          <Text className="text-on-primary">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const selectedVersion = versionQuery.data;
  const orderedFields = [...(selectedVersion?.fields ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* DynamicLoader overlay — rendered on top while AI template creation runs.
          Kept here (not as a screen replacement) so the expo-router context stays
          mounted and any navigation calls work correctly. */}
      {scanDocumentMutation.isPending && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <DynamicLoader
            currentStage={extractionStage}
            stages={['Processing', 'Extracting', 'Finalizing']}
            label="Creating Form Template..."
          />
        </View>
      )}
      <ScrollView 
        className="flex-1 bg-canvas-soft-2 p-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-4 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">{t("NGO_FormBuilder_Button_FormBuilder")}</Text>
        <Text className="text-2xl font-bold text-ink">{t("NGO_FormBuilder_Header_CreateForm")}</Text>
        <Text className="text-mute mt-2">{t("NGO_FormBuilder_Header_Description")}</Text>
      </View>

      {feedback ? (
        <View className="bg-success/10 border border-success/30 p-3 rounded-md mb-4">
          <Text className="text-success text-sm font-medium">{feedback}</Text>
        </View>
      ) : null}

      <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline">
        <Text className="text-lg font-bold text-ink mb-3">{t("NGO_Mobile_Forms_CreateForm")}</Text>
        <Text className="text-sm font-medium text-ink mb-1">{t("NGO_FormBuilder_Label_TargetLanguage")}</Text>
        <View className="mb-3">
           <CustomDropdown
             items={LANGUAGES}
             selectedValue={targetLanguage}
             onValueChange={(itemValue) => setTargetLanguage(itemValue)}
           />
        </View>
        <Pressable 
          className={`bg-ink py-3 rounded items-center ${scanDocumentMutation.isPending ? 'opacity-70' : ''}`}
          onPress={handleDocumentPick}
          disabled={scanDocumentMutation.isPending}
        >
          {scanDocumentMutation.isPending ? (
            <Text className="text-on-primary font-medium">{extractionStage || "Processing..."}</Text>
          ) : (
            <Text className="text-on-primary font-medium">{t("NGO_FormBuilder_Button_ScanDocument")}</Text>
          )}
        </Pressable>
      </View>

      <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline">
        <Text className="text-lg font-bold text-ink mb-3">{t("NGO_FormBuilder_Label_TemplateName")}</Text>
        
        <View className="flex-row gap-2 mb-4">
          <Pressable 
            className="flex-1 bg-canvas-soft border border-hairline py-2 rounded items-center"
            onPress={() => setShowNewTemplateInput(!showNewTemplateInput)}
          >
            <Text className="text-sm font-medium">{t("NGO_FormBuilder_Button_Template")}</Text>
          </Pressable>
          <Pressable 
            className="flex-1 bg-canvas-soft border border-hairline py-2 rounded items-center"
            onPress={() => selectedTemplateId && createVersionMutation.mutate()}
            disabled={!selectedTemplateId}
          >
            <Text className="text-sm font-medium">{t("NGO_FormBuilder_Button_NewVersion")}</Text>
          </Pressable>
        </View>

        {showNewTemplateInput && (
          <View className="flex-row gap-2 mb-4">
             <TextInput 
               className="flex-1 border border-hairline rounded p-2 bg-canvas-soft-2 text-ink"
               placeholder="Template Name"
               value={newTemplateName}
               onChangeText={setNewTemplateName}
             />
             <Pressable 
               className="bg-primary justify-center px-4 rounded"
               onPress={() => {
                 if (newTemplateName) {
                   createTemplateMutation.mutate(newTemplateName);
                   setNewTemplateName("");
                   setShowNewTemplateInput(false);
                 }
               }}
             >
               <Text className="text-on-primary">Save</Text>
             </Pressable>
          </View>
        )}

        {templatesQuery.data?.items?.map((t: any) => (
          <View key={t.id} className="mb-2">
            {editingTemplateId === t.id ? (
              <View className="flex-row gap-2 items-center p-2 border border-ink bg-canvas-soft rounded">
                <TextInput
                  className="flex-1 border border-hairline rounded p-2 bg-canvas text-ink"
                  value={editTemplateName}
                  onChangeText={setEditTemplateName}
                  autoFocus
                />
                <Pressable
                  className="bg-primary px-3 py-2 rounded"
                  onPress={() => updateTemplateMutation.mutate({ id: t.id, name: editTemplateName })}
                >
                  <Text className="text-on-primary">Save</Text>
                </Pressable>
                <Pressable
                  className="px-3 py-2 bg-canvas-soft border border-hairline rounded"
                  onPress={() => setEditingTemplateId(null)}
                >
                  <Text className="text-ink">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable 
                onPress={() => {
                  setSelectedTemplateId(t.id);
                  setSelectedVersionId("");
                }}
                className={`p-3 rounded border flex-row items-center justify-between ${selectedTemplateId === t.id ? 'border-ink bg-canvas-soft' : 'border-hairline bg-canvas'}`}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{t.name}</Text>
                  <Text className="text-xs text-mute mt-1">{t.status}</Text>
                </View>
                <View className="flex-row items-center gap-4 px-2">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setEditTemplateName(t.name);
                      setEditingTemplateId(t.id);
                    }}
                    hitSlop={10}
                  >
                    <Edit2 size={18} color="#0055ff" />
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(
                        "Delete Template",
                        "Are you sure you want to delete this template and all its versions?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => deleteTemplateMutation.mutate(t.id) }
                        ]
                      );
                    }}
                    hitSlop={10}
                  >
                    <Trash2 size={18} color="#ee0000" />
                  </Pressable>
                </View>
              </Pressable>
            )}
          </View>
        ))}

        <Text className="text-lg font-bold text-ink mt-4 mb-2">{t("NGO_FormBuilder_Text_Versions")}</Text>
        {versionsQuery.data?.map((v: any) => (
          <Pressable
            key={v.id}
            onPress={() => setSelectedVersionId(v.id)}
            className={`p-3 mb-2 rounded border flex-row justify-between items-center ${selectedVersionId === v.id ? 'border-ink bg-canvas-soft' : 'border-hairline bg-canvas'}`}
          >
            <View>
              <Text className="font-semibold text-ink">{t('NGO_Mobile_Forms_Version')} {v.versionNo}</Text>
              {v.isPublished && <Text className="text-xs text-success">{t("NGO_Mobile_Forms_Published")}</Text>}
            </View>
            {!v.isPublished && (
              <Pressable
                className="p-2"
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation();
                  Alert.alert(
                    "Delete Version",
                    "Are you sure you want to delete this version?",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteVersionMutation.mutate(v.id) }
                    ]
                  );
                }}
              >
                <Trash2 size={18} color="#ee0000" />
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>

      <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline">
        <View className="flex-row justify-between items-center mb-4">
           <Text className="text-lg font-bold text-ink">{t('NGO_Mobile_Forms_Fields')}</Text>
           <Pressable 
             className="bg-primary px-3 py-1.5 rounded"
             onPress={() => publishMutation.mutate()}
             disabled={!selectedVersionId}
           >
             <Text className="text-on-primary text-xs font-medium">{t('NGO_Mobile_Forms_Publish')}</Text>
           </Pressable>
        </View>
        
        {orderedFields.length === 0 ? (
          <Text className="text-center text-mute py-4">{t('NGO_Mobile_Forms_NoFields')}</Text>
        ) : (
          orderedFields.map((f: any) => (
            <View key={f.id} className="border border-hairline rounded p-3 mb-2 bg-canvas-soft-2">
              <Text className="font-semibold text-ink">{f.label}</Text>
              <Text className="text-xs text-mute mt-1">{f.inputType} {f.isRequired ? '(Required)' : ''}</Text>
            </View>
          ))
        )}
      </View>

      <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-lg font-bold text-ink mb-3">{t('NGO_Mobile_Forms_AddField')}</Text>
        <TextInput
          className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2"
          placeholder="Custom field label"
          value={newFieldLabel}
          onChangeText={setNewFieldLabel}
        />
        <TextInput
          className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2"
          placeholder="Field type (text, number, select)"
          value={newFieldType}
          onChangeText={setNewFieldType}
        />
        <Pressable 
          className="bg-ink px-4 py-3 rounded items-center"
          onPress={() => addFieldMutation.mutate()}
          disabled={!newFieldLabel || addFieldMutation.isPending}
        >
          <Text className="text-white font-medium">{t('NGO_Mobile_Forms_Button_AddField')}</Text>
        </Pressable>
      </View>
      <View className="h-10" />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
