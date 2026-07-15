import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const contactsTable = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  title: varchar("title", { length: 255 }),
  companyId: int("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).notNull().default("lead"), // lead|prospect|customer|churned|inactive
  source: varchar("source", { length: 255 }),
  tags: varchar("tags", { length: 512 }),
  notes: text("notes"),
  ownerId: int("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
