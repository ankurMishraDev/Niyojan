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
