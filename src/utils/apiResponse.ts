import { Response } from "express";

export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
};

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200,
  meta?: ApiMeta,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  details?: unknown,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
};
