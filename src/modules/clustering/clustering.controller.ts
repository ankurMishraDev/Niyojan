import { NextFunction, Request, Response } from "express";
import { assertTenantOrgId } from "../../middleware/tenantGuard";
import { sendSuccess } from "../../utils/apiResponse";
import {
  createManualCluster,
  runAutoClustering,
  fetchClusters,
  fetchClusterById,
  resumeClusterGraph,
} from "./clustering.service";

/**
 * Resolves the org scope for clustering operations.
 * - superadmin: may or may not have an orgId; null means "all orgs" (no filter).
 * - ngo_admin / field_worker: must have an orgId (enforced by assertTenantOrgId).
 */
const resolveScopeOrgId = (req: Request): string | null => {
  return req.user!.orgId ?? null;
};

export const createManualClusterController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orgId = resolveScopeOrgId(req);

    // Non-superadmin must have an org
    if (req.user!.role !== "superadmin" && !orgId) {
      throw Object.assign(
        new Error(
          "Your account does not have an organization assigned. Please complete NGO onboarding before creating clusters.",
        ),
        { statusCode: 400 },
      );
    }
    if (orgId && req.user!.role !== "superadmin") {
      assertTenantOrgId(req, orgId);
    }

    const { needIds, clusterName, category } = req.body;
    const result = await createManualCluster({
      // For superadmin without org, derive orgId from the first need's org (service handles this)
      orgId,
      userId: req.user!.id,
      needIds,
      clusterName,
      category,
    });
    return sendSuccess(res, result, "Cluster created", 201);
  } catch (error) {
    next(error);
  }
};

export const runClustering = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveScopeOrgId(req);
    if (req.user!.role !== "superadmin" && !orgId) {
      throw Object.assign(new Error("Organization scope required for this operation"), {
        statusCode: 403,
      });
    }

    const result = await runAutoClustering({
      orgId,
      userId: req.user!.id,
      timeWindowDays: req.body.timeWindowDays ?? 14,
    });
    return sendSuccess(res, result, "Auto-clustering complete", 200);
  } catch (error) {
    next(error);
  }
};

export const getClusters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveScopeOrgId(req);
    if (req.user!.role !== "superadmin" && !orgId) {
      throw Object.assign(new Error("Organization scope required"), { statusCode: 403 });
    }

    const status = req.query.status as string | undefined;
    const clusters = await fetchClusters(orgId, status);
    return sendSuccess(res, clusters);
  } catch (error) {
    next(error);
  }
};

export const getClusterById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveScopeOrgId(req);
    const cluster = await fetchClusterById(req.params.id as string, orgId);
    if (!cluster) {
      const { AppError } = await import("../../middleware/errorHandler");
      throw new AppError(404, "Cluster not found");
    }
    return sendSuccess(res, cluster);
  } catch (error) {
    next(error);
  }
};

export const confirmCluster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveScopeOrgId(req);
    if (req.user!.role !== "superadmin" && !orgId) {
      throw Object.assign(new Error("Organization scope required"), { statusCode: 403 });
    }

    const result = await resumeClusterGraph(req.params.id as string, orgId, req.user!.id);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
