import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.js";
import { DAILY_QUIZ_COUNT, REQUIRED_CORRECT_FOR_BONUS } from "../types/constants.js";
import { adjustPoints } from "../services/pointsService.js";
import { isSameDay } from "date-fns";

export async function getDailyQuiz(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const today = new Date();
  const answered = await prisma.examSession.findUnique({
    where: {
      userId_sessionDate: {
        userId: req.user.id,
        sessionDate: today,
      },
    },
    include: {
      answers: {
        include: { question: true },
      },
    },
  });

  if (answered) {
    return res.json({ questions: answered.answers.map((a) => a.question), completed: true });
  }

  const questions = await prisma.examQuestion.findMany({
    orderBy: {
      createdAt: "asc",
    },
    take: DAILY_QUIZ_COUNT,
  });

  return res.json({ questions, completed: false });
}

export async function submitDailyQuiz(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const { answers } = req.body as { answers: Array<{ questionId: number; selectedOption: number }> };
  if (!answers || answers.length !== DAILY_QUIZ_COUNT) {
    return res.status(400).json({ message: "答案数量不正确" });
  }

  const today = new Date();
  const existing = await prisma.examSession.findUnique({
    where: {
      userId_sessionDate: {
        userId: req.user.id,
        sessionDate: today,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ message: "今日已答题" });
  }

  const questions = await prisma.examQuestion.findMany({ where: { id: { in: answers.map((a) => a.questionId) } } });

  const session = await prisma.examSession.create({
    data: {
      userId: req.user.id,
      sessionDate: today,
      totalQuestions: DAILY_QUIZ_COUNT,
      correctCount: 0,
      score: 0,
    },
  });

  let correctCount = 0;
  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const isCorrect = question.correctOptionIndex === answer.selectedOption;
    if (isCorrect) correctCount += 1;

    const examAnswer = await prisma.examAnswer.create({
      data: {
        sessionId: session.id,
        questionId: question.id,
        userId: req.user.id,
        selectedOption: answer.selectedOption,
        isCorrect,
      },
    });

    if (!isCorrect) {
      await prisma.wrongAnswer.create({
        data: {
          userId: req.user.id,
          questionId: question.id,
          answerId: examAnswer.id,
          correctionDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          correctionText: question.explanationText,
          correctionVideoUrl: question.explanationVideoUrl,
        },
      });
    }
  }

  const score = Math.round((correctCount / DAILY_QUIZ_COUNT) * 100);

  await prisma.examSession.update({
    where: { id: session.id },
    data: {
      correctCount,
      score,
    },
  });

  if (correctCount >= REQUIRED_CORRECT_FOR_BONUS) {
    await adjustPoints(req.user.id, 1, "QUIZ_SCORE", "每日考题奖励", {
      correctCount,
    });
  }

  return res.json({ correctCount, score });
}
