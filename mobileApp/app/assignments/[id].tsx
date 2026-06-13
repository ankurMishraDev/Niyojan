import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useAppStore } from '../../src/store/appStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assignmentsApi, feedbackApi } from '../../src/lib/services';
import { format } from 'date-fns';

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAppStore();

  const [feedbackContent, setFeedbackContent] = useState('');
  const [rating, setRating] = useState('5'); 

  const detailQuery = useQuery({
    queryKey: ["assignment-detail", id],
    queryFn: () => assignmentsApi.get(id as string),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => feedbackApi.submit(id as string, payload),
    onSuccess: async () => {
      alert(t('assignments.feedbackSuccess', 'Feedback submitted successfully!'));
      router.back();
    },
    onError: (error: any) => {
       alert(error.message || "Failed to submit feedback");
    }
  });

  const submitFeedback = () => {
    submitMutation.mutate({
        visit_completed: true,
        actual_situation_summary: feedbackContent,
        actual_urgency_assessment: "correct",
        actual_affected_count: parseInt(rating, 10) || 1,
        was_ai_extraction_accurate: true,
        resolution_status: "resolved"
    });
  };

  if (detailQuery.isLoading) {
    return (
        <View className="flex-1 items-center justify-center bg-canvas-soft-2">
            <ActivityIndicator size="small" color="#171717" />
        </View>
    );
  }

  const assignment = detailQuery.data;

  if (!assignment) {
    return (
        <View className="flex-1 items-center justify-center bg-canvas-soft-2 p-8">
            <Text className="text-mute text-center">Assignment details not found.</Text>
        </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas-soft-2">
      <View className="p-4 bg-canvas border-b border-hairline pt-10">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-1">Assignment Detail</Text>
        <Text className="text-2xl font-bold text-ink">{assignment.needSummary}</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        
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

        <Text className="font-bold text-ink mb-2 uppercase text-xs tracking-wider ml-1">{t('assignments.submitFeedback', 'Submit Field Feedback')}</Text>
        <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline">
            <Text className="font-medium text-ink mb-2">{t('assignments.feedbackContent', 'Observed Field Situation')}</Text>
            <TextInput 
              className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 h-32"
              placeholder={t('assignments.feedbackPlaceholder', 'Describe the ground truth')}
              multiline
              textAlignVertical="top"
              value={feedbackContent}
              onChangeText={setFeedbackContent}
            />

            <Text className="font-medium text-ink mt-4 mb-2">Affected Count</Text>
            <TextInput 
              className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2"
              keyboardType="numeric"
              value={rating}
              onChangeText={setRating}
            />
        </View>

        <Pressable 
          className={`bg-ink rounded-pill py-3 items-center shadow-card-soft mt-2 flex-row justify-center ${submitMutation.isPending ? 'opacity-70' : 'active:bg-ink/90'}`}
          onPress={submitFeedback}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
          ) : (
             <>
                <CheckCircle size={18} color="white" />
                <Text className="text-on-primary font-medium ml-2">{t('assignments.complete', 'Complete & Submit')}</Text>
             </>
          )}
        </Pressable>
        
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}