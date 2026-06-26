import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { needsController } from "./needs.controller";

const needsRouter = Router();

const uuidSchema = z.string().uuid();

const needIdParamsSchema = z.object({
	id: uuidSchema,
});

const listNeedsQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	org_id: uuidSchema.optional(),
	survey_id: uuidSchema.optional(),
	status: z.string().optional(),
	priority_level: z.string().optional(),
	category: z.string().optional(),
});

const attachNeedSkillsBodySchema = z.object({
	replace: z.boolean().optional(),
	skill_ids: z.array(uuidSchema).min(1),
});

const updateNeedBodySchema = z.object({
	summary: z.string().min(4).max(1000).optional(),
	urgency_score: z.number().min(0).max(100).optional(),
	priority_level: z.enum(["low", "medium", "high"]).optional(),
	status: z.enum(["detected", "open", "matched", "closed"]).optional(),
});

needsRouter.use(requireAuth);

needsRouter.patch(
	"/:id",
	allowRoles(["superadmin"]),
	validate({ params: needIdParamsSchema, body: updateNeedBodySchema }),
	needsController.updateNeed,
);

needsRouter.get(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ query: listNeedsQuerySchema }),
	needsController.listNeeds,
);

needsRouter.get(
	"/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: needIdParamsSchema }),
	needsController.getNeedById,
);

needsRouter.post(
	"/:id/skills",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: needIdParamsSchema, body: attachNeedSkillsBodySchema }),
	needsController.attachNeedSkills,
);

export default needsRouter;
