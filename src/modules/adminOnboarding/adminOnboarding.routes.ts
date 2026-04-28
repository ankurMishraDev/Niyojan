import { Router } from "express";
import { z } from "zod";
import { requireAuth, resolveAppUser } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { adminOnboardingController } from "./adminOnboarding.controller";

const adminOnboardingRouter = Router();

const orgIdParamsSchema = z.object({
	orgId: z.string().uuid(),
});

const onboardingQuerySchema = z.object({
	status: z.enum(["pending", "active", "rejected", "inactive"]).optional(),
});

adminOnboardingRouter.use(requireAuth, resolveAppUser({ allowStatuses: ["active"] }));
adminOnboardingRouter.use(allowRoles(["superadmin"]));

adminOnboardingRouter.get(
	"/ngos",
	validate({ query: onboardingQuerySchema }),
	adminOnboardingController.listNgoRegistrations,
);

adminOnboardingRouter.post(
	"/ngos/:orgId/approve",
	validate({ params: orgIdParamsSchema }),
	adminOnboardingController.approveNgo,
);

adminOnboardingRouter.post(
	"/ngos/:orgId/reject",
	validate({ params: orgIdParamsSchema }),
	adminOnboardingController.rejectNgo,
);

export default adminOnboardingRouter;
