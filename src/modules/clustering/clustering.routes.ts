import { Router } from "express";
import { runClustering, getClusters, getClusterById, confirmCluster, createManualClusterController } from "./clustering.controller";
import { requireAuth, requireAnyResolvedUser } from "../../middleware/auth";

const router = Router();

router.use(requireAuth);
// Allow resolving user optionally to prevent failures when accessing shared clusters
// Or if you want strict enforcement change to `router.use(requireAnyResolvedUser);`
// But here the error suggests the user's role is missing or strictly enforced.
// Let's ensure the user resolves.
router.use(requireAnyResolvedUser);

router.post("/run", runClustering);
router.post("/manual", createManualClusterController);
router.get("/", getClusters);
router.get("/:id", getClusterById);
router.post("/:id/confirm", confirmCluster);

export default router;
