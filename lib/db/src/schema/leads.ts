import { pgTable, serial, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { integer } from "drizzle-orm/pg-core";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  contact: text("contact"),               // phone / identifier (primary value)
  email: text("email"),
  businessOwner: text("business_owner"),
  businessName: text("business_name"),
  service: text("service"),
  response: text("response"),
  followUp: text("follow_up"),
  leadValue: real("lead_value").notNull().default(0),
  leadAssignee: text("lead_assignee"),    // "admin" / user name shown in Lead column
  status: text("status").notNull().default("pending"), // pending|contacted|paid
  ownerId:    integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  customData: jsonb("custom_data").notNull().default({}),
  // Multi-values: { contact: ["+1-111", "+1-222"], email: ["a@b.com", "b@b.com"], ... }
  // The primary columns above are synced to multiValues[key][0] for search/compat
  multiValues: jsonb("multi_values").notNull().default({}),
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
