import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import '../src/i18n';
import { initDb } from '../src/db/schema';
import '../global.css';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/features/auth/AuthProvider';

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    initDb();
    setDbInitialized(true);
  }, []);

  if (!dbInitialized) {
    return null; 
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </AuthProvider>
  );
}