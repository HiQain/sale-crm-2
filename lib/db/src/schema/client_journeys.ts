import { mysqlTable, int, varchar, float, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clientJourneysTable = mysqlTable("client_journeys", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date"),
  clientName: varchar("client_name", { length: 255 }),
  businessName: varchar("business_name", { length: 255 }),
  creditCard: varchar("credit_card", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  sales: varchar("sales", { length: 255 }),
  leadAssignee: varchar("lead_assignee", { length: 255 }),
  service: varchar("service", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending|paid|contacted
  paidAmount: float("paid_amount").notNull().default(0),
  balance: float("balance").notNull().default(0),
  total: float("total").notNull().default(0),
  ownerId: int("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
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
