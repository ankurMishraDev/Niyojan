import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = "niyojan_access_token";
const PROFILE_KEY = "niyojan_user_profile";

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

/** Persist the user profile so the app can work offline after the first login. */
export async function saveUserProfile(profile: unknown): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Load the most recently saved profile from local storage. Returns null if none. */
export async function loadCachedProfile<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Remove the cached profile — call this on sign-out. */
export async function clearUserProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
