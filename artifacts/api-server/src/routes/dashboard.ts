import { Router } from "express";
import { db, contactsTable, companiesTable, dealsTable, tasksTable, activitiesTable, usersTable, contactsTable as ct } from "@workspace/db";
import { eq, count, sum, sql, desc, lte, and, or, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/dashboard/stats
router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [[contactStats], [companyStats], [dealStats], [taskStats], [recentContactStats]] = await Promise.all([
      db.select({ total: count() }).from(contactsTable),
      db.select({ total: count() }).from(companiesTable),
      db.select({
        total: count(),
        open: sql<number>`COUNT(*) FILTER (WHERE ${dealsTable.stage} NOT IN ('closed_won','closed_lost'))`,
        totalValue: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS NUMERIC)), 0)`,
        closedWonValue: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS NUMERIC)) FILTER (WHERE ${dealsTable.stage} = 'closed_won'), 0)`,
      }).from(dealsTable),
      db.select({
        total: count(),
        overdue: sql<number>`COUNT(*) FILTER (WHERE ${tasksTable.dueDate} < NOW() AND ${tasksTable.status} NOT IN ('done','cancelled'))`,
      }).from(tasksTable),
      db.select({ recent: count() }).from(contactsTable).where(gte(contactsTable.createdAt, thirtyDaysAgo)),
    ]);

    const totalDeals = Number(dealStats.total);
    const closedWon = await db.select({ c: count() }).from(dealsTable).where(eq(dealsTable.stage, "closed_won"));
    const conversionRate = totalDeals > 0 ? (Number(closedWon[0]?.c ?? 0) / totalDeals) * 100 : 0;

    res.json({
      totalContacts: Number(contactStats.total),
      totalCompanies: Number(companyStats.total),
      totalDeals,
      openDeals: Number(dealStats.open),
      totalDealValue: Number(dealStats.totalValue),
      closedWonValue: Number(dealStats.closedWonValue),
      totalTasks: Number(taskStats.total),
      overdueTasks: Number(taskStats.overdue),
      recentContacts: Number(recentContactStats.recent),
      conversionRate,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/pipeline
router.get("/dashboard/pipeline", requireAuth, async (req, res) => {
  try {
    const stages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
    const rows = await db
      .select({
        stage: dealsTable.stage,
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(${dealsTable.value} AS NUMERIC)), 0)`,
      })
      .from(dealsTable)
      .groupBy(dealsTable.stage);

    const stageMap = Object.fromEntries(rows.map(r => [r.stage, r]));
    const result = stages.map(stage => ({
      stage,
      count: Number(stageMap[stage]?.count ?? 0),
      totalValue: Number(stageMap[stage]?.totalValue ?? 0),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Pipeline summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/recent-activities
router.get("/dashboard/recent-activities", requireAuth, async (req, res) => {
  try {
    const activities = await db
      .select({
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
      })
      .from(activitiesTable)
      .leftJoin(contactsTable, eq(activitiesTable.contactId, contactsTable.id))
      .leftJoin(dealsTable, eq(activitiesTable.dealId, dealsTable.id))
      .leftJoin(companiesTable, eq(activitiesTable.companyId, companiesTable.id))
      .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
      .orderBy(desc(activitiesTable.occurredAt))
      .limit(20);
    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Recent activities error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/tasks-due
router.get("/dashboard/tasks-due", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        assigneeId: tasksTable.assigneeId,
        assigneeName: usersTable.name,
        contactId: tasksTable.contactId,
        contactName: contactsTable.firstName,
        dealId: tasksTable.dealId,
        dealTitle: dealsTable.title,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .leftJoin(contactsTable, eq(tasksTable.contactId, contactsTable.id))
      .leftJoin(dealsTable, eq(tasksTable.dealId, dealsTable.id))
      .where(
        and(
          lte(tasksTable.dueDate, sevenDaysLater),
          sql`${tasksTable.status} NOT IN ('done','cancelled')`
        )
      )
      .orderBy(tasksTable.dueDate)
      .limit(10);
    res.json(tasks);
  } catch (err) {
    req.log.error({ err }, "Tasks due error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
