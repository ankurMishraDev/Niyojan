import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../src/store/appStore';
import { useAuth } from '../../src/features/auth/useAuth';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../src/lib/services';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const { t } = useTranslation();
  const { isOffline } = useAppStore();
  const { user } = useAuth();
  const router = useRouter();

  const submittedSurveysQuery = useQuery({
    queryKey: ['ngo-dashboard-submitted-surveys'],
    queryFn: () => dashboardApi.submittedSurveys(),
    enabled: !isOffline,
  });

  return (
    <ScrollView className="flex-1 bg-canvas-soft-2 p-4">
      {isOffline && (
        <View className="bg-warning/20 p-3 rounded-md mb-4 border border-warning/40">
          <Text className="text-warning-deep text-center text-sm font-medium">
            {t('offline.warning', 'You are currently offline. Showing cached data.')}
          </Text>
        </View>
      )}

      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">NGO Workspace</Text>
        <Text className="text-2xl font-bold text-ink">
          {user?.organizationName ? `${user.organizationName} dashboard` : t('NGO_Dashboard_Header_Welcome', 'Welcome back')}
        </Text>
        <Text className="text-mute mt-2">
          {t('NGO_Dashboard_Text_Overview', 'Review your recent case submissions and monitor overall organization activity.')}
        </Text>
      </View>

      {/* Dashboard Stats */}
      {/* <View className="flex-row gap-4 mb-6">
        <View className="flex-1 bg-canvas rounded-lg p-4 shadow-card-soft border border-hairline">
          <Text className="text-mute text-xs font-medium uppercase tracking-wider">Account Scope</Text>
          <Text className="text-lg font-bold text-ink mt-2 line-clamp-1">{user?.name}</Text>
          <Text className="text-sm text-body">{user?.email}</Text>
        </View>
      </View> */}

      <View className="bg-canvas rounded-lg p-5 shadow-card-soft border border-hairline mb-6">
        <Text className="text-lg font-bold text-ink mb-1">
          {t('NGO_Dashboard_Metric_TotalSurveys', 'Submitted surveys')}
        </Text>
        <Text className="text-body text-sm mb-4">
          {t('NGO_Dashboard_Text_Overview')}
        </Text>

        {submittedSurveysQuery.isLoading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" color="#171717" />
          </View>
        ) : submittedSurveysQuery.isError ? (
          <View className="py-8 items-center justify-center">
             <Text className="text-danger">{t('NGO_Dashboard_Error_LoadSurveys')}</Text>
          </View>
        ) : (
          <View className="space-y-4 gap-y-4">
            {(submittedSurveysQuery.data ?? []).map((survey: any) => (
              <View key={survey.id} className="rounded-md border border-hairline bg-canvas-soft-2 p-4">
                <View className="flex-row justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="font-semibold text-ink">{survey.respondentName || 'Unnamed respondent'}</Text>
                    <Text className="mt-1 text-xs font-mono text-mute">{survey.id}</Text>
                  </View>
                  <View className="items-end shrink-0">
                    <View className="px-2 py-1 bg-canvas border border-hairline rounded-md">
                      <Text className="text-xs font-medium uppercase tracking-wider">{survey.priorityLevel}</Text>
                    </View>
                  </View>
                </View>
                
                <Text className="text-sm text-body mb-3">{survey.locationText || 'No location'}</Text>
                
                <View className="pt-3 border-t border-hairline flex-row flex-wrap gap-x-3 gap-y-1">
                  <Text className="text-xs text-body">
                    {format(new Date(survey.submittedAt || survey.createdAt), 'MMM d, yyyy')}
                  </Text>
                  <Text className="text-xs text-body">• {survey.needCount} need(s)</Text>
                  <Text className="text-xs text-body">• {survey.feedbackSubmitted ? t('NGO_Dashboard_Text_FeedbackSubmitted') : t('NGO_Dashboard_Text_WaitingFeedback')}</Text>
                  {survey.volunteerName && (
                     <Text className="text-xs text-body">• {t('NGO_Dashboard_Text_VolunteerName')}: {survey.volunteerName}</Text>
                  )}
                </View>

                <View className="mt-4 flex-row flex-wrap gap-2">
                  <Pressable 
                    className="bg-canvas border border-hairline rounded-md justify-center px-3 py-2 flex-1 items-center"
                    onPress={() => router.push(`/surveys/${survey.id}` as any)}
                  >
                    <Text className="text-xs font-medium text-ink">{t('NGO_Dashboard_Button_ViewSurvey')}</Text>
                  </Pressable>
                  {survey.assignmentId ? (
                    <Pressable 
                      className="bg-canvas border border-hairline rounded-md justify-center px-3 py-2 flex-1 items-center"
                      onPress={() => router.push(`/assignments/${survey.assignmentId}` as any)}
                    >
                      <Text className="text-xs font-medium text-ink">{t('NGO_Dashboard_Button_OpenFeedback')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              
              </View>
            ))}
            
            {(submittedSurveysQuery.data?.length === 0 || !submittedSurveysQuery.data) && (
              <View className="py-8 items-center border-2 border-dashed border-hairline rounded-lg">
                <Text className="text-mute text-sm">{t('NGO_Dashboard_Text_NoSurveys')}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View className="h-10" />
    </ScrollView>
  );
}