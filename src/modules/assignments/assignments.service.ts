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
	status: string;
	summary: string;
	category: string;
	priority_level: string;
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
	need_id: string;
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

const mapAssignment = (assignment: AssignmentRow) => {
	return {
		id: assignment.id,
		orgId: assignment.org_id,
		needId: assignment.need_id,
		volunteerId: assignment.volunteer_id,
		matchScore: Number(assignment.match_score),
		matchReason: fromJson(assignment.match_reason_json),
		status: assignment.status,
		assignedAt: assignment.assigned_at,
		completedAt: assignment.completed_at,
		createdAt: assignment.created_at,
		updatedAt: assignment.updated_at,
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
	};
};

const getNeedById = async (needId: string) => {
	return (await db("needs_analysis")
		.where({ id: needId })
		.select("id", "org_id", "status", "summary", "category", "priority_level")
		.first()) as NeedRow | undefined;
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

export class AssignmentsService {
	async createAssignment(input: CreateAssignmentInput, user: AuthenticatedUser) {
		const need = await getNeedById(input.need_id);
		if (!need) {
			throw new AppError(404, "Need not found");
		}

		assertOrgScope(user, need.org_id);
		if (need.status !== "open" && need.status !== "matched") {
			throw new AppError(409, "Assignments can only be created for open or matched needs");
		}

		const volunteer = await getVolunteerById(input.volunteer_id);
		if (!volunteer) {
			throw new AppError(404, "Volunteer not found");
		}

		if (volunteer.org_id !== need.org_id) {
			throw new AppError(403, "Volunteer belongs to another organization");
		}

		if (!volunteer.is_active) {
			throw new AppError(409, "Inactive volunteers cannot be assigned");
		}

		const existing = await db("task_assignments")
			.where({ need_id: input.need_id, volunteer_id: input.volunteer_id })
			.whereNot({ status: "cancelled" })
			.first();
		if (existing) {
			throw new AppError(409, "An active assignment already exists for this need and volunteer");
		}

		let matchScore = input.match_score;
		let matchReason = input.match_reason_json;

		if (matchScore === undefined || matchReason === undefined) {
			const matches = await matchingService.getMatchesForNeed(input.need_id, user);
			const selected = matches.matches.find((match) => match.volunteerId === input.volunteer_id);
			if (!selected) {
				throw new AppError(409, "Volunteer is not an eligible match for this need");
			}

			matchScore = selected.matchScore;
			matchReason = selected.matchReason;
		}

		const status = input.status || "suggested";
		const assignment = await db.transaction(async (trx) => {
			const [createdAssignment] = (await trx("task_assignments")
				.insert({
					org_id: need.org_id,
					need_id: input.need_id,
					volunteer_id: input.volunteer_id,
					match_score: matchScore,
					match_reason_json: JSON.stringify(matchReason),
					status,
					assigned_at: new Date(),
					completed_at: status === "completed" ? new Date() : null,
				})
				.returning("*")) as AssignmentRow[];

			let updatedNeedStatus = need.status;
			if (need.status === "open") {
				updatedNeedStatus = "matched";
				await trx("needs_analysis").where({ id: need.id }).update({
					status: updatedNeedStatus,
					updated_at: new Date(),
				});
			}

			await auditService.writeEvent(trx, {
				orgId: need.org_id,
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
				metadata: { needStatusBefore: need.status, needStatusAfter: updatedNeedStatus },
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
			items: rows.map(mapAssignment),
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

		assertOrgScope(user, assignment.org_id);
		return mapAssignment(assignment);
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
