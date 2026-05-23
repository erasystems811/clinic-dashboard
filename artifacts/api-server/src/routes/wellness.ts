import { Router, type IRouter } from "express";
import { db, wellnessNewsletterTable } from "@workspace/db";
import { z } from "zod/v4";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const UpsertNewsletterBody = z.object({
  content: z.string().min(1),
  weekOf: z.string().min(1),
});

const MarkSentBody = z.object({ id: z.number().int() });

function weekOfDate(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

router.get("/wellness", async (req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(wellnessNewsletterTable)
    .orderBy(desc(wellnessNewsletterTable.updatedAt));

  res.json(entries.map(e => ({
    ...e,
    updatedAt: e.updatedAt.toISOString(),
    lastSentAt: e.lastSentAt?.toISOString() ?? null,
  })));
});

// GET current week's newsletter
router.get("/wellness/current", async (req, res): Promise<void> => {
  const weekOf = weekOfDate(new Date());
  const [entry] = await db
    .select()
    .from(wellnessNewsletterTable)
    .where(eq(wellnessNewsletterTable.weekOf, weekOf));

  if (!entry) {
    res.json(null);
    return;
  }

  res.json({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
    lastSentAt: entry.lastSentAt?.toISOString() ?? null,
  });
});

// PUT /wellness — create or update the current week's newsletter
router.put("/wellness", async (req, res): Promise<void> => {
  const parsed = UpsertNewsletterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db
    .select()
    .from(wellnessNewsletterTable)
    .where(eq(wellnessNewsletterTable.weekOf, parsed.data.weekOf));

  let entry;
  if (existing.length > 0) {
    [entry] = await db
      .update(wellnessNewsletterTable)
      .set({ content: parsed.data.content })
      .where(eq(wellnessNewsletterTable.weekOf, parsed.data.weekOf))
      .returning();
  } else {
    [entry] = await db
      .insert(wellnessNewsletterTable)
      .values(parsed.data)
      .returning();
  }

  res.json({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
    lastSentAt: entry.lastSentAt?.toISOString() ?? null,
  });
});

// POST /wellness/:id/send — mark as sent
router.post("/wellness/:id/send", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [entry] = await db
    .update(wellnessNewsletterTable)
    .set({ lastSentAt: new Date() })
    .where(eq(wellnessNewsletterTable.id, id))
    .returning();

  if (!entry) { res.status(404).json({ error: "Newsletter not found" }); return; }

  res.json({
    ...entry,
    updatedAt: entry.updatedAt.toISOString(),
    lastSentAt: entry.lastSentAt?.toISOString() ?? null,
  });
});

export default router;
