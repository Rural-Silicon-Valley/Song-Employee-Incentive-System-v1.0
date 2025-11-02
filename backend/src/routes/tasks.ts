import { Router } from "express";
import { requireAuth, isAdmin } from "../middleware/auth.js";
import { listTodayTasks, createTask, submitTask, listSubmissions, removeTask } from "../controllers/taskController.js";

export const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.get("/today", listTodayTasks);
taskRouter.post("/submit", submitTask);
taskRouter.get("/submissions", listSubmissions);

taskRouter.post("/", isAdmin, createTask);
taskRouter.delete("/:id", isAdmin, removeTask);
