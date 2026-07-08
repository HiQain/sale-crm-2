import { Router } from "express";
import { db, clientJourneysTable } from "@workspace/db";
import { eq, ilike, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/client-journeys/stats
router.get("/client-journeys/stats", requireAuth, async (req, res) => {
  try {
    const conditions = req.session.role !== "admin"
      ? [eq(clientJourneysTable.ownerId, req.session.userId!)]
      : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db
      .select({
        totalJourneys: count(clientJourneysTable.id),
        paidJourneys: sql<number>`count(*) filter (where ${clientJourneysTable.status} = 'paid')`,
        paidRevenue: sql<number>`coalesce(sum(${clientJourneysTable.paidAmount}) filter (where ${clientJourneysTable.status} = 'paid'), 0)`,
        totalRevenue: sql<number>`coalesce(sum(${clientJourneysTable.total}), 0)`,
      })
      .from(clientJourneysTable)
      .where(where);

    res.json({
      totalJourneys: Number(totals?.totalJourneys ?? 0),
      paidJourneys: Number(totals?.paidJourneys ?? 0),
      paidRevenue: Number(totals?.paidRevenue ?? 0),
      totalRevenue: Number(totals?.totalRevenue ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Client journeys stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/client-journeys
router.get("/client-journeys", requireAuth, async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const conditions = [];
    if (req.session.role !== "admin") {
      conditions.push(eq(clientJourneysTable.ownerId, req.session.userId!));
    }
    if (search) {
      conditions.push(
        sql`(${ilike(clientJourneysTable.clientName, `%${search}%`)} OR ${ilike(clientJourneysTable.businessName, `%${search}%`)} OR ${ilike(clientJourneysTable.email, `%${search}%`)})`
      );
    }
    const journeys = await db
      .select()
      .from(clientJourneysTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(clientJourneysTable.createdAt);
    res.json(journeys);
  } catch (err) {
    req.log.error({ err }, "List client journeys error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/client-journeys
router.post("/client-journeys", requireAuth, async (req, res) => {
  try {
    const { date, clientName, businessName, creditCard, email, phone, sales, leadAssignee, service, status, paidAmount, balance, total } = req.body;
    const [journey] = await db
      .insert(clientJourneysTable)
      .values({
        date: date ? new Date(date) : undefined,
        clientName, businessName, creditCard, email, phone, sales, leadAssignee, service,
        status: status ?? "pending",
        paidAmount: paidAmount ?? 0,
        balance: balance ?? 0,
        total: total ?? 0,
        ownerId: req.session.userId,
      })
      .returning();
    res.status(201).json(journey);
  } catch (err) {
    req.log.error({ err }, "Create client journey error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/client-journeys/:id
router.patch("/client-journeys/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const fields = ["date","clientName","businessName","creditCard","email","phone","sales","leadAssignee","service","status","paidAmount","balance","total"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates[f] = f === "date" && req.body[f] ? new Date(req.body[f]) : req.body[f];
      }
    }
    const [journey] = await db.update(clientJourneysTable).set(updates).where(eq(clientJourneysTable.id, id)).returning();
    if (!journey) { res.status(404).json({ error: "Not found" }); return; }
    res.json(journey);
  } catch (err) {
    req.log.error({ err }, "Update client journey error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/client-journeys/:id
router.delete("/client-journeys/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(clientJourneysTable).where(eq(clientJourneysTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete client journey error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
