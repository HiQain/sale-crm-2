import { mysqlTable, int, varchar, json, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const userPreferencesTable = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  scope: varchar("scope", { length: 255 }).notNull(),          // e.g. "leads"
  value: json("value").notNull(),          // arbitrary JSON per scope
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserPreference = typeof userPreferencesTable.$inferSelect;
