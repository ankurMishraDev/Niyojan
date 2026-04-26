import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { skillsController } from "./skills.controller";

const skillsRouter = Router();

const idParamsSchema = z.object({
	id: z.string().uuid(),
});

const skillsQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().optional(),
	category: z.string().optional(),
	search: z.string().optional(),
});

const createSkillSchema = z.object({
	key: z.string().min(2).max(150),
	name: z.string().min(2).max(255),
	category: z.string().min(2).max(120),
});

const updateSkillSchema = createSkillSchema.partial();

skillsRouter.use(requireAuth);

skillsRouter.get("/", validate({ query: skillsQuerySchema }), skillsController.listSkills);

skillsRouter.post(
	"/",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ body: createSkillSchema }),
	skillsController.createSkill,
);

skillsRouter.get("/:id", validate({ params: idParamsSchema }), skillsController.getSkillById);

skillsRouter.patch(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: idParamsSchema, body: updateSkillSchema }),
	skillsController.updateSkill,
);

skillsRouter.delete(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: idParamsSchema }),
	skillsController.deleteSkill,
);

export default skillsRouter;
