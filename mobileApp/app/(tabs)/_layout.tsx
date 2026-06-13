import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, FileText, MessageSquare, User as UserIcon } from 'lucide-react-native';
import { useAuth } from '../../src/features/auth/useAuth';

export default function TabLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const isVolunteer = user?.role === 'volunteer';

  return (
    <Tabs screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: '#171717',
      tabBarInactiveTintColor: '#888888',
      headerStyle: {
        backgroundColor: '#ffffff',
      },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard', 'Dashboard'),
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
          href: isVolunteer ? null : '/(tabs)/dashboard',
        }}
      />
      <Tabs.Screen
        name="forms"
        options={{
          title: t('nav.forms', 'Forms'),
          tabBarIcon: ({ color }) => <FileText color={color} size={24} />,
          href: isVolunteer ? null : '/(tabs)/forms',
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: t('nav.assignments', 'Assignments'),
          tabBarIcon: ({ color }) => <FileText color={color} size={24} />,
          href: isVolunteer ? '/(tabs)/assignments' : null,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: t('nav.feedback', 'Feedback'),
          tabBarIcon: ({ color }) => <MessageSquare color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile', 'Profile'),
          tabBarIcon: ({ color }) => <UserIcon color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}