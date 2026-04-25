import { NextFunction, Request, RequestHandler, Response } from "express";
import { AppRole } from "../types/auth";
import { AppError } from "./errorHandler";

export const allowRoles = (roles: AppRole[]): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication is required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient role permissions"));
    }

    next();
  };
};
