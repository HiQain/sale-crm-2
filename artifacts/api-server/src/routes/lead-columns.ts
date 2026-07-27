import { Router } from "express";
import { db, leadCustomColumnsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { extractInsertId } from "../lib/mysql";

const router = Router();

function toFieldKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

const VALID_TYPES = ["text", "number", "date"] as const;
type ColType = (typeof VALID_TYPES)[number];

function sanitizeType(t: unknown): ColType {
  return VALID_TYPES.includes(t as ColType) ? (t as ColType) : "text";
}

router.get("/leads/columns", requireAuth, async (req, res) => {
  try {
    const cols = await db
      .select()
      .from(leadCustomColumnsTable)
      .orderBy(leadCustomColumnsTable.position, leadCustomColumnsTable.id);
    res.json(cols);
  } catch (err) {
    req.log.error({ err }, "List lead columns error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leads/columns", requireAuth, async (req, res) => {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Admins only" });
    return;
  }

  try {
    const { name, type } = req.body as { name: string; type?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    let fieldKey = toFieldKey(name);
    if (!fieldKey) fieldKey = `col_${Date.now()}`;

    const existing = await db
      .select({ fieldKey: leadCustomColumnsTable.fieldKey })
      .from(leadCustomColumnsTable);
    const keys = new Set(existing.map((row: (typeof existing)[number]) => row.fieldKey));
    let candidate = fieldKey;
    let suffix = 2;
    while (keys.has(candidate)) {
      candidate = `${fieldKey}_${suffix++}`;
    }

    const [maxPos] = await db
      .select({ max: sql<number>`coalesce(max(position), 0)` })
      .from(leadCustomColumnsTable);

    const insertResult = await db.insert(leadCustomColumnsTable).values({
      name: name.trim(),
      fieldKey: candidate,
      position: (maxPos?.max ?? 0) + 1,
      type: sanitizeType(type),
    });

    const [col] = await db
      .select()
      .from(leadCustomColumnsTable)
      .where(eq(leadCustomColumnsTable.id, extractInsertId(insertResult)))
      .limit(1);

    res.status(201).json(col);
  } catch (err) {
    req.log.error({ err }, "Create lead column error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/leads/columns/:id", requireAuth, async (req, res) => {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Admins only" });
    return;
  }

  try {
    const id = parseInt(req.params["id"] as string);
    const { name, type } = req.body as { name?: string; type?: string };
    const patch: { name?: string; type?: ColType } = {};

    if (name?.trim()) patch.name = name.trim();
    if (type) patch.type = sanitizeType(type);

    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "name or type is required" });
      return;
    }

    await db.update(leadCustomColumnsTable).set(patch).where(eq(leadCustomColumnsTable.id, id));
    const [col] = await db
      .select()
      .from(leadCustomColumnsTable)
      .where(eq(leadCustomColumnsTable.id, id))
      .limit(1);

    if (!col) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(col);
  } catch (err) {
    req.log.error({ err }, "Update lead column error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/leads/columns/:id", requireAuth, async (req, res) => {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Admins only" });
    return;
  }

  try {
    const id = parseInt(req.params["id"] as string);
    const [col] = await db
      .select()
      .from(leadCustomColumnsTable)
      .where(eq(leadCustomColumnsTable.id, id))
      .limit(1);

    if (!col) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db.execute(
      sql`UPDATE leads SET custom_data = JSON_REMOVE(custom_data, ${`$.${col.fieldKey}`})`,
    );

    await db.delete(leadCustomColumnsTable).where(eq(leadCustomColumnsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete lead column error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
