import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listWeeklyLeaderboard, requestReward } from "../controllers/rewardController.js";

export const rewardRouter = Router();

rewardRouter.get("/leaderboard", listWeeklyLeaderboard);
rewardRouter.post("/request", requireAuth, requestReward);
