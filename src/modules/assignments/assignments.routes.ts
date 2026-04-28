import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { assignmentsController } from "./assignments.controller";

const assignmentsRouter = Router();

const uuidSchema = z.string().uuid();

const assignmentIdParamsSchema = z.object({
	id: uuidSchema,
});

const listAssignmentsQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	org_id: uuidSchema.optional(),
	need_id: uuidSchema.optional(),
	volunteer_id: uuidSchema.optional(),
	status: z.string().optional(),
});

const createAssignmentBodySchema = z.object({
	need_id: uuidSchema,
	volunteer_id: uuidSchema,
	status: z.enum(["suggested", "accepted", "in_progress", "completed", "cancelled"]).optional(),
	match_score: z.number().min(0).max(1).optional(),
	match_reason_json: z.record(z.string(), z.unknown()).optional(),
});

const updateAssignmentStatusBodySchema = z.object({
	status: z.enum(["suggested", "accepted", "in_progress", "completed", "cancelled"]),
});

assignmentsRouter.use(requireAuth);

assignmentsRouter.post(
	"/assignments",
	allowRoles(["superadmin"]),
	validate({ body: createAssignmentBodySchema }),
	assignmentsController.createAssignment,
);

assignmentsRouter.get(
	"/assignments",
	allowRoles(["superadmin", "volunteer"]),
	validate({ query: listAssignmentsQuerySchema }),
	assignmentsController.listAssignments,
);

assignmentsRouter.get(
	"/assignments/:id",
	allowRoles(["superadmin", "volunteer"]),
	validate({ params: assignmentIdParamsSchema }),
	assignmentsController.getAssignmentById,
);

assignmentsRouter.patch(
	"/assignments/:id/status",
	allowRoles(["superadmin"]),
	validate({ params: assignmentIdParamsSchema, body: updateAssignmentStatusBodySchema }),
	assignmentsController.updateAssignmentStatus,
);

export default assignmentsRouter;
