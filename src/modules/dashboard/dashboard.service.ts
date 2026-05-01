import { db } from "../../config/db";
import { AppError } from "../../middleware/errorHandler";
import { AuthenticatedUser } from "../../types/auth";

type NeedRow = {
	id: string;
	org_id: string;
	category: string;
	summary: string;
	urgency_score: string | number;
	priority_level: string;
	status: string;
	created_at: Date;
	survey_location_text?: string | null;
};

type SubmittedSurveyRow = {
	id: string;
	org_id: string;
	respondent_name: string | null;
	location_text: string | null;
	status: string;
	submitted_at: Date | null;
	created_at: Date;
	updated_at: Date;
};

type SurveyNeedSummaryRow = {
	survey_id: string;
	priority_level: string;
	status: string;
	id: string;
};

type SurveyAssignmentRow = {
	survey_id: string;
	assignment_id: string;
	feedback_id: string | null;
	volunteer_name: string | null;
};

const priorityRank = (value: string) => {
	if (value === "critical") return 4;
	if (value === "high") return 3;
	if (value === "medium") return 2;
	if (value === "low") return 1;
	return 0;
};

const assertUserOrg = (user: AuthenticatedUser) => {
	if (user.role === "superadmin") {
		return null;
	}

	if (!user.orgId) {
		throw new AppError(400, "Authenticated user organization context is missing");
	}

	return user.orgId;
};

export class DashboardService {
	async getSummary(user: AuthenticatedUser) {
		const orgId = assertUserOrg(user);

		const activeNeedsQuery = db("needs_analysis").count<{ count: string }>({ count: "*" }).whereIn("status", [
			"open",
			"matched",
			"assigned",
		]);
		if (orgId) {
			activeNeedsQuery.andWhere("org_id", orgId);
		}

		const availableVolunteersQuery = db("volunteers")
			.count<{ count: string }>({ count: "*" })
			.where({ is_active: true, availability_status: "available" });
		if (orgId) {
			availableVolunteersQuery.andWhere("org_id", orgId);
		}

		const pendingReviewsQuery = db("documents")
			.count<{ count: string }>({ count: "*" })
			.where({ status: "review_pending" });
		if (orgId) {
			pendingReviewsQuery.andWhere("org_id", orgId);
		}

		const submittedSurveysQuery = db("surveys")
			.count<{ count: string }>({ count: "*" })
			.whereIn("status", ["submitted", "analyzed"]);
		if (orgId) {
			submittedSurveysQuery.andWhere("org_id", orgId);
		}

		const [activeNeeds, availableVolunteers, pendingReviews, submittedSurveys] = await Promise.all([
			activeNeedsQuery.first(),
			availableVolunteersQuery.first(),
			pendingReviewsQuery.first(),
			submittedSurveysQuery.first(),
		]);

		return {
			activeNeeds: Number(activeNeeds?.count || 0),
			availableVolunteers: Number(availableVolunteers?.count || 0),
			pendingReviews: Number(pendingReviews?.count || 0),
			submittedSurveys: Number(submittedSurveys?.count || 0),
		};
	}

	async getUrgentNeeds(user: AuthenticatedUser) {
		const orgId = assertUserOrg(user);
		const query = db("needs_analysis as n")
			.join("surveys as s", "n.survey_id", "s.id")
			.whereIn("n.priority_level", ["high", "critical"]);

		if (orgId) {
			query.andWhere("n.org_id", orgId);
		}

		const rows = (await query
			.select(
				"n.id",
				"n.org_id",
				"n.category",
				"n.summary",
				"n.urgency_score",
				"n.priority_level",
				"n.status",
				"n.created_at",
				"s.location_text as survey_location_text",
			)
			.orderBy("n.urgency_score", "desc")
			.orderBy("n.created_at", "desc")
			.limit(10)) as NeedRow[];

		return rows.map((need) => ({
			id: need.id,
			orgId: need.org_id,
			category: need.category,
			summary: need.summary,
			urgencyScore: Number(need.urgency_score),
			priorityLevel: need.priority_level,
			status: need.status,
			locationText: need.survey_location_text ?? null,
			createdAt: need.created_at,
		}));
	}

