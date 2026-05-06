import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import { AuthenticatedUser } from "../../types/auth";
import { getPaginationParams } from "../../utils/pagination";
import { matchingService } from "../matching/matching.service";

type AssignmentStatus = "suggested" | "accepted" | "in_progress" | "completed" | "cancelled";

type AssignmentRow = {
	id: string;
	org_id: string;
	need_id: string;
	volunteer_id: string;
	match_score: string | number;
	match_reason_json: unknown;
	status: AssignmentStatus;
	assigned_at: Date | null;
	completed_at: Date | null;
	created_at: Date;
	updated_at: Date;
	need_survey_id?: string;
	need_category?: string;
	need_summary?: string;
	need_priority_level?: string;
	volunteer_user_id?: string;
	volunteer_location_text?: string | null;
	volunteer_availability_status?: string;
	volunteer_name?: string;
	volunteer_email?: string;
};

type NeedRow = {
	id: string;
	org_id: string;
	survey_id: string;
	status: string;
	summary: string;
	category: string;
	priority_level: string;
};

type SurveyRow = {
	id: string;
	org_id: string;
	template_version_id: string;
	respondent_name: string | null;
	location_text: string | null;
	latitude: string | number | null;
	longitude: string | number | null;
	status: string;
	assessment_overrides_json: unknown;
	submitted_at: Date | null;
	created_at: Date;
	updated_at: Date;
};

type SurveyResponseRow = {
	field_label: string;
	value_text: string | null;
	value_number: string | number | null;
	value_bool: boolean | null;
	value_json: unknown;
	display_order: number;
};

type SurveyNeedContextRow = {
	id: string;
	category: string;
	summary: string;
	urgency_score: string | number;
	priority_level: string;
	status: string;
};

type ReasoningRow = {
	case_summary: string | null;
	urgency_score: string | number | null;
	urgency_label: string | null;
	urgency_reasons: unknown;
	urgency_evidence_refs: unknown;
	need_category: string | null;
	need_subcategory: string | null;
	recommended_skill_keys: unknown;
	recommended_action: string | null;
	verification_risk: string | null;
	verification_risk_reasons: unknown;
	reasoning_confidence: string | number | null;
	document_assessment_overrides_json?: unknown;
};

type VolunteerRow = {
	id: string;
	org_id: string;
	user_id: string;
	availability_status: string;
	location_text: string | null;
	is_active: boolean;
	user_name: string;
	user_email: string;
};

type ListAssignmentsQuery = {
	page?: string | number;
	pageSize?: string | number;
	org_id?: string;
	need_id?: string;
	volunteer_id?: string;
	status?: string;
};

type CreateAssignmentInput = {
	need_id?: string;
	survey_id?: string;
	volunteer_id: string;
	status?: AssignmentStatus;
	match_score?: number;
	match_reason_json?: Record<string, unknown>;
};

