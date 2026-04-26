import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { feedbackController } from "./feedback.controller";

const feedbackRouter = Router();

const uuidSchema = z.string().uuid();

const assignmentIdParamsSchema = z.object({
	id: uuidSchema,
});

const needIdParamsSchema = z.object({
	id: uuidSchema,
});

const feedbackBodySchema = z.object({
	visit_completed: z.boolean(),
	visit_date: z.string().optional(),
	need_confirmed: z.boolean().optional(),
	actual_situation_summary: z.string().min(1).optional(),
	actual_urgency_assessment: z
		.enum(["higher", "correct", "lower", "not_applicable"])
		.optional(),
	actual_affected_count: z.number().int().nonnegative().optional(),
	was_ai_extraction_accurate: z.boolean().optional(),
	extraction_inaccuracies: z.string().optional(),
	evidence_gcs_paths: z.array(z.string().min(1)).optional(),
	action_taken: z.string().optional(),
	resolution_status: z
		.enum(["pending", "resolved", "partially_resolved", "escalated", "unresolved"])
		.optional(),
	escalation_reason: z.string().optional(),
});

const evidenceUploadBodySchema = z.object({
	file_name: z.string().min(1),
	file_type: z.string().min(1),
});

const closeNeedBodySchema = z.object({
	assignment_id: uuidSchema,
	feedback_id: uuidSchema,
	outcome: z.enum(["resolved", "partially_resolved", "escalated", "unresolved", "duplicate"]),
	extraction_was_accurate: z.boolean().optional(),
	urgency_was_accurate: z.boolean().optional(),
	category_was_accurate: z.boolean().optional(),
	matching_was_appropriate: z.boolean().optional(),
	coordinator_notes: z.string().optional(),
});

feedbackRouter.use(requireAuth);

feedbackRouter.post(
	"/assignments/:id/feedback",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: assignmentIdParamsSchema, body: feedbackBodySchema }),
	feedbackController.submitFeedback,
);

feedbackRouter.get(
	"/assignments/:id/feedback",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: assignmentIdParamsSchema }),
	feedbackController.getFeedbackByAssignment,
);

feedbackRouter.post(
	"/assignments/:id/feedback/evidence-url",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: assignmentIdParamsSchema, body: evidenceUploadBodySchema }),
	feedbackController.createEvidenceUploadUrl,
);

feedbackRouter.post(
	"/needs/:id/close",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: needIdParamsSchema, body: closeNeedBodySchema }),
	feedbackController.closeNeed,
);

export default feedbackRouter;
