import { getStorageClient, gcsBucketName } from './src/config/gcp';

async function configureBucketCors() {
  const storage = getStorageClient();
  const maxAgeSeconds = 3600;
  const method = ['GET', 'POST', 'PUT', 'OPTIONS', 'DELETE'];
  const origin = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];
  const responseHeader = ['Content-Type', 'Authorization', 'x-goog-meta-org-id', 'Access-Control-Allow-Origin', '*'];

  await storage.bucket(gcsBucketName).setCorsConfiguration([
    {
      maxAgeSeconds,
      method,
      origin,
      responseHeader,
    },
  ]);

  console.log(`Bucket ${gcsBucketName} was updated with a CORS config to allow requests from ${origin.join(', ')}`);
}

configureBucketCors().catch(console.error).then(() => process.exit(0));