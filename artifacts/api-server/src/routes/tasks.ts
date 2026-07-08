import { Router } from "express";
import { db, tasksTable, contactsTable, dealsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/tasks
router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const { status, priority, assigneeId, contactId, dealId } = req.query as Record<string, string>;
    const conditions = [];
    // Non-admin users only see tasks assigned to them
    if (req.session.role !== "admin") {
      conditions.push(eq(tasksTable.assigneeId, req.session.userId!));
    }
    if (status) conditions.push(eq(tasksTable.status, status));
    if (priority) conditions.push(eq(tasksTable.priority, priority));
    if (assigneeId) conditions.push(eq(tasksTable.assigneeId, parseInt(assigneeId)));
    if (contactId) conditions.push(eq(tasksTable.contactId, parseInt(contactId)));
    if (dealId) conditions.push(eq(tasksTable.dealId, parseInt(dealId)));

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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasksTable.createdAt);
    res.json(tasks);
  } catch (err) {
    req.log.error({ err }, "List tasks error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tasks
router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assigneeId, contactId, dealId } = req.body;
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const [task] = await db
      .insert(tasksTable)
      .values({ title, description, status: status ?? "todo", priority: priority ?? "medium", dueDate, assigneeId, contactId, dealId })
      .returning();
    const full = await getTaskWithJoins(task.id);
    res.status(201).json(full);
  } catch (err) {
    req.log.error({ err }, "Create task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tasks/:id
router.get("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const task = await getTaskWithJoins(id);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    req.log.error({ err }, "Get task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { title, description, status, priority, dueDate, assigneeId, contactId, dealId } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId;
    if (contactId !== undefined) updates.contactId = contactId;
    if (dealId !== undefined) updates.dealId = dealId;
    await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id));
    const task = await getTaskWithJoins(id);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    req.log.error({ err }, "Update task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getTaskWithJoins(id: number) {
  const [task] = await db
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
    .where(eq(tasksTable.id, id))
    .limit(1);
  return task ?? null;
}

export default router;
