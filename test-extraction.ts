import { db } from './src/config/db';
import { documentAiService } from './src/modules/aiPipeline/documentAi.service';
import { geminiService } from './src/modules/aiPipeline/gemini.service';
import { getStorageClient, gcsBucketName } from './src/config/gcp';
import fs from 'fs';

async function run() {
  const gcsPath = 'tests/test_form.pdf';
  const storage = getStorageClient();
  await storage.bucket(gcsBucketName).upload('test_form.pdf', {
    destination: gcsPath
  });
  console.log("Uploaded to", gcsPath);

  const extraction = await documentAiService.extractCandidateFields({
    documentId: 'test-123',
    gcsPath,
    fileName: 'test_form.pdf',
    fileType: 'application/pdf'
  });

  console.log("Document AI raw:");
  console.log(JSON.stringify(extraction.rawResponse, null, 2)?.slice(0, 500));
  
  console.log("Document AI Output:");
  console.log(JSON.stringify(extraction.fields, null, 2));

  const mapping = await geminiService.normalizeAndMapFields(extraction.fields);
  console.log("Gemini Mapping:");
  console.log(JSON.stringify(mapping.mappedFields, null, 2));
  
  process.exit(0);
}
run();