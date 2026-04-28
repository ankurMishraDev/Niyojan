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

  AUTH_MOCK_MODE: z.string().optional().default("true"),
  MOCK_USER_ID: z.string().uuid().optional(),
  MOCK_USER_ROLE: z
    .enum(["superadmin", "ngo_admin", "field_worker", "volunteer"])
    .optional()
    .default("ngo_admin"),
  MOCK_USER_ORG_ID: z.string().uuid().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  GCP_MOCK_MODE: z.string().optional().default("true"),
  GCP_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default("niyojan-prototype"),
  GCP_SIGNED_URL_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  DOCUMENT_AI_LOCATION: z.string().default("us"),
  DOCUMENT_AI_PROCESSOR_ID: z.string().optional(),

  AI_PROVIDER_MODE: z.enum(["mock", "live"]).optional(),
  AI_MODE: z.enum(["mock", "live"]).optional(),
  GEMINI_API_KEY: z.string().optional(),
  VERTEX_LOCATION: z.string().default("us-central1"),
  VERTEX_DOCUMENT_MODEL: z.string().default("gemini-2.0-flash-001"),
  VERTEX_REASONING_MODEL: z.string().default("gemini-2.0-flash-001"),
  VERTEX_SURVEY_MODEL: z.string().default("gemini-2.0-flash-001"),

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

const resolveAiProviderMode = (
  aiProviderMode?: "mock" | "live",
  aiMode?: "mock" | "live",
) => {
  if (aiProviderMode) {
    return aiProviderMode;
  }

  if (aiMode) {
    return aiMode;
  }

  return "mock";
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
  DB_SSL: toBool(parsed.data.DB_SSL),
  AUTH_MOCK_MODE: toBool(parsed.data.AUTH_MOCK_MODE),
  GCP_MOCK_MODE: toBool(parsed.data.GCP_MOCK_MODE),
  CORS_ORIGINS: splitCsv(parsed.data.CORS_ORIGINS),
  AI_PROVIDER_MODE: resolveAiProviderMode(parsed.data.AI_PROVIDER_MODE, parsed.data.AI_MODE),
} as const;

const hasInlineFirebaseCreds = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);
const hasAnyGoogleCredentialSource = Boolean(
  env.GOOGLE_APPLICATION_CREDENTIALS || hasInlineFirebaseCreds,
);

if (!env.AUTH_MOCK_MODE && !hasAnyGoogleCredentialSource) {
  throw new Error(
    "Environment validation failed: live auth requires FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS",
  );
}

if (!env.GCP_MOCK_MODE && !hasAnyGoogleCredentialSource) {
  throw new Error(
    "Environment validation failed: live GCP access requires FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS",
  );
}

if (env.AI_PROVIDER_MODE === "live") {
  if (!env.GCP_PROJECT_ID) {
    throw new Error("Environment validation failed: AI live mode requires GCP_PROJECT_ID");
  }

  if (!env.DOCUMENT_AI_PROCESSOR_ID) {
    throw new Error("Environment validation failed: AI live mode requires DOCUMENT_AI_PROCESSOR_ID");
  }

  if (!hasAnyGoogleCredentialSource) {
    throw new Error(
      "Environment validation failed: AI live mode requires FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS",
    );
  }
}

export type AppEnv = typeof env;
