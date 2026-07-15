import { Router } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { containsCI, extractInsertId } from "../lib/mysql";

const router = Router();

// GET /api/companies
router.get("/companies", requireAuth, async (req, res) => {
  try {
    const { search, industry } = req.query as Record<string, string>;
    let query = db.select().from(companiesTable).$dynamic();
    if (search) {
      query = query.where(containsCI(companiesTable.name, search));
    }
    if (industry) {
      query = query.where(eq(companiesTable.industry, industry));
    }
    const companies = await query.orderBy(companiesTable.name);
    res.json(companies);
  } catch (err) {
    req.log.error({ err }, "List companies error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/companies
router.post("/companies", requireAuth, async (req, res) => {
  try {
    const { name, industry, website, phone, address, employeeCount, annualRevenue, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const insertResult = await db
      .insert(companiesTable)
      .values({ name, industry, website, phone, address, employeeCount, annualRevenue: annualRevenue?.toString(), notes });
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, extractInsertId(insertResult)))
      .limit(1);
    res.status(201).json(serializeCompany(company));
  } catch (err) {
    req.log.error({ err }, "Create company error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/companies/:id
router.get("/companies/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    res.json(serializeCompany(company));
  } catch (err) {
    req.log.error({ err }, "Get company error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/companies/:id
router.patch("/companies/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, industry, website, phone, address, employeeCount, annualRevenue, notes } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (industry !== undefined) updates.industry = industry;
    if (website !== undefined) updates.website = website;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (employeeCount !== undefined) updates.employeeCount = employeeCount;
    if (annualRevenue !== undefined) updates.annualRevenue = annualRevenue?.toString();
    if (notes !== undefined) updates.notes = notes;
    await db.update(companiesTable).set(updates).where(eq(companiesTable.id, id));
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    res.json(serializeCompany(company));
  } catch (err) {
    req.log.error({ err }, "Update company error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/companies/:id
router.delete("/companies/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(companiesTable).where(eq(companiesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete company error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function serializeCompany(c: typeof companiesTable.$inferSelect) {
  return {
    ...c,
    annualRevenue: c.annualRevenue != null ? parseFloat(c.annualRevenue) : null,
  };
}

export default router;
