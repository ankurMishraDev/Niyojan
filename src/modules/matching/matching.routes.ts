import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { matchingController } from "./matching.controller";

const matchingRouter = Router();

const needIdParamsSchema = z.object({
	id: z.string().uuid(),
});

matchingRouter.use(requireAuth);

matchingRouter.get(
	"/needs/:id/matches",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ params: needIdParamsSchema }),
	matchingController.getMatchesForNeed,
);

export default matchingRouter;
