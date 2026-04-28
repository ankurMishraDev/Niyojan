import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import { AuthenticatedUser } from "../../types/auth";
import { getPaginationParams } from "../../utils/pagination";
import { vertexService } from "../aiPipeline/vertex.service";

type SurveyStatus = "draft" | "submitted" | "analyzed";
type SupportedInputType = "text" | "number" | "boolean" | "select" | "multiselect" | "date" | "textarea";

type SurveyRow = {
	id: string;
	org_id: string;
	template_version_id: string;
	conducted_by: string | null;
	respondent_name: string | null;
	location_text: string | null;
	latitude: string | number | null;
	longitude: string | number | null;
	status: SurveyStatus;
	submitted_at: Date | null;
	created_at: Date;
	updated_at: Date;
};

type SurveyResponseRow = {
	id: string;
	survey_id: string;
	form_field_id: string;
	input_type: SupportedInputType;
	value_text: string | null;
	value_number: string | number | null;
	value_bool: boolean | null;
	value_json: unknown;
	created_at: Date;
	updated_at: Date;
	field_label: string;
	field_input_type: SupportedInputType;
	field_is_required: boolean;
	field_catalog_id: string | null;
	field_catalog_key: string | null;
	field_catalog_name: string | null;
	field_display_order: number;
};

type TemplateVersionContextRow = {
	id: string;
	template_id: string;
	status: string;
	is_published: boolean;
	template_org_id: string;
	template_name: string;
};

type FormFieldContextRow = {
	id: string;
	template_version_id: string;
	field_catalog_id: string | null;
	label: string;
	input_type: SupportedInputType;
	options_json: unknown;
	is_required: boolean;
	display_order: number;
	is_custom: boolean;
	field_catalog_key: string | null;
	field_catalog_name: string | null;
	field_catalog_category: string | null;
};

type SkillRow = {
	id: string;
	key: string;
	name: string;
};

type NeedRow = {
	id: string;
	org_id: string;
	survey_id: string;
	category: string;
	summary: string;
	urgency_score: string | number;
	priority_level: string;
	status: string;
	created_at: Date;
	updated_at: Date;
};

type CreateSurveyInput = {
	template_version_id: string;
	org_id?: string;
	respondent_name?: string;
	location_text?: string;
	latitude?: number | null;
	longitude?: number | null;
};

type ListSurveysQuery = {
	page?: string | number;
	pageSize?: string | number;
	org_id?: string;
	template_version_id?: string;
	conducted_by?: string;
	status?: SurveyStatus;
};

type SubmitSurveyResponseInput = {
	form_field_id: string;
	input_type: SupportedInputType;
	value_text?: string;
	value_number?: number;
	value_bool?: boolean;
	value_json?: unknown;
};

type SubmitSurveyInput = {
	responses: SubmitSurveyResponseInput[];
};

type NeedDraft = {
	category: string;
	summary: string;
	urgencyScore: number;
	priorityLevel: "high" | "medium" | "low";
	skillKeys: string[];
};

const fromJson = (value: unknown) => {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	return value;
};

const toNullableNumber = (value: string | number | null) => {
	if (value === null) {
		return null;
	}

	return Number(value);
};

const mapSurvey = (survey: SurveyRow) => {
	return {
		id: survey.id,
		orgId: survey.org_id,
		templateVersionId: survey.template_version_id,
		conductedBy: survey.conducted_by,
		respondentName: survey.respondent_name,
		locationText: survey.location_text,
		latitude: toNullableNumber(survey.latitude),
		longitude: toNullableNumber(survey.longitude),
		status: survey.status,
		submittedAt: survey.submitted_at,
		createdAt: survey.created_at,
		updatedAt: survey.updated_at,
	};
};

