import { createSign } from "node:crypto";
import fs from "node:fs";
import { env } from "./env";

type ServiceAccountJson = {
	type?: string;
	project_id?: string;
	client_email?: string;
	private_key?: string;
	[key: string]: unknown;
};

type AccessTokenCacheEntry = {
	token: string;
	expiresAt: number;
};

let cachedServiceAccount: ServiceAccountJson | null = null;
let cachedAccessToken: AccessTokenCacheEntry | null = null;

const inlineServiceAccountAvailable =
	!!env.FIREBASE_PROJECT_ID &&
	!!env.FIREBASE_CLIENT_EMAIL &&
	!!env.FIREBASE_PRIVATE_KEY;

const normalizePrivateKey = (value?: string) => value?.replace(/\\n/g, "\n");

const assertServiceAccountShape = (payload: ServiceAccountJson) => {
	if (payload.web && !payload.type) {
		throw new Error(
			"GOOGLE_APPLICATION_CREDENTIALS points to an OAuth web client JSON. A service_account key JSON is required.",
		);
	}

	if (!payload.client_email || !payload.private_key) {
		throw new Error("Google service account credentials are incomplete");
	}
};

export const hasGoogleServiceAccountConfig = () => {
	return Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || inlineServiceAccountAvailable);
};

export const loadGoogleServiceAccount = () => {
	if (cachedServiceAccount) {
		return cachedServiceAccount;
	}

	if (env.GOOGLE_APPLICATION_CREDENTIALS) {
		if (!fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
			throw new Error(
				`GOOGLE_APPLICATION_CREDENTIALS path not found: ${env.GOOGLE_APPLICATION_CREDENTIALS}`,
			);
		}

		const parsed = JSON.parse(
			fs.readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"),
		) as ServiceAccountJson;
		assertServiceAccountShape(parsed);
		cachedServiceAccount = parsed;
		return parsed;
	}

	if (!inlineServiceAccountAvailable) {
		throw new Error(
			"Provide FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS for live Google Cloud access.",
		);
	}

	cachedServiceAccount = {
		type: "service_account",
		project_id: env.GCP_PROJECT_ID || env.FIREBASE_PROJECT_ID,
		client_email: env.FIREBASE_CLIENT_EMAIL,
		private_key: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
	};

	return cachedServiceAccount;
};

const encodeJwtSegment = (value: unknown) =>
	Buffer.from(JSON.stringify(value)).toString("base64url");

export const getGoogleAccessToken = async () => {
	if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
		return cachedAccessToken.token;
	}

	const serviceAccount = loadGoogleServiceAccount();
	const now = Math.floor(Date.now() / 1000);
	const header = {
		alg: "RS256",
		typ: "JWT",
	};
	const claimSet = {
		iss: serviceAccount.client_email,
		scope: "https://www.googleapis.com/auth/cloud-platform",
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
	};
	const unsignedToken = `${encodeJwtSegment(header)}.${encodeJwtSegment(claimSet)}`;
	const signer = createSign("RSA-SHA256");
	signer.update(unsignedToken);
	signer.end();
	const signature = signer.sign(serviceAccount.private_key || "", "base64url");

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: `${unsignedToken}.${signature}`,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to obtain Google access token (${response.status})`);
	}

	const payload = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};

	cachedAccessToken = {
		token: payload.access_token,
		expiresAt: Date.now() + payload.expires_in * 1000,
	};

	return cachedAccessToken.token;
};
