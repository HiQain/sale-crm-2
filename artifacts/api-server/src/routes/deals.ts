import { Router } from "express";
import { db, dealsTable, contactsTable, companiesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { containsCI, extractInsertId } from "../lib/mysql";

const router = Router();

// GET /api/deals
router.get("/deals", requireAuth, async (req, res) => {
  try {
    const { search, stage, ownerId, contactId, companyId } = req.query as Record<string, string>;
    const conditions = [];
    // Non-admin users only see deals they own
    if (req.session.role !== "admin") {
      conditions.push(eq(dealsTable.ownerId, req.session.userId!));
    }
    if (search) conditions.push(containsCI(dealsTable.title, search));
    if (stage) conditions.push(eq(dealsTable.stage, stage));
    if (ownerId) conditions.push(eq(dealsTable.ownerId, parseInt(ownerId)));
    if (contactId) conditions.push(eq(dealsTable.contactId, parseInt(contactId)));
    if (companyId) conditions.push(eq(dealsTable.companyId, parseInt(companyId)));

    const deals = await db
      .select({
        id: dealsTable.id,
        title: dealsTable.title,
        stage: dealsTable.stage,
        value: dealsTable.value,
        currency: dealsTable.currency,
        probability: dealsTable.probability,
        expectedCloseDate: dealsTable.expectedCloseDate,
        contactId: dealsTable.contactId,
        contactName: contactsTable.firstName,
        companyId: dealsTable.companyId,
        companyName: companiesTable.name,
        ownerId: dealsTable.ownerId,
        ownerName: usersTable.name,
        notes: dealsTable.notes,
        createdAt: dealsTable.createdAt,
        updatedAt: dealsTable.updatedAt,
      })
      .from(dealsTable)
      .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
      .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
      .leftJoin(usersTable, eq(dealsTable.ownerId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(dealsTable.createdAt);

    res.json(deals.map(serializeDeal));
  } catch (err) {
    req.log.error({ err }, "List deals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/deals
router.post("/deals", requireAuth, async (req, res) => {
  try {
    const { title, stage, value, currency, probability, expectedCloseDate, contactId, companyId, ownerId, notes } = req.body;
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const insertResult = await db
      .insert(dealsTable)
      .values({ title, stage: stage ?? "prospecting", value: value?.toString(), currency: currency ?? "USD", probability, expectedCloseDate, contactId, companyId, ownerId, notes });
    const full = await getDealWithJoins(extractInsertId(insertResult));
    res.status(201).json(full);
  } catch (err) {
    req.log.error({ err }, "Create deal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/deals/:id
router.get("/deals/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const deal = await getDealWithJoins(id);
    if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
    res.json(deal);
  } catch (err) {
    req.log.error({ err }, "Get deal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/deals/:id
router.patch("/deals/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { title, stage, value, currency, probability, expectedCloseDate, contactId, companyId, ownerId, notes } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (stage !== undefined) updates.stage = stage;
    if (value !== undefined) updates.value = value?.toString();
    if (currency !== undefined) updates.currency = currency;
    if (probability !== undefined) updates.probability = probability;
    if (expectedCloseDate !== undefined) updates.expectedCloseDate = expectedCloseDate;
    if (contactId !== undefined) updates.contactId = contactId;
    if (companyId !== undefined) updates.companyId = companyId;
    if (ownerId !== undefined) updates.ownerId = ownerId;
    if (notes !== undefined) updates.notes = notes;
    await db.update(dealsTable).set(updates).where(eq(dealsTable.id, id));
    const deal = await getDealWithJoins(id);
    if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
    res.json(deal);
  } catch (err) {
    req.log.error({ err }, "Update deal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/deals/:id
router.delete("/deals/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(dealsTable).where(eq(dealsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete deal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getDealWithJoins(id: number) {
  const [deal] = await db
    .select({
      id: dealsTable.id,
      title: dealsTable.title,
      stage: dealsTable.stage,
      value: dealsTable.value,
      currency: dealsTable.currency,
      probability: dealsTable.probability,
      expectedCloseDate: dealsTable.expectedCloseDate,
      contactId: dealsTable.contactId,
      contactName: contactsTable.firstName,
      companyId: dealsTable.companyId,
      companyName: companiesTable.name,
      ownerId: dealsTable.ownerId,
      ownerName: usersTable.name,
      notes: dealsTable.notes,
      createdAt: dealsTable.createdAt,
      updatedAt: dealsTable.updatedAt,
    })
    .from(dealsTable)
    .leftJoin(contactsTable, eq(dealsTable.contactId, contactsTable.id))
    .leftJoin(companiesTable, eq(dealsTable.companyId, companiesTable.id))
    .leftJoin(usersTable, eq(dealsTable.ownerId, usersTable.id))
    .where(eq(dealsTable.id, id))
    .limit(1);
  return deal ? serializeDeal(deal) : null;
}

function serializeDeal(d: Record<string, unknown>) {
  return {
    ...d,
    value: d.value != null ? parseFloat(d.value as string) : null,
  };
}

export default router;
