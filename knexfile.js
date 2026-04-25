const path = require("path");

require("dotenv").config();

const sslEnabled = process.env.DB_SSL === "true";

const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "niyojan",
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  };
};

const baseConfig = {
  client: "pg",
  connection: getConnection(),
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: path.join(__dirname, "src", "db", "migrations"),
    extension: "js",
  },
  seeds: {
    directory: path.join(__dirname, "src", "db", "seeds"),
    extension: "js",
  },
};

module.exports = {
  development: {
    ...baseConfig,
  },
  test: {
    ...baseConfig,
    connection: {
      ...getConnection(),
      database: process.env.DB_TEST_NAME || "niyojan_test",
    },
  },
  production: {
    ...baseConfig,
  },
};
