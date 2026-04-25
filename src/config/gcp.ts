import { Storage } from "@google-cloud/storage";
import { env } from "./env";

let storageClient: Storage | null = null;

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
