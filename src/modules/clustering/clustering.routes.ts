import { Router } from "express";
import { runClustering, getClusters, getClusterById, confirmCluster } from "./clustering.controller";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/run", runClustering);
router.get("/", getClusters);
router.get("/:id", getClusterById);
router.post("/:id/confirm", confirmCluster);

export default router;
