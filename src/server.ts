import { app } from "./app";
import { db } from "./config/db";
import { env } from "./config/env";
import { startJobRunner } from "./jobs/jobRunner";
import { initializeFirebaseAdmin } from "./config/firebase";
import { logger } from "./utils/logger";

initializeFirebaseAdmin();

const server = app.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT}`);
  startJobRunner();
});

const shutdown = async (signal: string) => {
  logger.warn(`Received ${signal}, shutting down`);

  server.close(async () => {
    await db.destroy();
    logger.info("HTTP server and DB pool closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
  process.exit(1);
});
