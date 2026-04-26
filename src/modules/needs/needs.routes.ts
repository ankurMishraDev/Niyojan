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

needsRouter.use(requireAuth);

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
