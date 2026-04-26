import { env } from "../../config/env";

export class VertexService {
	getProviderMetadata() {
		return {
			mode: env.AI_PROVIDER_MODE,
			location: env.VERTEX_LOCATION,
			provider: env.AI_PROVIDER_MODE === "mock" ? "mock-vertex" : "vertex-ai-live",
		};
	}

	computeUrgencyHint(text: string) {
		const lower = text.toLowerCase();

		if (
			lower.includes("urgent") ||
			lower.includes("critical") ||
			lower.includes("immediate") ||
			lower.includes("medical")
		) {
			return { urgencyScore: 0.9, priorityLevel: "high" };
		}

		if (lower.includes("soon") || lower.includes("limited") || lower.includes("damaged")) {
			return { urgencyScore: 0.7, priorityLevel: "medium" };
		}

		return { urgencyScore: 0.45, priorityLevel: "low" };
	}
}

export const vertexService = new VertexService();
