import { Router } from "express";
import { db, leadsTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { containsCI, extractInsertId } from "../lib/mysql";

const router = Router();

const MULTI_SYNC_COLS = new Set([
  "contact",
  "email",
  "businessName",
  "businessOwner",
  "service",
  "response",
]);

router.get("/leads/stats", requireAuth, async (req, res) => {
  try {
    const conditions =
      req.session.role !== "admin"
        ? [eq(leadsTable.ownerId, req.session.userId!)]
        : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db
      .select({
        totalLeads: count(leadsTable.id),
        activeLeads: sql<number>`coalesce(sum(case when ${leadsTable.status} != 'paid' then 1 else 0 end), 0)`,
        paidLeads: sql<number>`coalesce(sum(case when ${leadsTable.status} = 'paid' then 1 else 0 end), 0)`,
        paidRevenue: sql<number>`coalesce(sum(case when ${leadsTable.status} = 'paid' then ${leadsTable.leadValue} else 0 end), 0)`,
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

router.get("/leads", requireAuth, async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;
    const conditions = [];
    if (req.session.role !== "admin") {
      conditions.push(eq(leadsTable.ownerId, req.session.userId!));
    }
    if (search) {
      conditions.push(
        sql`(${containsCI(leadsTable.contact, search)} OR ${containsCI(leadsTable.email, search)} OR ${containsCI(leadsTable.businessName, search)})`,
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

router.post("/leads", requireAuth, async (req, res) => {
  try {
    const {
      contact,
      email,
      businessOwner,
      businessName,
      service,
      response,
      followUp,
      leadValue,
      leadAssignee,
      status,
      multiValues,
    } = req.body;

    const mv: Record<string, string[]> =
      typeof multiValues === "object" && multiValues ? { ...multiValues } : {};
    if (contact && !mv.contact) mv.contact = [contact];
    if (email && !mv.email) mv.email = [email];
    if (businessName && !mv.businessName) mv.businessName = [businessName];
    if (businessOwner && !mv.businessOwner) mv.businessOwner = [businessOwner];
    if (service && !mv.service) mv.service = [service];
    if (response && !mv.response) mv.response = [response];

    const insertResult = await db.insert(leadsTable).values({
      contact,
      email,
      businessOwner,
      businessName,
      service,
      response,
      followUp,
      leadValue: leadValue ?? 0,
      leadAssignee,
      status: status ?? "pending",
      ownerId: req.session.userId,
      multiValues: mv,
      customData: {},
    });

    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, extractInsertId(insertResult)))
      .limit(1);

    res.status(201).json(lead);
  } catch (err) {
    req.log.error({ err }, "Create lead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/leads/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const fields = [
      "contact",
      "email",
      "businessOwner",
      "businessName",
      "service",
      "response",
      "followUp",
      "leadValue",
      "leadAssignee",
      "status",
    ];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const [existingLead] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, id))
      .limit(1);

    if (!existingLead) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (req.body.customData && typeof req.body.customData === "object") {
      updates.customData = {
        ...((existingLead.customData as Record<string, unknown> | null) ?? {}),
        ...(req.body.customData as Record<string, unknown>),
      };
    }

    if (req.body.multiValues && typeof req.body.multiValues === "object") {
      const mv = req.body.multiValues as Record<string, string[]>;
      updates.multiValues = {
        ...((existingLead.multiValues as Record<string, string[]> | null) ?? {}),
        ...mv,
      };

      for (const [key, vals] of Object.entries(mv)) {
        if (MULTI_SYNC_COLS.has(key)) {
          const fieldMap: Record<string, string> = {
            businessName: "businessName",
            businessOwner: "businessOwner",
          };
          updates[fieldMap[key] ?? key] =
            Array.isArray(vals) && vals[0] ? vals[0] : null;
        }
      }
    }

    await db.update(leadsTable).set(updates as never).where(eq(leadsTable.id, id));

    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, id))
      .limit(1);

    res.json(lead);
  } catch (err) {
    req.log.error({ err }, "Update lead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
