import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Plus, Trash, Save } from 'lucide-react-native';
import { db } from '../../src/db/schema';

export default function CreateForm() {
  const { t } = useTranslation();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<{id: string, label: string, type: string, required: boolean}[]>([]);

  const addField = (type: string) => {
    setFields([...fields, { id: Date.now().toString(), label: '', type, required: false }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: string, value: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const saveForm = () => {
    if (!title) return alert(t('forms.titleRequired', 'Title is required'));
    
    // Save to local sqlite
    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    db.execAsync(`
      INSERT INTO forms (id, title, description, fields, status, createdAt, updatedAt, synced)
      VALUES ('${id}', '${title}', '${description}', '${JSON.stringify(fields)}', 'Active', '${now}', '${now}', 0);
    `).then(() => {
      router.back();
    }).catch(err => console.error(err));
  };

  return (
    <View className="flex-1 bg-canvas-soft-2">
      <View className="flex-row items-center justify-between p-4 bg-canvas border-b border-hairline">
        <Text className="text-lg font-bold text-ink">{t('forms.createTitle', 'Create Template')}</Text>
        <Pressable onPress={saveForm} className="flex-row items-center bg-primary px-3 py-1.5 rounded-pill">
          <Save size={16} color="white" />
          <Text className="text-on-primary font-medium ml-1">{t('forms.save', 'Save')}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="bg-canvas rounded-lg p-4 shadow-card-soft mb-4">
          <Text className="font-medium text-ink mb-1">{t('forms.formTitle', 'Form Title')}</Text>
          <TextInput 
            className="border-b border-hairline py-2 text-ink text-lg mb-4"
            placeholder={t('forms.titlePlaceholder', 'e.g. Health Survey')}
            value={title}
            onChangeText={setTitle}
          />
          
          <Text className="font-medium text-ink mb-1">{t('forms.formDescription', 'Description')}</Text>
          <TextInput 
            className="border border-hairline rounded-md p-3 text-ink bg-canvas-soft-2 h-24"
            placeholder={t('forms.descPlaceholder', 'Describe the purpose of this form')}
            multiline
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View className="mb-6">
          <Text className="font-bold text-ink mb-2 uppercase text-xs tracking-wider ml-1">{t('forms.fields', 'Form Fields')}</Text>
          {fields.map((field, index) => (
            <View key={field.id} className="bg-canvas rounded-lg p-4 shadow-card-soft mb-3 border-l-4 border-primary">
              <View className="flex-row justify-between mb-2">
                <Text className="font-medium text-mute uppercase text-xs">{t(`forms.type_${field.type}`, field.type)}</Text>
                <Pressable onPress={() => removeField(field.id)}>
                  <Trash size={16} color="#ee0000" />
                </Pressable>
              </View>
              
              <TextInput 
                className="border-b border-hairline py-2 text-ink mb-3"
                placeholder={t('forms.fieldLabel', 'Question text')}
                value={field.label}
                onChangeText={(val) => updateField(field.id, 'label', val)}
              />

              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-sm text-ink">{t('forms.required', 'Required field')}</Text>
                <Switch 
                  value={field.required}
                  onValueChange={(val) => updateField(field.id, 'required', val)}
                  trackColor={{ false: '#ebebeb', true: '#171717' }}
                  thumbColor={'#ffffff'}
                />
              </View>
            </View>
          ))}

          <View className="flex-row flex-wrap gap-2 mt-2">
            <Pressable onPress={() => addField('text')} className="bg-canvas border border-hairline px-3 py-2 rounded-md items-center flex-row">
              <Plus size={14} color="#171717" />
              <Text className="text-ink ml-1 text-sm">{t('forms.addText', 'Add Text')}</Text>
            </Pressable>
            <Pressable onPress={() => addField('number')} className="bg-canvas border border-hairline px-3 py-2 rounded-md items-center flex-row">
              <Plus size={14} color="#171717" />
              <Text className="text-ink ml-1 text-sm">{t('forms.addNumber', 'Add Number')}</Text>
            </Pressable>
          </View>
        </View>
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}