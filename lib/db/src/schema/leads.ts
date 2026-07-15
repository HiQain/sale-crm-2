import { mysqlTable, int, varchar, float, timestamp, json } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const leadsTable = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  contact: varchar("contact", { length: 255 }),               // phone / identifier (primary value)
  email: varchar("email", { length: 255 }),
  businessOwner: varchar("business_owner", { length: 255 }),
  businessName: varchar("business_name", { length: 255 }),
  service: varchar("service", { length: 255 }),
  response: varchar("response", { length: 255 }),
  followUp: varchar("follow_up", { length: 255 }),
  leadValue: float("lead_value").notNull().default(0),
  leadAssignee: varchar("lead_assignee", { length: 255 }),    // "admin" / user name shown in Lead column
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending|contacted|paid
  ownerId:    int("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  customData: json("custom_data").notNull().default({}),
  // Multi-values: { contact: ["+1-111", "+1-222"], email: ["a@b.com", "b@b.com"], ... }
  // The primary columns above are synced to multiValues[key][0] for search/compat
  multiValues: json("multi_values").notNull().default({}),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
