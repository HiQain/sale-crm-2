import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";
import { dealsTable } from "./deals";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const activitiesTable = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 32 }).notNull().default("note"), // call|email|meeting|note|task
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  contactId: int("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  dealId: int("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  companyId: int("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  userId: int("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
