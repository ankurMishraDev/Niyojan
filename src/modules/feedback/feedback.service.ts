import { randomUUID } from "node:crypto";
import { gcsBucketName, generateSignedUploadUrl } from "../../config/gcp";
import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { auditService } from "../../services/auditService";
import { AuthenticatedUser } from "../../types/auth";

type AssignmentRow = {
	id: string;
	org_id: string;
	need_id: string;
	volunteer_id: string;
	status: string;
	assigned_at: Date | null;
	completed_at: Date | null;
	volunteer_user_id: string;
	volunteer_name: string;
	need_summary: string;
};

type NeedRow = {
	id: string;
	org_id: string;
	status: string;
	summary: string;
};

type FeedbackRow = {
	id: string;
	assignment_id: string;
	volunteer_id: string;
	need_id: string;
	visit_completed: boolean;
	visit_date: string | Date | null;
	need_confirmed: boolean | null;
	actual_situation_summary: string | null;
	actual_urgency_assessment: string | null;
	actual_affected_count: number | null;
	was_ai_extraction_accurate: boolean | null;
	extraction_inaccuracies: string | null;
	evidence_gcs_paths: unknown;
	action_taken: string | null;
	resolution_status: string;
	escalation_reason: string | null;
	submitted_at: Date | null;
	created_at: Date;
	updated_at: Date;
	assignment_org_id?: string;
	volunteer_user_id?: string;
	volunteer_name?: string;
};

type CaseOutcomeRow = {
	id: string;
	org_id: string;
	need_id: string;
	assignment_id: string;
	feedback_id: string;
	closed_by: string;
	outcome: string;
	extraction_was_accurate: boolean | null;
	urgency_was_accurate: boolean | null;
	category_was_accurate: boolean | null;
	matching_was_appropriate: boolean | null;
	coordinator_notes: string | null;
	closed_at: Date;
	created_at: Date;
	updated_at: Date;
};

type SubmitFeedbackInput = {
	visit_completed: boolean;
	visit_date?: string;
	need_confirmed?: boolean;
	actual_situation_summary?: string;
	actual_urgency_assessment?: "higher" | "correct" | "lower" | "not_applicable";
	actual_affected_count?: number;
	was_ai_extraction_accurate?: boolean;
	extraction_inaccuracies?: string;
	evidence_gcs_paths?: string[];
	action_taken?: string;
	resolution_status?: "pending" | "resolved" | "partially_resolved" | "escalated" | "unresolved";
	escalation_reason?: string;
};

type EvidenceUploadInput = {
	file_name: string;
	file_type: string;
};

type CloseNeedInput = {
	assignment_id: string;
	feedback_id: string;
	outcome: "resolved" | "partially_resolved" | "escalated" | "unresolved" | "duplicate";
	extraction_was_accurate?: boolean;
	urgency_was_accurate?: boolean;
	category_was_accurate?: boolean;
	matching_was_appropriate?: boolean;
	coordinator_notes?: string;
};

const assertOrgScope = (user: AuthenticatedUser, orgId: string) => {
	if (user.role === "superadmin") {
		return;
	}

	if (!user.orgId || user.orgId !== orgId) {
		throw new AppError(403, "Cross-organization access is not allowed");
	}
};

const fromJson = (value: unknown) => {
	if (value === null || value === undefined) {
		return [] as string[];
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [] as string[];
		}
	}

	return Array.isArray(value) ? value : [];
};

const mapFeedback = (feedback: FeedbackRow) => {
	return {
		id: feedback.id,
		assignmentId: feedback.assignment_id,
		volunteerId: feedback.volunteer_id,
		needId: feedback.need_id,
		visitCompleted: feedback.visit_completed,
		visitDate: feedback.visit_date,
		needConfirmed: feedback.need_confirmed,
		actualSituationSummary: feedback.actual_situation_summary,
		actualUrgencyAssessment: feedback.actual_urgency_assessment,
		actualAffectedCount: feedback.actual_affected_count,
		wasAiExtractionAccurate: feedback.was_ai_extraction_accurate,
		extractionInaccuracies: feedback.extraction_inaccuracies,
		evidenceGcsPaths: fromJson(feedback.evidence_gcs_paths),
		actionTaken: feedback.action_taken,
		resolutionStatus: feedback.resolution_status,
		escalationReason: feedback.escalation_reason,
		submittedAt: feedback.submitted_at,
		createdAt: feedback.created_at,
		updatedAt: feedback.updated_at,
		volunteer: feedback.volunteer_name
			? {
				userId: feedback.volunteer_user_id,
				name: feedback.volunteer_name,
			}
			: undefined,
	};
};

