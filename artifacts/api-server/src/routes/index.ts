import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import companiesRouter from "./companies";
import contactsRouter from "./contacts";
import dealsRouter from "./deals";
import tasksRouter from "./tasks";
import activitiesRouter from "./activities";
import dashboardRouter from "./dashboard";
import leadsRouter from "./leads";
import clientJourneysRouter from "./client-journeys";
import billingsRouter from "./billings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(companiesRouter);
router.use(contactsRouter);
router.use(dealsRouter);
router.use(tasksRouter);
router.use(activitiesRouter);
router.use(dashboardRouter);
router.use(leadsRouter);
router.use(clientJourneysRouter);
router.use(billingsRouter);

export default router;