type UpdateAssignmentStatusInput = {
	status: AssignmentStatus;
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const canAccessAssignment = (user: AuthenticatedUser, assignment: AssignmentRow) => {
	if (user.role === "superadmin") {
		return true;
	}

	if (user.role === "volunteer") {
		return assignment.volunteer_user_id === user.id;
	}

	return Boolean(user.orgId && user.orgId === assignment.org_id);
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

const toNullableNumber = (value: string | number | null | undefined) => {
	if (value === null || value === undefined) {
		return null;
	}

	return Number(value);
};

const mergeAssessmentOverrides = (...sources: unknown[]) => {
	return sources.reduce<Record<string, unknown>>((merged, source) => {
		const parsed = fromJson(source);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return merged;
		}

		return {
			...merged,
			...parsed,
		};
	}, {});
};

const priorityLevelFromUrgencyLabel = (value?: string | null) => {
	if (value === "critical" || value === "high") {
		return "high";
	}

	if (value === "medium") {
		return "medium";
	}

	return "low";
};

const formatSurveyResponseValue = (response: SurveyResponseRow) => {
	const parsed = fromJson(response.value_json);

	if (response.value_text?.trim()) {
		return response.value_text.trim();
	}

	if (response.value_number !== null && response.value_number !== undefined) {
		return String(response.value_number);
	}

	if (response.value_bool !== null && response.value_bool !== undefined) {
		return response.value_bool ? "Yes" : "No";
	}

	if (Array.isArray(parsed)) {
		return parsed.map((item) => String(item)).join(", ");
	}

	if (parsed && typeof parsed === "object") {
		return JSON.stringify(parsed);
	}

	if (parsed !== null && parsed !== undefined && String(parsed).trim()) {
		return String(parsed).trim();
	}

	return "Not provided";
};

const mapAssignment = (
	assignment: AssignmentRow,
	context?: {
		survey?: SurveyRow;
		responses?: SurveyResponseRow[];
		needs?: SurveyNeedContextRow[];
		reasoning?: ReasoningRow | null;
	},
) => {
	const survey = context?.survey;
	const reasoning = context?.reasoning;
	const assessmentOverrides = mergeAssessmentOverrides(
		reasoning?.document_assessment_overrides_json,
		survey?.assessment_overrides_json,
	);
	const surveyResponses = (context?.responses || []).map((response) => ({
		label: response.field_label,
		value: formatSurveyResponseValue(response),
	}));
	const surveyNeeds = (context?.needs || []).map((need) => ({
		id: need.id,
		category: need.category,
		summary: need.summary,
		urgencyScore: Number(need.urgency_score),
		priorityLevel: need.priority_level,
		status: need.status,
	}));
	const baseAiReview = reasoning
		? {
			caseSummary: reasoning.case_summary,
			urgencyScore: toNullableNumber(reasoning.urgency_score),
			urgencyLabel: reasoning.urgency_label,
			urgencyReasons: fromJson(reasoning.urgency_reasons) || [],
			urgencyEvidenceRefs: fromJson(reasoning.urgency_evidence_refs) || [],
			needCategory: reasoning.need_category,
			needSubcategory: reasoning.need_subcategory,
			recommendedSkillKeys: fromJson(reasoning.recommended_skill_keys) || [],
			recommendedAction: reasoning.recommended_action,
			verificationRisk: reasoning.verification_risk,
			verificationRiskReasons: fromJson(reasoning.verification_risk_reasons) || [],
			reasoningConfidence: toNullableNumber(reasoning.reasoning_confidence),
		}
		: survey
			? {
				caseSummary:
					surveyNeeds.length > 0
						? `This survey was manually reviewed and ${surveyNeeds.length} support need(s) were identified.`
						: "This survey was manually reviewed and requires volunteer assessment even though no automatic need was created.",
				urgencyScore: surveyNeeds.length > 0 ? Math.max(...surveyNeeds.map((need) => need.urgencyScore)) : null,
				urgencyLabel:
					surveyNeeds.length > 0
						? priorityLevelFromUrgencyLabel(surveyNeeds[0]?.priorityLevel)
						: null,
				urgencyReasons: [],
				urgencyEvidenceRefs: [],
				needCategory: surveyNeeds[0]?.category || null,
				needSubcategory: null,
				recommendedSkillKeys: [],
				recommendedAction:
					surveyNeeds.length > 0
						? "Proceed with volunteer coordination for the identified survey needs."
						: "Review the survey details directly and coordinate volunteer support as needed.",
				verificationRisk: surveyNeeds.length > 0 ? "medium" : "high",
				verificationRiskReasons: [],
				reasoningConfidence: null,
			}
			: null;
	const aiReview = baseAiReview
		? {
			...baseAiReview,
			...assessmentOverrides,
		}
		: null;

	return {
		id: assignment.id,
		orgId: assignment.org_id,
		needId: assignment.need_id,
		surveyId: assignment.need_survey_id,
		volunteerId: assignment.volunteer_id,
		matchScore: Number(assignment.match_score),
		matchReason: fromJson(assignment.match_reason_json),
		status: assignment.status,
		assignedAt: assignment.assigned_at,
		completedAt: assignment.completed_at,
		createdAt: assignment.created_at,
		updatedAt: assignment.updated_at,
		needCategory: assignment.need_category,
		needSummary: assignment.need_summary,
		needPriorityLevel: assignment.need_priority_level,
		volunteerUserId: assignment.volunteer_user_id,
		volunteerLocationText: assignment.volunteer_location_text,
		volunteerAvailabilityStatus: assignment.volunteer_availability_status,
		volunteerName: assignment.volunteer_name,
		volunteerEmail: assignment.volunteer_email,
		need: assignment.need_category
			? {
				category: assignment.need_category,
				summary: assignment.need_summary,
				priorityLevel: assignment.need_priority_level,
			}
			: undefined,
		volunteer: assignment.volunteer_name
			? {
				userId: assignment.volunteer_user_id,
				name: assignment.volunteer_name,
				email: assignment.volunteer_email,
				availabilityStatus: assignment.volunteer_availability_status,
				locationText: assignment.volunteer_location_text,
			}
			: undefined,
		survey: survey
			? {
				id: survey.id,
				respondentName: survey.respondent_name,
				locationText: survey.location_text,
				latitude: toNullableNumber(survey.latitude),
				longitude: toNullableNumber(survey.longitude),
				status: survey.status,
				submittedAt: survey.submitted_at,
				responses: surveyResponses,
				needs: surveyNeeds,
			}
			: undefined,
		aiReview,
	};
};

const getNeedById = async (needId: string) => {
	return (await db("needs_analysis")
		.where({ id: needId })
		.select("id", "org_id", "survey_id", "status", "summary", "category", "priority_level")
		.first()) as NeedRow | undefined;
};

const getSurveyById = async (surveyId: string) => {
	return (await db("surveys")
		.where({ id: surveyId })
		.select(
			"id",
			"org_id",
			"template_version_id",
			"respondent_name",
			"location_text",
			"latitude",
			"longitude",
			"status",
			"assessment_overrides_json",
			"submitted_at",
			"created_at",
			"updated_at",
		)
		.first()) as SurveyRow | undefined;
};

const getSurveyResponses = async (surveyId: string) => {
	return (await db("survey_responses as sr")
		.join("form_fields as ff", "sr.form_field_id", "ff.id")
		.where("sr.survey_id", surveyId)
		.orderBy("ff.display_order", "asc")
		.select(
			"ff.label as field_label",
			"sr.value_text",
			"sr.value_number",
			"sr.value_bool",
			"sr.value_json",
			"ff.display_order",
		)) as SurveyResponseRow[];
};

const getSurveyNeeds = async (surveyId: string) => {
	return (await db("needs_analysis")
		.where({ survey_id: surveyId })
		.orderBy("created_at", "asc")
		.select("id", "category", "summary", "urgency_score", "priority_level", "status")) as SurveyNeedContextRow[];
};

const getLatestReasoningBySurveyId = async (surveyId: string) => {
	return (await db("documents as d")
		.join("ai_reasoning_outputs as r", "r.document_id", "d.id")
		.where("d.source_survey_id", surveyId)
		.orderBy("r.created_at", "desc")
		.select(
			"r.case_summary",
			"r.urgency_score",
			"r.urgency_label",
			"r.urgency_reasons",
			"r.urgency_evidence_refs",
			"r.need_category",
			"r.need_subcategory",
			"r.recommended_skill_keys",
			"r.recommended_action",
			"r.verification_risk",
			"r.verification_risk_reasons",
			"r.reasoning_confidence",
			"d.assessment_overrides_json as document_assessment_overrides_json",
		)
		.first()) as ReasoningRow | undefined;
};

const getVolunteerById = async (volunteerId: string) => {
	return (await db("volunteers as v")
		.join("users as u", "v.user_id", "u.id")
		.where("v.id", volunteerId)
		.select(
			"v.id",
			"v.org_id",
			"v.user_id",
			"v.availability_status",
			"v.location_text",
			"v.is_active",
			"u.name as user_name",
			"u.email as user_email",
		)
		.first()) as VolunteerRow | undefined;
};

const getVolunteerByUserId = async (userId: string) => {
	return (await db("volunteers as v")
		.join("users as u", "v.user_id", "u.id")
		.where("v.user_id", userId)
		.select(
			"v.id",
			"v.org_id",
			"v.user_id",
			"v.availability_status",
			"v.location_text",
			"v.is_active",
			"u.name as user_name",
			"u.email as user_email",
		)
		.first()) as VolunteerRow | undefined;
};

const getAssignmentRowById = async (assignmentId: string) => {
	return (await db("task_assignments as ta")
		.join("needs_analysis as n", "ta.need_id", "n.id")
		.join("volunteers as v", "ta.volunteer_id", "v.id")
		.join("users as u", "v.user_id", "u.id")
		.where("ta.id", assignmentId)
		.select(
			"ta.id",
			"ta.org_id",
			"ta.need_id",
			"ta.volunteer_id",
			"ta.match_score",
			"ta.match_reason_json",
			"ta.status",
			"ta.assigned_at",
			"ta.completed_at",
			"ta.created_at",
			"ta.updated_at",
			"n.survey_id as need_survey_id",
			"n.category as need_category",
			"n.summary as need_summary",
			"n.priority_level as need_priority_level",
			"v.user_id as volunteer_user_id",
			"v.location_text as volunteer_location_text",
			"v.availability_status as volunteer_availability_status",
			"u.name as volunteer_name",
			"u.email as volunteer_email",
		)
		.first()) as AssignmentRow | undefined;
};

const getAssignmentContext = async (surveyId?: string) => {
	if (!surveyId) {
		return { survey: undefined, responses: [], needs: [], reasoning: null };
	}

	const [survey, responses, needs, reasoning] = await Promise.all([
		getSurveyById(surveyId),
		getSurveyResponses(surveyId),
		getSurveyNeeds(surveyId),
		getLatestReasoningBySurveyId(surveyId),
	]);

	return { survey, responses, needs, reasoning: reasoning || null };
};

const ensureNeedForAssignment = async (
	trx: any,
	input: CreateAssignmentInput,
	user: AuthenticatedUser,
) => {
	if (input.need_id) {
		const need = await getNeedById(input.need_id);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);
		return need;
	}

	if (!input.survey_id) {
		throw new AppError(400, "survey_id is required when need_id is missing");
	}

	const survey = await getSurveyById(input.survey_id);
	if (!survey) {
		throw new AppError(404, "Survey not found");
	}

	assertOrgScope(user, survey.org_id);

	const existingNeed = (await trx("needs_analysis")
		.where({ survey_id: survey.id })
		.whereIn("status", ["open", "matched"])
		.orderByRaw(
			"case priority_level when 'high' then 3 when 'medium' then 2 else 1 end desc",
		)
		.orderBy("created_at", "asc")
		.first()) as NeedRow | undefined;

	if (existingNeed) {
		return existingNeed;
	}

	const reasoning = await getLatestReasoningBySurveyId(survey.id);
	const summary =
		reasoning?.case_summary?.trim() ||
		`Volunteer support requested for ${survey.respondent_name || "submitted survey"}${survey.location_text ? ` at ${survey.location_text}` : ""}.`;
	const category = reasoning?.need_category?.trim() || "general";
	const urgencyScore = reasoning?.urgency_score !== null && reasoning?.urgency_score !== undefined
		? Math.max(0, Math.min(1, Number(reasoning.urgency_score) / 100))
		: 0.6;
	const priorityLevel = priorityLevelFromUrgencyLabel(reasoning?.urgency_label);

	const [createdNeed] = (await trx("needs_analysis")
		.insert({
			org_id: survey.org_id,
			survey_id: survey.id,
			category,
			summary,
			urgency_score: Number(urgencyScore.toFixed(2)),
			priority_level: priorityLevel,
			status: "open",
		})
		.returning("*")) as NeedRow[];

		await auditService.writeEvent(trx, {
			orgId: survey.org_id,
			eventType: "fallback_need_created_for_manual_assignment",
			entityType: "need",
			entityId: createdNeed.id,
			actorId: user.id,
			newValue: {
				surveyId: survey.id,
				summary: createdNeed.summary,
				category: createdNeed.category,
				priorityLevel: createdNeed.priority_level,
			},
		});

	return createdNeed;
};

