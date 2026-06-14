import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsApi, surveysApi } from '../../src/lib/services';

export default function SurveyDetail() {
  const params = useLocalSearchParams();
  const { id } = params;
  const { t } = useTranslation();
  const router = useRouter();

  const [draft, setDraft] = useState<Record<string, any>>({});
  const [showExtractionInfo, setShowExtractionInfo] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState("");

  const surveyQuery = useQuery({
    queryKey: ["survey-detail", id],
    queryFn: () => surveysApi.get(id as string),
  });

  const versionQuery = useQuery({
    enabled: Boolean(surveyQuery.data?.templateVersionId),
    queryKey: ["survey-template-version", surveyQuery.data?.templateVersionId],
    queryFn: () => formsApi.getVersion(surveyQuery.data?.templateVersionId),
  });

  useEffect(() => {
    if (!surveyQuery.data || !versionQuery.data) return;

    let prefillExtraction: any = null;
    if (typeof params.prefillExtraction === 'string') {
        try {
            prefillExtraction = JSON.parse(params.prefillExtraction);
        } catch(e) {}
    }

    const nextDraft: Record<string, any> = {};
    for (const field of versionQuery.data.fields ?? []) {
      const existing = surveyQuery.data.responses?.find(
        (response: any) => response.formFieldId === field.id
      );

      // Attempt to map from prefillExtraction if available
      let extractedValueText = "";
      if (prefillExtraction) {
         // simple heuristic for mobile demo to find a matching field
         const candidates = Array.isArray(prefillExtraction.documentAi?.fields) ? prefillExtraction.documentAi.fields : [];
         const match = candidates.find((c:any) => c.label?.toLowerCase() === field.label.toLowerCase() || c.label?.includes(field.label));
         if (match) extractedValueText = match.valueHint;
      }

      nextDraft[field.id] = {
        inputType: field.inputType,
        valueText: extractedValueText || existing?.valueText || "",
        valueNumber: existing?.valueNumber ?? undefined,
        valueBool: existing?.valueBool ?? undefined,
      };
    }

    if (prefillExtraction) {
        setExtractionMessage(`Draft prefilled from AI extraction${params.prefillDocumentName ? ' (' + params.prefillDocumentName + ')' : ''}. Please verify and submit.`);
        setShowExtractionInfo(true);
    }

    setDraft(nextDraft);
  }, [surveyQuery.data, versionQuery.data, params.prefillExtraction]);

  const submitMutation = useMutation({
    mutationFn: () => {
      const responses = (versionQuery.data?.fields ?? []).map((field: any) => {
        const val = draft[field.id];
        if (!val || (!val.valueText && val.valueNumber === undefined)) return null;
        return {
          form_field_id: field.id,
          input_type: field.inputType,
          value_text: val.valueText,
          value_number: val.valueNumber,
        };
      }).filter(Boolean);
      return surveysApi.submit(id as string, { responses });
    },
    onSuccess: () => {
      alert("Survey submitted successfully.");
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
      <ScrollView className="flex-1 bg-canvas-soft-2 p-4">
        {showExtractionInfo && (
        <View className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
            <Text className="text-warning-deep font-medium">{extractionMessage}</Text>
        </View>
      )}

      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">Field Survey</Text>
        <Text className="text-2xl font-bold text-ink">{version.templateName ?? "Survey Detail"}</Text>
        <Text className="text-mute mt-2">Fill the fields manually before final submission.</Text>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-6">
        <Pressable 
          className={`flex-1 py-3 rounded items-center ${submitMutation.isPending || survey.status !== "draft" ? 'bg-ink/70' : 'bg-ink'}`}
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || survey.status !== "draft"}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-white font-medium">
                {survey.status === "draft" ? "Submit Survey" : "Already Submitted"}
            </Text>
          )}
        </Pressable>
      </View>

      <View className="flex-row flex-wrap mb-4">
        <View className="w-1/2 p-2">
          <View className="bg-canvas border border-hairline rounded p-3">
            <Text className="text-xs text-mute uppercase mb-1">Respondent</Text>
            <Text className="font-semibold text-ink" numberOfLines={1}>{survey.respondentName ?? "Not set"}</Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-canvas border border-hairline rounded p-3">
            <Text className="text-xs text-mute uppercase mb-1">Status</Text>
            <Text className="font-semibold text-ink" numberOfLines={1}>{survey.status}</Text>
          </View>
        </View>
      </View>

      <View className="bg-canvas rounded-lg p-5 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-lg font-bold text-ink mb-4">Questions</Text>
        
        {version.fields?.map((field: any) => (
          <View key={field.id} className="mb-4">
            <Text className="font-medium text-ink mb-2">
              {field.label} {field.isRequired && <Text className="text-danger">*</Text>}
            </Text>
            <TextInput
              className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2"
              placeholder={`Enter ${field.inputType}`}
              keyboardType={field.inputType === 'number' ? 'numeric' : 'default'}
              value={field.inputType === 'number' ? draft[field.id]?.valueNumber?.toString() : draft[field.id]?.valueText}
              onChangeText={(text) => setDraft({
                ...draft,
                [field.id]: {
                  ...draft[field.id],
                  [field.inputType === 'number' ? 'valueNumber' : 'valueText']: field.inputType === 'number' ? Number(text) : text
                }
              })}
            />
          </View>
        ))}

        {(!version.fields || version.fields.length === 0) && (
          <Text className="text-center text-mute py-4">No fields defined for this template version.</Text>
        )}
      </View>
      <View className="h-10" />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
