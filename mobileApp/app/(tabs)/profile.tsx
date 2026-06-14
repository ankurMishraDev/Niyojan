import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { LogOut, Globe, CircleHelp } from 'lucide-react-native';
import i18n from '../../src/i18n';
import CustomDropdown from '../../src/components/CustomDropdown';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'ur', label: 'اُردُو (Urdu)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'ml', label: 'മലയാളം (Malayalam)' },
  { value: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { value: 'as', label: 'অসমীয়া (Assamese)' },
  { value: 'mai', label: 'मैथिली (Maithili)' },
  { value: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)' },
  { value: 'ks', label: 'कॉशुर (Kashmiri)' },
];

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, setUser } = useAppStore();

  const handleLogout = () => {
    setUser(null);
    router.replace('/login');
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <ScrollView className="flex-1 bg-canvas-soft-2 p-4">
      <View className="bg-canvas rounded-lg p-6 shadow-card-soft mb-6 items-center">
        <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4">
          <Text className="text-3xl text-on-primary font-bold">{user?.name?.charAt(0) || 'U'}</Text>
        </View>
        <Text className="text-2xl font-bold text-ink">{user?.name}</Text>
        <Text className="text-mute">{user?.email}</Text>
        <View className="bg-canvas-soft-2 px-3 py-1 rounded-pill mt-2">
          <Text className="text-sm font-medium uppercase text-mute tracking-wider">{user?.role}</Text>
        </View>
      </View>

      <Text className="font-bold text-ink mb-2 uppercase text-xs tracking-wider ml-1">{t('profile.language', 'Language')}</Text>
      <View className="mb-6 z-50">
        <CustomDropdown
          items={LANGUAGES}
          selectedValue={i18n.language}
          onValueChange={(itemValue) => changeLanguage(itemValue)}
          placeholder="Select Language"
        />
      </View>

      <Text className="font-bold text-ink mb-2 uppercase text-xs tracking-wider ml-1">{t('profile.account', 'Account')}</Text>
      <View className="bg-canvas rounded-lg shadow-card-soft mb-6 overflow-hidden">
        <Pressable className="flex-row items-center p-4 border-b border-hairline" onPress={() => {}}>
          <CircleHelp size={20} color="#888888" className="mr-3" />
          <Text className="text-ink">{t('nav.help', 'Help & Support')}</Text>
        </Pressable>
        <Pressable className="flex-row items-center p-4" onPress={handleLogout}>
          <LogOut size={20} color="#ee0000" className="mr-3" />
          <Text className="text-danger font-medium">{t('profile.logout', 'Log Out')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}