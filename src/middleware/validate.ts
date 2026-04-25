import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "./errorHandler";

type ValidationSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validate = (schema: ValidationSchema): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query) as Request["query"];
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request["params"];
      }

      next();
    } catch (error) {
      next(new AppError(400, "Request validation failed", error));
    }
  };
};
