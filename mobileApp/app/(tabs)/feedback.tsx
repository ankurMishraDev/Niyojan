import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { assignmentsApi } from '../../src/lib/services';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/features/auth/useAuth';

export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  
  const canListAssignments = user?.role === "volunteer" || user?.role === "ngo" || user?.role === "ngo_admin";

  const assignmentsQuery = useQuery({
    enabled: canListAssignments,
    queryKey: ["feedback-assignments"],
    queryFn: () => assignmentsApi.list({ page: 1, pageSize: 20 }),
  });

  return (
    <View className="flex-1 bg-canvas-soft-2 p-4">
      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">
          {t("NGO_Feedback_Header_CaseFeedback", "Case Feedback")}
        </Text>
        <Text className="text-xl font-bold text-ink mb-1">
          {user?.role === "volunteer" ? t("NGO_Feedback_Title_Volunteer", "My Feedback Submissions") : t("NGO_Feedback_Title_Review", "Review Feedback")}
        </Text>
        <Text className="text-mute text-sm mt-1">
           {user?.role === "volunteer"
             ? t("NGO_Feedback_Description_Volunteer", "View feedback you've submitted for past assignments.")
             : t("NGO_Feedback_Description_Review", "Review field feedback from volunteers.")}
        </Text>
      </View>

      {assignmentsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
           <ActivityIndicator size="small" color="#171717" />
        </View>
      ) : (
        <FlashList
          data={assignmentsQuery.data?.items ?? []}
          estimatedItemSize={120}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable 
              className="bg-canvas rounded-lg p-4 shadow-card-soft mb-3 border border-hairline"
              onPress={() => router.push(`/assignments/${item.id}`)}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="font-bold text-ink text-lg flex-1 pr-2 line-clamp-2">{item.needSummary}</Text>
                <View className="px-2 py-1 bg-canvas-soft-2 border border-hairline rounded-md shrink-0">
                  <Text className="text-xs font-medium uppercase tracking-wider">{item.status}</Text>
                </View>
              </View>
              <Text className="text-mute text-sm mt-1">
                {user?.role === "volunteer" ? item.needPriorityLevel : item.volunteerName}
              </Text>
              
              <View className="mt-4 pt-3 border-t border-hairline items-center">
                 <Text className="text-link text-sm font-medium">
                   {user?.role === "volunteer"
                    ? t("NGO_Feedback_Button_OpenFieldFeedback", "Open Feedback")
                    : t("NGO_Feedback_Button_ReviewVolunteerResponse", "Review Response")}
                 </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center p-10 border-2 border-dashed border-hairline rounded-lg mt-4">
              <Text className="text-mute">{t("NGO_Feedback_NoAssignments", "No feedback items available.")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}