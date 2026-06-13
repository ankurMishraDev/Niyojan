import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { assignmentsApi } from '../../src/lib/services';
import { format } from 'date-fns';

export default function Assignments() {
  const { t } = useTranslation();
  const router = useRouter();

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentsApi.list({ page: 1, pageSize: 25 }),
  });

  return (
    <View className="flex-1 bg-canvas-soft-2 p-4">
      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 border border-hairline">
        <Text className="text-xs uppercase tracking-wider font-mono text-mute mb-2">Volunteer Workboard</Text>
        <Text className="text-xl font-bold text-ink">Assignment Queue</Text>
        <Text className="text-mute mt-2">
          Review newly assigned cases, inspect NGO-submitted details, and open the linked feedback workflow.
        </Text>
      </View>

      {assignmentsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#171717" />
        </View>
      ) : assignmentsQuery.isError ? (
        <View className="flex-1 items-center justify-center p-8 border-2 border-dashed border-hairline rounded-md">
          <Text className="text-danger text-center">Failed to load assignments.</Text>
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
              <View className="flex-row justify-between items-start mb-1">
                <Text className="font-bold text-ink text-lg flex-1 pr-2 line-clamp-2">{item.needSummary}</Text>
                <View className="px-2 py-1 bg-canvas-soft-2 border border-hairline rounded-md shrink-0">
                  <Text className="text-xs font-medium uppercase tracking-wider">{item.status}</Text>
                </View>
              </View>
              
              <Text className="text-mute text-sm mt-1">{item.volunteerName} • {item.volunteerAvailabilityStatus}</Text>
              
              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-hairline">
                <Text className="text-mute text-xs">Assigned: {format(new Date(item.assignedAt), 'MMM d, yyyy')}</Text>
                <Text className="text-xs font-medium text-warning-deep">{item.needPriorityLevel}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center p-10 border-2 border-dashed border-hairline rounded-lg mt-4">
              <Text className="text-mute">{t('assignments.noAssignments', 'No assignments found.')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}