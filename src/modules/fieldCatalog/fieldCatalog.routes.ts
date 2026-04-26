import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { fieldCatalogController } from "./fieldCatalog.controller";

const fieldCatalogRouter = Router();

const idParamsSchema = z.object({
	id: z.string().uuid(),
});

const fieldCatalogQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().optional(),
	category: z.string().optional(),
	input_type: z.string().optional(),
	is_system: z.enum(["true", "false"]).optional(),
	search: z.string().optional(),
});

const fieldCatalogCreateSchema = z.object({
	key: z.string().min(2).max(150),
	name: z.string().min(2).max(255),
	category: z.string().min(2).max(120),
	input_type: z.string().min(2).max(80),
	options_json: z.unknown().optional(),
	validation_json: z.unknown().optional(),
	is_system: z.boolean().optional(),
});

const fieldCatalogUpdateSchema = fieldCatalogCreateSchema.partial();

fieldCatalogRouter.use(requireAuth);

fieldCatalogRouter.get(
	"/",
	validate({ query: fieldCatalogQuerySchema }),
	fieldCatalogController.listFields,
);

fieldCatalogRouter.post(
	"/",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ body: fieldCatalogCreateSchema }),
	fieldCatalogController.createField,
);

fieldCatalogRouter.get(
	"/:id",
	validate({ params: idParamsSchema }),
	fieldCatalogController.getFieldById,
);

fieldCatalogRouter.patch(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: idParamsSchema, body: fieldCatalogUpdateSchema }),
	fieldCatalogController.updateField,
);

fieldCatalogRouter.delete(
	"/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: idParamsSchema }),
	fieldCatalogController.deleteField,
);

export default fieldCatalogRouter;
