import { Router, type IRouter } from "express";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { db, callTasksTable, activityTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const CallOutcomeBody = z.object({
  outcome: z.string().min(1),
  actionType: z.string().optional(),
});

const UpdateActionTypeBody = z.object({
  actionType: z.enum(["automated_message", "manual_text", "manual_call"]),
});

function serializeTask(t: typeof callTasksTable.$inferSelect) {
  return {
    ...t,
    flaggedAt: t.flaggedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
  };
}

router.get("/call-tasks", async (req, res): Promise<void> => {
  const completed = req.query.completed === "true";

  const tasks = await db
    .select()
    .from(callTasksTable)
    .where(completed ? isNotNull(callTasksTable.completedAt) : isNull(callTasksTable.completedAt))
    .orderBy(callTasksTable.flaggedAt);

  res.json(tasks.map(serializeTask));
});

// PATCH /call-tasks/:id/outcome — log the outcome and complete the task
router.patch("/call-tasks/:id/outcome", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CallOutcomeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [task] = await db
    .update(callTasksTable)
    .set({ outcome: parsed.data.outcome, completedAt: new Date() })
    .where(eq(callTasksTable.id, id))
    .returning();

  if (!task) { res.status(404).json({ error: "Call task not found" }); return; }

  await db.insert(activityTable).values({
    type: "call_task_completed",
    description: `Call task completed for ${task.patientName} (${task.actionType}): ${parsed.data.outcome}`,
    patientId: task.patientId,
    patientName: task.patientName,
    metadata: parsed.data.outcome,
  });

  res.json(serializeTask(task));
});

// PATCH /call-tasks/:id/action-type — change the follow-up method
router.patch("/call-tasks/:id/action-type", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateActionTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [task] = await db
    .update(callTasksTable)
    .set({ actionType: parsed.data.actionType })
    .where(eq(callTasksTable.id, id))
    .returning();

  if (!task) { res.status(404).json({ error: "Call task not found" }); return; }

  await db.insert(activityTable).values({
    type: "call_task_action_updated",
    description: `Follow-up method changed to ${parsed.data.actionType} for ${task.patientName}`,
    patientId: task.patientId,
    patientName: task.patientName,
    metadata: parsed.data.actionType,
  });

  res.json(serializeTask(task));
});

export default router;
