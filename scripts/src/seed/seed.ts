import { db, usersTable, companiesTable, contactsTable, leadsTable, dealsTable, tasksTable, clientJourneysTable, billingsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("admin", 12);

  await db.transaction(async (tx) => {
    // --- Admin user (upsert) ---
    const [admin] = await tx
      .insert(usersTable)
      .values({
        email: "admin@hiqain.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: usersTable.email,
        set: { passwordHash, role: "admin", isActive: true },
      })
      .returning();

    console.log(`Admin user ready: ${admin.email} (id ${admin.id})`);

    // --- Companies (skip duplicates by name) ---
    const companies = await tx
      .insert(companiesTable)
      .values([
        { name: "Acme Corp", industry: "Manufacturing", website: "https://acme.example.com", phone: "+1-555-0101", employeeCount: 250, annualRevenue: "12000000" },
        { name: "Globex Inc", industry: "Technology", website: "https://globex.example.com", phone: "+1-555-0102", employeeCount: 80, annualRevenue: "4500000" },
        { name: "Initech", industry: "Software", website: "https://initech.example.com", phone: "+1-555-0103", employeeCount: 40, annualRevenue: "2100000" },
        { name: "Umbrella Retail", industry: "Retail", website: "https://umbrellaretail.example.com", phone: "+1-555-0104", employeeCount: 500, annualRevenue: "30000000" },
        { name: "Hooli", industry: "Technology", website: "https://hooli.example.com", phone: "+1-555-0105", employeeCount: 1200, annualRevenue: "90000000" },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${companies.length} companies`);

    if (companies.length === 0) {
      console.log("Sample data already present — skipping remaining seed rows.");
      return;
    }

    // --- Contacts ---
    const contacts = await tx
      .insert(contactsTable)
      .values([
        { firstName: "John", lastName: "Doe", email: "john.doe@acme.example.com", phone: "+1-555-0201", title: "VP Operations", companyId: companies[0].id, status: "customer", source: "referral", ownerId: admin.id },
        { firstName: "Jane", lastName: "Smith", email: "jane.smith@globex.example.com", phone: "+1-555-0202", title: "Head of IT", companyId: companies[1].id, status: "prospect", source: "website", ownerId: admin.id },
        { firstName: "Michael", lastName: "Bolton", email: "michael.bolton@initech.example.com", phone: "+1-555-0203", title: "Engineering Manager", companyId: companies[2].id, status: "lead", source: "cold-call", ownerId: admin.id },
        { firstName: "Sarah", lastName: "Connor", email: "sarah.connor@umbrellaretail.example.com", phone: "+1-555-0204", title: "Procurement Lead", companyId: companies[3].id, status: "customer", source: "trade-show", ownerId: admin.id },
        { firstName: "Gavin", lastName: "Belson", email: "gavin.belson@hooli.example.com", phone: "+1-555-0205", title: "CEO", companyId: companies[4].id, status: "prospect", source: "referral", ownerId: admin.id },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${contacts.length} contacts`);

    // --- Leads ---
    const leadDefs = [
      { contact: "(555) 000-0301", email: "lead1@example.com", businessOwner: "Alex Turner", businessName: "Turner Consulting", service: "Web Design", response: "Interested", followUp: "2026-07-16", leadValue: 1500, leadAssignee: "admin", status: "pending" },
      { contact: "(555) 000-0302", email: "lead2@example.com", businessOwner: "Priya Nair", businessName: "Nair Logistics", service: "SEO", response: "Requested proposal", followUp: "2026-07-14", leadValue: 3200, leadAssignee: "admin", status: "contacted" },
      { contact: "(555) 000-0303", email: "lead3@example.com", businessOwner: "Carlos Mendez", businessName: "Mendez Auto", service: "Branding", response: "Signed up", followUp: "2026-07-10", leadValue: 5000, leadAssignee: "admin", status: "paid" },
      { contact: "(555) 000-0304", email: "lead4@example.com", businessOwner: "Olivia Park", businessName: "Park Bakery", service: "Social Media", response: "No response yet", followUp: "2026-07-20", leadValue: 800, leadAssignee: "admin", status: "pending" },
      { contact: "(555) 000-0305", email: "lead5@example.com", businessOwner: "Ethan Brooks", businessName: "Brooks Fitness", service: "Web Design", response: "Onboarded", followUp: "2026-07-09", leadValue: 2200, leadAssignee: "admin", status: "paid" },
    ];
    const leads = await tx
      .insert(leadsTable)
      .values(
        leadDefs.map((l) => ({
          ...l,
          ownerId: admin.id,
          multiValues: { contact: [l.contact], email: [l.email] },
        }))
      )
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${leads.length} leads`);

    // --- Deals ---
    const deals = await tx
      .insert(dealsTable)
      .values([
        { title: "Acme Corp - Annual Contract", stage: "negotiation", value: "45000", probability: 70, expectedCloseDate: "2026-08-15", contactId: contacts[0].id, companyId: companies[0].id, ownerId: admin.id },
        { title: "Globex - Platform Migration", stage: "proposal", value: "22000", probability: 50, expectedCloseDate: "2026-09-01", contactId: contacts[1].id, companyId: companies[1].id, ownerId: admin.id },
        { title: "Initech - Support Retainer", stage: "prospecting", value: "8000", probability: 20, expectedCloseDate: "2026-10-10", contactId: contacts[2].id, companyId: companies[2].id, ownerId: admin.id },
        { title: "Umbrella Retail - POS Rollout", stage: "closed_won", value: "60000", probability: 100, expectedCloseDate: "2026-06-30", contactId: contacts[3].id, companyId: companies[3].id, ownerId: admin.id },
        { title: "Hooli - Enterprise Deal", stage: "qualification", value: "120000", probability: 30, expectedCloseDate: "2026-11-20", contactId: contacts[4].id, companyId: companies[4].id, ownerId: admin.id },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${deals.length} deals`);

    // --- Tasks ---
    const tasks = await tx
      .insert(tasksTable)
      .values([
        { title: "Follow up with Acme on contract terms", status: "in_progress", priority: "high", dueDate: new Date("2026-07-15"), assigneeId: admin.id, contactId: contacts[0].id, dealId: deals[0].id },
        { title: "Send proposal to Globex", status: "todo", priority: "medium", dueDate: new Date("2026-07-18"), assigneeId: admin.id, contactId: contacts[1].id, dealId: deals[1].id },
        { title: "Schedule discovery call with Initech", status: "todo", priority: "low", dueDate: new Date("2026-07-22"), assigneeId: admin.id, contactId: contacts[2].id, dealId: deals[2].id },
        { title: "Confirm POS install schedule with Umbrella", status: "done", priority: "medium", dueDate: new Date("2026-06-28"), assigneeId: admin.id, contactId: contacts[3].id, dealId: deals[3].id },
        { title: "Prep enterprise pitch deck for Hooli", status: "in_progress", priority: "urgent", dueDate: new Date("2026-07-12"), assigneeId: admin.id, contactId: contacts[4].id, dealId: deals[4].id },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${tasks.length} tasks`);

    // --- Client Journeys ---
    const journeys = await tx
      .insert(clientJourneysTable)
      .values([
        { date: new Date("2026-06-01"), clientName: "Carlos Mendez", businessName: "Mendez Auto", email: "lead3@example.com", phone: "(555) 000-0303", sales: "Admin", leadAssignee: "admin", service: "Branding", status: "paid", paidAmount: 5000, balance: 0, total: 5000, ownerId: admin.id },
        { date: new Date("2026-06-10"), clientName: "Ethan Brooks", businessName: "Brooks Fitness", email: "lead5@example.com", phone: "(555) 000-0305", sales: "Admin", leadAssignee: "admin", service: "Web Design", status: "paid", paidAmount: 2200, balance: 0, total: 2200, ownerId: admin.id },
        { date: new Date("2026-06-20"), clientName: "Priya Nair", businessName: "Nair Logistics", email: "lead2@example.com", phone: "(555) 000-0302", sales: "Admin", leadAssignee: "admin", service: "SEO", status: "pending", paidAmount: 1600, balance: 1600, total: 3200, ownerId: admin.id },
        { date: new Date("2026-07-01"), clientName: "Alex Turner", businessName: "Turner Consulting", email: "lead1@example.com", phone: "(555) 000-0301", sales: "Admin", leadAssignee: "admin", service: "Web Design", status: "pending", paidAmount: 0, balance: 1500, total: 1500, ownerId: admin.id },
        { date: new Date("2026-07-05"), clientName: "Olivia Park", businessName: "Park Bakery", email: "lead4@example.com", phone: "(555) 000-0304", sales: "Admin", leadAssignee: "admin", service: "Social Media", status: "pending", paidAmount: 400, balance: 400, total: 800, ownerId: admin.id },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${journeys.length} client journeys`);

    // --- Billings ---
    const billings = await tx
      .insert(billingsTable)
      .values([
        { invoiceDate: new Date("2026-06-01"), paymentDate: new Date("2026-06-03"), clientName: "Carlos Mendez", businessName: "Mendez Auto", paymentMethod: "Credit Card", service: "Branding", amount: 5000, feeDeducted: 150, netCurrency: 4850, leadAssignee: "admin", ownerId: admin.id },
        { invoiceDate: new Date("2026-06-10"), paymentDate: new Date("2026-06-11"), clientName: "Ethan Brooks", businessName: "Brooks Fitness", paymentMethod: "Bank Transfer", service: "Web Design", amount: 2200, feeDeducted: 0, netCurrency: 2200, leadAssignee: "admin", ownerId: admin.id },
        { invoiceDate: new Date("2026-06-20"), paymentDate: new Date("2026-06-22"), clientName: "Priya Nair", businessName: "Nair Logistics", paymentMethod: "Credit Card", service: "SEO", amount: 1600, feeDeducted: 48, netCurrency: 1552, leadAssignee: "admin", ownerId: admin.id },
        { invoiceDate: new Date("2026-07-01"), paymentDate: null, clientName: "Alex Turner", businessName: "Turner Consulting", paymentMethod: "Pending", service: "Web Design", amount: 1500, feeDeducted: 0, netCurrency: 0, leadAssignee: "admin", ownerId: admin.id },
        { invoiceDate: new Date("2026-07-05"), paymentDate: new Date("2026-07-05"), clientName: "Olivia Park", businessName: "Park Bakery", paymentMethod: "PayPal", service: "Social Media", amount: 400, feeDeducted: 12, netCurrency: 388, leadAssignee: "admin", ownerId: admin.id },
      ])
      .onConflictDoNothing()
      .returning();
    console.log(`Seeded ${billings.length} billings`);
  });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
