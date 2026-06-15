import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import * as ctrl from "./clustering.controller";

const router = Router();
// NOTE: requireAuth + resolveAppUser({ allowStatuses: ["active"] }) are already applied globally
// in app.ts before this router is mounted. Do NOT re-add them here.

const manualBody = z.object({
  needIds: z.array(z.string().uuid()).min(1),
  clusterName: z.string().min(1).max(255),
  category: z.string().min(1).max(120),
});

const autoBody = z.object({
  timeWindowDays: z.number().int().positive().max(90).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  status: z
    .enum(["pending_review", "confirmed", "assigned", "partially_closed", "closed", "active"])
    .optional(),
});

const CLUSTER_ROLES = ["superadmin", "ngo_admin"] as const;

router.post(
  "/run",
  allowRoles([...CLUSTER_ROLES]),
  validate({ body: autoBody }),
  ctrl.runClustering,
);

router.post(
  "/manual",
  allowRoles([...CLUSTER_ROLES]),
  validate({ body: manualBody }),
  ctrl.createManualClusterController,
);

router.get(
  "/",
  allowRoles([...CLUSTER_ROLES, "field_worker"]),
  validate({ query: listQuery }),
  ctrl.getClusters,
);

router.get(
  "/:id",
  allowRoles([...CLUSTER_ROLES, "field_worker"]),
  validate({ params: idParam }),
  ctrl.getClusterById,
);

router.post(
  "/:id/confirm",
  allowRoles([...CLUSTER_ROLES]),
  validate({ params: idParam }),
  ctrl.confirmCluster,
);

export default router;