const mapCaseOutcome = (outcome: CaseOutcomeRow) => {
	return {
		id: outcome.id,
		orgId: outcome.org_id,
		needId: outcome.need_id,
		assignmentId: outcome.assignment_id,
		feedbackId: outcome.feedback_id,
		closedBy: outcome.closed_by,
		outcome: outcome.outcome,
		extractionWasAccurate: outcome.extraction_was_accurate,
		urgencyWasAccurate: outcome.urgency_was_accurate,
		categoryWasAccurate: outcome.category_was_accurate,
		matchingWasAppropriate: outcome.matching_was_appropriate,
		coordinatorNotes: outcome.coordinator_notes,
		closedAt: outcome.closed_at,
		createdAt: outcome.created_at,
		updatedAt: outcome.updated_at,
	};
};

const getAssignmentById = async (assignmentId: string) => {
	return (await db("task_assignments as ta")
		.join("volunteers as v", "ta.volunteer_id", "v.id")
		.join("users as u", "v.user_id", "u.id")
		.join("needs_analysis as n", "ta.need_id", "n.id")
		.where("ta.id", assignmentId)
		.select(
			"ta.id",
			"ta.org_id",
			"ta.need_id",
			"ta.volunteer_id",
			"ta.status",
			"ta.assigned_at",
			"ta.completed_at",
			"v.user_id as volunteer_user_id",
			"u.name as volunteer_name",
			"n.summary as need_summary",
		)
		.first()) as AssignmentRow | undefined;
};

const getNeedById = async (needId: string) => {
	return (await db("needs_analysis").where({ id: needId }).first()) as NeedRow | undefined;
};

const getFeedbackByAssignmentIdInternal = async (assignmentId: string) => {
	return (await db("volunteer_feedback as vf")
		.join("task_assignments as ta", "vf.assignment_id", "ta.id")
		.join("volunteers as v", "vf.volunteer_id", "v.id")
		.join("users as u", "v.user_id", "u.id")
		.where("vf.assignment_id", assignmentId)
		.select(
			"vf.id",
			"vf.assignment_id",
			"vf.volunteer_id",
			"vf.need_id",
			"vf.visit_completed",
			"vf.visit_date",
			"vf.need_confirmed",
			"vf.actual_situation_summary",
			"vf.actual_urgency_assessment",
			"vf.actual_affected_count",
			"vf.was_ai_extraction_accurate",
			"vf.extraction_inaccuracies",
			"vf.evidence_gcs_paths",
			"vf.action_taken",
			"vf.resolution_status",
			"vf.escalation_reason",
			"vf.submitted_at",
			"vf.created_at",
			"vf.updated_at",
			"ta.org_id as assignment_org_id",
			"v.user_id as volunteer_user_id",
			"u.name as volunteer_name",
		)
		.first()) as FeedbackRow | undefined;
};

