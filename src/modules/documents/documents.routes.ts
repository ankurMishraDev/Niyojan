import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { documentsController } from "./documents.controller";

const router = Router();

const uuidSchema = z.string().uuid();

const uploadUrlBodySchema = z.object({
	file_name: z.string().min(1),
	file_type: z.string().min(1),
	org_id: uuidSchema.optional(),
});

const createDocumentBodySchema = z.object({
	file_name: z.string().min(1),
	gcs_path: z.string().min(1),
	file_type: z.string().min(1),
	status: z.enum(["uploaded", "processing", "review_pending", "approved", "failed"]).optional(),
	org_id: uuidSchema.optional(),
});

const listDocumentsQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(100).optional(),
	org_id: uuidSchema.optional(),
	status: z.enum(["uploaded", "processing", "review_pending", "approved", "failed"]).optional(),
	file_type: z.string().optional(),
	uploaded_by: uuidSchema.optional(),
});

const documentIdParamsSchema = z.object({
	id: uuidSchema,
});

const updateStatusBodySchema = z.object({
	status: z.enum(["uploaded", "processing", "review_pending", "approved", "failed"]),
});

router.use(requireAuth);

router.post(
	"/upload-url",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ body: uploadUrlBodySchema }),
	documentsController.createUploadUrl,
);

router.post(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ body: createDocumentBodySchema }),
	documentsController.createDocument,
);

router.get(
	"/",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ query: listDocumentsQuerySchema }),
	documentsController.listDocuments,
);

router.get(
	"/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	documentsController.getDocumentById,
);

router.get(
	"/:id/read-url",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	documentsController.getDocumentReadUrl,
);

router.patch(
	"/:id/status",
	allowRoles(["superadmin", "ngo_admin"]),
	validate({ params: documentIdParamsSchema, body: updateStatusBodySchema }),
	documentsController.updateDocumentStatus,
);

router.post(
	"/:id/extract-fields",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	documentsController.triggerExtraction,
);

export default router;
