const get = (key: string, fallback = "") => {
  const value = import.meta.env[key];
  if (typeof value === "string") {
    return value;
  }

  return fallback;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeApiBaseUrl = (value: string) => {
  const fallback = value.trim() || "/api";

  if (!import.meta.env.DEV || typeof window === "undefined" || !/^https?:\/\//i.test(fallback)) {
    return trimTrailingSlash(fallback);
  }

  try {
    const target = new URL(fallback);
    const current = new URL(window.location.href);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

    if (localHosts.has(target.hostname) && localHosts.has(current.hostname)) {
      return "/api";
    }
  } catch {
    return trimTrailingSlash(fallback);
  }

  return trimTrailingSlash(fallback);
};

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(get("VITE_API_BASE_URL", "/api")),
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
