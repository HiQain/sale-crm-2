import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

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
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
