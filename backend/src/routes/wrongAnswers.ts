import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listWrongAnswers, updateWrongAnswer } from "../controllers/wrongAnswerController.js";

export const wrongAnswerRouter = Router();

wrongAnswerRouter.use(requireAuth);
wrongAnswerRouter.get("/", listWrongAnswers);
wrongAnswerRouter.patch("/:wrongAnswerId", updateWrongAnswer);