export class AssignmentsService {
	async createAssignment(input: CreateAssignmentInput, user: AuthenticatedUser) {
		const directNeed = input.need_id ? await getNeedById(input.need_id) : undefined;
		const survey = input.survey_id ? await getSurveyById(input.survey_id) : undefined;
		if (input.need_id && !directNeed) {
			throw new AppError(404, "Need not found");
		}
		if (input.survey_id && !survey) {
			throw new AppError(404, "Survey not found");
		}
		if (directNeed && survey && directNeed.survey_id !== survey.id) {
			throw new AppError(409, "Provided need does not belong to the selected survey");
		}

		const targetOrgId = directNeed?.org_id || survey?.org_id;
		if (!targetOrgId) {
			throw new AppError(400, "Assignment requires a valid need or survey");
		}

		assertOrgScope(user, targetOrgId);

		const need = directNeed;
		if (need && need.status !== "open" && need.status !== "matched") {
			throw new AppError(409, "Assignments can only be created for open or matched needs");
		}

		const volunteer = await getVolunteerById(input.volunteer_id);
		if (!volunteer) {
			throw new AppError(404, "Volunteer not found");
		}

		if (!volunteer.is_active) {
			throw new AppError(409, "Inactive volunteers cannot be assigned");
		}

		let matchScore = input.match_score;
		let matchReason = input.match_reason_json;
		const defaultManualMatchReason = {
			assignmentMode: "manual_nearest",
			surveyId: input.survey_id || need?.survey_id || null,
			explanation: "Volunteer selected manually by admin from nearest and domain-filtered options.",
		};

		if (need && (matchScore === undefined || matchReason === undefined)) {
			const matches = await matchingService.getMatchesForNeed(need.id, user);
			const selected = matches.matches.find((match) => match.volunteerId === input.volunteer_id);
			if (selected) {
				matchScore = selected.matchScore;
				matchReason = selected.matchReason;
			}
		}

		if (matchScore === undefined) {
			matchScore = 0;
		}

		if (matchReason === undefined) {
			matchReason = defaultManualMatchReason;
		}

		const status = input.status || "suggested";
		const assignment = await db.transaction(async (trx) => {
			const resolvedNeed = await ensureNeedForAssignment(trx, input, user);

			const existing = await trx("task_assignments")
				.where({ need_id: resolvedNeed.id, volunteer_id: input.volunteer_id })
				.whereNot({ status: "cancelled" })
				.first();
			if (existing) {
				throw new AppError(409, "An active assignment already exists for this need and volunteer");
			}

			const [createdAssignment] = (await trx("task_assignments")
				.insert({
					org_id: resolvedNeed.org_id,
					need_id: resolvedNeed.id,
					volunteer_id: input.volunteer_id,
					match_score: matchScore,
					match_reason_json: JSON.stringify(matchReason),
					status,
					assigned_at: new Date(),
					completed_at: status === "completed" ? new Date() : null,
				})
				.returning("*")) as AssignmentRow[];

			let updatedNeedStatus = resolvedNeed.status;
			if (resolvedNeed.status === "open") {
				updatedNeedStatus = "matched";
				await trx("needs_analysis").where({ id: resolvedNeed.id }).update({
					status: updatedNeedStatus,
					updated_at: new Date(),
				});
			}

			await auditService.writeEvent(trx, {
				orgId: resolvedNeed.org_id,
				eventType: "assignment_created",
				entityType: "assignment",
				entityId: createdAssignment.id,
				actorId: user.id,
				newValue: {
					needId: createdAssignment.need_id,
					volunteerId: createdAssignment.volunteer_id,
					status: createdAssignment.status,
					matchScore: Number(createdAssignment.match_score),
				},
				metadata: {
					needStatusBefore: resolvedNeed.status,
					needStatusAfter: updatedNeedStatus,
					surveyId: input.survey_id || resolvedNeed.survey_id,
				},
			});

			return createdAssignment;
		});

		const detailed = await getAssignmentRowById(assignment.id);
		return mapAssignment(detailed || assignment);
	}