const sanitizeFileName = (fileName: string) => fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildEvidencePath = (orgId: string, assignmentId: string, fileName: string) => {
	return `orgs/${orgId}/feedback-evidence/${assignmentId}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;
};

export class FeedbackService {
	async submitFeedback(assignmentId: string, input: SubmitFeedbackInput, user: AuthenticatedUser) {
		const assignment = await getAssignmentById(assignmentId);
		if (!assignment) {
			throw new AppError(404, "Assignment not found");
		}

		assertOrgScope(user, assignment.org_id);
		if (user.role === "volunteer" && user.id !== assignment.volunteer_user_id) {
			throw new AppError(403, "Only the assigned volunteer can submit feedback");
		}

		const existingFeedback = await getFeedbackByAssignmentIdInternal(assignmentId);
		if (existingFeedback) {
			throw new AppError(409, "Feedback already exists for this assignment");
		}

		const feedback = await db.transaction(async (trx) => {
			const [createdFeedback] = (await trx("volunteer_feedback")
				.insert({
					assignment_id: assignment.id,
					volunteer_id: assignment.volunteer_id,
					need_id: assignment.need_id,
					visit_completed: input.visit_completed,
					visit_date: input.visit_date || null,
					need_confirmed: input.need_confirmed ?? null,
					actual_situation_summary: input.actual_situation_summary?.trim() || null,
					actual_urgency_assessment: input.actual_urgency_assessment || null,
					actual_affected_count: input.actual_affected_count ?? null,
					was_ai_extraction_accurate: input.was_ai_extraction_accurate ?? null,
					extraction_inaccuracies: input.extraction_inaccuracies?.trim() || null,
					evidence_gcs_paths: JSON.stringify(input.evidence_gcs_paths || []),
					action_taken: input.action_taken?.trim() || null,
					resolution_status: input.resolution_status || "pending",
					escalation_reason: input.escalation_reason?.trim() || null,
					submitted_at: new Date(),
				})
				.returning("*")) as FeedbackRow[];

			await trx("task_assignments").where({ id: assignment.id }).update({
				status: "completed",
				completed_at: new Date(),
				updated_at: new Date(),
			});

			let updatedNeedStatus: string | null = null;
			if ((input.resolution_status || "pending") === "resolved" || (input.resolution_status || "pending") === "partially_resolved") {
				updatedNeedStatus = "resolved";
				await trx("needs_analysis").where({ id: assignment.need_id }).update({
					status: updatedNeedStatus,
					updated_at: new Date(),
				});
			}

			await auditService.writeEvent(trx, {
				orgId: assignment.org_id,
				eventType: "feedback_submitted",
				entityType: "feedback",
				entityId: createdFeedback.id,
				actorId: user.id,
				newValue: mapFeedback(createdFeedback),
				metadata: {
					assignmentId: assignment.id,
					needId: assignment.need_id,
					assignmentStatusAfter: "completed",
					needStatusAfter: updatedNeedStatus,
				},
			});

			return createdFeedback;
		});

		const detailed = await getFeedbackByAssignmentIdInternal(assignment.id);
		return mapFeedback(detailed || feedback);
	}

	async getFeedbackByAssignment(assignmentId: string, user: AuthenticatedUser) {
		const assignment = await getAssignmentById(assignmentId);
		if (!assignment) {
			throw new AppError(404, "Assignment not found");
		}

		assertOrgScope(user, assignment.org_id);
		if (user.role === "volunteer" && user.id !== assignment.volunteer_user_id) {
			throw new AppError(403, "Only the assigned volunteer can view this feedback");
		}

		const feedback = await getFeedbackByAssignmentIdInternal(assignmentId);
		if (!feedback) {
			throw new AppError(404, "Feedback not found for this assignment");
		}

		return mapFeedback(feedback);
	}

	async createEvidenceUploadUrl(assignmentId: string, input: EvidenceUploadInput, user: AuthenticatedUser) {
		const assignment = await getAssignmentById(assignmentId);
		if (!assignment) {
			throw new AppError(404, "Assignment not found");
		}

		assertOrgScope(user, assignment.org_id);
		if (user.role === "volunteer" && user.id !== assignment.volunteer_user_id) {
			throw new AppError(403, "Only the assigned volunteer can upload evidence");
		}

		const gcsPath = buildEvidencePath(assignment.org_id, assignment.id, input.file_name);
		const signed = await generateSignedUploadUrl(gcsPath, input.file_type);

		return {
			bucket: gcsBucketName,
			assignmentId: assignment.id,
			gcsPath,
			fileName: input.file_name,
			fileType: input.file_type,
			uploadUrl: signed.url,
			method: "PUT",
			expiresAt: signed.expiresAt,
			requiredHeaders: {
				"Content-Type": input.file_type,
			},
		};
	}

	async closeNeed(needId: string, input: CloseNeedInput, user: AuthenticatedUser) {
		const need = await getNeedById(needId);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);

		const assignment = await getAssignmentById(input.assignment_id);
		if (!assignment || assignment.need_id !== need.id) {
			throw new AppError(400, "Assignment does not belong to the specified need");
		}

		const feedback = await getFeedbackByAssignmentIdInternal(input.assignment_id);
		if (!feedback || feedback.id !== input.feedback_id) {
			throw new AppError(400, "Feedback does not match the specified assignment");
		}

		const existingOutcome = await db("case_outcomes").where({ need_id: need.id }).first();
		if (existingOutcome) {
			throw new AppError(409, "Case outcome already exists for this need");
		}

		const outcome = await db.transaction(async (trx) => {
			const [createdOutcome] = (await trx("case_outcomes")
				.insert({
					org_id: need.org_id,
					need_id: need.id,
					assignment_id: assignment.id,
					feedback_id: feedback.id,
					closed_by: user.id,
					outcome: input.outcome,
					extraction_was_accurate: input.extraction_was_accurate ?? null,
					urgency_was_accurate: input.urgency_was_accurate ?? null,
					category_was_accurate: input.category_was_accurate ?? null,
					matching_was_appropriate: input.matching_was_appropriate ?? null,
					coordinator_notes: input.coordinator_notes?.trim() || null,
					closed_at: new Date(),
				})
				.returning("*")) as CaseOutcomeRow[];

			const nextNeedStatus = input.outcome === "escalated" || input.outcome === "unresolved"
				? "open"
				: "resolved";

			await trx("needs_analysis").where({ id: need.id }).update({
				status: nextNeedStatus,
				updated_at: new Date(),
			});

			await auditService.writeEvent(trx, {
				orgId: need.org_id,
				eventType: "case_closed",
				entityType: "need",
				entityId: need.id,
				actorId: user.id,
				oldValue: { status: need.status },
				newValue: { status: nextNeedStatus, outcome: createdOutcome.outcome },
				metadata: {
					assignmentId: assignment.id,
					feedbackId: feedback.id,
					caseOutcomeId: createdOutcome.id,
				},
				expectedNextState: nextNeedStatus,
			});

			return createdOutcome;
		});

		return mapCaseOutcome(outcome);
	}
}

export const feedbackService = new FeedbackService();
