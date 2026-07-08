import { Router } from "express";
import { db, leadsTable, usersTable } from "@workspace/db";
import { eq, ilike, and, sql, sum, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/leads/stats
router.get("/leads/stats", requireAuth, async (req, res) => {
  try {
    const conditions = req.session.role !== "admin"
      ? [eq(leadsTable.ownerId, req.session.userId!)]
      : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db
      .select({
        totalLeads: count(leadsTable.id),
        activeLeads: sql<number>`count(*) filter (where ${leadsTable.status} != 'paid')`,
        paidLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'paid')`,
        paidRevenue: sql<number>`coalesce(sum(${leadsTable.leadValue}) filter (where ${leadsTable.status} = 'paid'), 0)`,
        totalRevenue: sql<number>`coalesce(sum(${leadsTable.leadValue}), 0)`,
      })
      .from(leadsTable)
      .where(where);

    res.json({
      totalLeads: Number(totals?.totalLeads ?? 0),
      activeLeads: Number(totals?.activeLeads ?? 0),
      paidLeads: Number(totals?.paidLeads ?? 0),
      paidRevenue: Number(totals?.paidRevenue ?? 0),
      totalRevenue: Number(totals?.totalRevenue ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Leads stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leads
router.get("/leads", requireAuth, async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const conditions = [];
    if (req.session.role !== "admin") {
      conditions.push(eq(leadsTable.ownerId, req.session.userId!));
    }
    if (search) {
      conditions.push(
        sql`(${ilike(leadsTable.contact, `%${search}%`)} OR ${ilike(leadsTable.email, `%${search}%`)} OR ${ilike(leadsTable.businessName, `%${search}%`)})`
      );
    }
    const leads = await db
      .select()
      .from(leadsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(leadsTable.createdAt);
    res.json(leads);
  } catch (err) {
    req.log.error({ err }, "List leads error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads
router.post("/leads", requireAuth, async (req, res) => {
  try {
    const { contact, email, businessOwner, businessName, service, response, followUp, leadValue, leadAssignee, status } = req.body;
    const [lead] = await db
      .insert(leadsTable)
      .values({
        contact, email, businessOwner, businessName, service, response, followUp,
        leadValue: leadValue ?? 0,
        leadAssignee,
        status: status ?? "pending",
        ownerId: req.session.userId,
      })
      .returning();
    res.status(201).json(lead);
  } catch (err) {
    req.log.error({ err }, "Create lead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/leads/:id
router.patch("/leads/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const fields = ["contact","email","businessOwner","businessName","service","response","followUp","leadValue","leadAssignee","status"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    const [lead] = await db.update(leadsTable).set(updates).where(eq(leadsTable.id, id)).returning();
    if (!lead) { res.status(404).json({ error: "Not found" }); return; }
    res.json(lead);
  } catch (err) {
    req.log.error({ err }, "Update lead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/leads/:id
router.delete("/leads/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(leadsTable).where(eq(leadsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete lead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
