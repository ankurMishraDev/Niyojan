import knex from "knex";
import { env } from "./env";

const connection = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

export const db = knex({
  client: "pg",
  connection,
  pool: {
    min: 2,
    max: 10,
  },
});

export const checkDbHealth = async () => {
  await db.raw("select 1");
  return true;
};
