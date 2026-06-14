import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useAuth } from '../../src/features/auth/useAuth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assignmentsApi, feedbackApi } from '../../src/lib/services';
import { format } from 'date-fns';

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  // Feedback fields
  const [visitCompleted, setVisitCompleted] = useState("true");
  const [visitDate, setVisitDate] = useState("");
  const [needConfirmed, setNeedConfirmed] = useState("true");
  const [actualAffectedCount, setActualAffectedCount] = useState("");
  const [actualUrgencyAssessment, setActualUrgencyAssessment] = useState("correct");
  const [wasAiExtractionAccurate, setWasAiExtractionAccurate] = useState("true");
  const [actualSituationSummary, setActualSituationSummary] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [extractionInaccuracies, setExtractionInaccuracies] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState("pending");
  const [escalationReason, setEscalationReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["assignment-detail", id],
    queryFn: () => assignmentsApi.get(id as string),
  });

  const feedbackQuery = useQuery({
    enabled: Boolean(id),
    queryKey: ["assignment-feedback", id],
    queryFn: async () => {
      try {
        return await feedbackApi.get(id as string);
      } catch (error: any) {
        // The mobile ApiError class has a status property, so we check that.
        // It's normal for feedback to be missing initially.
        if (error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => feedbackApi.submit(id as string, payload),
    onSuccess: async () => {
      alert("Feedback submitted successfully.");
      await Promise.all([feedbackQuery.refetch(), detailQuery.refetch()]);
    },
    onError: (error: any) => {
       alert(error.message || "Failed to submit feedback");
    }
  });

  const submitFeedback = () => {
    submitMutation.mutate({
        visit_completed: visitCompleted === "true",
        visit_date: visitDate || undefined,
        need_confirmed: needConfirmed === "true",
        actual_situation_summary: actualSituationSummary || undefined,
        actual_urgency_assessment: actualUrgencyAssessment || undefined,
        actual_affected_count: actualAffectedCount ? Number(actualAffectedCount) : undefined,
        was_ai_extraction_accurate: wasAiExtractionAccurate === "true",
        extraction_inaccuracies: extractionInaccuracies || undefined,
        evidence_gcs_paths: [], // Evidence upload omitted for simplicity
        action_taken: actionTaken || undefined,
        resolution_status: resolutionStatus || undefined,
        escalation_reason: escalationReason || undefined,
    });
  };

  if (detailQuery.isLoading || feedbackQuery.isLoading) {
    return (
        <View className="flex-1 items-center justify-center bg-canvas-soft-2">
            <ActivityIndicator size="small" color="#171717" />
        </View>
    );
  }

  const assignment = detailQuery.data;
  const feedback = feedbackQuery.data;

  if (!assignment) {
    return (
        <View className="flex-1 items-center justify-center bg-canvas-soft-2 p-8">
            <Text className="text-mute text-center">Assignment details not found.</Text>
        </View>
    );
  }

  const isVolunteer = user?.role === "volunteer";

  return (
    <ScrollView className="flex-1 bg-canvas-soft-2 p-4">
      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">Assignment Detail</Text>
        <Text className="text-xl font-bold text-ink">{assignment.needSummary}</Text>
      </View>

      <View className="grid gap-3 mb-6 bg-canvas p-4 rounded-lg shadow-card-soft border border-hairline">
         <View className="flex-row justify-between pb-3 border-b border-hairline">
            <Text className="text-mute text-sm">Status</Text>
            <Text className="font-medium text-ink">{assignment.status}</Text>
         </View>
         <View className="flex-row justify-between pb-3 border-b border-hairline pt-2">
            <Text className="text-mute text-sm">Priority</Text>
            <Text className="font-medium text-ink">{assignment.needPriorityLevel}</Text>
         </View>
         <View className="flex-row justify-between pt-2">
            <Text className="text-mute text-sm">Assigned</Text>
            <Text className="font-medium text-ink">{format(new Date(assignment.assignedAt), 'MMM d, yyyy')}</Text>
         </View>
      </View>

      <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-lg font-bold text-ink mb-4">Feedback Response</Text>

        {!feedback && isVolunteer ? (
          <View>
            <Text className="font-medium text-ink mb-1">Visit Status (true/false)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={visitCompleted} onChangeText={setVisitCompleted} />

            <Text className="font-medium text-ink mb-1">Date of Visit (YYYY-MM-DD)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={visitDate} onChangeText={setVisitDate} />

            <Text className="font-medium text-ink mb-1">Need Confirmed (true/false)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={needConfirmed} onChangeText={setNeedConfirmed} />

            <Text className="font-medium text-ink mb-1">Affected Count</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" keyboardType="numeric" value={actualAffectedCount} onChangeText={setActualAffectedCount} />

            <Text className="font-medium text-ink mb-1">Urgency Assessment (correct/higher/lower)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={actualUrgencyAssessment} onChangeText={setActualUrgencyAssessment} />

            <Text className="font-medium text-ink mb-1">AI Extraction Accurate (true/false)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={wasAiExtractionAccurate} onChangeText={setWasAiExtractionAccurate} />

            <Text className="font-medium text-ink mb-1 mt-2">Observed Field Situation</Text>
            <TextInput 
              className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink h-24"
              multiline
              textAlignVertical="top"
              value={actualSituationSummary}
              onChangeText={setActualSituationSummary}
            />

            <Text className="font-medium text-ink mb-1 mt-2">Action Taken</Text>
            <TextInput 
              className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink h-24"
              multiline
              textAlignVertical="top"
              value={actionTaken}
              onChangeText={setActionTaken}
            />

            <Text className="font-medium text-ink mb-1">Resolution Status (pending/resolved/etc)</Text>
            <TextInput className="border border-hairline rounded p-2 mb-3 bg-canvas-soft-2 text-ink" value={resolutionStatus} onChangeText={setResolutionStatus} />

            <Pressable 
              className={`bg-ink rounded-pill py-3 items-center shadow-card-soft mt-4 flex-row justify-center ${submitMutation.isPending ? 'opacity-70' : ''}`}
              onPress={submitFeedback}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                  <Text className="text-on-primary font-medium ml-2">Submit Feedback</Text>
              )}
            </Pressable>
          </View>
        ) : feedback ? (
          <View>
            <Text className="text-mute text-sm mb-1">Visit Completed</Text>
            <Text className="text-ink font-medium mb-3">{String(feedback.visitCompleted)}</Text>
            
            <Text className="text-mute text-sm mb-1">Resolution Status</Text>
            <Text className="text-ink font-medium mb-3">{feedback.resolutionStatus}</Text>

            <Text className="text-mute text-sm mb-1">Actual Situation</Text>
            <Text className="text-ink font-medium mb-3">{feedback.actualSituationSummary || "None"}</Text>
          </View>
        ) : (
          <Text className="text-center text-mute py-6">No feedback submitted yet.</Text>
        )}
      </View>
      <View className="h-10" />
    </ScrollView>
  );
}