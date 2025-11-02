import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDailyQuiz, submitDailyQuiz } from "../controllers/quizController.js";

export const quizRouter = Router();

quizRouter.use(requireAuth);

quizRouter.get("/daily", getDailyQuiz);
quizRouter.post("/daily", submitDailyQuiz);
