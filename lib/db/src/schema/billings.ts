import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const billingsTable = pgTable("billings", {
  id: serial("id").primaryKey(),
  invoiceDate: timestamp("invoice_date"),
  paymentDate: timestamp("payment_date"),
  clientName: text("client_name"),
  businessName: text("business_name"),
  paymentMethod: text("payment_method"),
  service: text("service"),
  amount: real("amount").notNull().default(0),
  feeDeducted: real("fee_deducted").notNull().default(0),
  netCurrency: real("net_currency").notNull().default(0),
  leadAssignee: text("lead_assignee"),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBillingSchema = createInsertSchema(billingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBilling = z.infer<typeof insertBillingSchema>;
export type Billing = typeof billingsTable.$inferSelect;
