import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, patientsTable, pipelineStagesTable } from "@workspace/db";
import { ListPipelineStagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "New Inquiry", color: "#14b8a6", order: 1 },
  { name: "Consultation", color: "#0ea5e9", order: 2 },
  { name: "Treatment", color: "#f59e0b", order: 3 },
  { name: "Follow-up", color: "#8b5cf6", order: 4 },
  { name: "Discharged", color: "#6b7280", order: 5 },
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
