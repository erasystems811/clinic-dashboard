import { Router, type IRouter } from "express";
import { db, feedbackTable } from "@workspace/db";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const CreateFeedbackBody = z.object({
  patientId: z.number().int().optional(),
  patientName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

router.get("/feedback", async (req, res): Promise<void> => {
  const entries = await db.select().from(feedbackTable).orderBy(feedbackTable.submittedAt);

  const [stats] = await db
    .select({
      avgRating: sql<number>`round(avg(rating)::numeric, 1)`,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(feedbackTable);

  res.json({
    entries: entries.map(e => ({ ...e, submittedAt: e.submittedAt.toISOString() })),
    avgRating: Number(stats.avgRating) || 0,
    total: stats.total,
  });
});

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [entry] = await db.insert(feedbackTable).values(parsed.data).returning();
  res.status(201).json({ ...entry, submittedAt: entry.submittedAt.toISOString() });
});

export default router;
