import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  API_PREFIX: z.string().default("/api"),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.string().optional().default("info"),

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().positive().optional().default(5432),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_SSL: z.string().optional().default("false"),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  GCP_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default("niyojan-prototype"),
  GCP_SIGNED_URL_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  DOCUMENT_AI_LOCATION: z.string().default("us"),
  DOCUMENT_AI_PROCESSOR_ID: z.string().optional(),
  DOCUMENT_AI_PROCESSOR_ID_OCR: z.string().optional(),
  DOCUMENT_AI_PROCESSOR_ID_FORM: z.string().optional(),

  VERTEX_LOCATION: z.string().default("us-central1"),
  VERTEX_GEMINI_MODEL: z.string().optional(),
  VERTEX_GEMINI_FAST_MODEL: z.string().optional(),
  VERTEX_DOCUMENT_MODEL: z.string().optional(),
  VERTEX_REASONING_MODEL: z.string().optional(),
  VERTEX_SURVEY_MODEL: z.string().optional(),

  MATCH_SKILL_WEIGHT: z.coerce.number().min(0).max(1).default(0.5),
  MATCH_AVAILABILITY_WEIGHT: z.coerce.number().min(0).max(1).default(0.3),
  MATCH_LOCATION_WEIGHT: z.coerce.number().min(0).max(1).default(0.2),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  API_INTERNAL_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => {
    return `${issue.path.join(".")}: ${issue.message}`;
  });
  throw new Error(`Environment validation failed:\n${details.join("\n")}`);
}

const toBool = (value: string) => value.toLowerCase() === "true";
const splitCsv = (value?: string) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

if (
  !parsed.data.DATABASE_URL &&
  (!parsed.data.DB_HOST || !parsed.data.DB_NAME || !parsed.data.DB_USER || !parsed.data.DB_PASSWORD)
) {
  throw new Error(
    "Environment validation failed: provide DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD",
  );
}

export const env = {
  ...parsed.data,
  DOCUMENT_AI_PROCESSOR_ID_FORM:
    parsed.data.DOCUMENT_AI_PROCESSOR_ID_FORM || parsed.data.DOCUMENT_AI_PROCESSOR_ID || undefined,
  DOCUMENT_AI_PROCESSOR_ID_OCR:
    parsed.data.DOCUMENT_AI_PROCESSOR_ID_OCR || parsed.data.DOCUMENT_AI_PROCESSOR_ID || undefined,
  VERTEX_DOCUMENT_MODEL:
    parsed.data.VERTEX_DOCUMENT_MODEL || parsed.data.VERTEX_GEMINI_MODEL || "gemini-2.0-flash-001",
  VERTEX_REASONING_MODEL:
    parsed.data.VERTEX_REASONING_MODEL || parsed.data.VERTEX_GEMINI_MODEL || "gemini-2.0-flash-001",
  VERTEX_SURVEY_MODEL:
    parsed.data.VERTEX_SURVEY_MODEL || parsed.data.VERTEX_GEMINI_FAST_MODEL || parsed.data.VERTEX_GEMINI_MODEL || "gemini-2.0-flash-001",
  DB_SSL: toBool(parsed.data.DB_SSL),
  CORS_ORIGINS: splitCsv(parsed.data.CORS_ORIGINS),
} as const;

const hasInlineFirebaseCreds = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);
const hasAnyGoogleCredentialSource = Boolean(
  env.GOOGLE_APPLICATION_CREDENTIALS || hasInlineFirebaseCreds,
);
const isTestEnv = env.NODE_ENV === "test";

if (env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
  throw new Error(
    `Environment validation failed: GOOGLE_APPLICATION_CREDENTIALS path not found: ${env.GOOGLE_APPLICATION_CREDENTIALS}`,
  );
}

if (!isTestEnv && !hasAnyGoogleCredentialSource) {
  throw new Error(
    "Environment validation failed: Firebase/GCP access requires FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS",
  );
}

if (!isTestEnv && !env.GCP_PROJECT_ID) {
  throw new Error("Environment validation failed: GCP_PROJECT_ID is required");
}

if (!isTestEnv && !env.DOCUMENT_AI_PROCESSOR_ID_FORM && !env.DOCUMENT_AI_PROCESSOR_ID_OCR) {
  throw new Error(
    "Environment validation failed: provide DOCUMENT_AI_PROCESSOR_ID_FORM and/or DOCUMENT_AI_PROCESSOR_ID_OCR",
  );
}

if (!env.GCS_BUCKET_NAME) {
  throw new Error("Environment validation failed: GCS_BUCKET_NAME is required");
}

export type AppEnv = typeof env;
