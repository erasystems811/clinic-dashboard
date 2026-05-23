import { Router, type IRouter } from "express";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { db, callTasksTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const CallOutcomeBody = z.object({ outcome: z.string().min(1) });

router.get("/call-tasks", async (req, res): Promise<void> => {
  const completed = req.query.completed === "true";

  const tasks = await db
    .select()
    .from(callTasksTable)
    .where(completed ? isNotNull(callTasksTable.completedAt) : isNull(callTasksTable.completedAt))
    .orderBy(callTasksTable.flaggedAt);

  res.json(tasks.map((t) => ({
    ...t,
    flaggedAt: t.flaggedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
  })));
});

router.patch("/call-tasks/:id/outcome", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = CallOutcomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .update(callTasksTable)
    .set({ outcome: parsed.data.outcome, completedAt: new Date() })
    .where(eq(callTasksTable.id, id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Call task not found" });
    return;
  }

  res.json({
    ...task,
    flaggedAt: task.flaggedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  });
});

export default router;
