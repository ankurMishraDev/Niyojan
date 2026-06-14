import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/features/auth/useAuth';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await signInWithEmail(email, password);
      // Navigation is handled implicitly by the auth listener in layout/index
      router.replace('/');
    } catch (caught: any) {
      setError(caught?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft justify-center px-6">
      <KeyboardAvoidingView 
        style={{ flex: 1, justifyContent: 'center' }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View className="w-full max-w-md mx-auto relative z-10 p-6 bg-canvas rounded-lg shadow-card-soft border border-hairline">
        
        <View className="items-center mb-8">
          <View className="w-12 h-12 rounded-full bg-ink flex items-center justify-center mb-4 shadow-card-medium">
            <Text className="text-on-primary font-bold text-xl">N</Text>
          </View>
          <Text className="text-2xl font-bold tracking-tight text-ink">NIYOJAN</Text>
          <Text className="text-sm text-body leading-relaxed mt-2 text-center">
            {t("LoginPage_Header_Description", "Sign in to access your dashboard")}
          </Text>
        </View>

        {error ? (
          <View className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 mb-6">
            <Text className="text-sm text-danger font-medium">{error}</Text>
          </View>
        ) : null}

        <View className="space-y-4 mb-6 gap-y-4">
          <TextInput
            className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
            placeholder={t("LoginPage_Input_Email", "Email Address")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            className="w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-ink text-sm"
            placeholder={t("LoginPage_Input_Password", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <Pressable 
          className={`rounded-pill bg-ink items-center py-3 shadow-card-soft ${submitting ? 'opacity-70' : 'active:bg-ink/90'}`} 
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-on-primary font-medium text-sm">
              {t("LoginPage_Button_SignIn", "Sign In")}
            </Text>
          )}
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}