import { env } from "../../config/env";

export type ExtractedCandidateField = {
	label: string;
	inputType: string;
	options?: string[];
	required: boolean;
	confidence: number;
};

export type DocumentExtractionInput = {
	documentId: string;
	gcsPath: string;
	fileName: string;
	fileType: string;
};

export type DocumentExtractionResult = {
	providerMode: "mock" | "live";
	model: string;
	fields: ExtractedCandidateField[];
};

const mockHouseholdFields: ExtractedCandidateField[] = [
	{
		label: "Household Size",
		inputType: "number",
		required: true,
		confidence: 0.97,
	},
	{
		label: "Respondent Age",
		inputType: "number",
		required: true,
		confidence: 0.94,
	},
	{
		label: "Respondent Gender",
		inputType: "select",
		options: ["male", "female", "other", "prefer_not_to_say"],
		required: true,
		confidence: 0.91,
	},
	{
		label: "Primary Water Access",
		inputType: "select",
		options: ["piped", "well", "tanker", "river", "none"],
		required: true,
		confidence: 0.89,
	},
	{
		label: "Immediate Medical Need",
		inputType: "boolean",
		required: true,
		confidence: 0.88,
	},
	{
		label: "Urgent Assistance Required",
		inputType: "multiselect",
		options: ["food", "medical", "shelter", "water", "counseling"],
		required: true,
		confidence: 0.86,
	},
	{
		label: "Case Notes",
		inputType: "textarea",
		required: false,
		confidence: 0.84,
	},
	{
		label: "Consent Given",
		inputType: "boolean",
		required: true,
		confidence: 0.98,
	},
];

const mockGeneralFields: ExtractedCandidateField[] = [
	{
		label: "Respondent Name",
		inputType: "text",
		required: true,
		confidence: 0.87,
	},
	{
		label: "Village Name",
		inputType: "text",
		required: true,
		confidence: 0.83,
	},
	{
		label: "Urgent Assistance Required",
		inputType: "multiselect",
		options: ["food", "medical", "shelter", "water", "counseling"],
		required: true,
		confidence: 0.82,
	},
	{
		label: "Case Notes",
		inputType: "textarea",
		required: false,
		confidence: 0.8,
	},
];

const chooseMockFields = (fileName: string) => {
	const normalized = fileName.toLowerCase();

	if (normalized.includes("household") || normalized.includes("assessment")) {
		return mockHouseholdFields;
	}

	return mockGeneralFields;
};

export class DocumentAiService {
	async extractCandidateFields(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
		const fields = chooseMockFields(input.fileName);

		return {
			providerMode: env.AI_PROVIDER_MODE,
			model: env.AI_PROVIDER_MODE === "mock" ? "mock-document-extractor-v1" : "live-fallback-mock-v1",
			fields,
		};
	}
}

export const documentAiService = new DocumentAiService();
