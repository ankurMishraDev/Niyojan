import { describe, expect, it } from "vitest";
import { documentReasoningSchema, parseStructuredJson } from "../src/modules/aiPipeline/ai.schemas";

describe("parseStructuredJson", () => {
	it("parses fenced JSON payloads", () => {
		const result = parseStructuredJson(
			[
				"```json",
				JSON.stringify({
					urgencyScore: 82,
					urgencyLabel: "high",
					urgencyReasons: ["medical urgency"],
					urgencyEvidenceRefs: ["p1:b1"],
					needCategory: "health_support",
					needSubcategory: null,
					recommendedSkillKeys: ["triage"],
					recommendedAction: "Escalate to medical team",
					reasoningConfidence: 0.81,
					verificationRisk: "medium",
					verificationRiskReasons: ["single source document"],
				}),
				"```",
			].join("\n"),
			documentReasoningSchema,
		);

		expect(result.urgencyScore).toBe(82);
		expect(result.recommendedSkillKeys).toEqual(["triage"]);
	});

	it("throws on invalid structured output", () => {
		expect(() =>
			parseStructuredJson(
				JSON.stringify({
					urgencyScore: 120,
					urgencyLabel: "high",
				}),
				documentReasoningSchema,
			),
		).toThrow();
	});
});
