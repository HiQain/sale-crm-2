import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";
import { dealsTable } from "./deals";
import { usersTable } from "./users";

export const tasksTable = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("todo"), // todo|in_progress|done|cancelled
  priority: varchar("priority", { length: 32 }).notNull().default("medium"), // low|medium|high|urgent
  dueDate: timestamp("due_date"),
  assigneeId: int("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  contactId: int("contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  dealId: int("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
