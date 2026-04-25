import { env } from "../config/env";

const format = (level: string, message: string, data?: unknown) => {
  const base = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (data === undefined) {
    return base;
  }

  return `${base} ${JSON.stringify(data)}`;
};

export const logger = {
  info: (message: string, data?: unknown) => {
    console.log(format("INFO", message, data));
  },
  warn: (message: string, data?: unknown) => {
    console.warn(format("WARN", message, data));
  },
  error: (message: string, data?: unknown) => {
    console.error(format("ERROR", message, data));
  },
  debug: (message: string, data?: unknown) => {
    if (env.NODE_ENV !== "production") {
      console.debug(format("DEBUG", message, data));
    }
  },
};
