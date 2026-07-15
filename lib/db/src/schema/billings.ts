import { mysqlTable, int, varchar, float, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const billingsTable = mysqlTable("billings", {
  id: int("id").autoincrement().primaryKey(),
  invoiceDate: timestamp("invoice_date"),
  paymentDate: timestamp("payment_date"),
  clientName: varchar("client_name", { length: 255 }),
  businessName: varchar("business_name", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 255 }),
  service: varchar("service", { length: 255 }),
  amount: float("amount").notNull().default(0),
  feeDeducted: float("fee_deducted").notNull().default(0),
  netCurrency: float("net_currency").notNull().default(0),
  leadAssignee: varchar("lead_assignee", { length: 255 }),
  ownerId: int("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
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
