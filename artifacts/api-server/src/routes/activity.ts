import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, activityTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const limit = query.data.limit ?? 20;

  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(limit);

  res.json(ListActivityResponse.parse(activities.map(a => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }))));
});

export default router;
