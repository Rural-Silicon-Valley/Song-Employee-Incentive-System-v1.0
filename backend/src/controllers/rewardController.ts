import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../middleware/auth.js";
import { startOfWeek, endOfWeek } from "date-fns";

export async function listWeeklyLeaderboard(_req: Request, res: Response) {
  const summaries = await prisma.weeklySummary.findMany({
    orderBy: { generatedAt: "desc" },
    take: 10,
  });

  return res.json(
    summaries.map((summary) => ({
      id: summary.id,
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      leaderboard: JSON.parse(summary.leaderboard),
    }))
  );
}

export async function requestReward(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // 获取最近的周榜
  const latestSummary = await prisma.weeklySummary.findFirst({
    where: {
      weekStart: {
        gte: weekStart,
      },
      weekEnd: {
        lte: weekEnd,
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  if (!latestSummary) {
    return res.status(400).json({ message: "暂无周榜数据" });
  }

  const leaderboard = JSON.parse(latestSummary.leaderboard) as Array<{ userId: number; points: number; displayName: string }>;
  const rank = leaderboard.findIndex((entry) => entry.userId === req.user!.id);

  if (rank === -1 || rank > 2) {
    return res.status(403).json({ message: "仅周榜前三可申请奖励" });
  }

  const existing = await prisma.rewardRequest.findUnique({
    where: {
      userId_weekStart: {
        userId: req.user.id,
        weekStart: weekStart,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ message: "已提交奖励申请" });
  }

  const request = await prisma.rewardRequest.create({
    data: {
      userId: req.user.id,
      weekStart,
      pointsAtRequest: leaderboard[rank].points,
      rewardOption: req.body.rewardOption,
    },
  });

  return res.status(201).json(request);
}
