import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.js";
import { adjustPoints } from "../services/pointsService.js";

export async function listPendingReviews(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const submissions = await prisma.taskSubmission.findMany({
    where: {
      status: "PENDING_REVIEW",
    },
    include: {
      task: true,
      user: true,
    },
  });

  return res.json(submissions);
}

export async function reviewSubmission(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const { submissionId } = req.params;
  const { score, feedback, status } = req.body as { score: number; feedback?: string; status: "APPROVED" | "REJECTED" };

  const submission = await prisma.taskSubmission.findUnique({ where: { id: Number(submissionId) }, include: { user: true, task: true } });
  if (!submission) {
    return res.status(404).json({ message: "提交不存在" });
  }

  const review = await prisma.taskReview.upsert({
    where: { submissionId: submission.id },
    update: {
      score,
      feedback,
      reviewerType: "AI",
    },
    create: {
      submissionId: submission.id,
      score,
      feedback,
      reviewerType: "AI",
    },
  });

  await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: {
      status,
      aiScore: score,
      aiFeedback: feedback,
    },
  });

  if (status === "APPROVED") {
    const change = score >= 80 ? 1 : 0;
    if (change !== 0) {
      await adjustPoints(submission.userId, change, "AI_REVIEW_SCORE", "AI评审加分", {
        submissionId: submission.id,
      });
    }
  }

  return res.json(review);
}
