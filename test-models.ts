import { getGoogleAccessToken } from './src/config/googleCredentials';

async function run() {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/projects/helical-button-486909-m8/locations/us-central1/publishers/google/models`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const models = data.models ? data.models.map((m: any) => m.name).slice(0, 10) : data;
  console.log(models);
}
run();