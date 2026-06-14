import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../src/lib/api';

export default function Signup() {
  const { t } = useTranslation();
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState('');
  const [region, setRegion] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!organizationName || !region || !adminName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Direct registration call to backend
      await api.post('/v1/auth/register-ngo', {
        organization_name: organizationName,
        region,
        admin_name: adminName,
        email,
        password
      });
      
      setSuccess(t('SignupPage_Success_Created', 'NGO account created. You can now log in.'));
      setPassword('');
      setTimeout(() => router.replace('/login'), 2000);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError("NGO registration failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft">
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1 px-6">
        <View className="py-8 w-full max-w-md mx-auto">
          
          <View className="items-center mb-8">
            <View className="w-12 h-12 rounded-full bg-ink flex items-center justify-center mb-4 shadow-card-medium">
              <Text className="text-on-primary font-bold text-xl">N</Text>
            </View>
            <Text className="text-2xl font-bold tracking-tight text-ink">
              {t("SignupPage_Header_Title", "Create your NGO Workspace")}
            </Text>
            <Text className="text-sm text-body leading-relaxed mt-2 text-center">
              {t("SignupPage_Header_Description", "Join the network to manage volunteers and track community needs.")}
            </Text>
          </View>

          <View className="p-6 bg-canvas rounded-lg shadow-card-soft border border-hairline">
            {error ? (
              <View className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 mb-6">
                <Text className="text-sm text-danger font-medium">{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View className="rounded-md border border-success/30 bg-success/5 px-4 py-3 mb-6">
                <Text className="text-sm text-success font-medium">{success}</Text>
              </View>
            ) : null}

            <View className="space-y-4 mb-6">
              <View className="space-y-1">
                <Text className="text-xs font-medium text-body px-1">{t("SignupPage_Input_OrgName", "Organization Name")} *</Text>
                <TextInput
                  className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
                  value={organizationName}
                  onChangeText={setOrganizationName}
                />
              </View>

              <View className="space-y-1 mt-4">
                <Text className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Region", "Operating Region")} *</Text>
                <TextInput
                  className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
                  value={region}
                  onChangeText={setRegion}
                />
              </View>

              <View className="pt-4 mt-4 border-t border-hairline space-y-4">
                <Text className="font-medium text-sm text-ink mb-1">{t("SignupPage_Section_AdminDetails", "Administrator Details")}</Text>
                
                <View className="space-y-1">
                  <Text className="text-xs font-medium text-body px-1">{t("SignupPage_Input_AdminName", "Full Name")} *</Text>
                  <TextInput
                    className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
                    value={adminName}
                    onChangeText={setAdminName}
                  />
                </View>

                <View className="space-y-1 mt-4">
                  <Text className="text-xs font-medium text-body px-1">{t("SignupPage_Input_AdminEmail", "Email Address")} *</Text>
                  <TextInput
                    className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View className="space-y-1 mt-4">
                  <Text className="text-xs font-medium text-body px-1">{t("SignupPage_Input_Password", "Password")} *</Text>
                  <TextInput
                    className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>

            <Pressable 
              className={`mt-4 rounded-pill bg-ink items-center py-3 shadow-card-soft ${submitting ? 'opacity-70' : 'active:bg-ink/90'}`} 
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-on-primary font-medium text-sm">
                  {t("SignupPage_Button_CreateAccount", "Create Account")}
                </Text>
              )}
            </Pressable>

            <View className="mt-6 pt-4 border-t border-hairline items-center">
              <Link href="/login" asChild>
                <Pressable>
                  <Text className="text-sm text-link font-medium">
                    {t("SignupPage_Link_BackToLogin", "Already have an account? Sign In")}
                  </Text>
                </Pressable>
              </Link>
            </View>
            
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}