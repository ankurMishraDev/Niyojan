import admin from "firebase-admin";
import { env } from "./env";
import { loadGoogleServiceAccount } from "./googleCredentials";

const canInitWithInlineCreds =
	!!env.FIREBASE_PROJECT_ID &&
	!!env.FIREBASE_CLIENT_EMAIL &&
	!!env.FIREBASE_PRIVATE_KEY;

export const initializeFirebaseAdmin = (options?: { ignoreMockMode?: boolean }) => {
	if (admin.apps.length > 0) {
		return admin.app();
	}

	if (env.AUTH_MOCK_MODE && !options?.ignoreMockMode) {
		throw new Error("Firebase auth is disabled in AUTH_MOCK_MODE");
	}

	if (canInitWithInlineCreds) {
		admin.initializeApp({
			credential: admin.credential.cert({
				projectId: env.FIREBASE_PROJECT_ID,
				clientEmail: env.FIREBASE_CLIENT_EMAIL,
				privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
			}),
		});
		return admin.app();
	}

	const serviceAccount = loadGoogleServiceAccount();
	const resolvedProjectId =
		env.FIREBASE_PROJECT_ID ||
		env.GCP_PROJECT_ID ||
		(typeof serviceAccount.project_id === "string" ? serviceAccount.project_id : undefined);
	admin.initializeApp({
		projectId: resolvedProjectId,
		credential: admin.credential.cert({
			projectId: resolvedProjectId,
			clientEmail: serviceAccount.client_email as string,
			privateKey: (serviceAccount.private_key as string).replace(/\\n/g, "\n"),
		}),
	});

	return admin.app();
};

export const getFirebaseAuth = (options?: { ignoreMockMode?: boolean }) => {
	initializeFirebaseAdmin(options);
	return admin.auth();
};
