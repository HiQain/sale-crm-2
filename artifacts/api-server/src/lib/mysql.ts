import { sql } from "drizzle-orm";

export function containsCI(column: unknown, value: string) {
  return sql`lower(${column}) like ${`%${value.toLowerCase()}%`}`;
}

export function extractInsertId(result: unknown): number {
  const packet = Array.isArray(result) ? result[0] : result;
  const insertId = Number((packet as { insertId?: number }).insertId);

  if (!Number.isFinite(insertId) || insertId <= 0) {
    throw new Error("Unable to determine inserted row id");
  }

  return insertId;
}
