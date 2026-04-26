import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { volunteersController } from "./volunteers.controller";

const volunteersRouter = Router();

const idParamsSchema = z.object({
	id: z.string().uuid(),
});

const volunteerBaseSchema = z.object({
	availability_status: z.string().min(2).max(50).optional(),
	location_text: z.string().max(255).optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	is_active: z.boolean().optional(),
});

const createVolunteerSchema = volunteerBaseSchema.extend({
	org_id: z.string().uuid().optional(),
	user_id: z.string().uuid(),
});

const updateVolunteerSchema = volunteerBaseSchema;

const volunteersQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().optional(),
	org_id: z.string().uuid().optional(),
	availability_status: z.string().optional(),
	is_active: z.enum(["true", "false"]).optional(),
	user_id: z.string().uuid().optional(),
	skill_id: z.string().uuid().optional(),
});

const attachVolunteerSkillsSchema = z.object({
	replace: z.boolean().optional(),
	skills: z
		.array(
			z.object({
				skill_id: z.string().uuid(),
				proficiency: z.number().int().min(1).max(5),
			}),
		)
		.min(1),
});

volunteersRouter.use(requireAuth);

volunteersRouter.post(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ body: createVolunteerSchema }),
	volunteersController.createVolunteer,
);

volunteersRouter.get(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ query: volunteersQuerySchema }),
	volunteersController.listVolunteers,
);

volunteersRouter.post(
	"/:id/skills",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: idParamsSchema, body: attachVolunteerSkillsSchema }),
	volunteersController.attachVolunteerSkills,
);

volunteersRouter.get(
	"/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: idParamsSchema }),
	volunteersController.getVolunteerById,
);

volunteersRouter.patch(
	"/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: idParamsSchema, body: updateVolunteerSchema }),
	volunteersController.updateVolunteer,
);

export default volunteersRouter;
