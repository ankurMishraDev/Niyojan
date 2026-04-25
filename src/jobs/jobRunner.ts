import { logger } from "../utils/logger";

export const startJobRunner = () => {
  logger.info("Job runner initialized in DB-driven mode", {
    mode: "db",
    note: "Worker loop hooks will be implemented in AI pipeline phase",
  });
};
