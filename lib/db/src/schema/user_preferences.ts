import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userPreferencesTable = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),          // e.g. "leads"
  value: jsonb("value").notNull(),          // arbitrary JSON per scope
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserPreference = typeof userPreferencesTable.$inferSelect;
