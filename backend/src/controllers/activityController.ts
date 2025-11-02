import { Request, Response } from "express";
import { startOfDay } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { heartbeatSchema } from "../validators/activitySchemas.js";
import { AuthRequest } from "../middleware/auth.js";

export async function heartbeatController(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "未登录" });
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "输入错误", errors: parsed.error.flatten() });
  const minutes = parsed.data.minutes ?? 1;
  const today = startOfDay(new Date());
  const existing = await (prisma as any).dailyActivity.findUnique({ where: { userId_date: { userId: req.user.id, date: today } } }).catch(() => null);
  if (existing) {
    await (prisma as any).dailyActivity.update({ where: { userId_date: { userId: req.user.id, date: today } }, data: { minutes: { increment: minutes } } });
  } else {
    await (prisma as any).dailyActivity.create({ data: { userId: req.user.id, date: today, minutes } });
  }
  return res.json({ ok: true });
}
