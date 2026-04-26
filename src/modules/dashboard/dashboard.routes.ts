import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/roleGuard";
import { dashboardController } from "./dashboard.controller";

const dashboardRouter = Router();

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
