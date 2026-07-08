import { Router } from "express";
import { db, activitiesTable, contactsTable, dealsTable, companiesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

const joinedSelect = {
  id: activitiesTable.id,
  type: activitiesTable.type,
  title: activitiesTable.title,
  description: activitiesTable.description,
  occurredAt: activitiesTable.occurredAt,
  contactId: activitiesTable.contactId,
  contactName: contactsTable.firstName,
  dealId: activitiesTable.dealId,
  dealTitle: dealsTable.title,
  companyId: activitiesTable.companyId,
  companyName: companiesTable.name,
  userId: activitiesTable.userId,
  userName: usersTable.name,
  createdAt: activitiesTable.createdAt,
};

// GET /api/activities
router.get("/activities", requireAuth, async (req, res) => {
  try {
    const { contactId, dealId, companyId, type } = req.query as Record<string, string>;
    const conditions = [];
    if (contactId) conditions.push(eq(activitiesTable.contactId, parseInt(contactId)));
    if (dealId) conditions.push(eq(activitiesTable.dealId, parseInt(dealId)));
    if (companyId) conditions.push(eq(activitiesTable.companyId, parseInt(companyId)));
    if (type) conditions.push(eq(activitiesTable.type, type));

    const activities = await db
      .select(joinedSelect)
      .from(activitiesTable)
      .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
      .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
      .leftJoin(companiesTable, eq(activitiesTable.companyId, companiesTable.id))
      .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activitiesTable.occurredAt));
    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "List activities error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/activities
router.post("/activities", requireAuth, async (req, res) => {
  try {
    const { type, title, description, occurredAt, contactId, dealId, companyId } = req.body;
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const [activity] = await db
      .insert(activitiesTable)
      .values({ type: type ?? "note", title, description, occurredAt: occurredAt ? new Date(occurredAt) : new Date(), contactId, dealId, companyId, userId: req.session.userId })
      .returning();
    const full = await getActivityWithJoins(activity.id);
    res.status(201).json(full);
  } catch (err) {
    req.log.error({ err }, "Create activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/activities/:id
router.get("/activities/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const activity = await getActivityWithJoins(id);
    if (!activity) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json(activity);
  } catch (err) {
    req.log.error({ err }, "Get activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/activities/:id
router.patch("/activities/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { type, title, description, occurredAt, contactId, dealId, companyId } = req.body;
    const updates: Record<string, unknown> = {};
    if (type !== undefined) updates.type = type;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (occurredAt !== undefined) updates.occurredAt = new Date(occurredAt);
    if (contactId !== undefined) updates.contactId = contactId;
    if (dealId !== undefined) updates.dealId = dealId;
    if (companyId !== undefined) updates.companyId = companyId;
    await db.update(activitiesTable).set(updates).where(eq(activitiesTable.id, id));
    const activity = await getActivityWithJoins(id);
    if (!activity) { res.status(404).json({ error: "Activity not found" }); return; }
    res.json(activity);
  } catch (err) {
    req.log.error({ err }, "Update activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/activities/:id
router.delete("/activities/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(activitiesTable).where(eq(activitiesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getActivityWithJoins(id: number) {
  const [activity] = await db
    .select(joinedSelect)
    .from(activitiesTable)
    .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
    .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
    .leftJoin(companiesTable, eq(activitiesTable.companyId, companiesTable.id))
    .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
    .where(eq(activitiesTable.id, id))
    .limit(1);
  return activity ?? null;
}

export default router;
