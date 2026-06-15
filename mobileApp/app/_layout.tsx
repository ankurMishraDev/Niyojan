import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import '../src/i18n';
import { initDb } from '../src/db/schema';
import "../global.css";
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Created outside the component so it is stable and never recreated on re-render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// initDb uses execSync internally — safe to call at module level before first render.
// This avoids the blank-screen boot race that happens when returning null from the component
// while waiting for a useEffect to fire on a physical device.
initDb();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fcfcfc' }}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
            </Stack>
          </SafeAreaView>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}