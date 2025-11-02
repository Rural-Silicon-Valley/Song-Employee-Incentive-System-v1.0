import { Router } from "express";
import { heartbeatController } from "../controllers/activityController.js";
import { requireAuth } from "../middleware/auth.js";

export const activityRouter = Router();

activityRouter.post("/heartbeat", requireAuth, heartbeatController);
