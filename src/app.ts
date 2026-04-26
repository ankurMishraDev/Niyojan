import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { checkDbHealth } from "./config/db";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import aiRouter from "./modules/aiPipeline/ai.routes";
import authRouter from "./modules/auth/auth.routes";
import documentsRouter from "./modules/documents/documents.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import feedbackRouter from "./modules/feedback/feedback.routes";
import fieldCatalogRouter from "./modules/fieldCatalog/fieldCatalog.routes";
import formTemplatesRouter from "./modules/formBuilder/formTemplates.routes";
import assignmentsRouter from "./modules/assignments/assignments.routes";
import matchingRouter from "./modules/matching/matching.routes";
import needsRouter from "./modules/needs/needs.routes";
import pipelineRouter from "./modules/pipeline/pipeline.routes";
import organizationsRouter from "./modules/organizations/organizations.routes";
import skillsRouter from "./modules/skills/skills.routes";
import surveysRouter from "./modules/surveys/surveys.routes";
import volunteersRouter from "./modules/volunteers/volunteers.routes";
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
app.use(`${env.API_PREFIX}/organizations`, organizationsRouter);
app.use(`${env.API_PREFIX}/field-catalog`, fieldCatalogRouter);
app.use(`${env.API_PREFIX}/skills`, skillsRouter);
app.use(`${env.API_PREFIX}/volunteers`, volunteersRouter);
app.use(`${env.API_PREFIX}/surveys`, surveysRouter);
app.use(`${env.API_PREFIX}/needs`, needsRouter);
app.use(`${env.API_PREFIX}/documents`, documentsRouter);
app.use(`${env.API_PREFIX}/ai`, aiRouter);
app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter);
app.use(env.API_PREFIX, feedbackRouter);
app.use(env.API_PREFIX, matchingRouter);
app.use(env.API_PREFIX, assignmentsRouter);
app.use(env.API_PREFIX, pipelineRouter);
app.use(env.API_PREFIX, formTemplatesRouter);

app.get("/api-console", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "API_BROWSER_CONSOLE.html"));
});

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
