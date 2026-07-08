import { Router } from "express";
import { db, contactsTable, companiesTable, usersTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/contacts
router.get("/contacts", requireAuth, async (req, res) => {
  try {
    const { search, status, companyId } = req.query as Record<string, string>;
    const conditions = [];
    // Non-admin users only see contacts they own
    if (req.session.role !== "admin") {
      conditions.push(eq(contactsTable.ownerId, req.session.userId!));
    }
    if (search) {
      conditions.push(
        sql`(${ilike(contactsTable.firstName, `%${search}%`)} OR ${ilike(contactsTable.lastName, `%${search}%`)} OR ${ilike(contactsTable.email, `%${search}%`)})`
      );
    }
    if (status) conditions.push(eq(contactsTable.status, status));
    if (companyId) conditions.push(eq(contactsTable.companyId, parseInt(companyId)));

    const contacts = await db
      .select({
        id: contactsTable.id,
        firstName: contactsTable.firstName,
        lastName: contactsTable.lastName,
        email: contactsTable.email,
        phone: contactsTable.phone,
        title: contactsTable.title,
        companyId: contactsTable.companyId,
        companyName: companiesTable.name,
        status: contactsTable.status,
        source: contactsTable.source,
        tags: contactsTable.tags,
        notes: contactsTable.notes,
        ownerId: contactsTable.ownerId,
        ownerName: usersTable.name,
        createdAt: contactsTable.createdAt,
        updatedAt: contactsTable.updatedAt,
      })
      .from(contactsTable)
      .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
      .leftJoin(usersTable, eq(contactsTable.ownerId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(contactsTable.firstName);
    res.json(contacts);
  } catch (err) {
    req.log.error({ err }, "List contacts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contacts
router.post("/contacts", requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, title, companyId, status, source, tags, notes, ownerId } = req.body;
    if (!firstName || !lastName) {
      res.status(400).json({ error: "firstName and lastName are required" });
      return;
    }
    const [contact] = await db
      .insert(contactsTable)
      .values({ firstName, lastName, email, phone, title, companyId, status: status ?? "lead", source, tags, notes, ownerId })
      .returning();
    const full = await getContactWithJoins(contact.id);
    res.status(201).json(full);
  } catch (err) {
    req.log.error({ err }, "Create contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/contacts/:id
router.get("/contacts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const contact = await getContactWithJoins(id);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json(contact);
  } catch (err) {
    req.log.error({ err }, "Get contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/contacts/:id
router.patch("/contacts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { firstName, lastName, email, phone, title, companyId, status, source, tags, notes, ownerId } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (title !== undefined) updates.title = title;
    if (companyId !== undefined) updates.companyId = companyId;
    if (status !== undefined) updates.status = status;
    if (source !== undefined) updates.source = source;
    if (tags !== undefined) updates.tags = tags;
    if (notes !== undefined) updates.notes = notes;
    if (ownerId !== undefined) updates.ownerId = ownerId;
    await db.update(contactsTable).set(updates).where(eq(contactsTable.id, id));
    const contact = await getContactWithJoins(id);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json(contact);
  } catch (err) {
    req.log.error({ err }, "Update contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/contacts/:id
router.delete("/contacts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(contactsTable).where(eq(contactsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getContactWithJoins(id: number) {
  const [contact] = await db
    .select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      email: contactsTable.email,
      phone: contactsTable.phone,
      title: contactsTable.title,
      companyId: contactsTable.companyId,
      companyName: companiesTable.name,
      status: contactsTable.status,
      source: contactsTable.source,
      tags: contactsTable.tags,
      notes: contactsTable.notes,
      ownerId: contactsTable.ownerId,
      ownerName: usersTable.name,
      createdAt: contactsTable.createdAt,
      updatedAt: contactsTable.updatedAt,
    })
    .from(contactsTable)
    .leftJoin(companiesTable, eq(contactsTable.companyId, companiesTable.id))
    .leftJoin(usersTable, eq(contactsTable.ownerId, usersTable.id))
    .where(eq(contactsTable.id, id))
    .limit(1);
  return contact ?? null;
}

export default router;
