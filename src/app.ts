import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { checkDbHealth } from "./config/db";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRouter from "./modules/auth/auth.routes";
import { sendSuccess } from "./utils/apiResponse";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(env.API_PREFIX, limiter);
app.use(`${env.API_PREFIX}/auth`, authRouter);

app.get("/health", async (_req, res, next) => {
  try {
    await checkDbHealth();
    return sendSuccess(
      res,
      {
        service: "niyojan-backend",
        environment: env.NODE_ENV,
        db: "connected",
      },
      "Service healthy",
      200,
    );
  } catch (error) {
    return next(error);
  }
});

app.get(`${env.API_PREFIX}/health`, async (_req, res, next) => {
  try {
    await checkDbHealth();
    return sendSuccess(
      res,
      {
        service: "niyojan-backend",
        environment: env.NODE_ENV,
        db: "connected",
      },
      "Service healthy",
      200,
    );
  } catch (error) {
    return next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);