	async getSubmittedSurveyCases(
		user: AuthenticatedUser,
		query: { priority?: string; case_status?: string },
	) {
		const orgId = assertUserOrg(user);
		const surveyQuery = db("surveys")
			.whereIn("status", ["submitted", "analyzed"])
			.orderBy("submitted_at", "desc")
			.orderBy("created_at", "desc");

		if (orgId) {
			surveyQuery.andWhere("org_id", orgId);
		}

		const surveys = (await surveyQuery.select(
			"id",
			"org_id",
			"respondent_name",
			"location_text",
			"status",
			"submitted_at",
			"created_at",
			"updated_at",
		)) as SubmittedSurveyRow[];

		if (surveys.length === 0) {
			return [];
		}

		const surveyIds = surveys.map((survey) => survey.id);
		const needsQuery = db("needs_analysis")
			.whereIn("survey_id", surveyIds)
 			.select("id", "survey_id", "priority_level", "status");

		const [needRows, assignmentRows] = await Promise.all([
			needsQuery as Promise<SurveyNeedSummaryRow[]>,
			db("needs_analysis as n")
				.leftJoin("task_assignments as ta", "ta.need_id", "n.id")
				.leftJoin("volunteers as v", "ta.volunteer_id", "v.id")
				.leftJoin("users as u", "v.user_id", "u.id")
				.leftJoin("volunteer_feedback as vf", "vf.assignment_id", "ta.id")
				.whereIn("n.survey_id", surveyIds)
				.select(
					"n.survey_id",
					db.raw("ta.id as assignment_id"),
					db.raw("vf.id as feedback_id"),
					db.raw("u.name as volunteer_name"),
				),
		]) as [SurveyNeedSummaryRow[], SurveyAssignmentRow[]];
		const needsBySurvey = new Map<string, SurveyNeedSummaryRow[]>();
		const assignmentBySurvey = new Map<string, SurveyAssignmentRow>();

		for (const need of needRows) {
			const existing = needsBySurvey.get(need.survey_id) || [];
			existing.push(need);
			needsBySurvey.set(need.survey_id, existing);
		}

		for (const assignment of assignmentRows) {
			if (!assignment.assignment_id || assignmentBySurvey.has(assignment.survey_id)) {
				continue;
			}

			assignmentBySurvey.set(assignment.survey_id, assignment);
		}

		return surveys
			.map((survey) => {
				const needs = needsBySurvey.get(survey.id) || [];
				const highestPriority = needs.reduce((selected, need) =>
					priorityRank(need.priority_level) > priorityRank(selected)
						? need.priority_level
						: selected,
				"low");
				const caseStatus =
					needs.length === 0 || needs.some((need) => need.status !== "resolved")
						? "open"
						: "resolved";

				return {
					id: survey.id,
					orgId: survey.org_id,
					respondentName: survey.respondent_name,
					locationText: survey.location_text,
					surveyStatus: survey.status,
					priorityLevel: highestPriority,
					caseStatus,
					needCount: needs.length,
					assignmentId: assignmentBySurvey.get(survey.id)?.assignment_id ?? null,
					feedbackSubmitted: Boolean(assignmentBySurvey.get(survey.id)?.feedback_id),
					volunteerName: assignmentBySurvey.get(survey.id)?.volunteer_name ?? null,
					submittedAt: survey.submitted_at,
					createdAt: survey.created_at,
					updatedAt: survey.updated_at,
				};
			})
			.filter((survey) =>
				(query.priority ? survey.priorityLevel === query.priority : true) &&
				(query.case_status ? survey.caseStatus === query.case_status : true),
			);
	}

	async getVolunteerAvailability(user: AuthenticatedUser) {
		const orgId = assertUserOrg(user);
		const query = db("volunteers")
			.select("availability_status")
			.count<{ count: string }>({ count: "*" })
			.where({ is_active: true })
			.groupBy("availability_status")
			.orderBy("availability_status", "asc");

		if (orgId) {
			query.andWhere("org_id", orgId);
		}

		const rows = (await query) as Array<{ availability_status: string; count: string }>;
		const breakdown = rows.map((row) => ({
			availabilityStatus: row.availability_status,
			count: Number(row.count),
		}));

		return {
			breakdown,
			totalActiveVolunteers: breakdown.reduce((sum, item) => sum + item.count, 0),
		};
	}

	async getPipelineHealth(user: AuthenticatedUser) {
		const orgId = assertUserOrg(user);
		const statusQuery = db("jobs")
			.select("status")
			.count<{ count: string }>({ count: "*" })
			.groupBy("status")
			.orderBy("status", "asc");
		if (orgId) {
			statusQuery.andWhere("org_id", orgId);
		}

		const recentFailuresQuery = db("jobs")
			.where({ status: "failed" })
			.orderBy("updated_at", "desc")
			.limit(5)
			.select("id", "type", "entity_type", "entity_id", "error_message", "updated_at");
		if (orgId) {
			recentFailuresQuery.andWhere("org_id", orgId);
		}

		const processingDocumentsQuery = db("documents")
			.count<{ count: string }>({ count: "*" })
			.where({ status: "processing" });
		if (orgId) {
			processingDocumentsQuery.andWhere("org_id", orgId);
		}

		const [jobStatuses, recentFailures, processingDocuments] = await Promise.all([
			statusQuery,
			recentFailuresQuery,
			processingDocumentsQuery.first(),
		]);
		const typedJobStatuses = jobStatuses as Array<{ status: string; count: string }>;

		const queueDepth = typedJobStatuses.reduce((sum, item) => {
			if (item.status === "pending" || item.status === "running") {
				return sum + Number(item.count);
			}

			return sum;
		}, 0);

		return {
			queueDepth,
			processingDocuments: Number(processingDocuments?.count || 0),
			jobStatusBreakdown: typedJobStatuses.map((item) => ({
				status: item.status,
				count: Number(item.count),
			})),
			recentFailures: recentFailures.map((job) => ({
				id: job.id,
				type: job.type,
				entityType: job.entity_type,
				entityId: job.entity_id,
				errorMessage: job.error_message,
				updatedAt: job.updated_at,
			})),
		};
	}
}

export const dashboardService = new DashboardService();
