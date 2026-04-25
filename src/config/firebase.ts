import admin from "firebase-admin";
import fs from "node:fs";
import { env } from "./env";

const canInitWithInlineCreds =
  !!env.FIREBASE_PROJECT_ID &&
  !!env.FIREBASE_CLIENT_EMAIL &&
  !!env.FIREBASE_PRIVATE_KEY;

const assertCredentialFileLooksLikeServiceAccount = () => {
  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }

  if (!fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS path not found: ${env.GOOGLE_APPLICATION_CREDENTIALS}`,
    );
  }

  const content = fs.readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
  const parsed = JSON.parse(content) as Record<string, unknown>;

  if (parsed.web && !parsed.type) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS points to an OAuth web client JSON. Firebase Admin requires a service_account key JSON.",
    );
  }
};

if (!env.AUTH_MOCK_MODE && admin.apps.length === 0) {
  if (canInitWithInlineCreds) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    assertCredentialFileLooksLikeServiceAccount();

    admin.initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  }
}

export const getFirebaseAuth = () => {
  if (env.AUTH_MOCK_MODE) {
    throw new Error("Firebase auth is disabled in AUTH_MOCK_MODE");
  }

  if (admin.apps.length === 0) {
    throw new Error(
      "Firebase Admin is not initialized. Provide FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or valid GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }

  return admin.auth();
};
