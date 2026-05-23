import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import pipelineRouter from "./pipeline";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(patientsRouter);
router.use(pipelineRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(activityRouter);

export default router;
