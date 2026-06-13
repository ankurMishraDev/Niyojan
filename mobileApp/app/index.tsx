import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { useAuth } from '../src/features/auth/useAuth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { checkConnectivity } = useAppStore();
  const { status, user } = useAuth();

  useEffect(() => {
    checkConnectivity();
  }, [checkConnectivity]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#171717" />
      </View>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Redirect href="/login" />;
  }

  if (user.role === 'volunteer') {
    return <Redirect href="/(tabs)/assignments" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}