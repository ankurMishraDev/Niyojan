import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { dashboardController } from "./dashboard.controller";

const dashboardRouter = Router();
const submittedSurveyQuerySchema = z.object({
	priority: z.enum(["low", "medium", "high", "critical"]).optional(),
	case_status: z.enum(["open", "resolved"]).optional(),
});

dashboardRouter.use(requireAuth);

dashboardRouter.get(
	"/summary",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	dashboardController.getSummary,
);

dashboardRouter.get(
	"/urgent-needs",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	dashboardController.getUrgentNeeds,
);

dashboardRouter.get(
	"/submitted-surveys",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	validate({ query: submittedSurveyQuerySchema }),
	dashboardController.getSubmittedSurveyCases,
);

dashboardRouter.get(
	"/volunteer-availability",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	dashboardController.getVolunteerAvailability,
);

dashboardRouter.get(
	"/pipeline-health",
	allowRoles(["superadmin", "ngo_admin", "field_worker"]),
	dashboardController.getPipelineHealth,
);

export default dashboardRouter;
