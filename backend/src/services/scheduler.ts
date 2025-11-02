import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { adjustPoints, resetWeeklyPoints, penalizeExpiredWrongAnswers } from "./pointsService.js";
import { Roles } from "../types/roles.js";
import { startOfWeek, endOfWeek, startOfDay, subDays } from "date-fns";

export function scheduleJobs() {
  // 每日 00:30 扫描连续 3 天活跃不足 10 分钟的用户，禁用令牌
  cron.schedule("30 0 * * *", async () => {
    const today = startOfDay(new Date());
    const d1 = subDays(today, 1);
    const d2 = subDays(today, 2);
    const d3 = subDays(today, 3);

  const activities = await (prisma as any).dailyActivity.findMany({
      where: { date: { in: [d1, d2, d3] } },
    }).catch(() => [] as any[]);

    // map: userId -> map(date->minutes)
    const byUser: Record<number, Record<string, number>> = {};
    for (const a of activities as any[]) {
      byUser[a.userId] ||= {};
      byUser[a.userId][new Date(a.date).toISOString()] = a.minutes;
    }

    const employees = await prisma.user.findMany({ where: { role: Roles.EMPLOYEE } });
    for (const u of employees as any[]) {
      const m1 = byUser[u.id]?.[d1.toISOString()] ?? 0;
      const m2 = byUser[u.id]?.[d2.toISOString()] ?? 0;
      const m3 = byUser[u.id]?.[d3.toISOString()] ?? 0;
      const inactive3Days = m1 < 10 && m2 < 10 && m3 < 10;
      if (inactive3Days && !u.tokenDisabledAt) {
        await prisma.user.update({ where: { id: u.id }, data: { tokenDisabledAt: new Date(), tokenDisabledReason: "三天不活跃自动禁用" } as any });
      }
    }
  });
  // 每晚检查未提交任务扣分
  cron.schedule("0 22 * * *", async () => {
    const today = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        scheduledFor: {
          lte: today,
        },
      },
      include: {
        submissions: true,
      },
    });

    for (const task of tasks) {
      const users = await prisma.user.findMany({ where: { role: Roles.EMPLOYEE } });
      for (const user of users) {
        const submitted = task.submissions.some((submission) => submission.userId === user.id);
        if (!submitted && task.dueAt < today) {
          await adjustPoints(user.id, -1, "DAILY_MISSED_PENALTY", "未按时提交任务扣分", {
            taskId: task.id,
          });
        }
      }
    }
  });

  // 每天检查错题惩罚
  cron.schedule("0 21 * * *", async () => {
    await penalizeExpiredWrongAnswers();
  });

  // 每周刷新排行
  cron.schedule("0 23 * * 0", async () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const employees = await prisma.user.findMany({
      where: { role: Roles.EMPLOYEE },
      include: {
        pointsAccount: true,
      },
    });

    const ranking = employees
      .map((user) => ({
        userId: user.id,
        displayName: user.displayName,
        points: user.pointsAccount?.currentPoints ?? 0,
      }))
      .sort((a, b) => b.points - a.points);

    await prisma.weeklySummary.create({
      data: {
        weekStart,
        weekEnd,
        leaderboard: JSON.stringify(ranking),
      },
    });

    const topThree = ranking.slice(0, 3);
    for (const [index, entry] of topThree.entries()) {
      if (entry.points <= 0) continue;
      await adjustPoints(entry.userId, 1, "RANKING_BONUS", "周榜奖励", {
        rank: index + 1,
      });
    }

    await resetWeeklyPoints();
  });
}
