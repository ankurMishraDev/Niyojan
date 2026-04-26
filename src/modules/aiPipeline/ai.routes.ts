import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { aiController } from "./ai.controller";

const router = Router();

const paramsSchema = z.object({
	id: z.string().uuid(),
});

router.use(requireAuth);

router.get(
	"/status",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	aiController.getStatus,
);

router.post(
	"/documents/:id/preview-extraction",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: paramsSchema }),
	aiController.previewDocumentExtraction,
);

export default router;
