import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { formTemplatesController } from "./formTemplates.controller";

const router = Router();

const uuidSchema = z.string().uuid();

const templateIdParamsSchema = z.object({
	id: uuidSchema,
});

const versionIdParamsSchema = z.object({
	id: uuidSchema,
});

const fieldIdParamsSchema = z.object({
	id: uuidSchema,
});

const documentIdParamsSchema = z.object({
	documentId: uuidSchema,
});

const createTemplateBodySchema = z.object({
	name: z.string().min(1).max(255),
	org_id: uuidSchema.optional(),
	source_document_id: uuidSchema.optional(),
	status: z.enum(["draft", "active", "archived"]).optional(),
});

const updateTemplateBodySchema = z.object({
	name: z.string().min(1).max(255).optional(),
	status: z.enum(["draft", "active", "archived"]).optional(),
});

const listTemplatesQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	org_id: uuidSchema.optional(),
	status: z.enum(["draft", "active", "archived"]).optional(),
	search: z.string().optional(),
});

const createVersionBodySchema = z.object({
	status: z.enum(["draft", "review_pending", "archived"]).optional(),
	copy_fields_from_version_id: uuidSchema.optional(),
});

const updateVersionBodySchema = z.object({
	status: z.enum(["draft", "review_pending", "archived"]),
});

const addFieldBodySchema = z.object({
	field_catalog_id: uuidSchema.optional(),
	label: z.string().min(1).max(255).optional(),
	input_type: z.string().min(1).max(80).optional(),
	options_json: z.unknown().optional(),
	is_required: z.boolean().optional(),
	display_order: z.number().int().positive().optional(),
	is_custom: z.boolean().optional(),
});

const updateFieldBodySchema = z.object({
	field_catalog_id: uuidSchema.nullable().optional(),
	label: z.string().min(1).max(255).optional(),
	input_type: z.string().min(1).max(80).optional(),
	options_json: z.unknown().optional(),
	is_required: z.boolean().optional(),
	display_order: z.number().int().positive().optional(),
	is_custom: z.boolean().optional(),
});

const createFromDocumentBodySchema = z.object({
	name: z.string().min(1).max(255).optional(),
});

router.use(requireAuth);

router.post(
	"/form-templates",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ body: createTemplateBodySchema }),
	formTemplatesController.createTemplate,
);

router.get(
	"/form-templates",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ query: listTemplatesQuerySchema }),
	formTemplatesController.listTemplates,
);

router.get(
	"/form-templates/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: templateIdParamsSchema }),
	formTemplatesController.getTemplateById,
);

router.patch(
	"/form-templates/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: templateIdParamsSchema, body: updateTemplateBodySchema }),
	formTemplatesController.updateTemplate,
);

router.delete(
	"/form-templates/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: templateIdParamsSchema }),
	formTemplatesController.deleteTemplate,
);

router.post(
	"/form-templates/:id/versions",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: templateIdParamsSchema, body: createVersionBodySchema }),
	formTemplatesController.createTemplateVersion,
);

router.get(
	"/form-templates/:id/versions",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: templateIdParamsSchema }),
	formTemplatesController.listTemplateVersions,
);

router.post(
	"/form-templates/from-document/:documentId",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: documentIdParamsSchema, body: createFromDocumentBodySchema }),
	formTemplatesController.createTemplateFromDocument,
);

router.get(
	"/form-template-versions/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker", "volunteer"]),
	validate({ params: versionIdParamsSchema }),
	formTemplatesController.getTemplateVersionById,
);

router.patch(
	"/form-template-versions/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: versionIdParamsSchema, body: updateVersionBodySchema }),
	formTemplatesController.updateTemplateVersion,
);

router.delete(
	"/form-template-versions/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: versionIdParamsSchema }),
	formTemplatesController.deleteTemplateVersion,
);

router.post(
	"/form-template-versions/:id/fields",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: versionIdParamsSchema, body: addFieldBodySchema }),
	formTemplatesController.addVersionField,
);

router.post(
	"/form-template-versions/:id/publish",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: versionIdParamsSchema }),
	formTemplatesController.publishVersion,
);

router.patch(
	"/form-fields/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: fieldIdParamsSchema, body: updateFieldBodySchema }),
	formTemplatesController.updateField,
);

router.delete(
	"/form-fields/:id",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: fieldIdParamsSchema }),
	formTemplatesController.deleteField,
);

export default router;
