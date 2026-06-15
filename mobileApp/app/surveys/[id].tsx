import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsApi, surveysApi } from '../../src/lib/services';
import {
  applyExtractionToDraft,
  buildExtractionAttentionItems,
  buildResponsePayload,
  type DynamicFieldValue,
  type ExtractionAttentionItem,
} from '../../src/lib/extractionMapping';

export default function SurveyDetail() {
  const params = useLocalSearchParams();
  const { id } = params;
  const { t } = useTranslation();
  const router = useRouter();

  const [draft, setDraft] = useState<Record<string, DynamicFieldValue>>({});
  const [showExtractionInfo, setShowExtractionInfo] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState('');
  const [attentionItems, setAttentionItems] = useState<ExtractionAttentionItem[]>([]);
  const appliedPrefillRef = useRef(false);

  const surveyQuery = useQuery({
    queryKey: ['survey-detail', id],
    queryFn: () => surveysApi.get(id as string),
  });

  const versionQuery = useQuery({
    enabled: Boolean(surveyQuery.data?.templateVersionId),
    queryKey: ['survey-template-version', surveyQuery.data?.templateVersionId],
    queryFn: () => formsApi.getVersion(surveyQuery.data?.templateVersionId),
  });

  // Initialize draft from server responses
  useEffect(() => {
    if (!surveyQuery.data || !versionQuery.data) return;

    const nextDraft: Record<string, DynamicFieldValue> = {};
    for (const field of versionQuery.data.fields ?? []) {
      const existing = surveyQuery.data.responses?.find(
        (r: any) => r.formFieldId === field.id,
      );
      nextDraft[field.id] = {
        inputType: field.inputType,
        valueText: existing?.valueText ?? '',
        valueNumber: existing?.valueNumber ?? undefined,
        valueBool: existing?.valueBool ?? undefined,
        valueJson: existing?.valueJson ?? undefined,
      };
    }
    setDraft(nextDraft);
  }, [surveyQuery.data?.id, versionQuery.data?.id]);

  // Apply extraction prefill (runs once per survey load)
  useEffect(() => {
    if (!versionQuery.data || appliedPrefillRef.current) return;
    if (typeof params.prefillExtraction !== 'string') return;

    let prefill: unknown = null;
    try {
      prefill = JSON.parse(params.prefillExtraction);
    } catch {
      return;
    }
    if (!prefill) return;

    appliedPrefillRef.current = true;
    const fields = versionQuery.data.fields ?? [];
    const { draft: next, fieldExtractionMeta } = applyExtractionToDraft(draft, fields, prefill);
    const attention = buildExtractionAttentionItems(fields, next, fieldExtractionMeta);

    setDraft(next);
    setAttentionItems(attention);
    setShowExtractionInfo(true);
    setExtractionMessage(
      attention.length > 0
        ? `Draft prefilled${params.prefillDocumentName ? ` from ${params.prefillDocumentName}` : ''}. Review flagged fields before submitting.`
        : `Draft prefilled${params.prefillDocumentName ? ` from ${params.prefillDocumentName}` : ''}. Please verify and submit.`,
    );
  }, [versionQuery.data, params.prefillExtraction]);

  const submitMutation = useMutation({
    mutationFn: () => {
      const fields = versionQuery.data?.fields ?? [];
      const responses = fields
        .map((field: any) => buildResponsePayload(field, draft[field.id]))
        .filter(Boolean);
      return surveysApi.submit(id as string, { responses });
    },
    onSuccess: () => {
      alert('Survey submitted successfully.');
      surveyQuery.refetch();
    },
  });

  if (surveyQuery.isLoading || versionQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-4 bg-canvas-soft-2">
        <ActivityIndicator size="large" color="#171717" />
        <Text className="mt-4 text-mute">Loading survey...</Text>
      </View>
    );
  }

  const survey = surveyQuery.data;
  const version = versionQuery.data;

  if (!survey || !version) {
    return (
      <View className="flex-1 items-center justify-center p-4 bg-canvas-soft-2">
        <Text className="text-danger">Survey detail could not be loaded.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        className="flex-1 bg-canvas-soft-2 p-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Extraction prefill banner */}
        {showExtractionInfo && (
          <View className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
            <Text className="text-warning-deep font-medium">{extractionMessage}</Text>
          </View>
        )}

        {/* Attention items */}
        {attentionItems.length > 0 && (
          <View className="bg-canvas border border-hairline rounded-lg p-4 mb-4">
            <Text className="font-semibold text-ink mb-2">Fields needing review:</Text>
            {attentionItems.map((item) => (
              <View key={item.fieldId} className="flex-row items-start mb-1">
                <Text className="text-warning-deep mr-2">•</Text>
                <Text className="text-sm text-ink flex-1">
                  <Text className="font-medium">{item.fieldLabel}</Text>: {item.reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
          <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">
            {t('NGO_Survey_Header_FieldSurvey')}
          </Text>
          <Text className="text-2xl font-bold text-ink">
            {version.templateName ?? 'Survey Detail'}
          </Text>
          <Text className="text-mute mt-2">{t('NGO_SurveyPages_Header_SurveyDescription')}</Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-6">
          <Pressable
            className={`flex-1 py-3 rounded items-center ${
              submitMutation.isPending || survey.status !== 'draft' ? 'bg-ink/70' : 'bg-ink'
            }`}
            onPress={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || survey.status !== 'draft'}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white font-medium">
                {survey.status === 'draft'
                  ? t('NGO_Survey_Button_Submit')
                  : t('NGO_Survey_Text_AlreadySubmitted')}
              </Text>
            )}
          </Pressable>
        </View>

        <View className="flex-row flex-wrap mb-4">
          <View className="w-1/2 p-2">
            <View className="bg-canvas border border-hairline rounded p-3">
              <Text className="text-xs text-mute uppercase mb-1">
                {t('NGO_SurveyPages_Info_Respondent')}
              </Text>
              <Text className="font-semibold text-ink" numberOfLines={1}>
                {survey.respondentName ?? 'Not set'}
              </Text>
            </View>
          </View>
          <View className="w-1/2 p-2">
            <View className="bg-canvas border border-hairline rounded p-3">
              <Text className="text-xs text-mute uppercase mb-1">
                {t('NGO_SurveyPages_Info_Status')}
              </Text>
              <Text className="font-semibold text-ink" numberOfLines={1}>
                {survey.status}
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-canvas rounded-lg p-5 shadow-card-soft mb-6 border border-hairline">
          {version.fields?.map((field: any) => (
            <View key={field.id} className="mb-4">
              <Text className="font-medium text-ink mb-2">
                {field.label}{' '}
                {field.isRequired && <Text className="text-danger">*</Text>}
              </Text>
              <TextInput
                className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2"
                placeholder={`Enter ${field.inputType}`}
                keyboardType={field.inputType === 'number' ? 'numeric' : 'default'}
                value={
                  field.inputType === 'number'
                    ? draft[field.id]?.valueNumber?.toString() ?? ''
                    : draft[field.id]?.valueText ?? ''
                }
                onChangeText={(text) =>
                  setDraft((prev) => ({
                    ...prev,
                    [field.id]: {
                      ...prev[field.id],
                      inputType: field.inputType,
                      [field.inputType === 'number' ? 'valueNumber' : 'valueText']:
                        field.inputType === 'number' ? Number(text) : text,
                    },
                  }))
                }
              />
            </View>
          ))}

          {(!version.fields || version.fields.length === 0) && (
            <Text className="text-center text-mute py-4">
              No fields defined for this template version.
            </Text>
          )}
        </View>

        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
