import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { db } from '../../src/db/schema';
import { useAppStore } from '../../src/store/appStore';
import { enqueueSurvey } from '../../src/lib/syncService';

export default function FillForm() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAppStore();

  const [form, setForm] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch form from SQLite — parameterized query prevents SQL injection
    db.getFirstAsync('SELECT * FROM forms WHERE id = ?', [id as string]).then((row: any) => {
      if (row) {
        setForm({ ...row, fields: JSON.parse(row.fields) });
      }
    });
  }, [id]);

  const submitSurvey = () => {
    const surveyId = Date.now().toString();
    const now = new Date().toISOString();
    
    // Parameterized insert — no string interpolation
    db.runAsync(
      `INSERT INTO surveys (id, formId, volunteerId, data, status, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, 'Completed', ?, ?, 0)`,
      [surveyId, id as string, user?.id ?? '', JSON.stringify(answers), now, now]
    ).then(() => {
      // Enqueue for sync when back online
      enqueueSurvey(surveyId);
      alert(t('forms.submitSuccess', 'Survey saved and queued for sync!'));
      router.back();
    }).catch(err => console.error(err));
  };

  if (!form) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas-soft-2">
        <Text className="text-mute">{t('forms.loading', 'Loading form...')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas-soft-2">
      <View className="p-4 bg-primary pt-10 pb-6">
        <Text className="text-2xl font-bold text-on-primary">{form.title}</Text>
        {form.description ? <Text className="text-on-primary/80 mt-1">{form.description}</Text> : null}
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          className="flex-1 p-4"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
        {form.fields.map((field: any) => (
          <View key={field.id} className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4 border border-hairline">
            <Text className="font-medium text-ink mb-2">
              {field.label} {field.required && <Text className="text-danger">*</Text>}
            </Text>
            
            <TextInput 
              className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2"
              placeholder={t('forms.answerPlaceholder', 'Your answer')}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              value={answers[field.id] || ''}
              onChangeText={(val) => setAnswers({...answers, [field.id]: val})}
            />
          </View>
        ))}

        <Pressable 
          className="bg-ink rounded-pill py-3 items-center shadow-card-soft mt-4 flex-row justify-center"
          onPress={submitSurvey}
        >
          <Save size={18} color="white" />
          <Text className="text-on-primary font-medium ml-2">{t('forms.submitSurvey', 'Submit Survey')}</Text>
        </Pressable>
        <View className="h-20" />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}