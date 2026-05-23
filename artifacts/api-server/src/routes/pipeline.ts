import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, patientsTable, pipelineStagesTable } from "@workspace/db";
import { ListPipelineStagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "Booked",         color: "#14b8a6", order: 1 },
  { name: "Queued",         color: "#f59e0b", order: 2 },
  { name: "In Care",        color: "#3b82f6", order: 3 },
  { name: "Post Treatment", color: "#8b5cf6", order: 4 },
  { name: "Post Care",      color: "#06b6d4", order: 5 },
  { name: "Dormant",        color: "#6b7280", order: 6 },
];

async function ensureStagesExist() {
  const existing = await db.select().from(pipelineStagesTable);
  if (existing.length === 0) {
    await db.insert(pipelineStagesTable).values(DEFAULT_STAGES);
  }
}

router.get("/pipeline/stages", async (req, res): Promise<void> => {
  await ensureStagesExist();

  const stages = await db.select().from(pipelineStagesTable).orderBy(pipelineStagesTable.order);

  const counts = await db
    .select({
      stage: patientsTable.stage,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(patientsTable)
    .groupBy(patientsTable.stage);

  const countMap = Object.fromEntries(counts.map(c => [c.stage, c.count]));

  const result = stages.map(s => ({
    ...s,
    count: countMap[s.name] ?? 0,
  }));

  res.json(ListPipelineStagesResponse.parse(result));
});

export default router;
