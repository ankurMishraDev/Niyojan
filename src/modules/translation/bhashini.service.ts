import { env } from "../../config/env";

interface PipelineConfig {
  pipelineTasks: Array<{
    taskType: string;
    config: {
      language: {
        sourceLanguage: string;
        targetLanguage: string;
      };
    };
  }>;
  pipelineRequestConfig: {
    pipelineId: string;
  };
}

export class BhashiniService {
  private pipelineId = "64392f96daac500b55c543cd";

  async translate(text: string, sourceLang: string, targetLang: string = "en"): Promise<string> {
    if (sourceLang === targetLang) {
      return text;
    }

    try {
      // Use standard fetch API (Node 18+) instead of axios
      const configRes = await fetch("https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "userID": env.BHASHINI_USER_ID || "",
          "ulcaApiKey": env.BHASHINI_API_KEY || "",
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: "translation",
              config: {
                language: { sourceLanguage: sourceLang, targetLanguage: targetLang },
              },
            },
          ],
          pipelineRequestConfig: { pipelineId: this.pipelineId },
        } as PipelineConfig),
      });

      if (!configRes.ok) {
        throw new Error(`Pipeline config fetch failed: ${configRes.statusText}`);
      }

      const config = await configRes.json();
      
      const callbackUrl = config?.pipelineInferenceAPIEndPoint?.callbackUrl;
      const serviceId = config?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
      const authHeader = config?.pipelineInferenceAPIEndPoint?.inferenceApiKey?.name || "Authorization";

      if (!callbackUrl || !serviceId) {
        throw new Error("Missing callbackUrl or serviceId in Bhashini pipeline response.");
      }

      const inferenceRes = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [authHeader]: env.BHASHINI_INFERENCE_KEY || "",
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: "translation",
              config: {
                language: { sourceLanguage: sourceLang, targetLanguage: targetLang },
                serviceId,
              },
            },
          ],
          inputData: {
            input: [{ source: text }],
          },
        }),
      });

      if (!inferenceRes.ok) {
        throw new Error(`Pipeline inference fetch failed: ${inferenceRes.statusText}`);
      }

      const inferenceResult = await inferenceRes.json();
      return inferenceResult?.pipelineResponse?.[0]?.output?.[0]?.target || text;
    } catch (error) {
      console.error("[Bhashini] Translation error:", error);
      // Fallback gracefully to original text
      return text;
    }
  }
}

export const bhashiniService = new BhashiniService();
