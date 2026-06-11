import { Request, Response } from "express";
import { runClusterAlgorithm, fetchClusters, fetchClusterById, resumeClusterGraph, createManualCluster } from "./clustering.service";
import { AppError } from "../../middleware/errorHandler";

export const createManualClusterController = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  const userId = req.user?.id;
  if (!orgId || !userId) throw new AppError(401, "Unauthorized");

  const { needIds, clusterName, category } = req.body;
  if (!Array.isArray(needIds) || !clusterName || !category) {
    throw new AppError(400, "Invalid payload. needIds (array), clusterName, and category are required.");
  }

  const result = await createManualCluster(orgId, userId, needIds, clusterName, category);
  res.status(200).json({ success: true, data: result });
};

export const runClustering = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  const userId = req.user?.id;
  if (!orgId || !userId) throw new AppError(401, "Unauthorized");

  const { timeWindowDays } = req.body;
  
  const result = await runClusterAlgorithm(orgId, userId, timeWindowDays || 14);
  res.status(200).json({ success: true, data: result });
};

export const getClusters = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  if (!orgId) throw new AppError(401, "Unauthorized");

  const status = req.query.status as string | undefined;
  const clusters = await fetchClusters(orgId, status);
  res.status(200).json({ success: true, data: clusters });
};

export const getClusterById = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  if (!orgId) throw new AppError(401, "Unauthorized");

  const cluster = await fetchClusterById(req.params.id as string, orgId);
  if (!cluster) throw new AppError(404, "Cluster not found");
  
  res.status(200).json({ success: true, data: cluster });
};

export const confirmCluster = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId;
  const userId = req.user?.id;
  if (!orgId || !userId) throw new AppError(401, "Unauthorized");

  const result = await resumeClusterGraph(req.params.id as string, orgId, userId);
  res.status(200).json({ success: true, data: result });
};
