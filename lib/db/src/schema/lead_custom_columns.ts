import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const leadCustomColumnsTable = pgTable("lead_custom_columns", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  fieldKey:  text("field_key").notNull().unique(),
  position:  integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeadCustomColumn = typeof leadCustomColumnsTable.$inferSelect;