const mapSurveyResponse = (response: SurveyResponseRow) => {
	return {
		id: response.id,
		formFieldId: response.form_field_id,
		inputType: response.input_type,
		fieldLabel: response.field_label,
		fieldCatalogId: response.field_catalog_id,
		fieldCatalogKey: response.field_catalog_key,
		fieldCatalogName: response.field_catalog_name,
		isRequired: response.field_is_required,
		displayOrder: response.field_display_order,
		valueText: response.value_text,
		valueNumber: response.value_number === null ? null : Number(response.value_number),
		valueBool: response.value_bool,
		valueJson: fromJson(response.value_json),
	};
};

const mapNeed = (need: NeedRow) => {
	return {
		id: need.id,
		orgId: need.org_id,
		surveyId: need.survey_id,
		category: need.category,
		summary: need.summary,
		urgencyScore: Number(need.urgency_score),
		priorityLevel: need.priority_level,
		status: need.status,
		createdAt: need.created_at,
		updatedAt: need.updated_at,
	};
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const resolveTargetOrgId = (user: AuthenticatedUser, orgIdFromInput?: string) => {
	if (user.role === "superadmin") {
		if (!orgIdFromInput) {
			throw new AppError(400, "org_id is required for superadmin requests");
		}

		return orgIdFromInput;
	}

	if (!user.orgId) {
		throw new AppError(400, "Authenticated user organization context is missing");
	}

	if (orgIdFromInput && orgIdFromInput !== user.orgId) {
		throw new AppError(403, "Organization scope mismatch");
	}

	return user.orgId;
};

const getTemplateVersionContext = async (templateVersionId: string) => {
	return (await db("form_template_versions as v")
		.join("form_templates as t", "v.template_id", "t.id")
		.where("v.id", templateVersionId)
		.select(
			"v.id",
			"v.template_id",
			"v.status",
			"v.is_published",
			"t.org_id as template_org_id",
			"t.name as template_name",
		)
		.first()) as TemplateVersionContextRow | undefined;
};

const getSurveyRowById = async (surveyId: string) => {
	return (await db("surveys").where({ id: surveyId }).first()) as SurveyRow | undefined;
};

const getSurveyResponses = async (surveyId: string) => {
	return (await db("survey_responses as sr")
		.join("form_fields as ff", "sr.form_field_id", "ff.id")
		.leftJoin("field_catalog as fc", "ff.field_catalog_id", "fc.id")
		.where("sr.survey_id", surveyId)
		.orderBy("ff.display_order", "asc")
		.select(
			"sr.id",
			"sr.survey_id",
			"sr.form_field_id",
			"sr.input_type",
			"sr.value_text",
			"sr.value_number",
			"sr.value_bool",
			"sr.value_json",
			"sr.created_at",
			"sr.updated_at",
			"ff.label as field_label",
			"ff.input_type as field_input_type",
			"ff.is_required as field_is_required",
			"ff.field_catalog_id",
			"ff.display_order as field_display_order",
			"fc.key as field_catalog_key",
			"fc.name as field_catalog_name",
		)) as SurveyResponseRow[];
};

const getTemplateFields = async (templateVersionId: string) => {
	return (await db("form_fields as ff")
		.leftJoin("field_catalog as fc", "ff.field_catalog_id", "fc.id")
		.where("ff.template_version_id", templateVersionId)
		.orderBy("ff.display_order", "asc")
		.select(
			"ff.id",
			"ff.template_version_id",
			"ff.field_catalog_id",
			"ff.label",
			"ff.input_type",
			"ff.options_json",
			"ff.is_required",
			"ff.display_order",
			"ff.is_custom",
			"fc.key as field_catalog_key",
			"fc.name as field_catalog_name",
			"fc.category as field_catalog_category",
		)) as FormFieldContextRow[];
};

const hasMeaningfulValue = (inputType: SupportedInputType, response: SubmitSurveyResponseInput) => {
	if (inputType === "number") {
		return response.value_number !== undefined;
	}

	if (inputType === "boolean") {
		return response.value_bool !== undefined;
	}

	if (inputType === "multiselect") {
		return Array.isArray(response.value_json) && response.value_json.length > 0;
	}

	return typeof response.value_text === "string" && response.value_text.trim().length > 0;
};

const assertResponseMatchesField = (field: FormFieldContextRow, response: SubmitSurveyResponseInput) => {
	if (field.input_type !== response.input_type) {
		throw new AppError(422, `Input type mismatch for field ${field.label}`);
	}

	if (response.input_type === "number") {
		if (response.value_number === undefined) {
			throw new AppError(422, `Field ${field.label} requires value_number`);
		}
		return;
	}

	if (response.input_type === "boolean") {
		if (response.value_bool === undefined) {
			throw new AppError(422, `Field ${field.label} requires value_bool`);
		}
		return;
	}

	if (response.input_type === "multiselect") {
		if (!Array.isArray(response.value_json)) {
			throw new AppError(422, `Field ${field.label} requires value_json array`);
		}
		return;
	}

	if (!response.value_text || response.value_text.trim().length === 0) {
		throw new AppError(422, `Field ${field.label} requires value_text`);
	}
};

const normalizeResponseInsert = (surveyId: string, response: SubmitSurveyResponseInput) => {
	return {
		survey_id: surveyId,
		form_field_id: response.form_field_id,
		input_type: response.input_type,
		value_text: response.input_type === "number" || response.input_type === "boolean" || response.input_type === "multiselect"
			? null
			: response.value_text?.trim() || null,
		value_number: response.input_type === "number" ? response.value_number ?? null : null,
		value_bool: response.input_type === "boolean" ? response.value_bool ?? null : null,
		value_json: response.input_type === "multiselect" ? JSON.stringify(response.value_json ?? []) : null,
	};
};

const priorityFromUrgency = (urgencyScore: number): "high" | "medium" | "low" => {
	if (urgencyScore >= 0.85) {
		return "high";
	}

	if (urgencyScore >= 0.65) {
		return "medium";
	}

	return "low";
};

const maybePushNeed = (needs: NeedDraft[], need: NeedDraft) => {
	if (needs.some((item) => item.category === need.category && item.summary === need.summary)) {
		return;
	}

	needs.push(need);
};

const buildNeedsFromResponses = (survey: SurveyRow, responses: SurveyResponseRow[]) => {
	const byKey = new Map<string, SurveyResponseRow>();
	for (const response of responses) {
		if (response.field_catalog_key) {
			byKey.set(response.field_catalog_key, response);
		}
	}

	const needs: NeedDraft[] = [];
	const notes = byKey.get("notes")?.value_text || "";
	const urgentAssistance = fromJson(byKey.get("urgent_assistance_required")?.value_json);
	const medicalNeed = byKey.get("medical_need")?.value_bool === true;
	const waterAccess = byKey.get("water_access_type")?.value_text?.toLowerCase();

	if (medicalNeed) {
		maybePushNeed(needs, {
			category: "health_support",
			summary: notes.trim()
				? `Urgent medical outreach required. ${notes.trim()}`
				: `Urgent medical outreach required for survey ${survey.id}.`,
			urgencyScore: 0.92,
			priorityLevel: "high",
			skillKeys: ["first_aid", "triage"],
		});
	}

	if (waterAccess === "river" || waterAccess === "none" || waterAccess === "tanker") {
		maybePushNeed(needs, {
			category: "water_sanitation",
			summary: `Household reports unsafe or unreliable water access at ${survey.location_text || "reported location"}.`,
			urgencyScore: waterAccess === "river" || waterAccess === "none" ? 0.88 : 0.76,
			priorityLevel: waterAccess === "river" || waterAccess === "none" ? "high" : "medium",
			skillKeys: ["sanitation_support", "water_testing"],
		});
	}

	if (Array.isArray(urgentAssistance)) {
		const assistanceValues = urgentAssistance.filter((value): value is string => typeof value === "string");

		if (assistanceValues.includes("food")) {
			maybePushNeed(needs, {
				category: "food_support",
				summary: `Food distribution support requested${survey.location_text ? ` at ${survey.location_text}` : ""}.`,
				urgencyScore: 0.81,
				priorityLevel: "medium",
				skillKeys: ["food_distribution", "logistics"],
			});
		}

		if (assistanceValues.includes("shelter")) {
			maybePushNeed(needs, {
				category: "shelter_support",
				summary: `Shelter support requested${notes.trim() ? `: ${notes.trim()}` : " for this household."}`,
				urgencyScore: 0.8,
				priorityLevel: "medium",
				skillKeys: ["logistics", "community_mobilization"],
			});
		}

		if (assistanceValues.includes("counseling")) {
			maybePushNeed(needs, {
				category: "psychosocial_support",
				summary: `Counseling or psychosocial support requested for reported case.`,
				urgencyScore: 0.72,
				priorityLevel: "medium",
				skillKeys: ["counseling", "mental_health_support"],
			});
		}
		if (assistanceValues.includes("medical") && !medicalNeed) {
			maybePushNeed(needs, {
				category: "health_support",
				summary: `Medical assistance requested by respondent${survey.respondent_name ? ` ${survey.respondent_name}` : ""}.`,
				urgencyScore: 0.85,
				priorityLevel: "high",
				skillKeys: ["first_aid", "triage"],
			});
		}
	}

	if (needs.length === 0 && notes.trim()) {
		maybePushNeed(needs, {
			category: "general_support",
			summary: notes.trim(),
			urgencyScore: 0.65,
			priorityLevel: "medium",
			skillKeys: ["case_management", "documentation"],
		});
	}

	return needs;
};

export class SurveysService {
	async createSurvey(input: CreateSurveyInput, user: AuthenticatedUser) {
		const templateVersion = await getTemplateVersionContext(input.template_version_id);
		if (!templateVersion) {
			throw new AppError(404, "Form template version not found");
		}

		if (!templateVersion.is_published || templateVersion.status !== "published") {
			throw new AppError(409, "Survey must use a published form template version");
		}

		const orgId = resolveTargetOrgId(user, input.org_id);
		if (templateVersion.template_org_id !== orgId) {
			throw new AppError(403, "Template version belongs to another organization");
		}

		const [survey] = (await db("surveys")
			.insert({
				org_id: orgId,
				template_version_id: input.template_version_id,
				conducted_by: user.id,
				respondent_name: input.respondent_name?.trim() || null,
				location_text: input.location_text?.trim() || null,
				latitude: input.latitude ?? null,
				longitude: input.longitude ?? null,
				status: "draft",
			})
			.returning("*")) as SurveyRow[];

		await auditService.logEvent({
			orgId,
			eventType: "survey_created",
			entityType: "survey",
			entityId: survey.id,
			actorId: user.id,
			newValue: mapSurvey(survey),
			expectedNextState: "draft",
		});

		return {
			...mapSurvey(survey),
			templateName: templateVersion.template_name,
		};
	}

	async listSurveys(query: ListSurveysQuery, user: AuthenticatedUser) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);
		const baseQuery = db("surveys as s").leftJoin("form_template_versions as v", "s.template_version_id", "v.id");

		if (user.role === "superadmin") {
			if (query.org_id) {
				baseQuery.andWhere("s.org_id", query.org_id);
			}
		} else {
			if (!user.orgId) {
				throw new AppError(400, "Authenticated user organization context is missing");
			}

			baseQuery.andWhere("s.org_id", user.orgId);
		}

		if (query.template_version_id) {
			baseQuery.andWhere("s.template_version_id", query.template_version_id);
		}

		if (query.conducted_by) {
			baseQuery.andWhere("s.conducted_by", query.conducted_by);
		}

		if (query.status) {
			baseQuery.andWhere("s.status", query.status);
		}

		const rows = (await baseQuery
			.clone()
			.select("s.*")
			.orderBy("s.created_at", "desc")
			.offset(offset)
			.limit(pageSize)) as SurveyRow[];

		const countResult = (await baseQuery.clone().clearSelect().countDistinct({ count: "s.id" }).first()) as
			| { count: string }
			| undefined;

		return {
			items: rows.map(mapSurvey),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async getSurveyById(surveyId: string, user: AuthenticatedUser) {
		const survey = await getSurveyRowById(surveyId);
		if (!survey) {
			throw new AppError(404, "Survey not found");
		}

		assertOrgScope(user, survey.org_id);
		const responses = await getSurveyResponses(surveyId);

		return {
			...mapSurvey(survey),
			responses: responses.map(mapSurveyResponse),
		};
	}

	async submitSurvey(surveyId: string, input: SubmitSurveyInput, user: AuthenticatedUser) {
		const survey = await getSurveyRowById(surveyId);
		if (!survey) {
			throw new AppError(404, "Survey not found");
		}

		assertOrgScope(user, survey.org_id);
		if (survey.status === "analyzed") {
			throw new AppError(409, "Analyzed surveys cannot be resubmitted");
		}

		const templateFields = await getTemplateFields(survey.template_version_id);
		const fieldsById = new Map(templateFields.map((field) => [field.id, field]));
		const seenFieldIds = new Set<string>();

		for (const response of input.responses) {
			const field = fieldsById.get(response.form_field_id);
			if (!field) {
				throw new AppError(422, `Form field ${response.form_field_id} does not belong to this survey template`);
			}

			if (seenFieldIds.has(response.form_field_id)) {
				throw new AppError(422, `Duplicate response submitted for field ${field.label}`);
			}

			seenFieldIds.add(response.form_field_id);
			assertResponseMatchesField(field, response);
		}

		for (const field of templateFields) {
			if (!field.is_required) {
				continue;
			}

			const response = input.responses.find((item) => item.form_field_id === field.id);
			if (!response || !hasMeaningfulValue(field.input_type, response)) {
				throw new AppError(422, `Required field ${field.label} is missing a value`);
			}
		}

		await db.transaction(async (trx) => {
			await trx("survey_responses").where({ survey_id: surveyId }).del();
			await trx("survey_responses").insert(
				input.responses.map((response) => normalizeResponseInsert(surveyId, response)),
			);

			await trx("surveys").where({ id: surveyId }).update({
				status: "submitted",
				submitted_at: new Date(),
				updated_at: new Date(),
			});

			await auditService.writeEvent(trx, {
				orgId: survey.org_id,
				eventType: "survey_submitted",
				entityType: "survey",
				entityId: survey.id,
				actorId: user.id,
				oldValue: { status: survey.status },
				newValue: {
					status: "submitted",
					responseCount: input.responses.length,
					responseFieldIds: input.responses.map((response) => response.form_field_id),
				},
				expectedNextState: "submitted",
			});
		});

		return this.getSurveyById(surveyId, user);
	}

	async analyzeNeeds(surveyId: string, user: AuthenticatedUser) {
		const survey = await getSurveyRowById(surveyId);
		if (!survey) {
			throw new AppError(404, "Survey not found");
		}

		assertOrgScope(user, survey.org_id);
		if (survey.status === "draft") {
			throw new AppError(409, "Draft surveys must be submitted before needs analysis");
		}

		const existingNeeds = (await db("needs_analysis")
			.where({ survey_id: surveyId })
			.orderBy("created_at", "asc")) as NeedRow[];
		if (existingNeeds.length > 0) {
			return {
				survey: mapSurvey(survey),
				needs: existingNeeds.map(mapNeed),
				createdCount: 0,
			};
		}

		const responses = await getSurveyResponses(surveyId);
		if (responses.length === 0) {
			throw new AppError(409, "Survey has no responses to analyze");
		}

		const fallbackDrafts = buildNeedsFromResponses(survey, responses);
		const uniqueSkillKeys = Array.from(new Set(fallbackDrafts.flatMap((draft) => draft.skillKeys)));
		const skillRows = uniqueSkillKeys.length
			? ((await db("skills").whereIn("key", uniqueSkillKeys).select("id", "key", "name")) as SkillRow[])
			: [];
		const skillsByKey = new Map(skillRows.map((skill) => [skill.key, skill]));
		const aiResult = await vertexService.analyzeSurveyNeeds({
			surveyId: survey.id,
			locationText: survey.location_text,
			respondentName: survey.respondent_name,
			responses: responses.map((response) => ({
				fieldLabel: response.field_label,
				fieldCatalogKey: response.field_catalog_key,
				inputType: response.input_type,
				valueText: response.value_text,
				valueNumber: response.value_number === null ? null : Number(response.value_number),
				valueBool: response.value_bool,
				valueJson: fromJson(response.value_json),
			})),
			availableSkillKeys: uniqueSkillKeys,
			fallbackNeeds: fallbackDrafts,
		});
		const drafts =
			aiResult.output.length === 0 && fallbackDrafts.length > 0
				? fallbackDrafts
				: aiResult.output;

		const createdNeeds = await db.transaction(async (trx) => {
			const created: NeedRow[] = [];

			for (const draft of drafts) {
				const [need] = (await trx("needs_analysis")
					.insert({
						org_id: survey.org_id,
						survey_id: survey.id,
						category: draft.category,
						summary: draft.summary,
						urgency_score: Number(draft.urgencyScore.toFixed(2)),
						priority_level: draft.priorityLevel,
						status: "open",
					})
					.returning("*")) as NeedRow[];

				created.push(need);

				const needSkills = draft.skillKeys
					.map((skillKey) => skillsByKey.get(skillKey))
					.filter((skill): skill is SkillRow => Boolean(skill))
					.map((skill) => ({
						need_id: need.id,
						skill_id: skill.id,
					}));

				if (needSkills.length > 0) {
					await trx("need_skills").insert(needSkills);
				}

				await auditService.writeEvent(trx, {
					orgId: survey.org_id,
					eventType: "need_created_from_survey",
					entityType: "need",
					entityId: need.id,
					actorId: user.id,
					newValue: {
						id: need.id,
						surveyId: survey.id,
						category: need.category,
						summary: need.summary,
						urgencyScore: Number(need.urgency_score),
						priorityLevel: need.priority_level,
						status: need.status,
						skillIds: needSkills.map((skill) => skill.skill_id),
					},
					metadata: {
						analysisProvider: aiResult.providerName,
						analysisModel: aiResult.model,
						analysisValidationStatus: aiResult.validationStatus,
						analysisFallbackReason: aiResult.fallbackReason,
					},
					expectedNextState: need.status,
				});
			}

			await trx("surveys").where({ id: survey.id }).update({
				status: "analyzed",
				updated_at: new Date(),
			});

			await auditService.writeEvent(trx, {
				orgId: survey.org_id,
				eventType: "survey_analyzed",
				entityType: "survey",
				entityId: survey.id,
				actorId: user.id,
				oldValue: { status: survey.status },
				newValue: { status: "analyzed", createdNeedCount: created.length },
				metadata: {
					analysisProvider: aiResult.providerName,
					analysisModel: aiResult.model,
					analysisValidationStatus: aiResult.validationStatus,
					analysisFallbackReason: aiResult.fallbackReason,
					analysisValidationErrors: aiResult.validationErrors,
				},
				expectedNextState: "analyzed",
			});

			return created;
		});

		const refreshedSurvey = (await getSurveyRowById(surveyId)) as SurveyRow;

		return {
			survey: mapSurvey(refreshedSurvey),
			needs: createdNeeds.map(mapNeed),
			createdCount: createdNeeds.length,
		};
	}
}

export const surveysService = new SurveysService();
