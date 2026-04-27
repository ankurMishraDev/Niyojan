const get = (key: string, fallback = "") => {
  const value = import.meta.env[key];
  if (typeof value === "string") {
    return value;
  }

  return fallback;
};

const truthy = (value: string) => value.toLowerCase() === "true";

export const env = {
  apiBaseUrl: get("VITE_API_BASE_URL", "http://localhost:8080/api"),
  enableDevMockAuth: truthy(get("VITE_ENABLE_DEV_MOCK_AUTH", "true")),
  mockUserId: get("VITE_MOCK_USER_ID", "10000000-0000-4000-8000-000000000002"),
  mockRole: get("VITE_MOCK_USER_ROLE", "ngo_admin"),
  mockOrgId: get("VITE_MOCK_USER_ORG_ID", "11111111-1111-4111-8111-111111111111"),
  mockFirebaseUid: get("VITE_MOCK_FIREBASE_UID", "firebase-ngo-admin-a-001"),
  firebaseApiKey: get("VITE_FIREBASE_API_KEY"),
  firebaseAuthDomain: get("VITE_FIREBASE_AUTH_DOMAIN"),
  firebaseProjectId: get("VITE_FIREBASE_PROJECT_ID"),
  firebaseStorageBucket: get("VITE_FIREBASE_STORAGE_BUCKET"),
  firebaseMessagingSenderId: get("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  firebaseAppId: get("VITE_FIREBASE_APP_ID"),
};

export const hasFirebaseConfig = Boolean(
  env.firebaseApiKey &&
    env.firebaseAuthDomain &&
    env.firebaseProjectId &&
    env.firebaseStorageBucket &&
    env.firebaseMessagingSenderId &&
    env.firebaseAppId,
);
