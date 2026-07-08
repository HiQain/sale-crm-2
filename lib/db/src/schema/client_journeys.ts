import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clientJourneysTable = pgTable("client_journeys", {
  id: serial("id").primaryKey(),
  date: timestamp("date"),
  clientName: text("client_name"),
  businessName: text("business_name"),
  creditCard: text("credit_card"),
  email: text("email"),
  phone: text("phone"),
  sales: text("sales"),
  leadAssignee: text("lead_assignee"),
  service: text("service"),
  status: text("status").notNull().default("pending"), // pending|paid|contacted
  paidAmount: real("paid_amount").notNull().default(0),
  balance: real("balance").notNull().default(0),
  total: real("total").notNull().default(0),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClientJourneySchema = createInsertSchema(clientJourneysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientJourney = z.infer<typeof insertClientJourneySchema>;
export type ClientJourney = typeof clientJourneysTable.$inferSelect;