	async listAssignments(query: ListAssignmentsQuery, user: AuthenticatedUser) {
		const { page, pageSize, offset } = getPaginationParams(query.page, query.pageSize);
		const baseQuery = db("task_assignments as ta")
			.join("needs_analysis as n", "ta.need_id", "n.id")
			.join("volunteers as v", "ta.volunteer_id", "v.id")
			.join("users as u", "v.user_id", "u.id");

		if (user.role === "superadmin") {
			if (query.org_id) {
				baseQuery.andWhere("ta.org_id", query.org_id);
			}
		} else if (user.role === "volunteer") {
			const volunteer = await getVolunteerByUserId(user.id);
			if (!volunteer) {
				throw new AppError(404, "Volunteer profile not found for authenticated user");
			}

			baseQuery.andWhere("ta.volunteer_id", volunteer.id);
		} else {
			if (!user.orgId) {
				throw new AppError(400, "Authenticated user organization context is missing");
			}

			baseQuery.andWhere("ta.org_id", user.orgId);
		}

		if (query.need_id) {
			baseQuery.andWhere("ta.need_id", query.need_id);
		}

		if (query.volunteer_id) {
			baseQuery.andWhere("ta.volunteer_id", query.volunteer_id);
		}

		if (query.status) {
			baseQuery.andWhere("ta.status", query.status);
		}

		const rows = (await baseQuery
			.clone()
			.select(
				"ta.id",
				"ta.org_id",
				"ta.need_id",
				"ta.volunteer_id",
				"ta.match_score",
				"ta.match_reason_json",
				"ta.status",
				"ta.assigned_at",
				"ta.completed_at",
			"ta.created_at",
			"ta.updated_at",
			"n.survey_id as need_survey_id",
			"n.category as need_category",
			"n.summary as need_summary",
				"n.priority_level as need_priority_level",
				"v.user_id as volunteer_user_id",
				"v.location_text as volunteer_location_text",
				"v.availability_status as volunteer_availability_status",
				"u.name as volunteer_name",
				"u.email as volunteer_email",
			)
			.orderBy("ta.created_at", "desc")
			.offset(offset)
			.limit(pageSize)) as AssignmentRow[];

		const countResult = (await baseQuery.clone().clearSelect().countDistinct({ count: "ta.id" }).first()) as
			| { count: string }
			| undefined;

		return {
			items: rows.map((row) => mapAssignment(row)),
			page,
			pageSize,
			total: Number(countResult?.count || 0),
		};
	}

