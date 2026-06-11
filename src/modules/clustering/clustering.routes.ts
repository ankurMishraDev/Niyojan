import { Router } from "express";
import { runClustering, getClusters, getClusterById, confirmCluster, createManualClusterController } from "./clustering.controller";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/run", runClustering);
router.post("/manual", createManualClusterController);
router.get("/", getClusters);
router.get("/:id", getClusterById);
router.post("/:id/confirm", confirmCluster);

export default router;
