import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

function loadDatabaseEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
    path.join(process.cwd(), "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    process.loadEnvFile(candidate);
    if (process.env.DATABASE_URL) {
      return;
    }
  }
}

loadDatabaseEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
