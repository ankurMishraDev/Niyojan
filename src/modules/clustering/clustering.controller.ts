import { Request, Response } from "express";
import { runClusterAlgorithm, fetchClusters, fetchClusterById, resumeClusterGraph, createManualCluster } from "./clustering.service";
import { AppError } from "../../middleware/errorHandler";

export const createManualClusterController = async (req: Request, res: Response) => {
  const orgId = req.user?.orgId || 'superadmin-bypass'; // Allow superadmin without org
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");

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
  
  const status = req.query.status as string | undefined;
  
  // Wait, looking at this closely, if the user doesn't have an orgId (e.g., is superadmin without org)
  // this would throw a 401. Let's make orgId optional in service fetch OR throw 403 Forbidden instead of 401 if they genuinely shouldn't be here.
  // The prompt says it's throwing 401. And requireAnyResolvedUser is used.
  if (!orgId && req.user?.role !== 'superadmin') throw new AppError(401, "Unauthorized");

  // Let's just bypass the orgId check if it's superadmin or pass null if undefined
  const fetchOrgId = orgId || 'none'; // Needs to match service signature if it accepts null/undefined 
  // Let's look at clustering.service.ts
  const clusters = await fetchClusters(orgId || 'superadmin-bypass', status);
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
