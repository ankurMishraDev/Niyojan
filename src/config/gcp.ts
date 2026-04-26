import { Storage } from "@google-cloud/storage";
import { env } from "./env";

let storageClient: Storage | null = null;

type SignedUrlResult = {
  url: string;
  expiresAt: string;
};

export const getStorageClient = () => {
  if (env.GCP_MOCK_MODE) {
    return null;
  }

  if (!storageClient) {
    storageClient = new Storage({
      projectId: env.GCP_PROJECT_ID,
    });
  }

  return storageClient;
};

export const gcsBucketName = env.GCS_BUCKET_NAME;
export const gcsSignedUrlExpirySeconds = env.GCP_SIGNED_URL_EXPIRY_SECONDS;

const getSignedExpiry = () => {
  return Date.now() + gcsSignedUrlExpirySeconds * 1000;
};

const buildMockSignedUrl = (action: "read" | "write", gcsPath: string): SignedUrlResult => {
  const expires = getSignedExpiry();
  const encodedPath = encodeURIComponent(gcsPath);

  return {
    url: `https://mock-gcs.local/${gcsBucketName}/${encodedPath}?action=${action}&expires=${expires}`,
    expiresAt: new Date(expires).toISOString(),
  };
};

export const generateSignedUploadUrl = async (
  gcsPath: string,
  contentType: string,
): Promise<SignedUrlResult> => {
  const storage = getStorageClient();

  if (!storage) {
    return buildMockSignedUrl("write", gcsPath);
  }

  const expires = getSignedExpiry();
  const [url] = await storage.bucket(gcsBucketName).file(gcsPath).getSignedUrl({
    version: "v4",
    action: "write",
    expires,
    contentType,
  });

  return {
    url,
    expiresAt: new Date(expires).toISOString(),
  };
};

export const generateSignedReadUrl = async (gcsPath: string): Promise<SignedUrlResult> => {
  const storage = getStorageClient();

  if (!storage) {
    return buildMockSignedUrl("read", gcsPath);
  }

  const expires = getSignedExpiry();
  const [url] = await storage.bucket(gcsBucketName).file(gcsPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires,
  });

  return {
    url,
    expiresAt: new Date(expires).toISOString(),
  };
};
