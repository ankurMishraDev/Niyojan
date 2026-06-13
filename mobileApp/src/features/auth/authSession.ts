import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = "niyojan_access_token";

export async function setAccessToken(token: string | null) {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getAccessToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function buildAuthHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
