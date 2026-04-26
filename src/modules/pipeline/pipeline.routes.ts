import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { pipelineController } from "./pipeline.controller";

const pipelineRouter = Router();

const uuidSchema = z.string().uuid();

const documentIdParamsSchema = z.object({ id: uuidSchema });
const manifestIdParamsSchema = z.object({ id: uuidSchema });
const queueQuerySchema = z.object({ status: z.string().optional() });
const reviewBodySchema = z.object({
	review_action: z.enum(["approved", "rejected", "edited", "requested_reextraction"]),
	field_corrections: z.record(z.string(), z.unknown()).optional(),
	review_notes: z.string().optional(),
	approved_fields: z.record(z.string(), z.unknown()).optional(),
});
const createFormBodySchema = z.object({ name: z.string().optional() });

pipelineRouter.use(requireAuth);

pipelineRouter.post(
	"/documents/:id/pipeline/start",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	pipelineController.startPipeline,
);

pipelineRouter.get(
	"/documents/:id/pipeline/status",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	pipelineController.getPipelineStatus,
);

pipelineRouter.get(
	"/documents/:id/review-package",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema }),
	pipelineController.getReviewPackage,
);

pipelineRouter.post(
	"/documents/:id/review",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema, body: reviewBodySchema }),
	pipelineController.submitReview,
);

pipelineRouter.post(
	"/documents/:id/create-form",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: documentIdParamsSchema, body: createFormBodySchema }),
	pipelineController.createForm,
);

pipelineRouter.get(
	"/pipeline/queue",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ query: queueQuerySchema }),
	pipelineController.listQueue,
);

pipelineRouter.get(
	"/pipeline/manifests/:id",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: manifestIdParamsSchema }),
	pipelineController.getManifest,
);

export default pipelineRouter;
