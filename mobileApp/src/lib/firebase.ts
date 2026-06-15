import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  // Surface a clear error in development instead of a cryptic crash
  console.error(
    '[Firebase] EXPO_PUBLIC_FIREBASE_API_KEY or EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing. ' +
    'Ensure these env vars are set in your .env file (local) and in eas.json "env" block (EAS builds).'
  );
}

const firebaseConfig = {
  apiKey: apiKey ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: projectId ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

// Initialize Firebase — will only work properly when env vars are present
let app;
let firebaseAuth;

try {
  app = initializeApp(firebaseConfig);
  firebaseAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  console.error('[Firebase] Initialization failed:', e);
  // Export null so AuthProvider can handle it gracefully instead of crashing
  firebaseAuth = null;
}

export { firebaseAuth };
