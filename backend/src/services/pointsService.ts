import { prisma } from "../lib/prisma.js";
import { POINT_LIMIT } from "../types/constants.js";

const clampPoints = (points: number) => {
  if (points > POINT_LIMIT) return POINT_LIMIT;
  if (points < 0) return 0;
  return points;
};

export async function adjustPoints(
  userId: number,
  change: number,
  reason: string,
  note?: string,
  metadata?: Record<string, unknown>
) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.pointsAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });

    const newPoints = clampPoints(account.currentPoints + change);

    const updatedAccount = await tx.pointsAccount.update({
      where: { userId },
      data: { currentPoints: newPoints },
    });

    await tx.pointTransaction.create({
      data: {
        userId,
        change,
        reason,
        note,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });

    return updatedAccount;
  });
}

export async function calculateTaskPenalty(
  userId: number,
  submission: { isLate: boolean; submittedAt: Date; task: { scheduledFor: Date; dueAt: Date; id: number } }
) {
  if (!submission.isLate) {
    await adjustPoints(userId, 1, "TASK_SUBMISSION", "按时提交任务奖励", {
      taskId: submission.task.id,
      submissionAt: submission.submittedAt,
    });
  } else {
    await adjustPoints(userId, -1, "TASK_LATE_PENALTY", "逾期提交扣分", {
      taskId: submission.task.id,
      submissionAt: submission.submittedAt,
    });
  }
}

export async function resetWeeklyPoints() {
  const accounts = await prisma.pointsAccount.findMany();
  for (const account of accounts) {
    if (account.currentPoints === 0) continue;
    const difference = -account.currentPoints;
    await adjustPoints(account.userId, difference, "WEEKLY_RESET", "周度积分重置");
  }
}

export async function penalizeExpiredWrongAnswers() {
  const now = new Date();
  const wrongAnswers = await prisma.wrongAnswer.findMany({
    where: {
      isResolved: false,
      penaltyApplied: false,
      correctionDeadline: {
        lt: now,
      },
    },
  });

  for (const wrong of wrongAnswers) {
    await adjustPoints(wrong.userId, -1, "QUIZ_CORRECTION_PENALTY", "错题未按时纠正扣分", {
      wrongAnswerId: wrong.id,
    });

    await prisma.wrongAnswer.update({
      where: { id: wrong.id },
      data: {
        penaltyApplied: true,
      },
    });
  }
}
