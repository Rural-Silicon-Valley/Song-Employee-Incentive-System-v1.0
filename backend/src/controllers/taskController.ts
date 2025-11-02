import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.js";
import { calculateTaskPenalty } from "../services/pointsService.js";
import { startOfDay, endOfDay } from "date-fns";
import { z } from "zod";
import { evaluateSubmission } from "../services/aiEvaluator.js";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledFor: z.coerce.date(),
  dueAt: z.coerce.date(),
});

const submitTaskSchema = z.object({
  taskId: z.number().int(),
  content: z.string().min(1),
  submittedAt: z.coerce.date().optional(),
});

export async function listTodayTasks(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const today = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      scheduledFor: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
    include: {
      submissions: {
        where: { userId: req.user.id },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return res.json(tasks);
}

export async function createTask(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式错误", errors: parseResult.error.flatten() });
  }

  const { title, description, scheduledFor, dueAt } = parseResult.data;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      scheduledFor: new Date(scheduledFor),
      dueAt: new Date(dueAt),
      createdById: req.user.id,
    },
  });

  return res.status(201).json(task);
}

export async function submitTask(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const parseResult = submitTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式错误", errors: parseResult.error.flatten() });
  }

  const { taskId, content, submittedAt } = parseResult.data;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return res.status(404).json({ message: "任务不存在" });
  }

  const submissionTime = submittedAt ? new Date(submittedAt) : new Date();
  const isLate = submissionTime > task.dueAt;

  const submission = await prisma.taskSubmission.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId: req.user.id,
      },
    },
    update: {
      content,
      submittedAt: submissionTime,
      isLate,
      status: "PENDING_REVIEW",
    },
    create: {
      taskId,
      userId: req.user.id,
      content,
      submittedAt: submissionTime,
      isLate,
    },
    include: {
      task: true,
    },
  });

  await calculateTaskPenalty(req.user.id, submission);

  // 内置AI评估（无外部依赖，基于启发式规则）
  const evaluation = evaluateSubmission(content);
  await prisma.taskReview.upsert({
    where: { submissionId: submission.id },
    update: {
      reviewerType: "AI",
      score: evaluation.score,
      feedback: evaluation.feedback,
    },
    create: {
      submissionId: submission.id,
      reviewerType: "AI",
      score: evaluation.score,
      feedback: evaluation.feedback,
    },
  });

  await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: {
      status: evaluation.status,
      aiScore: evaluation.score,
      aiFeedback: evaluation.feedback,
    },
  });

  return res.status(201).json(submission);
}

export async function listSubmissions(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const submissions = await prisma.taskSubmission.findMany({
    where: {
      userId: req.user.id,
    },
    include: {
      task: true,
      review: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return res.json(submissions);
}

export async function removeTask(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id: Number(id) } });
  if (!task) {
    return res.status(404).json({ message: "任务不存在" });
  }

  await prisma.task.delete({ where: { id: task.id } });
  return res.status(204).send();
}
