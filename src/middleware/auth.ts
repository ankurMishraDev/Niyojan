import { NextFunction, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { getFirebaseAuth } from "../config/firebase";
import { env } from "../config/env";
import { AppRole } from "../types/auth";
import { AppError } from "./errorHandler";

const extractBearerToken = (authorization?: string) => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

const resolveRole = (value: string | undefined, fallback: AppRole): AppRole => {
  if (
    value === "superadmin" ||
    value === "ngo_admin" ||
    value === "field_worker" ||
    value === "volunteer"
  ) {
    return value;
  }

  return fallback;
};

export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (env.AUTH_MOCK_MODE) {
      const defaultMockUserId = "10000000-0000-4000-8000-000000000002";
      const defaultMockOrgId = "11111111-1111-4111-8111-111111111111";

      req.user = {
        id:
          req.header("x-mock-user-id") ||
          env.MOCK_USER_ID ||
          defaultMockUserId ||
          randomUUID(),
        firebaseUid:
          req.header("x-mock-firebase-uid") ||
          "firebase-ngo-admin-a-001",
        orgId: req.header("x-mock-org-id") || env.MOCK_USER_ORG_ID || defaultMockOrgId,
        role: resolveRole(req.header("x-mock-role") || undefined, env.MOCK_USER_ROLE),
        email: req.header("x-mock-email") || undefined,
        name: req.header("x-mock-name") || "Mock User",
      };

      return next();
    }

    const token = extractBearerToken(req.header("authorization"));
    if (!token) {
      throw new AppError(401, "Missing or invalid bearer token");
    }

    const decoded = await getFirebaseAuth().verifyIdToken(token);
    const tokenRole = (decoded.role || decoded["custom_role"]) as string | undefined;
    const tokenOrgId =
      (decoded.org_id as string | undefined) ||
      (decoded["organization_id"] as string | undefined) ||
      null;

    req.user = {
      id: decoded.uid,
      firebaseUid: decoded.uid,
      orgId: tokenOrgId,
      role: resolveRole(tokenRole, "field_worker"),
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    next(new AppError(401, "Unauthorized request"));
  }
};
