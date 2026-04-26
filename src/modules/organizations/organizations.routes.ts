import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { organizationsController } from "./organizations.controller";

const orgIdParamsSchema = z.object({
	id: z.string().uuid(),
});

const createOrganizationSchema = z.object({
	name: z.string().min(2).max(255),
	type: z.string().min(2).max(100),
	region: z.string().min(2).max(120).optional(),
	status: z.string().min(2).max(50).optional(),
});

const updateOrganizationSchema = createOrganizationSchema.partial();

const listOrganizationUsersQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().optional(),
	role: z.string().min(2).max(40).optional(),
	status: z.string().min(2).max(50).optional(),
});

const organizationsRouter = Router();

organizationsRouter.use(requireAuth);

organizationsRouter.post(
	"/",
	allowRoles(["superadmin"]),
	validate({ body: createOrganizationSchema }),
	organizationsController.createOrganization,
);

organizationsRouter.get(
	"/:id/users",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: orgIdParamsSchema, query: listOrganizationUsersQuerySchema }),
	organizationsController.listOrganizationUsers,
);

organizationsRouter.get(
	"/:id",
	validate({ params: orgIdParamsSchema }),
	organizationsController.getOrganizationById,
);

organizationsRouter.patch(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: orgIdParamsSchema, body: updateOrganizationSchema }),
	organizationsController.updateOrganization,
);

export default organizationsRouter;
