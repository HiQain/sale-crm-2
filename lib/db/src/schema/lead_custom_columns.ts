import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";

export const leadCustomColumnsTable = mysqlTable("lead_custom_columns", {
  id:        int("id").autoincrement().primaryKey(),
  name:      varchar("name", { length: 255 }).notNull(),
  fieldKey:  varchar("field_key", { length: 255 }).notNull().unique(),
  position:  int("position").notNull().default(0),
  type:      varchar("type", { length: 32 }).notNull().default("text"),  // "text" | "number" | "date"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeadCustomColumn = typeof leadCustomColumnsTable.$inferSelect;