	async getAssignmentById(assignmentId: string, user: AuthenticatedUser) {
		const assignment = await getAssignmentRowById(assignmentId);
		if (!assignment) {
			throw new AppError(404, "Assignment not found");
		}

		if (!canAccessAssignment(user, assignment)) {
			throw new AppError(403, "Cross-organization access is not allowed");
		}
		const context = await getAssignmentContext(assignment.need_survey_id);
		return mapAssignment(assignment, context);
	}

	async updateAssignmentStatus(assignmentId: string, input: UpdateAssignmentStatusInput, user: AuthenticatedUser) {
		const assignment = await getAssignmentRowById(assignmentId);
		if (!assignment) {
			throw new AppError(404, "Assignment not found");
		}

		assertOrgScope(user, assignment.org_id);

		const [updated] = (await db.transaction(async (trx) => {
			const rows = (await trx("task_assignments")
				.where({ id: assignmentId })
				.update({
					status: input.status,
					completed_at: input.status === "completed" ? new Date() : null,
					updated_at: new Date(),
				})
				.returning("*")) as AssignmentRow[];

			const [updatedAssignment] = rows;
			await auditService.writeEvent(trx, {
				orgId: assignment.org_id,
				eventType: "assignment_status_updated",
				entityType: "assignment",
				entityId: assignment.id,
				actorId: user.id,
				oldValue: { status: assignment.status },
				newValue: { status: updatedAssignment.status },
				expectedNextState: updatedAssignment.status,
			});

			return rows;
		})) as AssignmentRow[];

		const refreshed = await getAssignmentRowById(updated.id);
		return mapAssignment(refreshed || updated);
	}
}

export const assignmentsService = new AssignmentsService();
