import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import pipelineRouter from "./pipeline";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import activityRouter from "./activity";
import queueRouter from "./queue";
import callTasksRouter from "./call-tasks";
import departmentsRouter from "./departments";
import feedbackRouter from "./feedback";
import wellnessRouter from "./wellness";
import messagesRouter from "./messages";
import superAdminRouter from "./super-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(patientsRouter);
router.use(pipelineRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(activityRouter);
router.use(queueRouter);
router.use(callTasksRouter);
router.use(departmentsRouter);
router.use(feedbackRouter);
router.use(wellnessRouter);
router.use(messagesRouter);
router.use(superAdminRouter);

export default router;
