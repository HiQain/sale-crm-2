import {
  billingsTable,
  clientJourneysTable,
  companiesTable,
  contactsTable,
  db,
  dealsTable,
  leadsTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

const COMPANY_ROWS = [
  { name: "Acme Corp", industry: "Manufacturing", website: "https://acme.example.com", phone: "+1-555-0101", employeeCount: 250, annualRevenue: "12000000" },
  { name: "Globex Inc", industry: "Technology", website: "https://globex.example.com", phone: "+1-555-0102", employeeCount: 80, annualRevenue: "4500000" },
  { name: "Initech", industry: "Software", website: "https://initech.example.com", phone: "+1-555-0103", employeeCount: 40, annualRevenue: "2100000" },
  { name: "Umbrella Retail", industry: "Retail", website: "https://umbrellaretail.example.com", phone: "+1-555-0104", employeeCount: 500, annualRevenue: "30000000" },
  { name: "Hooli", industry: "Technology", website: "https://hooli.example.com", phone: "+1-555-0105", employeeCount: 1200, annualRevenue: "90000000" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password", 12);

  await db.transaction(async (tx) => {
    let [admin] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "admin@hiqain.com"))
      .limit(1);

    if (admin) {
      await tx
        .update(usersTable)
        .set({ passwordHash, role: "admin", isActive: true, updatedAt: new Date() })
        .where(eq(usersTable.id, admin.id));
      [admin] = await tx.select().from(usersTable).where(eq(usersTable.id, admin.id)).limit(1);
    } else {
      const insertResult = await tx.insert(usersTable).values({
        email: "admin@hiqain.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        isActive: true,
      });
      [admin] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, Number(((insertResult as unknown as [{ insertId: number }])[0]).insertId)))
        .limit(1);
    }

    console.log(`Admin user ready: ${admin.email} (id ${admin.id})`);

    const [existingCompany] = await tx
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .limit(1);

    if (existingCompany) {
      console.log("Sample data already present - skipping remaining seed rows.");
      return;
    }

    await tx.insert(companiesTable).values(COMPANY_ROWS);
    const companies = await tx
      .select()
      .from(companiesTable)
      .where(inArray(companiesTable.name, COMPANY_ROWS.map((row) => row.name)));
    console.log(`Seeded ${companies.length} companies`);

    const companyByName = new Map(companies.map((company) => [company.name, company]));

    const contactRows = [
      { firstName: "John", lastName: "Doe", email: "john.doe@acme.example.com", phone: "+1-555-0201", title: "VP Operations", companyId: companyByName.get("Acme Corp")?.id, status: "customer", source: "referral", ownerId: admin.id },
      { firstName: "Jane", lastName: "Smith", email: "jane.smith@globex.example.com", phone: "+1-555-0202", title: "Head of IT", companyId: companyByName.get("Globex Inc")?.id, status: "prospect", source: "website", ownerId: admin.id },
      { firstName: "Michael", lastName: "Bolton", email: "michael.bolton@initech.example.com", phone: "+1-555-0203", title: "Engineering Manager", companyId: companyByName.get("Initech")?.id, status: "lead", source: "cold-call", ownerId: admin.id },
      { firstName: "Sarah", lastName: "Connor", email: "sarah.connor@umbrellaretail.example.com", phone: "+1-555-0204", title: "Procurement Lead", companyId: companyByName.get("Umbrella Retail")?.id, status: "customer", source: "trade-show", ownerId: admin.id },
      { firstName: "Gavin", lastName: "Belson", email: "gavin.belson@hooli.example.com", phone: "+1-555-0205", title: "CEO", companyId: companyByName.get("Hooli")?.id, status: "prospect", source: "referral", ownerId: admin.id },
    ];

    await tx.insert(contactsTable).values(contactRows);
    const contacts = await tx
      .select()
      .from(contactsTable)
      .where(inArray(contactsTable.email, contactRows.map((row) => row.email!)));
    console.log(`Seeded ${contacts.length} contacts`);

    const contactByEmail = new Map(contacts.map((contact) => [contact.email, contact]));

    const leadRows = [
      { contact: "(555) 000-0301", email: "lead1@example.com", businessOwner: "Alex Turner", businessName: "Turner Consulting", service: "Web Design", response: "Interested", followUp: "2026-07-16", leadValue: 1500, leadAssignee: "admin", status: "pending" },
      { contact: "(555) 000-0302", email: "lead2@example.com", businessOwner: "Priya Nair", businessName: "Nair Logistics", service: "SEO", response: "Requested proposal", followUp: "2026-07-14", leadValue: 3200, leadAssignee: "admin", status: "contacted" },
      { contact: "(555) 000-0303", email: "lead3@example.com", businessOwner: "Carlos Mendez", businessName: "Mendez Auto", service: "Branding", response: "Signed up", followUp: "2026-07-10", leadValue: 5000, leadAssignee: "admin", status: "paid" },
      { contact: "(555) 000-0304", email: "lead4@example.com", businessOwner: "Olivia Park", businessName: "Park Bakery", service: "Social Media", response: "No response yet", followUp: "2026-07-20", leadValue: 800, leadAssignee: "admin", status: "pending" },
      { contact: "(555) 000-0305", email: "lead5@example.com", businessOwner: "Ethan Brooks", businessName: "Brooks Fitness", service: "Web Design", response: "Onboarded", followUp: "2026-07-09", leadValue: 2200, leadAssignee: "admin", status: "paid" },
    ];

    await tx.insert(leadsTable).values(
      leadRows.map((lead) => ({
        ...lead,
        ownerId: admin.id,
        customData: {},
        multiValues: { contact: [lead.contact], email: [lead.email] },
      })),
    );
    console.log(`Seeded ${leadRows.length} leads`);

    const dealRows = [
      { title: "Acme Corp - Annual Contract", stage: "negotiation", value: "45000", probability: 70, expectedCloseDate: new Date("2026-08-15"), contactId: contactByEmail.get("john.doe@acme.example.com")?.id, companyId: companyByName.get("Acme Corp")?.id, ownerId: admin.id },
      { title: "Globex - Platform Migration", stage: "proposal", value: "22000", probability: 50, expectedCloseDate: new Date("2026-09-01"), contactId: contactByEmail.get("jane.smith@globex.example.com")?.id, companyId: companyByName.get("Globex Inc")?.id, ownerId: admin.id },
      { title: "Initech - Support Retainer", stage: "prospecting", value: "8000", probability: 20, expectedCloseDate: new Date("2026-10-10"), contactId: contactByEmail.get("michael.bolton@initech.example.com")?.id, companyId: companyByName.get("Initech")?.id, ownerId: admin.id },
      { title: "Umbrella Retail - POS Rollout", stage: "closed_won", value: "60000", probability: 100, expectedCloseDate: new Date("2026-06-30"), contactId: contactByEmail.get("sarah.connor@umbrellaretail.example.com")?.id, companyId: companyByName.get("Umbrella Retail")?.id, ownerId: admin.id },
      { title: "Hooli - Enterprise Deal", stage: "qualification", value: "120000", probability: 30, expectedCloseDate: new Date("2026-11-20"), contactId: contactByEmail.get("gavin.belson@hooli.example.com")?.id, companyId: companyByName.get("Hooli")?.id, ownerId: admin.id },
    ];

    await tx.insert(dealsTable).values(dealRows);
    const deals = await tx
      .select()
      .from(dealsTable)
      .where(inArray(dealsTable.title, dealRows.map((row) => row.title)));
    console.log(`Seeded ${deals.length} deals`);

    const dealByTitle = new Map(deals.map((deal) => [deal.title, deal]));

    await tx.insert(tasksTable).values([
      { title: "Follow up with Acme on contract terms", status: "in_progress", priority: "high", dueDate: new Date("2026-07-15"), assigneeId: admin.id, contactId: contactByEmail.get("john.doe@acme.example.com")?.id, dealId: dealByTitle.get("Acme Corp - Annual Contract")?.id },
      { title: "Send proposal to Globex", status: "todo", priority: "medium", dueDate: new Date("2026-07-18"), assigneeId: admin.id, contactId: contactByEmail.get("jane.smith@globex.example.com")?.id, dealId: dealByTitle.get("Globex - Platform Migration")?.id },
      { title: "Schedule discovery call with Initech", status: "todo", priority: "low", dueDate: new Date("2026-07-22"), assigneeId: admin.id, contactId: contactByEmail.get("michael.bolton@initech.example.com")?.id, dealId: dealByTitle.get("Initech - Support Retainer")?.id },
      { title: "Confirm POS install schedule with Umbrella", status: "done", priority: "medium", dueDate: new Date("2026-06-28"), assigneeId: admin.id, contactId: contactByEmail.get("sarah.connor@umbrellaretail.example.com")?.id, dealId: dealByTitle.get("Umbrella Retail - POS Rollout")?.id },
      { title: "Prep enterprise pitch deck for Hooli", status: "in_progress", priority: "urgent", dueDate: new Date("2026-07-12"), assigneeId: admin.id, contactId: contactByEmail.get("gavin.belson@hooli.example.com")?.id, dealId: dealByTitle.get("Hooli - Enterprise Deal")?.id },
    ]);
    console.log("Seeded 5 tasks");

    await tx.insert(clientJourneysTable).values([
      { date: new Date("2026-06-01"), clientName: "Carlos Mendez", businessName: "Mendez Auto", email: "lead3@example.com", phone: "(555) 000-0303", sales: "Admin", leadAssignee: "admin", service: "Branding", status: "paid", paidAmount: 5000, balance: 0, total: 5000, ownerId: admin.id },
      { date: new Date("2026-06-10"), clientName: "Ethan Brooks", businessName: "Brooks Fitness", email: "lead5@example.com", phone: "(555) 000-0305", sales: "Admin", leadAssignee: "admin", service: "Web Design", status: "paid", paidAmount: 2200, balance: 0, total: 2200, ownerId: admin.id },
      { date: new Date("2026-06-20"), clientName: "Priya Nair", businessName: "Nair Logistics", email: "lead2@example.com", phone: "(555) 000-0302", sales: "Admin", leadAssignee: "admin", service: "SEO", status: "pending", paidAmount: 1600, balance: 1600, total: 3200, ownerId: admin.id },
      { date: new Date("2026-07-01"), clientName: "Alex Turner", businessName: "Turner Consulting", email: "lead1@example.com", phone: "(555) 000-0301", sales: "Admin", leadAssignee: "admin", service: "Web Design", status: "pending", paidAmount: 0, balance: 1500, total: 1500, ownerId: admin.id },
      { date: new Date("2026-07-05"), clientName: "Olivia Park", businessName: "Park Bakery", email: "lead4@example.com", phone: "(555) 000-0304", sales: "Admin", leadAssignee: "admin", service: "Social Media", status: "pending", paidAmount: 400, balance: 400, total: 800, ownerId: admin.id },
    ]);
    console.log("Seeded 5 client journeys");

    await tx.insert(billingsTable).values([
      { invoiceDate: new Date("2026-06-01"), paymentDate: new Date("2026-06-03"), clientName: "Carlos Mendez", businessName: "Mendez Auto", paymentMethod: "Credit Card", service: "Branding", amount: 5000, feeDeducted: 150, netCurrency: 4850, leadAssignee: "admin", ownerId: admin.id },
      { invoiceDate: new Date("2026-06-10"), paymentDate: new Date("2026-06-11"), clientName: "Ethan Brooks", businessName: "Brooks Fitness", paymentMethod: "Bank Transfer", service: "Web Design", amount: 2200, feeDeducted: 0, netCurrency: 2200, leadAssignee: "admin", ownerId: admin.id },
      { invoiceDate: new Date("2026-06-20"), paymentDate: new Date("2026-06-22"), clientName: "Priya Nair", businessName: "Nair Logistics", paymentMethod: "Credit Card", service: "SEO", amount: 1600, feeDeducted: 48, netCurrency: 1552, leadAssignee: "admin", ownerId: admin.id },
      { invoiceDate: new Date("2026-07-01"), paymentDate: null, clientName: "Alex Turner", businessName: "Turner Consulting", paymentMethod: "Pending", service: "Web Design", amount: 1500, feeDeducted: 0, netCurrency: 0, leadAssignee: "admin", ownerId: admin.id },
      { invoiceDate: new Date("2026-07-05"), paymentDate: new Date("2026-07-05"), clientName: "Olivia Park", businessName: "Park Bakery", paymentMethod: "PayPal", service: "Social Media", amount: 400, feeDeducted: 12, netCurrency: 388, leadAssignee: "admin", ownerId: admin.id },
    ]);
    console.log("Seeded 5 billings");
  });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
