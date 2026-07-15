import { Router } from "express";
import { db, billingsTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { containsCI, extractInsertId } from "../lib/mysql";

const router = Router();

// GET /api/billings/stats
router.get("/billings/stats", requireAuth, async (req, res) => {
  try {
    const conditions = req.session.role !== "admin"
      ? [eq(billingsTable.ownerId, req.session.userId!)]
      : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db
      .select({
        totalBillings: count(billingsTable.id),
        paymentsReceived: sql<number>`coalesce(sum(case when ${billingsTable.paymentDate} is not null then 1 else 0 end), 0)`,
        grossAmount: sql<number>`coalesce(sum(${billingsTable.amount}), 0)`,
        netCurrency: sql<number>`coalesce(sum(${billingsTable.netCurrency}), 0)`,
      })
      .from(billingsTable)
      .where(where);

    res.json({
      totalBillings: Number(totals?.totalBillings ?? 0),
      paymentsReceived: Number(totals?.paymentsReceived ?? 0),
      grossAmount: Number(totals?.grossAmount ?? 0),
      netCurrency: Number(totals?.netCurrency ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Billings stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/billings
router.get("/billings", requireAuth, async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const conditions = [];
    if (req.session.role !== "admin") {
      conditions.push(eq(billingsTable.ownerId, req.session.userId!));
    }
    if (search) {
      conditions.push(
        sql`(${containsCI(billingsTable.clientName, search)} OR ${containsCI(billingsTable.businessName, search)} OR ${containsCI(billingsTable.service, search)})`
      );
    }
    const billings = await db
      .select()
      .from(billingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(billingsTable.createdAt);
    res.json(billings);
  } catch (err) {
    req.log.error({ err }, "List billings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/billings
router.post("/billings", requireAuth, async (req, res) => {
  try {
    const { invoiceDate, paymentDate, clientName, businessName, paymentMethod, service, amount, feeDeducted, netCurrency, leadAssignee } = req.body;
    const insertResult = await db
      .insert(billingsTable)
      .values({
        invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        clientName, businessName, paymentMethod, service,
        amount: amount ?? 0,
        feeDeducted: feeDeducted ?? 0,
        netCurrency: netCurrency ?? 0,
        leadAssignee,
        ownerId: req.session.userId,
      });
    const [billing] = await db.select().from(billingsTable).where(eq(billingsTable.id, extractInsertId(insertResult))).limit(1);
    res.status(201).json(billing);
  } catch (err) {
    req.log.error({ err }, "Create billing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/billings/:id
router.patch("/billings/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const fields = ["invoiceDate","paymentDate","clientName","businessName","paymentMethod","service","amount","feeDeducted","netCurrency","leadAssignee"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates[f] = (f === "invoiceDate" || f === "paymentDate") && req.body[f]
          ? new Date(req.body[f]) : req.body[f];
      }
    }
    await db.update(billingsTable).set(updates).where(eq(billingsTable.id, id));
    const [billing] = await db.select().from(billingsTable).where(eq(billingsTable.id, id)).limit(1);
    if (!billing) { res.status(404).json({ error: "Not found" }); return; }
    res.json(billing);
  } catch (err) {
    req.log.error({ err }, "Update billing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/billings/:id
router.delete("/billings/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(billingsTable).where(eq(billingsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete billing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
