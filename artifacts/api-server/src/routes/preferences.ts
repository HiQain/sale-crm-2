import { Router } from "express";
import { db, userPreferencesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/preferences/:scope
router.get("/preferences/:scope", requireAuth, async (req, res) => {
  try {
    const scope = req.params["scope"] as string;
    const [pref] = await db
      .select()
      .from(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.userId, req.session.userId!),
          eq(userPreferencesTable.scope, scope),
        ),
      )
      .limit(1);
    res.json(pref?.value ?? null);
  } catch (err) {
    req.log.error({ err }, "Get preferences error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/preferences/:scope
router.put("/preferences/:scope", requireAuth, async (req, res) => {
  try {
    const scope = req.params["scope"] as string;
    const value = req.body as Record<string, unknown>;

    const [existing] = await db
      .select({ id: userPreferencesTable.id })
      .from(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.userId, req.session.userId!),
          eq(userPreferencesTable.scope, scope),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(userPreferencesTable)
        .set({ value, updatedAt: new Date() })
        .where(eq(userPreferencesTable.id, existing.id));
    } else {
      await db.insert(userPreferencesTable).values({
        userId: req.session.userId!,
        scope,
        value,
      });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Save preferences error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
