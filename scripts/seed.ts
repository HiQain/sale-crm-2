import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("Seeding database...");

  // Admin user
  const passwordHash = await bcrypt.hash("admin", 12);
  const [admin] = await db
    .insert(schema.usersTable)
    .values({
      email: "admin@hiqain.com",
      name: "Admin",
      passwordHash,
      role: "admin",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning();
  console.log("Admin user:", admin?.email ?? "already exists");

  // Sample regular user
  const userHash = await bcrypt.hash("user123", 12);
  await db
    .insert(schema.usersTable)
    .values({
      email: "sarah@hiqain.com",
      name: "Sarah Miller",
      passwordHash: userHash,
      role: "user",
      isActive: true,
    })
    .onConflictDoNothing();

  // Sample leads
  const leads = [
    { contact: "+1-555-0101", email: "john.smith@acme.com", businessOwner: "John Smith", businessName: "Acme Corp", service: "SEO Package", response: "Interested", followUp: "2026-07-15", leadValue: 2500, leadAssignee: "Sarah Miller", status: "contacted" },
    { contact: "+1-555-0102", email: "emily.r@techwave.io", businessOwner: "Emily Rogers", businessName: "TechWave IO", service: "Social Media Management", response: "Requested demo", followUp: "2026-07-12", leadValue: 1800, leadAssignee: "Admin", status: "pending" },
    { contact: "+1-555-0103", email: "mike.chen@globalretail.com", businessOwner: "Mike Chen", businessName: "Global Retail Co", service: "PPC Campaign", response: "Ready to sign", followUp: "2026-07-10", leadValue: 4200, leadAssignee: "Sarah Miller", status: "paid" },
    { contact: "+1-555-0104", email: "lisa.park@freshstarts.co", businessOwner: "Lisa Park", businessName: "Fresh Starts", service: "Web Design", response: "Sent proposal", followUp: "2026-07-18", leadValue: 3500, leadAssignee: "Admin", status: "contacted" },
    { contact: "+1-555-0105", email: "david.w@sunrisefitness.com", businessOwner: "David Walsh", businessName: "Sunrise Fitness", service: "Email Marketing", response: "Needs follow-up", followUp: "2026-07-20", leadValue: 1200, leadAssignee: "Sarah Miller", status: "pending" },
    { contact: "+1-555-0106", email: "nancy.b@blueskykitchen.com", businessOwner: "Nancy Brown", businessName: "Blue Sky Kitchen", service: "SEO Package", response: "Very interested", followUp: "2026-07-11", leadValue: 2200, leadAssignee: "Admin", status: "contacted" },
    { contact: "+1-555-0107", email: "carlos.m@urbanbuilt.com", businessOwner: "Carlos Martinez", businessName: "Urban Built", service: "PPC Campaign", response: "Signed contract", followUp: "2026-07-08", leadValue: 5000, leadAssignee: "Sarah Miller", status: "paid" },
    { contact: "+1-555-0108", email: "anna.k@naturalskin.co", businessOwner: "Anna Kim", businessName: "Natural Skin Co", service: "Social Media Management", response: "Awaiting budget approval", followUp: "2026-07-22", leadValue: 900, leadAssignee: "Admin", status: "pending" },
  ];
  await db.insert(schema.leadsTable).values(leads).onConflictDoNothing();
  console.log("Leads inserted:", leads.length);

  // Sample client journeys
  const journeys = [
    { date: new Date("2026-06-01"), clientName: "Mike Chen", businessName: "Global Retail Co", email: "mike.chen@globalretail.com", phone: "+1-555-0103", sales: "Sarah Miller", leadAssignee: "Sarah Miller", service: "PPC Campaign", status: "paid", paidAmount: 4200, balance: 0, total: 4200 },
    { date: new Date("2026-06-10"), clientName: "Carlos Martinez", businessName: "Urban Built", email: "carlos.m@urbanbuilt.com", phone: "+1-555-0107", sales: "Sarah Miller", leadAssignee: "Sarah Miller", service: "PPC Campaign", status: "paid", paidAmount: 5000, balance: 0, total: 5000 },
    { date: new Date("2026-06-15"), clientName: "John Smith", businessName: "Acme Corp", email: "john.smith@acme.com", phone: "+1-555-0101", sales: "Admin", leadAssignee: "Sarah Miller", service: "SEO Package", status: "pending", paidAmount: 1000, balance: 1500, total: 2500 },
    { date: new Date("2026-06-20"), clientName: "Lisa Park", businessName: "Fresh Starts", email: "lisa.park@freshstarts.co", phone: "+1-555-0104", sales: "Admin", leadAssignee: "Admin", service: "Web Design", status: "pending", paidAmount: 1750, balance: 1750, total: 3500 },
    { date: new Date("2026-07-01"), clientName: "Nancy Brown", businessName: "Blue Sky Kitchen", email: "nancy.b@blueskykitchen.com", phone: "+1-555-0106", sales: "Admin", leadAssignee: "Admin", service: "SEO Package", status: "contacted", paidAmount: 0, balance: 2200, total: 2200 },
  ];
  await db.insert(schema.clientJourneysTable).values(journeys).onConflictDoNothing();
  console.log("Client journeys inserted:", journeys.length);

  // Sample billings
  const billings = [
    { invoiceDate: new Date("2026-06-01"), paymentDate: new Date("2026-06-03"), clientName: "Mike Chen", businessName: "Global Retail Co", paymentMethod: "Credit Card", service: "PPC Campaign", amount: 4200, feeDeducted: 126, netCurrency: 4074, leadAssignee: "Sarah Miller" },
    { invoiceDate: new Date("2026-06-10"), paymentDate: new Date("2026-06-11"), clientName: "Carlos Martinez", businessName: "Urban Built", paymentMethod: "Bank Transfer", service: "PPC Campaign", amount: 5000, feeDeducted: 0, netCurrency: 5000, leadAssignee: "Sarah Miller" },
    { invoiceDate: new Date("2026-06-15"), paymentDate: new Date("2026-06-18"), clientName: "John Smith", businessName: "Acme Corp", paymentMethod: "Credit Card", service: "SEO Package", amount: 1000, feeDeducted: 30, netCurrency: 970, leadAssignee: "Sarah Miller" },
    { invoiceDate: new Date("2026-06-20"), paymentDate: new Date("2026-06-22"), clientName: "Lisa Park", businessName: "Fresh Starts", paymentMethod: "PayPal", service: "Web Design", amount: 1750, feeDeducted: 52.5, netCurrency: 1697.5, leadAssignee: "Admin" },
    { invoiceDate: new Date("2026-07-01"), paymentDate: null, clientName: "Nancy Brown", businessName: "Blue Sky Kitchen", paymentMethod: "Pending", service: "SEO Package", amount: 2200, feeDeducted: 0, netCurrency: 0, leadAssignee: "Admin" },
  ];
  await db.insert(schema.billingsTable).values(billings).onConflictDoNothing();
  console.log("Billings inserted:", billings.length);

  await pool.end();
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
