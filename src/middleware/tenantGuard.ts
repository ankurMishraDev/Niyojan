import { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "./errorHandler";

const resolveRequestedOrgId = (req: Request) => {
  const paramOrgId = req.params.orgId || req.params.id;
  const bodyOrgId = (req.body?.org_id || req.body?.orgId) as string | undefined;
  const queryOrgId = (req.query.org_id || req.query.orgId) as string | undefined;

  return paramOrgId || bodyOrgId || queryOrgId || null;
};

export const enforceTenantAccess: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return next(new AppError(401, "Authentication is required"));
  }

  if (req.user.role === "superadmin") {
    return next();
  }

  const requestedOrgId = resolveRequestedOrgId(req);
  if (!requestedOrgId) {
    return next();
  }

  if (!req.user.orgId || req.user.orgId !== requestedOrgId) {
    return next(new AppError(403, "Cross-organization access is not allowed"));
  }

  next();
};

export const assertTenantOrgId = (req: Request, orgId: string) => {
  if (!req.user) {
    throw new AppError(401, "Authentication is required");
  }

  if (req.user.role === "superadmin") {
    return;
  }

  if (!req.user.orgId || req.user.orgId !== orgId) {
    throw new AppError(403, "Organization scope mismatch");
  }
};
