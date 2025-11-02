import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const updateWrongAnswerSchema = z.object({
  correctionText: z.string().optional(),
  correctionVideoUrl: z.string().url().optional(),
  isResolved: z.boolean().optional(),
});

export async function listWrongAnswers(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const wrongAnswers = await prisma.wrongAnswer.findMany({
    where: { userId: req.user.id },
    include: {
      question: true,
      answer: true,
    },
    orderBy: { recordedAt: "desc" },
  });

  return res.json(wrongAnswers);
}

export async function updateWrongAnswer(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const parseResult = updateWrongAnswerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "输入格式错误", errors: parseResult.error.flatten() });
  }

  const { wrongAnswerId } = req.params;
  const wrongAnswer = await prisma.wrongAnswer.findUnique({ where: { id: Number(wrongAnswerId) } });
  if (!wrongAnswer || wrongAnswer.userId !== req.user.id) {
    return res.status(404).json({ message: "错题不存在" });
  }

  const data = parseResult.data;

  const updated = await prisma.wrongAnswer.update({
    where: { id: wrongAnswer.id },
    data: {
      correctionText: data.correctionText,
      correctionVideoUrl: data.correctionVideoUrl,
      isResolved: data.isResolved ?? wrongAnswer.isResolved,
      resolvedAt: data.isResolved ? new Date() : wrongAnswer.resolvedAt,
    },
  });

  return res.json(updated);
}
