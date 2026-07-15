import { mysqlTable, int, varchar, text, decimal, timestamp, date } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const dealsTable = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  stage: varchar("stage", { length: 32 }).notNull().default("prospecting"),
  value: decimal("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 16 }).notNull().default("USD"),
  probability: int("probability"),
  expectedCloseDate: date("expected_close_date"),
  contactId: int("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  companyId: int("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  ownerId: int("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
