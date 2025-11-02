import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.js";
import { userRouter } from "./routes/user.js";
import { taskRouter } from "./routes/tasks.js";
import { quizRouter } from "./routes/quiz.js";
import { rewardRouter } from "./routes/rewards.js";
import { reviewRouter } from "./routes/reviews.js";
import { wrongAnswerRouter } from "./routes/wrongAnswers.js";
import { authExRouter } from "./routes/authEx.js";
import { scheduleJobs } from "./services/scheduler.js";
import { devToolsRouter } from "./routes/devTools.js";
import { activityRouter } from "./routes/activity.js";
import { inboxRouter } from "./routes/inbox.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/auth-ex", authExRouter);
app.use("/api/users", userRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/quizzes", quizRouter);
app.use("/api/rewards", rewardRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/wrong-answers", wrongAnswerRouter);
app.use("/api/dev", devToolsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/inbox", inboxRouter);

app.get("/api/health", async (_req, res) => {
  const dbCheck = await prisma.user.count().catch(() => null);
  res.json({
    status: "ok",
    database: dbCheck !== null,
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  scheduleJobs();
});
