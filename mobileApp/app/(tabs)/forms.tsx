import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { db } from '../../src/db/schema';

type FormTemplate = {
  id: string;
  title: string;
  description: string;
  status: string;
  synced: number;
};

export default function Forms() {
  const { t } = useTranslation();
  const router = useRouter();
  const [forms, setForms] = useState<FormTemplate[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadForms();
    }, [])
  );

  const loadForms = () => {
    try {
      const rows = db.getAllSync('SELECT * FROM forms ORDER BY createdAt DESC') as FormTemplate[];
      setForms(rows);
    } catch (e) {
      console.log('Failed to load forms from db', e);
    }
  };

  return (
    <View className="flex-1 bg-canvas-soft-2 p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl font-bold text-ink">{t('NGO_Forms_Header_Title', 'My Forms')}</Text>
        <View className="flex-row gap-2">
          <Pressable 
            className="bg-canvas border border-hairline rounded-pill flex-row items-center px-3 py-2 shadow-card-soft"
            onPress={() => router.push('/surveys/new' as any)}
          >
            <Plus size={16} color="#171717" />
            <Text className="text-ink ml-1 font-medium">{t('NGO_Forms_Button_NewSurvey')}</Text>
          </Pressable>
          <Pressable 
            className="bg-primary rounded-pill flex-row items-center px-3 py-2 shadow-card-soft"
            onPress={() => router.push('/forms/builder' as any)}
          >
            <Plus size={16} color="white" />
            <Text className="text-on-primary ml-1 font-medium">{t('NGO_FormBuilder_Button_FormBuilder')}</Text>
          </Pressable>
        </View>
      </View>

      <FlashList
        data={forms}
        keyExtractor={(item) => item.id}
        estimatedItemSize={100}
        renderItem={({ item }) => (
          <Pressable 
            className="bg-canvas rounded-lg p-4 shadow-card-soft mb-3 border border-hairline"
            onPress={() => router.push(`/forms/${item.id}` as any)}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <Text className="font-bold text-ink text-lg">{item.title}</Text>
                {item.description ? <Text className="text-body text-sm mt-1 line-clamp-2" numberOfLines={2}>{item.description}</Text> : null}
              </View>
              <View className={`px-2 py-1 rounded-md ${item.status === 'Active' ? 'bg-success/10' : 'bg-warning/10'}`}>
                <Text className={`text-xs font-medium ${item.status === 'Active' ? 'text-success' : 'text-warning-deep'}`}>
                  {item.status}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-hairline">
              <Text className="text-mute text-xs">ID: {item.id.slice(0, 8)}...</Text>
              <Text className="text-mute text-xs">
                {item.synced ? t('forms.synced', 'Synced') : t('forms.offline', 'Offline')}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center p-10 border-2 border-dashed border-hairline rounded-lg mt-4">
            <Text className="text-mute text-center mb-2">{t('forms.noForms', 'No forms created yet.')}</Text>
            <Text className="text-xs text-body text-center">Create a form template offline to start collecting survey responses.</Text>
          </View>
        }
      />
    </View>
  );
}