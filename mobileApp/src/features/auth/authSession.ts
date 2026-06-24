import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth } from '../lib/firebase';

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

/**
 * Returns auth headers with a fresh Firebase token.
 *
 * Firebase ID tokens expire every 60 minutes. Reading from AsyncStorage gives
 * a stale token after the app sits in the background. Instead, we ask Firebase
 * directly — it returns the cached token if still valid, or silently fetches a
 * new one if expired. This prevents 401 errors during sync uploads.
 */
export async function buildAuthHeaders(): Promise<{ Authorization: string } | Record<string, never>> {
  // PRIMARY: Get a fresh (or cached-but-valid) token from Firebase
  try {
    if (firebaseAuth?.currentUser) {
      // getIdToken(false) = use cache if valid, auto-refresh silently if not
      const freshToken = await firebaseAuth.currentUser.getIdToken(false);
      // Keep AsyncStorage in sync for offline fallback reads
      await AsyncStorage.setItem(TOKEN_KEY, freshToken);
      return { Authorization: `Bearer ${freshToken}` };
    }
  } catch (e) {
    // Firebase unavailable (cold start, offline, not yet initialized) — fall through
    console.warn('[AUTH] Could not get fresh token from Firebase:', e);
  }

  // FALLBACK: Use cached token from AsyncStorage (e.g. Firebase not yet initialized)
  const token = await AsyncStorage.getItem(TOKEN_KEY);
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
